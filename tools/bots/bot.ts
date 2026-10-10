import { ENEMIES } from '../../src/core/data/enemies';
import { deriveSpots } from '../../src/core/level';
import type { Sim } from '../../src/core/sim/Sim';
import type { EnemyState, LevelDef, TowerState } from '../../src/core/types';
import type { BotConfig, PlanAction } from './types';

/**
 * A scripted player. `act` is called a few times per simulated second and issues commands on the real Sim,
 * exactly as the UI would (build / upgrade / rally / abilities / early wave calls).
 */
export class Bot {
  private idx = 0;
  private readonly spotAt = new Map<string, number>();
  private readonly spotsByEntry: number[];

  constructor(
    readonly cfg: BotConfig,
    private readonly level: LevelDef,
    private readonly plan: readonly PlanAction[],
  ) {
    const spots = deriveSpots(level);
    for (const s of spots) this.spotAt.set(`${s.col},${s.row}`, s.id);
    // spots ordered by distance to the first path's entry (for the naive bot)
    const entry = level.paths[0][1];
    this.spotsByEntry = spots
      .map((s) => ({ id: s.id, d: Math.min(...level.paths.map((p) => Math.hypot(p[1].x - s.x, p[1].y - s.y))) + 0 * entry.x }))
      .sort((a, b) => a.d - b.d || a.id - b.id)
      .map((s) => s.id);
  }

  act(sim: Sim): void {
    const s = sim.state;
    if (s.status === 'won' || s.status === 'lost') return;
    switch (this.cfg.style) {
      case 'idle':
        if (s.status === 'pre') sim.callNextWave();
        return;
      case 'naive':
        this.naive(sim);
        if (s.status === 'pre') sim.callNextWave();
        return;
      default:
        this.runPlan(sim);
        if (s.status === 'pre' && !this.nextAffordable(sim)) sim.callNextWave();
    }
    if (s.status !== 'running') return;
    if (this.cfg.abilities !== 'none') {
      this.orbital(sim);
      this.reinforce(sim);
    }
    if (this.cfg.early !== 'never') this.earlyCall(sim);
  }

  // ---------------------------------------------------------------------------------------------
  // plan execution
  // ---------------------------------------------------------------------------------------------

  private spotId(at: readonly [number, number]): number {
    const id = this.spotAt.get(`${at[0]},${at[1]}`);
    if (id === undefined) throw new Error(`${this.level.id}: plan references (${at[0]},${at[1]}) which is not a build spot`);
    return id;
  }

  private runPlan(sim: Sim): void {
    while (this.idx < this.plan.length) {
      const a = this.plan[this.idx];
      if (a.wave !== undefined && sim.state.wave.index < a.wave) return;
      if (a.do === 'build') {
        const kind = this.cfg.onlyKind ?? a.kind;
        const r = sim.build(this.spotId(a.at), kind);
        if (!r.ok && r.reason === 'gold') return;
      } else if (a.do === 'up') {
        const t = sim.towerAtSpot(this.spotId(a.at));
        if (t) {
          const r = sim.upgrade(t.id);
          if (!r.ok && r.reason === 'gold') return;
        }
      } else {
        const t = sim.towerAtSpot(this.spotId(a.at));
        if (t && t.kind === 'barracks') sim.setRally(t.id, { x: a.to[0], y: a.to[1] });
      }
      this.idx++;
    }
  }

  /** True if the next pending plan action could be executed with the current gold. */
  private nextAffordable(sim: Sim): boolean {
    while (this.idx < this.plan.length) {
      const a = this.plan[this.idx];
      if (a.wave !== undefined && sim.state.wave.index < a.wave) return false;
      if (a.do === 'build') return sim.canAfford(sim.costOf(this.cfg.onlyKind ?? a.kind));
      if (a.do === 'up') {
        const t = sim.towerAtSpot(this.spotId(a.at));
        if (!t) {
          this.idx++;
          continue;
        }
        const c = sim.upgradeCostOf(t.id);
        if (c === null) {
          this.idx++;
          continue;
        }
        return sim.canAfford(c);
      }
      this.idx++;
    }
    return false;
  }

  // ---------------------------------------------------------------------------------------------
  // naive: cheapest tower near the spawn, upgrades when affordable
  // ---------------------------------------------------------------------------------------------

