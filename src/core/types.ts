/**
 * Shared types for the pure simulation core. No Phaser / DOM here.
 * All positions are in grid ("tile") units: cell (x, y) has its centre at (x + 0.5, y + 0.5).
 */

export type Biome = 'spring' | 'desert' | 'winter';
export type TowerKind = 'archer' | 'wizard' | 'barracks' | 'bomb';
export type EnemyId = 'scout' | 'dart' | 'skimmer' | 'plated' | 'prism' | 'carrier' | 'dread' | 'mothership';
/**
 * Tower specializations (docs/DESIGN.md section 12). Two per tower kind, bought once per Lv3 tower on levels with
 * `LevelDef.specsUnlocked` (levels 7-10), permanent.
 */
export type SpecId =
  | 'eagle_eye' | 'hunting_nets' // archer
  | 'chain_lightning' | 'fire_mages' // wizard
  | 'bigger_bombs' | 'homing_missiles' // bomb
  | 'bow_training' | 'extra_recruits'; // barracks
export type DamageType = 'physical' | 'magic' | 'true';
export type AbilityId = 'orbital' | 'reinforce';

export interface Vec2 {
  x: number;
  y: number;
}

// --------------------------------------------------------------------------------------------
// Level definition
// --------------------------------------------------------------------------------------------

/**
 * Tile characters in `LevelDef.tiles`:
 *  '.' ground, '#' road, 'B' build spot, 'T' tree, 'r' rock, 'c' crystal, 'd' small decoration, ' ' void (nothing drawn).
 */
export type TileChar = '.' | '#' | 'B' | 'T' | 'r' | 'c' | 'd' | ' ';

/** Per-cell biome for `biome: 'mixed'` levels: 's' spring, 'd' desert, 'w' winter. */
export type BiomeChar = 's' | 'd' | 'w';

export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  /** Seconds between two spawns of this group. */
  interval: number;
  /** Seconds from wave start until the first spawn of this group. */
  delay: number;
  /** Index into `LevelDef.paths`. */
  path: number;
}

export interface WaveDef {
  groups: SpawnGroup[];
}

export interface TowerCap {
  archer: number;
  wizard: number;
  barracks: number;
  /** Bomb tower cap (1..3). Lv3 (Cluster Bomb) unlocks on level 6. */
  bomb: number;
}

export interface LevelHint {
  /**
   * The hint is relevant while `state.wave.index === waveIndex`
   * (wave.index = number of waves started so far; 0 = level start, before the first wave is called).
   */
  waveIndex: number;
  text: string;
}

export interface LevelDef {
  id: string;
  name: string;
  biome: Biome | 'mixed';
  /** ASCII rows, tiles[y][x]. See TileChar. All rows must have equal length. */
  tiles: string[];
  /** For `biome: 'mixed'`: same dimensions as tiles, one BiomeChar per cell. */
  biomeMap?: string[];
  /**
   * Explicit enemy paths: polylines of cell-centre coordinates (grid units), axis-aligned segments, running over
   * '#' cells only. The first point is just off-map (e.g. x = -0.5) and the last point just off-map past the exit.
   */
  paths: Vec2[][];
  startGold: number;
  /** Starting lives (20). */
  lives: number;
  /** Seconds between the end of a wave's spawning and the automatic start of the next wave (default 18). */
  waveGap?: number;
  towerCap: TowerCap;
  /**
   * Tower specializations can be bought on this level (campaign: true on levels 7-10, absent/false before). Because it is a
   * property of the level, replays of a level behave exactly like the first play. `SimOptions.specs` overrides it.
   */
  specsUnlocked?: boolean;
  waves: WaveDef[];
  hints?: LevelHint[];
}

/** A fixed build spot, derived from the 'B' cells (id = index in row-major order). */
export interface BuildSpot {
  id: number;
  /** Cell coordinates. */
  col: number;
  row: number;
  /** Cell centre in grid units. */
  x: number;
  y: number;
}

// --------------------------------------------------------------------------------------------
// Star upgrade tree
// --------------------------------------------------------------------------------------------

export type UpgradeTrack = 'archers' | 'wizards' | 'barracks' | 'orbital' | 'reinforcements' | 'bombs';

