import { ORBITAL, REINFORCE } from '../data/abilities';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import {
  ATTACK_ANIM_TIME,
  EARLY_COOLDOWN_PER_SEC,
  EARLY_GOLD_PER_SEC,
  FIXED_DT,
  LATERAL_OFFSET,
  MAX_TOWER_LEVEL,
  RALLY_PATH_TOLERANCE,
} from '../data/rules';
import { SPECS, SPEC_TUNING, specCost } from '../data/specs';
import { BOMB, KNIGHT, TOWERS, splashFactor } from '../data/towers';
import { emptyUpgrades, resolveModifiers, type Modifiers } from '../data/upgrades';
import { deriveSpots, levelHeight, levelWidth, validateLevel, waveGapOf } from '../level';
import { starsForLives } from '../progress';
import { Rng } from '../rng';
import type {
  BuildSpot,
  BurnState,
  CommandResult,
  DamageType,
  EnemyId,
  EnemyState,
  HitSource,
  KnightKind,
  KnightState,
  LevelDef,
  ProjectileKind,
  ProjectileState,
  SimEvent,
  SimState,
  SimStats,
  SpecId,
  SpawnSource,
  StrikeState,
  TowerCap,
  TowerKind,
  TowerState,
  UpgradeState,
  Vec2,
  WavePreview,
  WavePreviewEntry,
  WaveState,
} from '../types';
import { buildPath, nearestOnPaths, pointAt, type NearestResult, type PathInfo, type PathPoint } from './path';
import { calcDamage, resolveTowerStats, sellValue, type TowerStatsView } from './stats';

export interface SimOptions {
  /** RNG seed (default 1). Same seed + same commands at the same ticks => identical simulation. */
  seed?: number;
  /** Purchased star-tree tiers (default none). */
  upgrades?: UpgradeState;
  /** Overrides `level.towerCap`. */
  towerCap?: TowerCap;
  /** Overrides `level.specsUnlocked` (tests / tools). */
  specs?: boolean;
  /** Set false to skip recording events (e.g. headless balance runs). Default true. */
  events?: boolean;
}

// ---- internal mutable entity types ----

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface TowerRt extends Omit<Mutable<TowerState>, 'knightIds'> {
  knightIds: number[];
  attackAnim: number;
}

interface KnightRt extends Mutable<KnightState> {
  shootAnim: number;
  offX: number;
  offY: number;
  dmgMin: number;
  dmgMax: number;
  attackCd: number;
  attackTimer: number;
  attackAnim: number;
  regenRate: number;
  respawnTime: number;
  removed: boolean;
}

interface EnemyRt extends Omit<Mutable<EnemyState>, 'engagedBy'> {
  engagedBy: number[];
  attackAnim: number;
}

type ProjectileRt = Mutable<ProjectileState>;
type StrikeRt = Mutable<StrikeState>;
type BurnRt = Mutable<BurnState>;

interface StateRt {
  status: SimState['status'];
  time: number;
  gold: number;
  lives: number;
  maxLives: number;
  wave: Mutable<WaveState>;
  towers: TowerRt[];
  knights: KnightRt[];
  enemies: EnemyRt[];
  projectiles: ProjectileRt[];
  strikes: StrikeRt[];
  burns: BurnRt[];
  abilities: {
    orbital: Mutable<SimState['abilities']['orbital']>;
    reinforce: Mutable<SimState['abilities']['reinforce']>;
  };
  boss: Mutable<NonNullable<SimState['boss']>> | null;
  stars: number;
  stats: Mutable<SimStats>;
}

interface WaveRuntime {
  time: number;
  spawned: number[];
}

const EPS = 1e-9;

export class Sim {
  readonly level: LevelDef;
  readonly spots: readonly BuildSpot[];
  readonly paths: readonly PathInfo[];
  readonly upgrades: UpgradeState;
  readonly modifiers: Modifiers;
  readonly towerCap: TowerCap;
  /** True if tower specializations can be bought on this level (`LevelDef.specsUnlocked`, or `SimOptions.specs`). */
  readonly specsUnlocked: boolean;
  readonly width: number;
  readonly height: number;

  private readonly s: StateRt;
  private readonly rng: Rng;
  private readonly recordEvents: boolean;
  private events: SimEvent[] = [];
  private nextId = 1;
  private waveRt: WaveRuntime | null = null;
  private readonly waveGap: number;
  private readonly towerBySpot = new Map<number, TowerRt>();
  private readonly towerById = new Map<number, TowerRt>();
  private readonly enemyById = new Map<number, EnemyRt>();
  private readonly knightById = new Map<number, KnightRt>();
  private readonly towerStats = new Map<number, TowerStatsView>();
  private readonly tmpPt: PathPoint = { x: 0, y: 0, dx: 1, dy: 0 };

  constructor(level: LevelDef, options: SimOptions = {}) {
    const errs = validateLevel(level);
    if (errs.length > 0) throw new Error(`Invalid level:\n${errs.join('\n')}`);
    this.level = level;
    this.spots = deriveSpots(level);
    this.paths = level.paths.map((p, i) => buildPath(i, p));
    this.upgrades = { ...emptyUpgrades(), ...(options.upgrades ?? {}) };
    this.modifiers = resolveModifiers(this.upgrades);
    this.towerCap = { ...(options.towerCap ?? level.towerCap) };
    this.specsUnlocked = options.specs ?? level.specsUnlocked ?? false;
    this.width = levelWidth(level);
    this.height = levelHeight(level);
    this.rng = new Rng(options.seed ?? 1);
    this.recordEvents = options.events ?? true;
    this.waveGap = waveGapOf(level);

    const m = this.modifiers;
    const orbCd = Math.max(1, ORBITAL.cooldown - m.orbitalCooldownReduction);
    const reiCd = Math.max(1, REINFORCE.cooldown - m.reinforceCooldownReduction);
    this.s = {
      status: 'pre',
      time: 0,
      gold: level.startGold,
      lives: level.lives,
      maxLives: level.lives,
      wave: {
        index: 0,
        total: level.waves.length,
        spawning: false,
        countdown: null,
        countdownMax: this.waveGap,
        next: this.preview(0),
        earlyBonus: 0,
      },
      towers: [],
      knights: [],
      enemies: [],
      projectiles: [],
      strikes: [],
      burns: [],
      abilities: {
        orbital: {
          cooldown: 0,
          cooldownMax: orbCd,
          ready: true,
          radius: ORBITAL.radius * m.orbitalRadiusMult,
          damage: ORBITAL.damage * m.orbitalDamageMult,
          delay: ORBITAL.delay,
          burn: m.orbitalBurn,
        },
        reinforce: {
          cooldown: 0,
          cooldownMax: reiCd,
          ready: true,
          pathRange: REINFORCE.pathRange,
          count: REINFORCE.count + m.reinforceExtraCount,
          duration: m.reinforceDuration > 0 ? m.reinforceDuration : REINFORCE.duration,
          hp: REINFORCE.hp * m.reinforceHpMult,
        },
      },
      boss: null,
      stars: 0,
      stats: { kills: 0, leaked: 0, spawned: 0, goldEarned: 0, goldSpent: 0 },
    };
  }

  // =========================================================================================
  // Public read API
  // =========================================================================================

  /** Live read-only snapshot. Mutated in place by `step`; entities keep stable ids. */
  get state(): SimState {
    return this.s;
  }

  /** Returns and clears all events emitted since the last call. */
  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  getTower(id: number): TowerState | undefined {
    return this.towerById.get(id);
  }

  getEnemy(id: number): EnemyState | undefined {
    const e = this.enemyById.get(id);
    return e && !e.dead ? e : undefined;
  }

  getKnight(id: number): KnightState | undefined {
    return this.knightById.get(id);
  }

  towerAtSpot(spotId: number): TowerState | undefined {
    return this.towerBySpot.get(spotId);
  }

  /**
   * Stats (with star-tree modifiers) of a tower kind at a level, for tooltips. Pass `spec` to preview a specialization
   * (only meaningful at level 3; ignored for a spec of another kind).
   */
  statsFor(kind: TowerKind, level: number, spec: SpecId | null = null): TowerStatsView {
    return resolveTowerStats(kind, level, this.modifiers, spec);
  }