  private naive(sim: Sim): void {
    const limit = this.spotsByEntry.length;
    const near = this.spotsByEntry.slice(0, limit);
    for (let guard = 0; guard < 50; guard++) {
      const free = near.find((id) => !sim.towerAtSpot(id));
      if (free !== undefined && sim.canAfford(sim.costOf('archer'))) {
        if (sim.build(free, 'archer').ok) continue;
      }
      if (free !== undefined && !sim.canAfford(sim.costOf('archer'))) {
        // saving for the next tower, but cheap upgrades are not worth waiting for
        return;
      }
      // all near spots used: upgrade the lowest level tower that can still be upgraded
      const towers = [...sim.state.towers].sort((a, b) => a.level - b.level || a.id - b.id);
      let did = false;
      for (const t of towers) {
        if (sim.canUpgrade(t.id).ok) {
          sim.upgrade(t.id);
          did = true;
          break;
        }
      }
      if (!did) return;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // abilities
  // ---------------------------------------------------------------------------------------------

  private predicted(e: EnemyState, secs: number): { x: number; y: number } {
    const sp = ENEMIES[e.type].speed * (e.slowed ? e.slowFactor : 1) * (e.engaged ? 0 : 1);
    return { x: e.x + e.dirX * sp * secs, y: e.y + e.dirY * sp * secs };
  }

  private orbital(sim: Sim): void {
    const s = sim.state;
    const ab = s.abilities.orbital;
    if (!ab.ready || s.enemies.length === 0) return;
    const expert = this.cfg.abilities === 'expert';
    const en = s.enemies;
    const pos = en.map((e) => this.predicted(e, ab.delay));
    const r2 = (ab.radius - 0.15) ** 2;
    let best = -1;
    let bx = 0;
    let by = 0;
    let bestNear = 0;
    for (let i = 0; i < en.length; i++) {
      let score = 0;
      for (let j = 0; j < en.length; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        if (dx * dx + dy * dy > r2) continue;
        let v = Math.min(ab.damage, en[j].hp);
        if (en[j].boss) v *= 3;
        else if (ENEMIES[en[j].type].lives >= 2) v *= 1.5;
        score += v;
      }
      if (score > best) {
        best = score;
        bx = pos[i].x;
        by = pos[i].y;
        bestNear = en[i].pathLength - en[i].progress;
      }
    }
    const threshold = expert ? 100 : 150;
    // emergency: a decent cluster about to leak
    const emergency = bestNear < 6 && best >= 45;
    if (best >= threshold || emergency) sim.castOrbital({ x: bx, y: by });
  }

  private reinforce(sim: Sim): void {
    const s = sim.state;
    const ab = s.abilities.reinforce;
    if (!ab.ready) return;
    const expert = this.cfg.abilities === 'expert';
    const ground = s.enemies.filter((e) => !e.flier && !e.boss);
    if (ground.length === 0) return;
    let lead = ground[0];
    for (const e of ground) if (e.progress > lead.progress) lead = e;
    const frac = lead.progress / lead.pathLength;
    if (frac < (expert ? 0.12 : 0.25) || frac > 0.985) return;
    let cluster = 0;
    for (const e of ground) if (Math.hypot(e.x - lead.x, e.y - lead.y) <= 2.0) cluster++;
    const big = ENEMIES[lead.type].hp >= 80;
    if (cluster < 2 && !big && frac < 0.75) return;
    const p = this.predicted(lead, 0.5);
    const n = sim.nearestPathPoint({ x: p.x + lead.dirX * 0.4, y: p.y + lead.dirY * 0.4 });
    if (n) sim.castReinforcements({ x: n.x, y: n.y });
  }

  // ---------------------------------------------------------------------------------------------
  // early wave calls
  // ---------------------------------------------------------------------------------------------

  private earlyCall(sim: Sim): void {
    const w = sim.state.wave;
    if (w.countdown === null || w.countdown < 3) return;
    if (this.cfg.early === 'competent') {
      if (sim.state.enemies.length === 0) sim.callNextWave();
      return;
    }
    // expert: nothing dangerous left on the map and the defense is intact
    const left = sim.state.enemies;
    const worry = left.some((e) => e.progress / e.pathLength > 0.55 || ENEMIES[e.type].lives >= 2);
    if (left.length <= 5 && !worry) sim.callNextWave();
  }
}

export function towerSummary(towers: readonly TowerState[]): string {
  const k = { archer: 'A', wizard: 'W', barracks: 'B', bomb: 'X' } as const;
  return towers.map((t) => `${k[t.kind]}${t.level}`).join(' ');
}