/** Purchased tiers per track (0..3). Old saves without a track (e.g. 'bombs') default to 0. */
export type UpgradeState = Record<UpgradeTrack, number>;

// --------------------------------------------------------------------------------------------
// Commands
// --------------------------------------------------------------------------------------------

export type FailReason =
  | 'gold' // not enough gold
  | 'capped' // level cap of this stage forbids it
  | 'max_level' // already level 3
  | 'occupied' // build spot already has a tower
  | 'no_spot' // unknown build spot
  | 'no_tower' // unknown tower id
  | 'wrong_kind' // e.g. setRally on a non-barracks
  | 'out_of_range' // rally point too far from tower / target outside map
  | 'not_on_road' // point not close enough to an enemy path
  | 'cooldown' // ability on cooldown
  | 'locked' // specialize on a level without specializations (before level 7)
  | 'not_max_level' // specialize before the tower is level 3
  | 'already_specialized' // the tower already has its (permanent) specialization
  | 'wave_in_progress' // callNextWave while the current wave is still spawning
  | 'no_more_waves' // callNextWave after the last wave started
  | 'not_running' // abilities before the first wave
  | 'ended'; // level already won/lost

export interface CommandResult {
  ok: boolean;
  reason?: FailReason;
}

// --------------------------------------------------------------------------------------------
// Snapshot types (read-only views of the simulation)
// --------------------------------------------------------------------------------------------

export type SimStatus = 'pre' | 'running' | 'won' | 'lost';

export interface TowerState {
  readonly id: number;
  readonly spotId: number;
  readonly kind: TowerKind;
  /** 1..3 */
  readonly level: number;
  readonly x: number;
  readonly y: number;
  /** Total gold invested (build + upgrades). */
  readonly invested: number;
  /** Refund if sold now. */
  readonly sellValue: number;
  /** Effective range in tiles (archer/wizard/bomb attack range, barracks rally range). */
  readonly range: number;
  /** Seconds until the next shot (archer/wizard/bomb). 0 = ready. */
  readonly cooldown: number;
  /** Current target, if any (archer/wizard: first enemy in range; bomb: ground enemy with the most neighbours in the splash). Not barracks. */
  readonly targetId: number | null;
  readonly targetX: number | null;
  readonly targetY: number | null;
  /** Unit vector facing (towards target, or last target). */
  readonly facingX: number;
  readonly facingY: number;
  /** True for ~0.3 s after a shot: use for bow/wand animation. */
  readonly attacking: boolean;
  /** Incremented on every shot (handy for triggering animations without events). */
  readonly shotCount: number;
  /**
   * Specialization bought for this tower (null = none). Permanent. Changes `range`, damage and behaviour, see `SPEC_TUNING`
   * in data/specs.ts. Use for the tower emblem.
   */
  readonly spec: SpecId | null;
  /**
   * Seconds until the spec's periodic power fires (hunting_nets: next net, homing_missiles: next missile volley); 0 = ready,
   * it fires as soon as a UFO is in range. The timer counts down continuously. Always 0 for other specs / no spec.
   */
  readonly specCooldown: number;
  /** Full period of `specCooldown` in seconds (0 when the spec has no periodic power). Use for a charge indicator. */
  readonly specCooldownMax: number;
  /**
   * eagle_eye only: arrows fired since the last armor-ignoring one (0..3). The arrow fired while this is 3 ignores all armor,
   * and resets it to 0. 0 for other specs.
   */
  readonly specCounter: number;
  /** Barracks only: rally post (grid units). */
  readonly rallyX: number | null;
  readonly rallyY: number | null;
  /** Barracks only: ids of its knights (alive or dead-awaiting-respawn). */
  readonly knightIds: readonly number[];
}

export type KnightKind = 'knight' | 'militia';
export type KnightMode = 'idle' | 'walking' | 'fighting' | 'dead';