  /** Current stats of a built tower (level, star tree and specialization included). */
  statsOf(towerId: number): TowerStatsView | undefined {
    return this.towerStats.get(towerId);
  }

  /** Gold cost of a specialization (not discounted by the star tree). */
  specCostOf(specId: SpecId): number {
    return specCost(specId);
  }

  /** Gold cost to build a tower of this kind (level 1). */
  costOf(kind: TowerKind): number {
    return this.statsFor(kind, 1).cost;
  }

  /** Gold to upgrade this tower to its next level, or null at max level. */
  upgradeCostOf(towerId: number): number | null {
    const t = this.towerById.get(towerId);
    if (!t || t.level >= MAX_TOWER_LEVEL) return null;
    return this.statsFor(t.kind, t.level + 1).cost;
  }

  sellValueOf(towerId: number): number {
    const t = this.towerById.get(towerId);
    return t ? sellValue(t.invested) : 0;
  }

  canAfford(amount: number): boolean {
    return this.s.gold >= amount;
  }

  /** Preview of wave `index0` (0-based), or null if out of range. */
  wavePreview(index0: number): WavePreview | null {
    return this.preview(index0);
  }

  /** Nearest point on any in-map enemy path (for validating ability / rally targets in the UI). */
  nearestPathPoint(p: Vec2): NearestResult | null {
    return nearestOnPaths(this.paths, p, this.width, this.height);
  }