export interface KnightState {
  readonly id: number;
  readonly kind: KnightKind;
  /** Owning barracks, or null for militia. */
  readonly towerId: number | null;
  /** Barracks level (1..3) for knights; 1 for militia. */
  readonly level: number;
  readonly x: number;
  readonly y: number;
  /** Unit facing vector. */
  readonly facingX: number;
  readonly facingY: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly armor: number;
  readonly mode: KnightMode;
  /** Enemy currently being fought / chased. */
  readonly targetId: number | null;
  /** True for ~0.25 s after a swing. */
  readonly attacking: boolean;
  /** Bow Training: this knight shoots arrows when not in melee (its barracks has the spec). */
  readonly bow: boolean;
  /** Bow Training: seconds until the next arrow (0 = ready). */
  readonly bowCooldown: number;
  /** Bow Training: true for ~0.25 s after an arrow was shot (bow-draw animation). */
  readonly shooting: boolean;
  /** Rally post the knight defends (engagement radius is measured from here). */
  readonly postX: number;
  readonly postY: number;
  /** Idle slot (post + formation offset) the knight walks back to. */
  readonly homeX: number;
  readonly homeY: number;
  /** Seconds until respawn when mode === 'dead' (knights only). */
  readonly respawnTimer: number;
  /** Seconds of life left (militia only; -1 for barracks knights, who live until killed). */
  readonly lifeLeft: number;
}

export interface EnemyState {
  readonly id: number;
  readonly type: EnemyId;
  readonly x: number;
  readonly y: number;
  /** Unit direction of travel (grid units). */
  readonly dirX: number;
  readonly dirY: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly flier: boolean;
  readonly boss: boolean;
  /** True while a knight/militia is in melee contact (enemy has stopped to fight). */
  readonly engaged: boolean;
  /** Knight ids in contact with this enemy this tick. */
  readonly engagedBy: readonly number[];
  readonly slowed: boolean;
  /**
   * Hunting Nets: true while caught in a net. A netted UFO cannot move (it can still fight knights it is engaged with, and be
   * shot). A netted FLIER is pulled down: it counts as a blockable ground UFO (knights engage it, bombs hit it), so the
   * renderer should draw it low (`flier && !netted` = high flier). Bosses are never netted (they are slowed instead).
   */
  readonly netted: boolean;
  /** Seconds of root left (0 when not netted). */
  readonly netTimer: number;
  /** Fire Mages: true while burning (draw an orange HP bar). Burn deals `burnDps` true damage per second. */
  readonly burning: boolean;
  /** Seconds of burning left (0 when not burning). */
  readonly burnTimer: number;
  readonly burnDps: number;
  /** True for ~0.25 s after its melee swing. */
  readonly attacking: boolean;
  readonly pathIndex: number;
  /** Distance travelled along the path (tiles). */
  readonly progress: number;
  /** Total path length (tiles); progress/pathLength is the 0..1 route fraction. */
  readonly pathLength: number;
  /** Lateral offset (tiles, perpendicular to path). */
  readonly lateral: number;
  readonly slowTimer: number;
  readonly slowFactor: number;
  readonly attackTimer: number;
  readonly launchTimer: number;
  /** Internal: set when killed/leaked this tick before sweeping. Never true in a snapshot read between steps. */
  readonly dead: boolean;
}

/**
 * - 'arrow' / 'bolt': homing projectiles (fields flightTime/elapsed/progress/radius/arc are 0).
 * - 'shell': bomb-tower artillery shell. Lobbed to a FIXED ground point (tx, ty = target position at fire time, no lead),
 *   flies `flightTime` seconds, then explodes (splash `radius`). x/y move linearly on the ground from (fromX, fromY) to
 *   (tx, ty); the renderer adds the height arc using `progress` and `arc`.
 * - 'net': Hunting Nets (archer spec). Lobbed like a shell to a FIXED ground point (tx, ty = predicted cluster centre), `radius` =
 *   catch radius, `flightTime` ~0.4-0.5 s, `arc` apex height. On landing it emits 'net' (and roots the UFOs in `radius`).
 * - 'missile': Homing Missiles (bomb spec). Homing like an arrow (speed ~6.5 t/s, `targetId`), explodes on reaching the target
 *   (or at its last known position when the target died) with splash `radius` (0.5), `damage` physical. Hits fliers too.
 *   Emits 'explode' (kind 'missile').
 * - 'knightArrow': Bow Training arrow shot by a knight (`knightId`), homing like an 'arrow', `towerId` = its barracks.
 * - 'bomblet': Cluster Bomb sub-munition. Spawned at the shell's impact point (fromX, fromY), hops to a scatter point
 *   (tx, ty) in `flightTime` (~0.35 s) and explodes there with `radius`. Same fields as a shell.
 */
export type ProjectileKind = 'arrow' | 'bolt' | 'shell' | 'bomblet' | 'net' | 'missile' | 'knightArrow';

export interface ProjectileState {
  readonly id: number;
  readonly kind: ProjectileKind;
  readonly x: number;
  readonly y: number;
  readonly fromX: number;
  readonly fromY: number;
  /** Target enemy id (may no longer exist: then the projectile flies to tx,ty and fizzles). */
  readonly targetId: number;
  readonly tx: number;
  readonly ty: number;
  readonly speed: number;
  /** Raw (pre-resistance) damage. */
  readonly damage: number;
  readonly damageType: DamageType;
  readonly towerId: number;
  /** Armor reduction (archer tier-3 star upgrade). */
  readonly armorPierce: number;
  /** Wizard tier-3 star upgrade: speed multiplier applied for slowDuration seconds (1 = none). */
  readonly slowFactor: number;
  readonly slowDuration: number;
  /** Number of additional chain targets on impact (Chain Lightning: 3; 0 otherwise). */
  readonly chainCount: number;
  readonly chainRange: number;
  readonly chainFactor: number;
  /** Damage factor of each chain jump (Chain Lightning: [0.7, 0.5, 0.35]); empty when no chain. `chainFactor` = factors[0]. */
  readonly chainFactors: readonly number[];
  /** Fire Mages: burn applied to the target on impact (true dps / seconds); 0 = none. */
  readonly igniteDps: number;
  readonly igniteDuration: number;
  /** Eagle Eye: this arrow ignores ALL armor (every 4th arrow). Draw it differently (golden). `armorPierce` is 1 then. */
  readonly armorIgnore: boolean;
  /** 'knightArrow' only: the shooting knight's id (-1 otherwise). */
  readonly knightId: number;
  /** Unit direction of travel (for rotating the sprite). */
  readonly dirX: number;
  readonly dirY: number;
  /** Shell/bomblet only (0 otherwise): total seconds from launch to the explosion. */
  readonly flightTime: number;
  /** Shell/bomblet only: seconds flown so far. */
  readonly elapsed: number;
  /** Shell/bomblet only: elapsed / flightTime, 0..1 (use for the arc: height = 4 * progress * (1 - progress) * arc). */
  readonly progress: number;
  /** Shell/bomblet/missile: splash radius in tiles at the landing point (star-tree + spec bonuses included); net: catch radius. */
  readonly radius: number;
  /** Shell/bomblet only: suggested apex height of the visual arc, in tiles (shell 1.6, bomblet 0.5). */
  readonly arc: number;
  /** Shell only: number of bomblets released on impact (Lv3 Cluster Bomb; 3, or 5 with the star upgrade; 0 = none). */
  readonly bombletCount: number;
  /** Shell only: bomblet damage as a fraction of the shell's rolled damage (0.30, or 0.35 with the star upgrade). */
  readonly bombletFactor: number;
  /** Shell only: blast radius of each bomblet (0.5 x star radius bonus x Bigger Bombs). */
  readonly bombletRadius: number;
  /** Shell only: bomblets land uniformly within this distance of the impact point (0.8, x1.5 with Bigger Bombs). */
  readonly bombletScatter: number;
}

export interface StrikeState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Seconds until the beam lands. */
  readonly timer: number;
  readonly delay: number;
  readonly damage: number;
}

export interface BurnState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly timer: number;
  readonly duration: number;
  readonly dps: number;
}

export interface AbilityState {
  /** Seconds remaining; 0 = ready. */
  readonly cooldown: number;
  readonly cooldownMax: number;
  readonly ready: boolean;
}

export interface OrbitalAbilityState extends AbilityState {
  readonly radius: number;
  readonly damage: number;
  readonly delay: number;
  readonly burn: boolean;
}