  /** Total number of simulated ticks' worth of seconds: convenience for tests/tools. */
  runFor(seconds: number, dt: number = FIXED_DT): void {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) this.step(dt);
  }

  // =========================================================================================
  // Commands
  // =========================================================================================

  canBuild(spotId: number, kind: TowerKind): CommandResult {
    if (this.ended()) return fail('ended');
    if (!this.spots[spotId]) return fail('no_spot');
    if (this.towerBySpot.has(spotId)) return fail('occupied');
    if (this.towerCap[kind] < 1) return fail('capped');
    if (this.s.gold < this.costOf(kind)) return fail('gold');
    return { ok: true };
  }

  build(spotId: number, kind: TowerKind): CommandResult {
    const check = this.canBuild(spotId, kind);
    if (!check.ok) return check;
    const spot = this.spots[spotId];
    const stats = this.statsFor(kind, 1);
    this.spend(stats.cost);
    const tower: TowerRt = {
      id: this.nextId++,
      spotId,
      kind,
      level: 1,
      x: spot.x,
      y: spot.y,
      invested: stats.cost,
      sellValue: sellValue(stats.cost),
      range: stats.range,
      cooldown: 0,
      targetId: null,
      targetX: null,
      targetY: null,
      facingX: 0,
      facingY: 1,
      attacking: false,
      shotCount: 0,
      spec: null,
      specCooldown: 0,
      specCooldownMax: 0,
      specCounter: 0,
      rallyX: null,
      rallyY: null,
      knightIds: [],
      attackAnim: 0,
    };
    this.s.towers.push(tower);
    this.towerById.set(tower.id, tower);
    this.towerBySpot.set(spotId, tower);
    this.towerStats.set(tower.id, stats);
    if (kind === 'barracks') {
      const r = this.defaultRally(tower, stats.range);
      tower.rallyX = r.x;
      tower.rallyY = r.y;
      for (let i = 0; i < stats.knights; i++) this.addKnight(tower, stats);
      this.reform(tower);
    }
    this.emit({ type: 'build', towerId: tower.id, spotId, kind, x: tower.x, y: tower.y, cost: stats.cost });
    return { ok: true };
  }

  canUpgrade(towerId: number): CommandResult {
    if (this.ended()) return fail('ended');
    const t = this.towerById.get(towerId);
    if (!t) return fail('no_tower');
    if (t.level >= MAX_TOWER_LEVEL) return fail('max_level');
    if (t.level + 1 > this.towerCap[t.kind]) return fail('capped');
    if (this.s.gold < this.statsFor(t.kind, t.level + 1).cost) return fail('gold');
    return { ok: true };
  }

  upgrade(towerId: number): CommandResult {
    const check = this.canUpgrade(towerId);
    if (!check.ok) return check;
    const t = this.towerById.get(towerId)!;
    const stats = this.statsFor(t.kind, t.level + 1);
    this.spend(stats.cost);
    t.level += 1;
    t.invested += stats.cost;
    t.sellValue = sellValue(t.invested);
    t.range = stats.range;
    this.towerStats.set(t.id, stats);
    if (t.kind === 'barracks') {
      // upgrade existing knights in place (full heal), add the extra knight if the level grants one
      for (const kid of t.knightIds) {
        const k = this.knightById.get(kid)!;
        this.applyKnightStats(k, t, stats);
        if (k.mode !== 'dead') k.hp = k.maxHp;
      }
      while (t.knightIds.length < stats.knights) this.addKnight(t, stats);
      this.reform(t);
    }
    this.emit({ type: 'upgrade', towerId: t.id, kind: t.kind, level: t.level, x: t.x, y: t.y, cost: stats.cost });
    return { ok: true };
  }

  /**
   * Can this tower buy this specialization right now? Failure reasons, in check order: 'ended', 'no_tower', 'locked' (level
   * without specializations), 'wrong_kind' (spec belongs to another tower kind / unknown spec), 'not_max_level' (tower below
   * level 3), 'already_specialized', 'gold'.
   */
  canSpecialize(towerId: number, specId: SpecId): CommandResult {
    if (this.ended()) return fail('ended');
    const t = this.towerById.get(towerId);
    if (!t) return fail('no_tower');
    if (!this.specsUnlocked) return fail('locked');
    if (SPECS[specId]?.tower !== t.kind) return fail('wrong_kind');
    if (t.level < MAX_TOWER_LEVEL) return fail('not_max_level');
    if (t.spec !== null) return fail('already_specialized');
    if (this.s.gold < specCost(specId)) return fail('gold');
    return { ok: true };
  }

  /** Buys a specialization for a Lv3 tower (permanent, exactly one per tower). Emits 'specialize'. */
  specialize(towerId: number, specId: SpecId): CommandResult {
    const check = this.canSpecialize(towerId, specId);
    if (!check.ok) return check;
    const t = this.towerById.get(towerId)!;
    const cost = specCost(specId);
    this.spend(cost);
    t.spec = specId;
    t.invested += cost;
    t.sellValue = sellValue(t.invested);
    const stats = this.statsFor(t.kind, t.level, specId);
    this.towerStats.set(t.id, stats);
    t.range = stats.range;
    t.specCooldownMax = stats.netCooldown || stats.missileCooldown;
    t.specCooldown = 0;
    t.specCounter = 0;
    if (t.kind === 'barracks') {
      for (const kid of t.knightIds) {
        const k = this.knightById.get(kid)!;
        this.applyKnightStats(k, t, stats);
        if (k.mode !== 'dead') k.hp = k.maxHp;
      }
      while (t.knightIds.length < stats.knights) this.addKnight(t, stats);
      this.reform(t);
    }
    this.emit({ type: 'specialize', towerId: t.id, kind: t.kind, specId, x: t.x, y: t.y, cost });
    return { ok: true };
  }

  sell(towerId: number): CommandResult {
    if (this.ended()) return fail('ended');
    const t = this.towerById.get(towerId);
    if (!t) return fail('no_tower');
    const refund = sellValue(t.invested);
    this.s.gold += refund;
    // remove knights
    if (t.kind === 'barracks') {
      for (const kid of t.knightIds) this.knightById.get(kid)!.removed = true;
      this.s.knights = this.s.knights.filter((k) => !k.removed);
      for (const kid of t.knightIds) this.knightById.delete(kid);
    }
    this.s.towers = this.s.towers.filter((x) => x !== t);
    this.towerById.delete(t.id);
    this.towerBySpot.delete(t.spotId);
    this.towerStats.delete(t.id);
    this.emit({ type: 'sell', towerId: t.id, kind: t.kind, x: t.x, y: t.y, refund });
    return { ok: true };
  }

  canSetRally(towerId: number, pos: Vec2): CommandResult {
    if (this.ended()) return fail('ended');
    const t = this.towerById.get(towerId);
    if (!t) return fail('no_tower');
    if (t.kind !== 'barracks') return fail('wrong_kind');
    if (Math.hypot(pos.x - t.x, pos.y - t.y) > t.range + EPS) return fail('out_of_range');
    const n = this.nearestPathPoint(pos);
    if (!n || n.dist > RALLY_PATH_TOLERANCE) return fail('not_on_road');
    return { ok: true };
  }

  setRally(towerId: number, pos: Vec2): CommandResult {
    const check = this.canSetRally(towerId, pos);
    if (!check.ok) return check;
    const t = this.towerById.get(towerId)!;
    t.rallyX = pos.x;
    t.rallyY = pos.y;
    for (const kid of t.knightIds) {
      const k = this.knightById.get(kid)!;
      k.postX = pos.x;
      k.postY = pos.y;
    }
    this.reform(t);
    this.emit({ type: 'rally', towerId: t.id, x: pos.x, y: pos.y });
    return { ok: true };
  }

  canCastOrbital(pos: Vec2): CommandResult {
    if (this.ended()) return fail('ended');
    if (this.s.status !== 'running') return fail('not_running');
    if (this.s.abilities.orbital.cooldown > 0) return fail('cooldown');
    if (!this.inMap(pos)) return fail('out_of_range');
    return { ok: true };
  }

  castOrbital(pos: Vec2): CommandResult {
    const check = this.canCastOrbital(pos);
    if (!check.ok) return check;
    const ab = this.s.abilities.orbital;
    ab.cooldown = ab.cooldownMax;
    ab.ready = false;
    const strike: StrikeRt = {
      id: this.nextId++,
      x: pos.x,
      y: pos.y,
      radius: ab.radius,
      timer: ab.delay,
      delay: ab.delay,
      damage: ab.damage,
    };
    this.s.strikes.push(strike);
    this.emit({ type: 'orbitalWarn', strikeId: strike.id, x: strike.x, y: strike.y, radius: strike.radius, delay: strike.delay });
    return { ok: true };
  }

  canCastReinforcements(pos: Vec2): CommandResult {
    if (this.ended()) return fail('ended');
    if (this.s.status !== 'running') return fail('not_running');
    if (this.s.abilities.reinforce.cooldown > 0) return fail('cooldown');
    const n = this.nearestPathPoint(pos);
    if (!n || n.dist > this.s.abilities.reinforce.pathRange + EPS) return fail('not_on_road');
    return { ok: true };
  }

  castReinforcements(pos: Vec2): CommandResult {
    const check = this.canCastReinforcements(pos);
    if (!check.ok) return check;
    const ab = this.s.abilities.reinforce;
    ab.cooldown = ab.cooldownMax;
    ab.ready = false;
    const ids: number[] = [];
    for (let i = 0; i < ab.count; i++) {
      const off = formationOffset(i, ab.count);
      const k = this.makeKnight({
        kind: 'militia',
        towerId: null,
        level: 1,
        x: pos.x + off.x,
        y: pos.y + off.y,
        postX: pos.x,
        postY: pos.y,
        maxHp: ab.hp,
        armor: REINFORCE.armor,
        dmgMin: REINFORCE.damageMin,
        dmgMax: REINFORCE.damageMax,
        attackCd: REINFORCE.attackCooldown,
        lifeLeft: ab.duration,
        offX: off.x,
        offY: off.y,
      });
      ids.push(k.id);
    }
    this.emit({ type: 'reinforce', x: pos.x, y: pos.y, knightIds: ids });
    return { ok: true };
  }

  canCallNextWave(): CommandResult {
    const s = this.s;
    if (this.ended()) return fail('ended');
    if (s.wave.index >= s.wave.total) return fail('no_more_waves');
    if (s.status === 'pre' || s.wave.countdown !== null) return { ok: true };
    return fail('wave_in_progress');
  }

  /** Starts the next wave now. From 'pre' there is no bonus; during a countdown pays the early-call bonus. */
  callNextWave(): CommandResult {
    const check = this.canCallNextWave();
    if (!check.ok) return check;
    const s = this.s;
    if (s.wave.countdown !== null) {
      const remaining = s.wave.countdown;
      const bonus = Math.floor(remaining * EARLY_GOLD_PER_SEC);
      s.gold += bonus;
      s.stats.goldEarned += bonus;
      this.reduceCooldowns(remaining * EARLY_COOLDOWN_PER_SEC);
      this.emit({ type: 'waveCalledEarly', number: s.wave.index + 1, bonus, remaining });
      this.startWave(true);
    } else {
      this.startWave(false);
    }
    return { ok: true };
  }

  // =========================================================================================
  // Simulation step
  // =========================================================================================

  /** Advance the simulation by `dt` seconds (use the fixed 1/60 s). No-op once won/lost. */
  step(dt: number = FIXED_DT): void {
    const s = this.s;
    if (s.status === 'won' || s.status === 'lost') return;
    s.time += dt;
    this.tickAbilities(dt);
    this.tickWaves(dt);
    this.tickKnights(dt);
    this.tickEnemies(dt);
    this.tickTowers(dt);
    this.tickProjectiles(dt);
    this.sweep();
    this.updateDerived();
    this.checkEnd();
  }

  // =========================================================================================
  // Internals: helpers
  // =========================================================================================

  private ended(): boolean {
    return this.s.status === 'won' || this.s.status === 'lost';
  }

  private emit(e: SimEvent): void {
    if (this.recordEvents) this.events.push(e);
  }

  private spend(amount: number): void {
    this.s.gold -= amount;
    this.s.stats.goldSpent += amount;
  }

  private inMap(p: Vec2): boolean {
    return p.x >= -0.5 && p.y >= -0.5 && p.x <= this.width + 0.5 && p.y <= this.height + 0.5 && Number.isFinite(p.x) && Number.isFinite(p.y);
  }

  private preview(index0: number): WavePreview | null {
    const wave = this.level.waves[index0];
    if (!wave) return null;
    const entries: WavePreviewEntry[] = [];
    const paths: number[] = [];
    let hasFlier = false;
    let hasBoss = false;
    for (const g of wave.groups) {
      const found = entries.findIndex((e) => e.enemy === g.enemy);
      if (found >= 0) entries[found] = { enemy: g.enemy, count: entries[found].count + g.count };
      else entries.push({ enemy: g.enemy, count: g.count });
      if (!paths.includes(g.path)) paths.push(g.path);
      if (ENEMIES[g.enemy].flier) hasFlier = true;
      if (ENEMIES[g.enemy].boss) hasBoss = true;
    }
    return { number: index0 + 1, entries, paths, hasFlier, hasBoss };
  }

  // ---- waves ----

  private startWave(early: boolean): void {
    const s = this.s;
    const wave = this.level.waves[s.wave.index];
    s.wave.index += 1;
    s.wave.spawning = true;
    s.wave.countdown = null;
    s.wave.earlyBonus = 0;
    s.wave.next = this.preview(s.wave.index);
    s.status = 'running';
    this.waveRt = { time: 0, spawned: wave.groups.map(() => 0) };
    this.emit({ type: 'waveStart', number: s.wave.index, total: s.wave.total, early });
  }

  private tickWaves(dt: number): void {
    const s = this.s;
    const rt = this.waveRt;
    if (rt) {
      rt.time += dt;
      const wave = this.level.waves[s.wave.index - 1];
      let done = true;
      for (let gi = 0; gi < wave.groups.length; gi++) {
        const g = wave.groups[gi];
        while (rt.spawned[gi] < g.count && rt.time + EPS >= g.delay + rt.spawned[gi] * g.interval) {
          this.spawnEnemy(g.enemy, g.path, 'wave', 0);
          rt.spawned[gi]++;
        }
        if (rt.spawned[gi] < g.count) done = false;
      }
      if (done) {
        this.waveRt = null;
        s.wave.spawning = false;
        if (s.wave.index < s.wave.total) s.wave.countdown = this.waveGap;
      }
    } else if (s.wave.countdown !== null) {
      s.wave.countdown -= dt;
      if (s.wave.countdown <= 0) {
        s.wave.countdown = null;
        this.startWave(false);
      }
    }
  }

  // ---- enemies ----

  private spawnEnemy(type: EnemyId, pathIndex: number, source: SpawnSource, progress: number): EnemyRt {
    const def = ENEMIES[type];
    const path = this.paths[pathIndex];
    const lateral = this.rng.range(-LATERAL_OFFSET, LATERAL_OFFSET) * (def.boss ? 0 : 1);
    const e: EnemyRt = {
      id: this.nextId++,
      type,
      x: 0,
      y: 0,
      dirX: 1,
      dirY: 0,
      hp: def.hp,
      maxHp: def.hp,
      flier: def.flier,
      boss: def.boss,
      engaged: false,
      engagedBy: [],
      slowed: false,
      attacking: false,
      pathIndex,
      progress,
      pathLength: path.length,
      lateral,
      slowTimer: 0,
      slowFactor: 1,
      netted: false,
      netTimer: 0,
      burning: false,
      burnTimer: 0,
      burnDps: 0,
      attackTimer: def.meleeCooldown * 0.5,
      launchTimer: def.launcher ? def.launcher.interval : 0,
      dead: false,
      attackAnim: 0,
    };
    this.placeEnemy(e);
    this.s.enemies.push(e);
    this.enemyById.set(e.id, e);
    this.s.stats.spawned++;
    this.emit({ type: 'spawn', enemyId: e.id, enemy: type, x: e.x, y: e.y, source });
    if (def.boss) this.emit({ type: 'bossSpawn', enemyId: e.id, enemy: type });
    return e;
  }

  private placeEnemy(e: EnemyRt): void {
    const p = pointAt(this.paths[e.pathIndex], e.progress, this.tmpPt);
    e.x = p.x - p.dy * e.lateral;
    e.y = p.y + p.dx * e.lateral;
    e.dirX = p.dx;
    e.dirY = p.dy;
  }

  private tickEnemies(dt: number): void {
    const s = this.s;
    const n = s.enemies.length;
    for (let i = 0; i < n; i++) {
      const e = s.enemies[i];
      if (e.dead) continue;
      const def = ENEMIES[e.type];
      if (e.attackAnim > 0) {
        e.attackAnim -= dt;
        e.attacking = e.attackAnim > 0;
      }
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) {
          e.slowTimer = 0;
          e.slowFactor = 1;
          e.slowed = false;
        }
      }
      if (e.burnTimer > 0) {
        const dealt = e.burnDps * Math.min(dt, e.burnTimer);
        e.burnTimer -= dt;
        if (e.burnTimer <= 0) {
          e.burnTimer = 0;
          e.burnDps = 0;
          e.burning = false;
        }
        this.damageEnemy(e, dealt, 'true', 0, null);
        if (e.dead) continue;
      }
      if (e.netTimer > 0) {
        e.netTimer -= dt;
        if (e.netTimer <= 0) {
          e.netTimer = 0;
          e.netted = false;
          this.emit({ type: 'netExpire', enemyId: e.id, x: e.x, y: e.y });
        }
      }
      if (def.launcher) {
        e.launchTimer -= dt;
        if (e.launchTimer <= 0) {
          e.launchTimer += def.launcher.interval;
          this.emit({ type: 'escortLaunch', fromId: e.id, x: e.x, y: e.y });
          for (const sp of def.launcher.spawns) {
            for (let c = 0; c < sp.count; c++) this.spawnEnemy(sp.enemy, e.pathIndex, 'mothership', e.progress);
          }
        }
      }
      if (e.engaged) {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = def.meleeCooldown;
          this.enemyStrike(e, def);
        }
        continue;
      }
      e.attackTimer = def.meleeCooldown * 0.5;
      if (e.netted) continue; // rooted by a net
      e.progress += def.speed * e.slowFactor * dt;
      if (e.progress >= e.pathLength) {
        this.leak(e, def);
        continue;
      }
      this.placeEnemy(e);
    }
  }

  private enemyStrike(e: EnemyRt, def: EnemyDef): void {
    if (def.meleeDamage <= 0 || e.engagedBy.length === 0) return;
    const k = this.knightById.get(e.engagedBy[0]);
    if (!k || k.mode === 'dead') return;
    const amount = def.meleeDamage * (1 - k.armor);
    k.hp -= amount;
    e.attackAnim = ATTACK_ANIM_TIME;
    e.attacking = true;
    this.emit({ type: 'meleeHit', attacker: 'enemy', attackerId: e.id, targetId: k.id, x: k.x, y: k.y, amount });
    if (k.hp <= 0) this.killKnight(k);
  }

  private leak(e: EnemyRt, def: EnemyDef): void {
    e.dead = true;
    this.s.lives = Math.max(0, this.s.lives - def.lives);
    this.s.stats.leaked += def.lives;
    this.emit({ type: 'leak', enemyId: e.id, enemy: e.type, x: e.x, y: e.y, lives: def.lives });
  }

  /** Applies resistances, subtracts hp, handles death. Returns damage dealt. */
  private damageEnemy(e: EnemyRt, raw: number, type: DamageType, pierce: number, source: HitSource | null): number {
    if (e.dead) return 0;
    const def = ENEMIES[e.type];
    const amount = calcDamage(raw, type, def.armor, def.magicResist, pierce);
    e.hp -= amount;
    if (source) this.emit({ type: 'hit', enemyId: e.id, enemy: e.type, x: e.x, y: e.y, amount, raw, damageType: type, source });
    if (e.hp <= 0) {
      e.hp = 0;
      this.killEnemy(e, def);
    }
    return amount;
  }

  private killEnemy(e: EnemyRt, def: EnemyDef): void {
    e.dead = true;
    this.s.gold += def.gold;
    this.s.stats.goldEarned += def.gold;
    this.s.stats.kills++;
    this.emit({ type: 'kill', enemyId: e.id, enemy: e.type, x: e.x, y: e.y, gold: def.gold, flier: def.flier, boss: def.boss });
    if (def.onDeath) {
      for (let c = 0; c < def.onDeath.count; c++) this.spawnEnemy(def.onDeath.enemy, e.pathIndex, 'carrier', e.progress);
    }
  }

  private applySlow(e: EnemyRt, factor: number, duration: number): void {
    if (e.dead || factor >= 1 || duration <= 0) return;
    if (e.slowTimer <= 0 || factor <= e.slowFactor) {
      e.slowFactor = factor;
    }
    e.slowTimer = Math.max(e.slowTimer, duration);
    e.slowed = true;
  }

  // ---- knights / militia ----

  private makeKnight(init: {
    kind: KnightKind;
    towerId: number | null;
    level: number;
    x: number;
    y: number;
    postX: number;
    postY: number;
    maxHp: number;
    armor: number;
    dmgMin: number;
    dmgMax: number;
    attackCd: number;
    lifeLeft: number;
    offX: number;
    offY: number;
  }): KnightRt {
    const k: KnightRt = {
      id: this.nextId++,
      kind: init.kind,
      towerId: init.towerId,
      level: init.level,
      x: init.x,
      y: init.y,
      facingX: 0,
      facingY: 1,
      hp: init.maxHp,
      maxHp: init.maxHp,
      armor: init.armor,
      mode: 'idle',
      targetId: null,
      attacking: false,
      bow: false,
      bowCooldown: 0,
      shooting: false,
      shootAnim: 0,
      postX: init.postX,
      postY: init.postY,
      homeX: init.postX + init.offX,
      homeY: init.postY + init.offY,
      respawnTimer: 0,
      lifeLeft: init.lifeLeft,
      offX: init.offX,
      offY: init.offY,
      dmgMin: init.dmgMin,
      dmgMax: init.dmgMax,
      attackCd: init.attackCd,
      attackTimer: 0,
      attackAnim: 0,
      regenRate: init.kind === 'knight' ? KNIGHT.regen * this.modifiers.knightRegenMult : 0,
      respawnTime: KNIGHT.respawn * this.modifiers.knightRespawnMult,
      removed: false,
    };
    this.s.knights.push(k);
    this.knightById.set(k.id, k);
    return k;
  }

  private addKnight(t: TowerRt, stats: TowerStatsView): KnightRt {
    const k = this.makeKnight({
      kind: 'knight',
      towerId: t.id,
      level: t.level,
      x: t.x,
      y: t.y,
      postX: t.rallyX!,
      postY: t.rallyY!,
      maxHp: stats.knightHp,
      armor: stats.knightArmor,
      dmgMin: stats.damageMin,
      dmgMax: stats.damageMax,
      attackCd: stats.cooldown,
      lifeLeft: -1,
      offX: 0,
      offY: 0,
    });
    k.bow = stats.bowCooldown > 0;
    k.respawnTime = stats.knightRespawn;
    t.knightIds.push(k.id);
    k.mode = 'walking';
    return k;
  }

  private applyKnightStats(k: KnightRt, t: TowerRt, stats: TowerStatsView): void {
    k.level = t.level;
    k.maxHp = stats.knightHp;
    k.armor = stats.knightArmor;
    k.dmgMin = stats.damageMin;
    k.dmgMax = stats.damageMax;
    k.attackCd = stats.cooldown;
    k.bow = stats.bowCooldown > 0;
    k.respawnTime = stats.knightRespawn;
  }

  /** Recomputes the formation slots of a barracks' knights around its rally post. */
  private reform(t: TowerRt): void {
    const n = t.knightIds.length;
    t.knightIds.forEach((kid, i) => {
      const k = this.knightById.get(kid)!;
      const off = formationOffset(i, n);
      k.offX = off.x;
      k.offY = off.y;
      k.homeX = k.postX + off.x;
      k.homeY = k.postY + off.y;
    });
  }

  private defaultRally(t: TowerRt, range: number): Vec2 {
    const n = this.nearestPathPoint({ x: t.x, y: t.y });
    if (!n) return { x: t.x, y: t.y };
    if (n.dist <= range) return { x: n.x, y: n.y };
    const f = range / n.dist;
    return { x: t.x + (n.x - t.x) * f, y: t.y + (n.y - t.y) * f };
  }

  private killKnight(k: KnightRt): void {
    k.hp = 0;
    k.mode = 'dead';
    k.targetId = null;
    k.attacking = false;
    k.respawnTimer = k.kind === 'knight' ? k.respawnTime : 0;
    if (k.kind === 'militia') k.removed = true;
    this.emit({ type: 'knightDeath', knightId: k.id, towerId: k.towerId, kind: k.kind, x: k.x, y: k.y });
  }

  private tickKnights(dt: number): void {
    const s = this.s;
    for (const e of s.enemies) {
      e.engaged = false;
      if (e.engagedBy.length > 0) e.engagedBy.length = 0;
    }
    // how many knights already chase each enemy (to spread knights over several enemies)
    const counts = new Map<number, number>();
    for (const k of s.knights) {
      if (k.targetId !== null && k.mode !== 'dead') counts.set(k.targetId, (counts.get(k.targetId) ?? 0) + 1);
    }

    for (const k of s.knights) {
      if (k.mode === 'dead') {
        if (k.kind === 'knight' && k.towerId !== null) {
          k.respawnTimer -= dt;
          if (k.respawnTimer <= 0) this.respawnKnight(k);
        }
        continue;
      }
      if (k.kind === 'militia') {
        k.lifeLeft -= dt;
        if (k.lifeLeft <= 0) {
          k.mode = 'dead';
          k.removed = true;
          k.targetId = null;
          this.emit({ type: 'militiaExpire', knightId: k.id, x: k.x, y: k.y });
          continue;
        }
      }
      if (k.attackTimer > 0) k.attackTimer = Math.max(0, k.attackTimer - dt);
      if (k.attackAnim > 0) {
        k.attackAnim -= dt;
        k.attacking = k.attackAnim > 0;
      }

      // validate / acquire target
      let target: EnemyRt | undefined;
      if (k.targetId !== null) {
        const cur = this.enemyById.get(k.targetId);
        if (cur && !cur.dead && (cur.netted || ENEMIES[cur.type].blockable) && Math.hypot(cur.x - k.postX, cur.y - k.postY) <= KNIGHT.leashRange) target = cur;
        else {
          const c = counts.get(k.targetId) ?? 0;
          if (c > 0) counts.set(k.targetId, c - 1);
        }
      }
      if (!target) {
        k.targetId = null;
        target = this.acquireTarget(k, counts);
        if (target) {
          k.targetId = target.id;
          counts.set(target.id, (counts.get(target.id) ?? 0) + 1);
        }
      }

      if (target) {
        const dx = target.x - k.x;
        const dy = target.y - k.y;
        const dist = Math.hypot(dx, dy);
        if (dist > EPS) {
          k.facingX = dx / dist;
          k.facingY = dy / dist;
        }
        if (dist <= KNIGHT.contactRange) {
          k.mode = 'fighting';
          target.engaged = true;
          target.engagedBy.push(k.id);
          if (k.attackTimer <= 0) {
            k.attackTimer = k.attackCd;
            k.attackAnim = ATTACK_ANIM_TIME;
            k.attacking = true;
            const raw = this.rng.int(Math.round(k.dmgMin), Math.round(k.dmgMax));
            this.emit({ type: 'meleeHit', attacker: k.kind, attackerId: k.id, targetId: target.id, x: target.x, y: target.y, amount: raw });
            this.damageEnemy(target, raw, 'physical', 0, k.kind);
          }
        } else {
          k.mode = 'walking';
          const step = Math.min(KNIGHT.speed * dt, dist - KNIGHT.contactRange * 0.9);
          k.x += (dx / dist) * step;
          k.y += (dy / dist) * step;
        }
      } else {
        // return to the slot
        const dx = k.homeX - k.x;
        const dy = k.homeY - k.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.03) {
          const step = Math.min(KNIGHT.speed * dt, dist);
          k.x += (dx / dist) * step;
          k.y += (dy / dist) * step;
          k.facingX = dx / dist;
          k.facingY = dy / dist;
          k.mode = 'walking';
        } else {
          k.mode = 'idle';
        }
      }

      if (k.bow) {
        if (k.shootAnim > 0) {
          k.shootAnim -= dt;
          k.shooting = k.shootAnim > 0;
        }
        if (k.bowCooldown > 0) k.bowCooldown = Math.max(0, k.bowCooldown - dt);
        if (k.mode !== 'fighting' && k.bowCooldown <= 0) this.knightShoot(k);
      }

      if (k.mode !== 'fighting' && k.hp < k.maxHp && k.regenRate > 0) {
        k.hp = Math.min(k.maxHp, k.hp + k.maxHp * k.regenRate * dt);
      }
    }
  }

  private acquireTarget(k: KnightRt, counts: Map<number, number>): EnemyRt | undefined {
    let best: EnemyRt | undefined;
    let bestCount = Infinity;
    let bestRemaining = Infinity;
    for (const e of this.s.enemies) {
      if (e.dead || !(e.netted || ENEMIES[e.type].blockable)) continue;
      if (Math.hypot(e.x - k.postX, e.y - k.postY) > KNIGHT.engageRange) continue;
      const c = counts.get(e.id) ?? 0;
      const remaining = e.pathLength - e.progress;
      if (c < bestCount || (c === bestCount && remaining < bestRemaining)) {
        best = e;
        bestCount = c;
        bestRemaining = remaining;
      }
    }
    return best;
  }

  /** Bow Training: a knight that is not in melee shoots the furthest-forward UFO within its bow range (fliers included). */
  private knightShoot(k: KnightRt): void {
    const stats = k.towerId !== null ? this.towerStats.get(k.towerId) : undefined;
    if (!stats || stats.bowCooldown <= 0) return;
    const r2 = stats.bowRange * stats.bowRange;
    let best: EnemyRt | undefined;
    let bestRem = Infinity;
    for (const e of this.s.enemies) {
      if (e.dead) continue;
      const dx = e.x - k.x;
      const dy = e.y - k.y;
      if (dx * dx + dy * dy > r2) continue;
      const rem = e.pathLength - e.progress;
      if (rem < bestRem || (rem === bestRem && best && e.id < best.id)) {
        best = e;
        bestRem = rem;
      }
    }
    if (!best) return;
    const dx = best.x - k.x;
    const dy = best.y - k.y;
    const d = Math.hypot(dx, dy) || 1;
    k.facingX = dx / d;
    k.facingY = dy / d;
    k.bowCooldown = stats.bowCooldown;
    k.shootAnim = ATTACK_ANIM_TIME;
    k.shooting = true;
    const p = this.newProjectile({
      kind: 'knightArrow',
      x: k.x,
      y: k.y,
      target: best,
      speed: SPEC_TUNING.bow_training.arrowSpeed,
      damage: this.rng.int(stats.bowDamageMin, stats.bowDamageMax),
      damageType: 'physical',
      towerId: k.towerId!,
      knightId: k.id,
    });
    this.s.projectiles.push(p);
    this.emit({ type: 'knightShoot', towerId: k.towerId!, knightId: k.id, projectileId: p.id, x: k.x, y: k.y, targetId: best.id, tx: best.x, ty: best.y });
  }

  private respawnKnight(k: KnightRt): void {
    const t = this.towerById.get(k.towerId!);
    if (!t) {
      k.removed = true;
      return;
    }
    k.hp = k.maxHp;
    k.mode = 'walking';
    k.x = t.x;
    k.y = t.y;
    k.respawnTimer = 0;
    k.attackTimer = 0;
    this.emit({ type: 'knightRespawn', knightId: k.id, towerId: t.id });
  }

  // ---- towers & projectiles ----

  private tickTowers(dt: number): void {
    for (const t of this.s.towers) {
      if (t.kind === 'barracks') continue;
      const stats = this.towerStats.get(t.id)!;
      if (t.cooldown > 0) t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.specCooldown > 0) t.specCooldown = Math.max(0, t.specCooldown - dt);
      if (t.attackAnim > 0) {
        t.attackAnim -= dt;
        t.attacking = t.attackAnim > 0;
      }
      const targets = t.kind === 'bomb' ? this.bombTarget(t, stats) : this.targetsInRange(t.x, t.y, stats.range, stats.shots);
      if (targets.length > 0) {
        const first = targets[0];
        t.targetId = first.id;
        t.targetX = first.x;
        t.targetY = first.y;
        const dx = first.x - t.x;
        const dy = first.y - t.y;
        const d = Math.hypot(dx, dy);
        if (d > EPS) {
          t.facingX = dx / d;
          t.facingY = dy / d;
        }
      } else {
        t.targetId = null;
        t.targetX = null;
        t.targetY = null;
      }
      if (t.cooldown <= 0 && targets.length > 0) {
        this.fire(t, stats, targets);
        t.cooldown = stats.cooldown;
        t.attackAnim = ATTACK_ANIM_TIME;
        t.attacking = true;
        t.shotCount++;
      }
      // specialization powers on their own timer (independent of the normal shot cooldown)
      if (t.specCooldownMax > 0 && t.specCooldown <= 0) {
        if (t.spec === 'hunting_nets') this.throwNet(t, stats);
        else if (t.spec === 'homing_missiles') this.fireMissiles(t, stats);
      }
    }
  }

  /** Enemies within range sorted by "first" (least distance remaining to the exit). */
  private targetsInRange(x: number, y: number, range: number, max: number): EnemyRt[] {
    const out: EnemyRt[] = [];
    const r2 = range * range;
    for (const e of this.s.enemies) {
      if (e.dead) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= r2) out.push(e);
    }
    if (out.length > 1) out.sort((a, b) => a.pathLength - a.progress - (b.pathLength - b.progress) || a.id - b.id);
    if (out.length > max) out.length = max;
    return out;
  }

  /**
   * Bomb targeting: ground enemies in range only (high fliers are ignored, a netted flier counts as ground, the boss is fair game). While the tower is ready it
   * picks the enemy whose position has the most ground enemies inside the splash radius (itself included); ties go to
   * the one furthest along its path. While reloading it just keeps its previous target (or the "first" ground enemy).
   */
  private bombTarget(t: TowerRt, stats: TowerStatsView): EnemyRt[] {
    const r2 = stats.range * stats.range;
    const cand: EnemyRt[] = [];
    for (const e of this.s.enemies) {
      if (e.dead || isAirborne(e)) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      if (dx * dx + dy * dy <= r2) cand.push(e);
    }
    if (cand.length === 0) return [];
    const remaining = (e: EnemyRt) => e.pathLength - e.progress;
    if (t.cooldown > 0) {
      const keep = cand.find((e) => e.id === t.targetId);
      if (keep) return [keep];
      let first = cand[0];
      for (const e of cand) if (remaining(e) < remaining(first) || (remaining(e) === remaining(first) && e.id < first.id)) first = e;
      return [first];
    }
    const sr2 = stats.splashRadius * stats.splashRadius;
    let best: EnemyRt = cand[0];
    let bestCount = -1;
    for (const c of cand) {
      let n = 0;
      for (const e of this.s.enemies) {
        if (e.dead || isAirborne(e)) continue;
        const dx = e.x - c.x;
        const dy = e.y - c.y;
        if (dx * dx + dy * dy <= sr2) n++;
      }
      if (n > bestCount || (n === bestCount && (remaining(c) < remaining(best) || (remaining(c) === remaining(best) && c.id < best.id)))) {
        best = c;
        bestCount = n;
      }
    }
    return [best];
  }

  /** Fresh projectile with all optional fields defaulted. Direction/target point come from `target` or `tx`/`ty`. */
  private newProjectile(
    o: Partial<ProjectileRt> & { kind: ProjectileKind; x: number; y: number; speed: number; damage: number; damageType: DamageType; towerId: number; target?: EnemyRt },
  ): ProjectileRt {
    const { target, ...rest } = o;
    const tx = target ? target.x : (o.tx ?? o.x);
    const ty = target ? target.y : (o.ty ?? o.y);
    const dx = tx - o.x;
    const dy = ty - o.y;
    const d = Math.hypot(dx, dy);
    return {
      id: this.nextId++,
      fromX: o.x,
      fromY: o.y,
      targetId: target ? target.id : -1,
      tx,
      ty,
      armorPierce: 0,
      slowFactor: 1,
      slowDuration: 0,
      chainCount: 0,
      chainRange: 0,
      chainFactor: 0,
      chainFactors: [],
      igniteDps: 0,
      igniteDuration: 0,
      armorIgnore: false,
      knightId: -1,
      dirX: d > EPS ? dx / d : 0,
      dirY: d > EPS ? dy / d : 1,
      flightTime: 0,
      elapsed: 0,
      progress: 0,
      radius: 0,
      arc: 0,
      bombletCount: 0,
      bombletFactor: 0,
      bombletRadius: 0,
      bombletScatter: 0,
      ...rest,
    };
  }

  private fireBomb(t: TowerRt, stats: TowerStatsView, target: EnemyRt): void {
    const lv = TOWERS.bomb.levels[t.level - 1];
    const base = this.rng.int(lv.damageMin, lv.damageMax);
    const dmgMult = stats.damageMin / lv.damageMin;
    const d = Math.hypot(target.x - t.x, target.y - t.y);
    const flight = BOMB.flightBase + BOMB.flightPerTile * d;
    const p = this.newProjectile({
      kind: 'shell',
      x: t.x,
      y: t.y,
      target,
      speed: d / flight,
      damage: base * dmgMult,
      damageType: 'physical',
      towerId: t.id,
      flightTime: flight,
      radius: stats.splashRadius,
      arc: BOMB.shellArc,
      bombletCount: stats.bomblets,
      bombletFactor: stats.bombletDamageFactor,
      bombletRadius: stats.bombletRadius,
      bombletScatter: stats.bombletScatter,
    });
    this.s.projectiles.push(p);
    this.emit({ type: 'shoot', towerId: t.id, kind: 'bomb', projectileId: p.id, x: t.x, y: t.y, targetId: target.id, tx: p.tx, ty: p.ty });
  }

  private fire(t: TowerRt, stats: TowerStatsView, targets: EnemyRt[]): void {
    if (t.kind === 'bomb') {
      this.fireBomb(t, stats, targets[0]);
      return;
    }
    const def = TOWERS[t.kind];
    const kind = t.kind === 'archer' ? 'arrow' : 'bolt';
    const lv = def.levels[t.level - 1];
    const dmgMult = stats.damageMin / lv.damageMin;
    for (const target of targets) {
      const base = this.rng.int(lv.damageMin, lv.damageMax);
      let ignore = false;
      if (stats.armorIgnoreEvery > 0) {
        // Eagle Eye: every Nth arrow (each arrow of a double-shot volley counts) ignores all armor
        ignore = t.specCounter >= stats.armorIgnoreEvery - 1;
        t.specCounter = ignore ? 0 : t.specCounter + 1;
      }
      const p = this.newProjectile({
        kind,
        x: t.x,
        y: t.y,
        target,
        speed: def.projectileSpeed,
        damage: base * dmgMult,
        damageType: def.damageType,
        towerId: t.id,
        armorPierce: ignore ? 1 : stats.armorPierce,
        armorIgnore: ignore,
        slowFactor: stats.slowFactor,
        slowDuration: stats.slowDuration,
        chainCount: stats.chainCount,
        chainRange: stats.chainRange,
        chainFactor: stats.chainFactor,
        chainFactors: stats.chainFactors,
        igniteDps: stats.igniteDps,
        igniteDuration: stats.igniteDuration,
      });
      this.s.projectiles.push(p);
      this.emit({ type: 'shoot', towerId: t.id, kind: t.kind, projectileId: p.id, x: t.x, y: t.y, targetId: target.id, tx: target.x, ty: target.y });
    }
  }

  /** Where a UFO will be in `secs` seconds if nothing changes (straight line along its heading; rooted / engaged ones stay put). */
  private leadPosition(e: EnemyRt, secs: number): Vec2 {
    if (e.netted || e.engaged) return { x: e.x, y: e.y };
    const sp = ENEMIES[e.type].speed * e.slowFactor;
    return { x: e.x + e.dirX * sp * secs, y: e.y + e.dirY * sp * secs };
  }

  /**
   * Hunting Nets: throws a net at the densest cluster among the UFOs in range (cluster = UFOs within the net radius of a
   * candidate's predicted landing position; ties: the furthest-forward candidate). Fires only when something is in range.
   */
  private throwNet(t: TowerRt, stats: TowerStatsView): void {
    const inRange = this.targetsInRange(t.x, t.y, stats.range, Infinity);
    if (inRange.length === 0) return;
    const alive = this.s.enemies.filter((e) => !e.dead);
    const r2 = stats.netRadius * stats.netRadius;
    const N = SPEC_TUNING.hunting_nets;
    let best: Vec2 | null = null;
    let bestCount = -1;
    for (const c of inRange) {
      const d0 = Math.hypot(c.x - t.x, c.y - t.y);
      const aim = this.leadPosition(c, N.flightBase + N.flightPerTile * d0);
      const flight = N.flightBase + N.flightPerTile * Math.hypot(aim.x - t.x, aim.y - t.y);
      let n = 0;
      for (const e of alive) {
        const pe = this.leadPosition(e, flight);
        const dx = pe.x - aim.x;
        const dy = pe.y - aim.y;
        if (dx * dx + dy * dy <= r2) n++;
      }
      // inRange is sorted furthest-forward first, so a strict '>' keeps the furthest candidate on ties
      if (n > bestCount) {
        bestCount = n;
        best = aim;
      }
    }
    if (!best) return;
    const d = Math.hypot(best.x - t.x, best.y - t.y);
    const flight = N.flightBase + N.flightPerTile * d;
    const p = this.newProjectile({
      kind: 'net',
      x: t.x,
      y: t.y,
      tx: best.x,
      ty: best.y,
      speed: d / flight,
      damage: 0,
      damageType: 'physical',
      towerId: t.id,
      flightTime: flight,
      radius: stats.netRadius,
      arc: N.arc,
    });
    this.s.projectiles.push(p);
    t.specCooldown = stats.netCooldown;
    this.emit({ type: 'netLaunch', towerId: t.id, projectileId: p.id, fromX: t.x, fromY: t.y, tx: p.tx, ty: p.ty, radius: p.radius, flightTime: flight });
  }

  /** Hunting Nets landing: roots UFOs within the radius (fliers are pulled down); bosses are slowed instead. */
  private landNet(p: ProjectileRt, stats: TowerStatsView | undefined): void {
    const dur = stats?.netDuration ?? SPEC_TUNING.hunting_nets.rootDuration;
    const bossFactor = stats?.netBossSlowFactor ?? SPEC_TUNING.hunting_nets.bossSlowFactor;
    const bossDur = stats?.netBossSlowDuration ?? SPEC_TUNING.hunting_nets.bossSlowDuration;
    const caught: number[] = [];
    const slowed: number[] = [];
    const r2 = p.radius * p.radius;
    for (const e of this.s.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > r2) continue;
      caught.push(e.id);
      if (e.boss) {
        this.applySlow(e, bossFactor, bossDur);
        slowed.push(e.id);
      } else {
        e.netted = true;
        e.netTimer = Math.max(e.netTimer, dur);
      }
    }
    this.emit({ type: 'net', towerId: p.towerId, projectileId: p.id, x: p.x, y: p.y, radius: p.radius, duration: dur, enemyIds: caught, slowedIds: slowed });
  }

  /** Homing Missiles: one volley at the furthest-forward UFOs in range (fliers included); fewer UFOs than missiles = several missiles per UFO. */
  private fireMissiles(t: TowerRt, stats: TowerStatsView): void {
    const targets = this.targetsInRange(t.x, t.y, stats.range, stats.missileCount);
    if (targets.length === 0) return;
    const out: { projectileId: number; targetId: number }[] = [];
    for (let i = 0; i < stats.missileCount; i++) {
      const target = targets[i % targets.length];
      const p = this.newProjectile({
        kind: 'missile',
        x: t.x,
        y: t.y,
        target,
        speed: SPEC_TUNING.homing_missiles.speed,
        damage: stats.missileDamage,
        damageType: 'physical',
        towerId: t.id,
        radius: stats.missileSplash,
      });
      this.s.projectiles.push(p);
      out.push({ projectileId: p.id, targetId: target.id });
    }
    t.specCooldown = stats.missileCooldown;
    this.emit({ type: 'missileLaunch', towerId: t.id, x: t.x, y: t.y, missiles: out });
  }

  private tickProjectiles(dt: number): void {
    const s = this.s;
    if (s.projectiles.length === 0) return;
    const keep: ProjectileRt[] = [];
    const spawned: ProjectileRt[] = [];
    for (const p of s.projectiles) {
      if (p.kind === 'shell' || p.kind === 'bomblet' || p.kind === 'net') {
        // lobbed: flies to a fixed point and lands there, whether or not anything is still underneath
        p.elapsed += dt;
        if (p.elapsed + EPS >= p.flightTime) {
          p.elapsed = p.flightTime;
          p.progress = 1;
          p.x = p.tx;
          p.y = p.ty;
          if (p.kind === 'net') this.landNet(p, this.towerStats.get(p.towerId));
          else this.explode(p, spawned);
        } else {
          p.progress = p.elapsed / p.flightTime;
          p.x = p.fromX + (p.tx - p.fromX) * p.progress;
          p.y = p.fromY + (p.ty - p.fromY) * p.progress;
          keep.push(p);
        }
        continue;
      }
      const target = this.enemyById.get(p.targetId);
      const alive = !!target && !target.dead;
      if (alive) {
        p.tx = target!.x;
        p.ty = target!.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (dist <= step + EPS) {
        p.x = p.tx;
        p.y = p.ty;
        if (p.kind === 'missile') this.explode(p, spawned); // detonates even if its target died on the way
        else if (alive) this.impact(p, target!);
        else this.emit({ type: 'fizzle', projectileId: p.id, x: p.x, y: p.y });
        continue;
      }
      p.dirX = dx / dist;
      p.dirY = dy / dist;
      p.x += p.dirX * step;
      p.y += p.dirY * step;
      keep.push(p);
    }
    for (const q of spawned) keep.push(q);
    s.projectiles = keep;
  }

  /**
   * Shell / bomblet / missile detonation: splash damage (falloff) to grounded UFOs (missiles also hit high fliers), then the
   * Cluster Bomb release of a shell.
   */
  private explode(p: ProjectileRt, spawned: ProjectileRt[]): void {
    const kind = p.kind as 'shell' | 'bomblet' | 'missile';
    const hit: { e: EnemyRt; f: number }[] = [];
    for (const e of this.s.enemies) {
      if (e.dead || (kind !== 'missile' && isAirborne(e))) continue;
      const f = splashFactor(Math.hypot(e.x - p.x, e.y - p.y), p.radius);
      if (f > 0) hit.push({ e, f });
    }
    this.emit({ type: 'explode', towerId: p.towerId, kind, projectileId: p.id, x: p.x, y: p.y, radius: p.radius, hits: hit.length });
    for (const h of hit) this.damageEnemy(h.e, p.damage * h.f, p.damageType, 0, kind);
    if (kind === 'shell' && p.bombletCount > 0) {
      const out: { projectileId: number; tx: number; ty: number }[] = [];
      for (let i = 0; i < p.bombletCount; i++) {
        const a = this.rng.range(0, Math.PI * 2);
        const r = p.bombletScatter * Math.sqrt(this.rng.next());
        const tx = p.x + Math.cos(a) * r;
        const ty = p.y + Math.sin(a) * r;
        const b = this.newProjectile({
          kind: 'bomblet',
          x: p.x,
          y: p.y,
          tx,
          ty,
          speed: r / BOMB.bombletFuse,
          damage: p.damage * p.bombletFactor,
          damageType: p.damageType,
          towerId: p.towerId,
          flightTime: BOMB.bombletFuse,
          radius: p.bombletRadius,
          arc: BOMB.bombletArc,
        });
        spawned.push(b);
        out.push({ projectileId: b.id, tx, ty });
      }
      this.emit({ type: 'cluster', towerId: p.towerId, shellId: p.id, x: p.x, y: p.y, bomblets: out });
    }
  }

  private applyIgnite(target: EnemyRt, p: ProjectileRt): void {
    if (target.dead || p.igniteDps <= 0) return;
    const refreshed = target.burning;
    target.burning = true;
    target.burnDps = Math.max(target.burnDps, p.igniteDps); // refresh, never stack
    target.burnTimer = Math.max(target.burnTimer, p.igniteDuration);
    this.emit({ type: 'ignite', towerId: p.towerId, enemyId: target.id, x: target.x, y: target.y, dps: target.burnDps, duration: target.burnTimer, refreshed });
  }

  private impact(p: ProjectileRt, target: EnemyRt): void {
    const source: HitSource = p.kind === 'arrow' ? 'arrow' : p.kind === 'knightArrow' ? 'knightArrow' : 'bolt';
    this.damageEnemy(target, p.damage, p.damageType, p.armorPierce, source);
    this.applySlow(target, p.slowFactor, p.slowDuration);
    this.applyIgnite(target, p);
    if (p.chainCount > 0) {
      const hit = new Set<number>([target.id]);
      let fromX = target.x;
      let fromY = target.y;
      for (let c = 0; c < p.chainCount; c++) {
        let best: EnemyRt | undefined;
        let bestD = Infinity;
        for (const e of this.s.enemies) {
          if (e.dead || hit.has(e.id)) continue;
          const d = Math.hypot(e.x - fromX, e.y - fromY);
          if (d <= p.chainRange && d < bestD) {
            best = e;
            bestD = d;
          }
        }
        if (!best) break;
        hit.add(best.id);
        const factor = p.chainFactors[c] ?? p.chainFactor;
        this.emit({ type: 'chain', towerId: p.towerId, fromX, fromY, toX: best.x, toY: best.y, targetId: best.id, jump: c + 1, factor });
        this.damageEnemy(best, p.damage * factor, p.damageType, p.armorPierce, 'chain');
        this.applySlow(best, p.slowFactor, p.slowDuration);
        fromX = best.x;
        fromY = best.y;
      }
    }
  }

  // ---- abilities ----

  private tickAbilities(dt: number): void {
    const s = this.s;
    for (const id of ['orbital', 'reinforce'] as const) {
      const ab = s.abilities[id];
      if (ab.cooldown > 0) {
        ab.cooldown = Math.max(0, ab.cooldown - dt);
        if (ab.cooldown <= 0) {
          ab.ready = true;
          this.emit({ type: 'abilityReady', ability: id });
        }
      }
    }
    if (s.strikes.length > 0) {
      const pending: StrikeRt[] = [];
      for (const st of s.strikes) {
        st.timer -= dt;
        if (st.timer <= 0) this.detonate(st);
        else pending.push(st);
      }
      s.strikes = pending;
    }
    if (s.burns.length > 0) {
      const alive: BurnRt[] = [];
      for (const b of s.burns) {
        const slice = Math.min(dt, b.timer);
        b.timer -= dt;
        const r2 = b.radius * b.radius;
        const n = s.enemies.length;
        for (let i = 0; i < n; i++) {
          const e = s.enemies[i];
          if (e.dead) continue;
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          if (dx * dx + dy * dy <= r2) this.damageEnemy(e, b.dps * slice, 'true', 0, null);
        }
        if (b.timer > 0) alive.push(b);
      }
      s.burns = alive;
    }
  }

  private detonate(st: StrikeRt): void {
    const r2 = st.radius * st.radius;
    let hits = 0;
    const targets = this.s.enemies.filter((e) => !e.dead && (e.x - st.x) ** 2 + (e.y - st.y) ** 2 <= r2);
    for (const e of targets) {
      this.damageEnemy(e, st.damage, 'true', 0, 'orbital');
      hits++;
    }
    this.emit({ type: 'orbitalHit', strikeId: st.id, x: st.x, y: st.y, radius: st.radius, damage: st.damage, hits });
    if (this.modifiers.orbitalBurn) {
      const burn: BurnRt = {
        id: this.nextId++,
        x: st.x,
        y: st.y,
        radius: st.radius,
        timer: ORBITAL.burnDuration,
        duration: ORBITAL.burnDuration,
        dps: ORBITAL.burnDps,
      };
      this.s.burns.push(burn);
      this.emit({ type: 'burnStart', burnId: burn.id, x: burn.x, y: burn.y, radius: burn.radius, duration: burn.duration });
    }
  }

  private reduceCooldowns(amount: number): void {
    for (const id of ['orbital', 'reinforce'] as const) {
      const ab = this.s.abilities[id];
      if (ab.cooldown > 0) {
        ab.cooldown = Math.max(0, ab.cooldown - amount);
        if (ab.cooldown <= 0) {
          ab.ready = true;
          this.emit({ type: 'abilityReady', ability: id });
        }
      }
    }
  }

  // ---- housekeeping ----

  private sweep(): void {
    const s = this.s;
    if (s.enemies.some((e) => e.dead)) {
      for (const e of s.enemies) if (e.dead) this.enemyById.delete(e.id);
      s.enemies = s.enemies.filter((e) => !e.dead);
    }
    if (s.knights.some((k) => k.removed)) {
      for (const k of s.knights) if (k.removed) this.knightById.delete(k.id);
      s.knights = s.knights.filter((k) => !k.removed);
      // dead knights stay in their tower's list only if still tracked
      for (const t of s.towers) t.knightIds = t.knightIds.filter((id) => this.knightById.has(id));
    }
  }

  private updateDerived(): void {
    const s = this.s;
    s.wave.earlyBonus = s.wave.countdown !== null ? Math.floor(s.wave.countdown * EARLY_GOLD_PER_SEC) : 0;
    const boss = s.enemies.find((e) => e.boss);
    if (boss) {
      if (s.boss && s.boss.id === boss.id) {
        s.boss.hp = boss.hp;
        s.boss.maxHp = boss.maxHp;
      } else s.boss = { id: boss.id, hp: boss.hp, maxHp: boss.maxHp };
    } else s.boss = null;
  }

  private checkEnd(): void {
    const s = this.s;
    if (s.lives <= 0) {
      s.status = 'lost';
      this.emit({ type: 'lost', wave: s.wave.index });
      return;
    }
    if (s.status === 'running' && s.wave.index >= s.wave.total && !this.waveRt && s.enemies.length === 0) {
      s.status = 'won';
      s.stars = starsForLives(s.lives);
      this.emit({ type: 'won', lives: s.lives, stars: s.stars });
    }
  }
}

/** High flier = not catchable by knights or bombs. A netted flier is pulled down and counts as a ground UFO. */
function isAirborne(e: { flier: boolean; netted: boolean }): boolean {
  return e.flier && !e.netted;
}

function fail(reason: NonNullable<CommandResult['reason']>): CommandResult {
  return { ok: false, reason };
}

/** Formation slot `i` of `n` around a post. */
export function formationOffset(i: number, n: number): Vec2 {
  if (n <= 1) return { x: 0, y: 0 };
  const a = (i / n) * Math.PI * 2 + Math.PI / 4;
  return { x: Math.cos(a) * KNIGHT.formationRadius, y: Math.sin(a) * KNIGHT.formationRadius };
}