export interface ReinforceAbilityState extends AbilityState {
  /** Max distance from an enemy path for the target point. */
  readonly pathRange: number;
  readonly count: number;
  readonly duration: number;
  readonly hp: number;
}

export interface WavePreviewEntry {
  readonly enemy: EnemyId;
  readonly count: number;
}

export interface WavePreview {
  /** 1-based wave number. */
  readonly number: number;
  /** Aggregated by enemy id, in order of first appearance. */
  readonly entries: readonly WavePreviewEntry[];
  /** Distinct path indices this wave spawns on (where to show incoming buttons). */
  readonly paths: readonly number[];
  readonly hasFlier: boolean;
  readonly hasBoss: boolean;
}

export interface WaveState {
  /** Number of waves started so far (0 before the first). */
  readonly index: number;
  readonly total: number;
  /** True while the current wave is still spawning enemies. */
  readonly spawning: boolean;
  /** Seconds until the next wave starts automatically; null if none is pending (pre, spawning, or last wave out). */
  readonly countdown: number | null;
  readonly countdownMax: number;
  /** Composition of the next wave to be called, or null after the last. */
  readonly next: WavePreview | null;
  /** What callNextWave would pay out right now (0 if not callable early). */
  readonly earlyBonus: number;
}

export interface SimStats {
  readonly kills: number;
  readonly leaked: number;
  readonly spawned: number;
  readonly goldEarned: number;
  readonly goldSpent: number;
}

export interface BossInfo {
  readonly id: number;
  readonly hp: number;
  readonly maxHp: number;
}

export interface SimState {
  readonly status: SimStatus;
  /** Simulated seconds. */
  readonly time: number;
  readonly gold: number;
  readonly lives: number;
  readonly maxLives: number;
  readonly wave: WaveState;
  readonly towers: readonly TowerState[];
  readonly knights: readonly KnightState[];
  readonly enemies: readonly EnemyState[];
  readonly projectiles: readonly ProjectileState[];
  readonly strikes: readonly StrikeState[];
  readonly burns: readonly BurnState[];
  readonly abilities: {
    readonly orbital: OrbitalAbilityState;
    readonly reinforce: ReinforceAbilityState;
  };
  /** Alive mothership, if any (for the top-of-screen HP bar). */
  readonly boss: BossInfo | null;
  /** Set when won (1..3), else 0. */
  readonly stars: number;
  readonly stats: SimStats;
}

// --------------------------------------------------------------------------------------------
// Events
// --------------------------------------------------------------------------------------------

export type HitSource = 'arrow' | 'bolt' | 'chain' | 'shell' | 'bomblet' | 'missile' | 'knightArrow' | 'orbital' | 'knight' | 'militia';
export type SpawnSource = 'wave' | 'carrier' | 'mothership';

export type SimEvent =
  | { type: 'build'; towerId: number; spotId: number; kind: TowerKind; x: number; y: number; cost: number }
  | { type: 'upgrade'; towerId: number; kind: TowerKind; level: number; x: number; y: number; cost: number }
  | { type: 'sell'; towerId: number; kind: TowerKind; x: number; y: number; refund: number }
  | { type: 'rally'; towerId: number; x: number; y: number }
  | { type: 'waveStart'; number: number; total: number; early: boolean }
  | { type: 'waveCalledEarly'; number: number; bonus: number; remaining: number }
  | { type: 'spawn'; enemyId: number; enemy: EnemyId; x: number; y: number; source: SpawnSource }
  | { type: 'bossSpawn'; enemyId: number; enemy: EnemyId }
  | { type: 'escortLaunch'; fromId: number; x: number; y: number }
  | { type: 'shoot'; towerId: number; kind: TowerKind; projectileId: number; x: number; y: number; targetId: number; tx: number; ty: number }
  | { type: 'hit'; enemyId: number; enemy: EnemyId; x: number; y: number; amount: number; raw: number; damageType: DamageType; source: HitSource }
  /**
   * A bomb shell or bomblet detonated at (x, y) after its flight. `hits` = number of ground enemies damaged (may be 0).
   * Emitted BEFORE the per-enemy 'hit' / 'kill' events of that explosion. A shell with Cluster Bomb emits its own
   * 'explode' (kind 'shell') and, ~0.35 s later, one 'explode' (kind 'bomblet') per bomblet.
   */
  | { type: 'explode'; towerId: number; kind: 'shell' | 'bomblet' | 'missile'; projectileId: number; x: number; y: number; radius: number; hits: number }
  /** Cluster Bomb: a Lv3 shell released its bomblets at (x, y). Each is a 'bomblet' projectile in `state.projectiles`. */
  | { type: 'cluster'; towerId: number; shellId: number; x: number; y: number; bomblets: { projectileId: number; tx: number; ty: number }[] }
  /**
   * One Chain Lightning jump (from the previously hit UFO's position to the next UFO), emitted before the jump's 'hit'.
   * `jump` is 1-based (1..3), `factor` the damage factor of this jump (0.7 / 0.5 / 0.35).
   */
  | { type: 'chain'; towerId: number; fromX: number; fromY: number; toX: number; toY: number; targetId: number; jump: number; factor: number }
  /** A tower bought its specialization (permanent). `cost` is the gold paid. */
  | { type: 'specialize'; towerId: number; kind: TowerKind; specId: SpecId; x: number; y: number; cost: number }
  /** Hunting Nets: a net was thrown (a 'net' projectile is in `state.projectiles`, lobbed from (fromX, fromY) to (tx, ty)). */
  | { type: 'netLaunch'; towerId: number; projectileId: number; fromX: number; fromY: number; tx: number; ty: number; radius: number; flightTime: number }
  /**
   * Hunting Nets: the net landed at (x, y). `enemyIds` = every UFO caught (rooted for `duration` s; fliers are pulled down).
   * `slowedIds` is the subset that was only slowed (bosses). May be empty (net missed). Also see 'netExpire'.
   */
  | { type: 'net'; towerId: number; projectileId: number; x: number; y: number; radius: number; duration: number; enemyIds: number[]; slowedIds: number[] }
  /** Hunting Nets: the root of a UFO ran out (not emitted if it died first; fliers rise again). */
  | { type: 'netExpire'; enemyId: number; x: number; y: number }
  /** Homing Missiles: a volley left the tower, one entry per missile (each is a 'missile' projectile in `state.projectiles`). */
  | { type: 'missileLaunch'; towerId: number; x: number; y: number; missiles: { projectileId: number; targetId: number }[] }
  /** Fire Mages: a hit ignited (or refreshed, `refreshed: true`) a UFO. dps/duration are the burn's values. */
  | { type: 'ignite'; towerId: number; enemyId: number; x: number; y: number; dps: number; duration: number; refreshed: boolean }
  /** Bow Training: a knight shot an arrow (a 'knightArrow' projectile). (x, y) is the knight's position. */
  | { type: 'knightShoot'; towerId: number; knightId: number; projectileId: number; x: number; y: number; targetId: number; tx: number; ty: number }
  | { type: 'fizzle'; projectileId: number; x: number; y: number }
  | { type: 'kill'; enemyId: number; enemy: EnemyId; x: number; y: number; gold: number; flier: boolean; boss: boolean }
  | { type: 'leak'; enemyId: number; enemy: EnemyId; x: number; y: number; lives: number }
  | { type: 'meleeHit'; attacker: 'knight' | 'militia' | 'enemy'; attackerId: number; targetId: number; x: number; y: number; amount: number }
  | { type: 'knightDeath'; knightId: number; towerId: number | null; kind: KnightKind; x: number; y: number }
  | { type: 'knightRespawn'; knightId: number; towerId: number }
  | { type: 'militiaExpire'; knightId: number; x: number; y: number }
  | { type: 'orbitalWarn'; strikeId: number; x: number; y: number; radius: number; delay: number }
  | { type: 'orbitalHit'; strikeId: number; x: number; y: number; radius: number; damage: number; hits: number }
  | { type: 'burnStart'; burnId: number; x: number; y: number; radius: number; duration: number }
  | { type: 'reinforce'; x: number; y: number; knightIds: number[] }
  | { type: 'abilityReady'; ability: AbilityId }
  | { type: 'won'; lives: number; stars: number }
  | { type: 'lost'; wave: number };

export type SimEventType = SimEvent['type'];
