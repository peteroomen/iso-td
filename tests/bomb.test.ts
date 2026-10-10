import { describe, expect, it } from 'vitest';
import { BOMB, TOWERS, splashFactor } from '../src/core/data/towers';
import { emptyUpgrades, resolveModifiers } from '../src/core/data/upgrades';
import { towerCost, towerStats, upgradeCost } from '../src/core/sim/stats';
import type { Sim } from '../src/core/sim/Sim';
import type { EnemyState } from '../src/core/types';
import { Recorder, makeSim, straightLevel, wave } from './helpers';

/** Spot 1 of the straight level sits at (5.5, 1.5); the road is the line y = 2.5. */
const SPOT = 1;
const up = (patch: Partial<ReturnType<typeof emptyUpgrades>>) => ({ ...emptyUpgrades(), ...patch });

type Rw = { x: number; y: number; progress: number; lateral: number; slowFactor: number; slowTimer: number; slowed: boolean };
const rw = (e: EnemyState) => e as unknown as Rw;

/** Stops an enemy for the rest of the test. */
function freeze(e: EnemyState): void {
  rw(e).slowFactor = 0;
  rw(e).slowTimer = 1e9;
}
/** Teleports an enemy of the straight level (the road runs along y = 2.5 from x = -0.5) to (x, y). */
function place(e: EnemyState, x: number, y: number): void {
  rw(e).progress = x + 0.5;
  rw(e).lateral = y - 2.5;
  rw(e).x = x;
  rw(e).y = y;
}

/** Sim with `kinds` enemies spawned at once (nothing in range yet). Returns after the first tick. */
function setup(enemies: ('scout' | 'dart' | 'plated' | 'dread' | 'skimmer' | 'mothership')[], opts: Parameters<typeof makeSim>[1] = {}, towerLevel = 1) {
  const sim = makeSim(straightLevel({ waves: [wave(...enemies.map((enemy) => ({ enemy, count: 1, interval: 0 })))] }), opts);
  sim.build(SPOT, 'bomb');
  const tower = sim.state.towers[0];
  for (let i = 1; i < towerLevel; i++) sim.upgrade(tower.id);
  sim.callNextWave();
  sim.step();
  return { sim, tower };
}

/** Steps until the (first) shell is about to land on the next tick; returns it. */
function untilShellLanding(sim: Sim) {
  for (let i = 0; i < 600; i++) {
    const p = sim.state.projectiles.find((q) => q.kind === 'shell');
    if (p && p.elapsed + 1 / 60 + 1e-6 >= p.flightTime) return p;
    sim.step();
  }
  throw new Error('no shell');
}

describe('bomb tower data', () => {
  it('has the designed numbers', () => {
    const lv = TOWERS.bomb.levels;
    expect(lv.map((l) => l.cost)).toEqual([100, 160, 240]);
    expect(lv.map((l) => [l.damageMin, l.damageMax])).toEqual([[12, 22], [26, 48], [54, 84]]);
    expect(lv.map((l) => l.cooldown)).toEqual([2.0, 1.9, 1.8]);
    expect(lv.map((l) => l.range)).toEqual([3.0, 3.2, 3.4]);
    expect(lv.map((l) => l.splashRadius)).toEqual([1.0, 1.1, 1.2]);
    expect(lv.map((l) => l.bomblets)).toEqual([0, 0, 3]);
    expect(TOWERS.bomb).toMatchObject({ damageType: 'physical', groundOnly: true });
    expect(TOWERS.archer.groundOnly).toBe(false);
  });

  it('exposes splash radius and groundOnly in the stats views', () => {
    const s1 = towerStats('bomb', 1, emptyUpgrades());
    expect(s1).toMatchObject({ groundOnly: true, splashRadius: 1.0, bomblets: 0, range: 3.0 });
    expect(s1.dps).toBeCloseTo(17 / 2.0);
    const s3 = towerStats('bomb', 3, emptyUpgrades());
    expect(s3).toMatchObject({ splashRadius: 1.2, bomblets: 3, bombletDamageFactor: 0.3, bombletRadius: 0.5 });
    expect(s3.special).toContain('Cluster Bomb');
    expect(towerStats('archer', 3, emptyUpgrades())).toMatchObject({ groundOnly: false, splashRadius: 0, bomblets: 0 });
    expect(makeSim().statsFor('bomb', 2)).toMatchObject({ groundOnly: true, splashRadius: 1.1 });
  });

  it('costs 100 / +160 / +240 and sells for 60%', () => {
    expect(towerCost('bomb', 1, emptyUpgrades())).toBe(100);
    expect(upgradeCost('bomb', 1, emptyUpgrades())).toBe(160);
    expect(upgradeCost('bomb', 2, emptyUpgrades())).toBe(240);
    expect(upgradeCost('bomb', 3, emptyUpgrades())).toBeNull();
    // wizard discount does not touch bombs
    expect(towerCost('bomb', 1, up({ wizards: 1 }))).toBe(100);
    const sim = makeSim(straightLevel({ startGold: 1000 }));
    sim.build(0, 'bomb');
    sim.upgrade(sim.state.towers[0].id);
    sim.upgrade(sim.state.towers[0].id);
    expect(sim.state.gold).toBe(1000 - 500);
    expect(sim.sellValueOf(sim.state.towers[0].id)).toBe(300);
  });
});

describe('splash falloff', () => {
  it('is 100% inside 40% of the radius and falls linearly to 50% at the edge', () => {
    const r = 1.0;
    expect(splashFactor(0, r)).toBe(1);
    expect(splashFactor(0.4, r)).toBe(1);
    expect(splashFactor(0.7, r)).toBeCloseTo(0.75);
    expect(splashFactor(1.0, r)).toBeCloseTo(0.5);
    expect(splashFactor(1.01, r)).toBe(0);
    expect(BOMB.falloffInner).toBe(0.4);
  });

  it('applies to enemies hit by a shell (raw damage per distance)', () => {
    const { sim } = setup(['dread', 'dread', 'dread', 'dread', 'dread']);
    sim.step(); // the shell is in the air
    const shell = untilShellLanding(sim);
    const r = shell.radius;
    expect(r).toBeCloseTo(1.0);
    const offsets = [0, 0.4 * r, 0.7 * r, r - 0.01, r + 0.05];
    sim.state.enemies.forEach((e, i) => {
      freeze(e);
      place(e, shell.tx + offsets[i], shell.ty);
    });
    sim.drainEvents();
    sim.step();
    const ev = sim.drainEvents();
    const ex = ev.find((e) => e.type === 'explode')!;
    expect(ex).toMatchObject({ type: 'explode', kind: 'shell', hits: 4 });
    const hits = ev.filter((e) => e.type === 'hit');
    expect(hits.length).toBe(4);
    const raw = hits.map((h) => (h.type === 'hit' ? h.raw : 0));
    expect(raw[1]).toBeCloseTo(raw[0]);
    expect(raw[2]).toBeCloseTo(raw[0] * splashFactor(0.7 * r, r));
    expect(raw[3]).toBeCloseTo(raw[0] * splashFactor(r - 0.01, r));
    expect(raw[3] / raw[0]).toBeGreaterThan(0.5);
    expect(raw[3] / raw[0]).toBeLessThan(0.52);
    expect(hits.every((h) => h.type === 'hit' && h.source === 'shell' && h.damageType === 'physical')).toBe(true);
    // physical: armor applies (dread 0.6)
    const h0 = hits[0];
    if (h0.type === 'hit') expect(h0.amount).toBeCloseTo(h0.raw * 0.4);
  });
});

describe('bomb targeting', () => {
  it('never targets or shoots high fliers; splash never hurts them', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'skimmer', count: 3, interval: 0.4 })] }));
    sim.build(SPOT, 'bomb');
    sim.callNextWave();
    const rec = new Recorder(sim);
    let sawFlierInRange = false;
    for (let i = 0; i < 60 * 14; i++) {
      rec.step();
      const t = sim.state.towers[0];
      if (sim.state.enemies.some((e) => Math.hypot(e.x - t.x, e.y - t.y) <= t.range)) sawFlierInRange = true;
      expect(t.targetId).toBeNull();
    }
    expect(sawFlierInRange).toBe(true);
    expect(rec.of('shoot').filter((s) => s.e.kind === 'bomb').length).toBe(0);
    expect(sim.state.projectiles.length).toBe(0);

    // a shell that explodes right under a skimmer does nothing to it
    const { sim: s2 } = setup(['scout', 'skimmer']);
    s2.step();
    const shell = untilShellLanding(s2);
    const [scout, skim] = s2.state.enemies;
    expect(scout.type).toBe('scout');
    freeze(scout);
    freeze(skim);
    place(scout, shell.tx, shell.ty);
    place(skim, shell.tx + 0.1, shell.ty);
    const hp = skim.hp;
    s2.drainEvents();
    s2.step();
    const ev = s2.drainEvents();
    expect(ev.find((e) => e.type === 'explode')).toMatchObject({ hits: 1 });
    expect(ev.some((e) => e.type === 'hit' && e.enemy === 'skimmer')).toBe(false);
    expect(skim.hp).toBe(hp);
  });

  it('targets the ground enemy even when a flier is further along the road', () => {
    const { sim, tower } = setup(['skimmer', 'scout']);
    const [skim, scout] = sim.state.enemies;
    place(skim, 6.5, 2.5);
    place(scout, 4.5, 2.5);
    freeze(skim);
    freeze(scout);
    sim.step();
    expect(tower.targetId).toBe(scout.id);
  });

  it('hits the Mothership', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'mothership' })] }));
    sim.build(SPOT, 'bomb');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('hit').some((h) => h.e.enemy === 'mothership' && h.e.source === 'shell'), 60)).toBe(true);
    expect(rec.of('shoot').some((s) => s.e.kind === 'bomb')).toBe(true);
    expect(sim.state.boss!.hp).toBeLessThan(sim.state.boss!.maxHp);
  });

  it('prefers the enemy with the most neighbours in the blast; ties go to the one furthest along the path', () => {
    // lone enemy far ahead (x 6.5) versus a pack of three at x ~ 3.6..3.9 (all in range of the tower at 5.5)
    const { sim, tower } = setup(['scout', 'scout', 'scout', 'scout']);
    const [lone, a, b, c] = sim.state.enemies;
    place(lone, 7.0, 2.5);
    place(a, 3.6, 2.5);
    place(b, 3.8, 2.5);
    place(c, 4.0, 2.5);
    sim.state.enemies.forEach(freeze);
    sim.step();
    expect([a.id, b.id, c.id]).toContain(tower.targetId);
    // tie: two packs of two -> the pack further along the road wins (progress-wise: its leader)
    const t2 = setup(['scout', 'scout', 'scout', 'scout']);
    const [p1, p2, q1, q2] = t2.sim.state.enemies;
    place(p1, 3.4, 2.5);
    place(p2, 3.6, 2.5);
    place(q1, 7.4, 2.5);
    place(q2, 7.6, 2.5);
    t2.sim.state.enemies.forEach(freeze);
    t2.sim.step();
    // tower at 5.5: all four are in range 3.0 (dx <= 2.1); counts are 2 for each member
    expect(t2.tower.targetId).toBe(q2.id);
  });
});

describe('lobbed shells', () => {
  it('fly for ~0.9 s + a little per tile to a fixed point, emitting shoot(kind bomb) with the arc fields', () => {
    const { sim } = setup(['plated']);
    const rec = new Recorder(sim);
    rec.flush();
    const target = sim.state.enemies[0];
    place(target, 4.0, 2.5);
    freeze(target);
    rec.seconds(0.05);
    const shell = sim.state.projectiles.find((p) => p.kind === 'shell')!;
    expect(shell).toBeDefined();
    const d = Math.hypot(shell.tx - shell.fromX, shell.ty - shell.fromY);
    expect(shell.flightTime).toBeCloseTo(BOMB.flightBase + BOMB.flightPerTile * d);
    expect(shell.flightTime).toBeGreaterThanOrEqual(0.9);
    expect(shell.radius).toBeCloseTo(1.0);
    expect(shell.arc).toBe(BOMB.shellArc);
    expect(shell.progress).toBeGreaterThan(0);
    expect(shell.progress).toBeLessThan(0.2);
    const mid = Math.hypot(shell.x - shell.fromX, shell.y - shell.fromY);
    expect(mid).toBeCloseTo(d * shell.progress, 3);
    rec.seconds(shell.flightTime);
    expect(rec.of('explode')[0].e).toMatchObject({ kind: 'shell', projectileId: shell.id });
    expect(rec.of('explode')[0].t - rec.of('shoot')[0].t).toBeCloseTo(shell.flightTime, 1);
    expect(sim.state.projectiles.some((p) => p.id === shell.id)).toBe(false);
  });

  it('can miss a fast Dart: the shell lands where the Dart was', () => {
    const { sim } = setup(['dart']);
    const dart = sim.state.enemies[0];
    place(dart, 4.0, 2.5);
    // not frozen: it keeps running at 1.8 t/s
    const start = dart.x;
    const rec = new Recorder(sim);
    rec.flush();
    expect(rec.until(() => rec.of('explode').length > 0, 5)).toBe(true);
    const ex = rec.of('explode')[0].e;
    expect(ex.hits).toBe(0);
    expect(dart.x).toBeGreaterThan(start + 1.5);
    expect(rec.of('hit').filter((h) => h.e.source === 'shell').length).toBe(0);
    expect(dart.hp).toBe(dart.maxHp);
  });

  it('hits a stationary target of the same speed class', () => {
    const { sim } = setup(['scout']);
    const scout = sim.state.enemies[0];
    place(scout, 4.0, 2.5);
    freeze(scout);
    const rec = new Recorder(sim);
    rec.flush();
    expect(rec.until(() => rec.of('explode').length > 0, 5)).toBe(true);
    expect(rec.of('explode')[0].e.hits).toBe(1);
  });
});

describe('Cluster Bomb (level 3)', () => {
  function clusterRun(seed: number, upgrades = emptyUpgrades()) {
    const { sim } = setup(['dread'], { seed, upgrades }, 3);
    const dread = sim.state.enemies[0];
    place(dread, 4.2, 2.5);
    freeze(dread);
    const rec = new Recorder(sim);
    rec.flush();
    expect(rec.until(() => rec.of('cluster').length > 0, 5)).toBe(true);
    const cluster = rec.of('cluster')[0];
    const flying = sim.state.projectiles.filter((p) => p.kind === 'bomblet');
    rec.seconds(BOMB.bombletFuse + 0.05);
    return { sim, rec, cluster, flying };
  }

  it('releases 3 bomblets within ~0.8 tile that explode after ~0.35 s with radius 0.5 and 30% damage', () => {
    const { sim, rec, cluster, flying } = clusterRun(1);
    const e = cluster.e;
    expect(e.bomblets.length).toBe(3);
    expect(flying.length).toBe(3);
    for (const b of e.bomblets) expect(Math.hypot(b.tx - e.x, b.ty - e.y)).toBeLessThanOrEqual(BOMB.bombletScatter + 1e-9);
    expect(flying.every((p) => p.flightTime === BOMB.bombletFuse && p.radius === 0.5 && p.fromX === e.x)).toBe(true);
    const shellExplode = rec.of('explode').find((x) => x.e.kind === 'shell')!;
    const blets = rec.of('explode').filter((x) => x.e.kind === 'bomblet');
    expect(blets.length).toBe(3);
    for (const b of blets) {
      expect(b.e.radius).toBeCloseTo(0.5);
      expect(b.t - shellExplode.t).toBeCloseTo(BOMB.bombletFuse, 1);
    }
    expect(sim.state.projectiles.filter((p) => p.kind === 'bomblet').length).toBe(0);
    // bomblet hits carry <= 30% of the shell's raw hit (the shell hit the dread at its centre: 100%)
    const shellHit = rec.of('hit').find((h) => h.e.source === 'shell')!.e;
    const bombletHits = rec.of('hit').filter((h) => h.e.source === 'bomblet');
    for (const h of bombletHits) expect(h.e.raw).toBeLessThanOrEqual(shellHit.raw * 0.3 + 1e-9);
    // bombs below level 3 do not cluster
    const lv2 = setup(['dread'], {}, 2);
    place(lv2.sim.state.enemies[0], 4.2, 2.5);
    freeze(lv2.sim.state.enemies[0]);
    const r2 = new Recorder(lv2.sim);
    r2.seconds(4);
    expect(r2.of('explode').length).toBeGreaterThan(0);
    expect(r2.of('cluster').length).toBe(0);
  });

  it('scatters deterministically from the seeded RNG (same seed => same points, other seed => other points)', () => {
    const pts = (seed: number) => clusterRun(seed).cluster.e.bomblets.map((b) => [b.tx, b.ty]);
    expect(pts(5)).toEqual(pts(5));
    expect(pts(5)).not.toEqual(pts(6));
  });

  it('star tier 3 makes it 5 bomblets at 35% damage', () => {
    const { cluster } = clusterRun(1, up({ bombs: 3 }));
    expect(cluster.e.bomblets.length).toBe(5);
    expect(towerStats('bomb', 3, up({ bombs: 3 }))).toMatchObject({ bomblets: 5, bombletDamageFactor: 0.35 });
    expect(towerStats('bomb', 2, up({ bombs: 3 })).bomblets).toBe(0);
  });
});

describe('bomb caps and star track', () => {
  it('respects the per-level cap (reason capped) and the 3-level maximum', () => {
    const sim = makeSim(straightLevel({ towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 2 } }));
    sim.build(0, 'bomb');
    const id = sim.state.towers[0].id;
    expect(sim.upgrade(id).ok).toBe(true);
    expect(sim.upgrade(id)).toEqual({ ok: false, reason: 'capped' });
    const sim1 = makeSim(straightLevel(), { towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 1 } });
    sim1.build(0, 'bomb');
    expect(sim1.upgrade(sim1.state.towers[0].id)).toEqual({ ok: false, reason: 'capped' });
    const sim3 = makeSim(straightLevel());
    sim3.build(0, 'bomb');
    sim3.upgrade(sim3.state.towers[0].id);
    sim3.upgrade(sim3.state.towers[0].id);
    expect(sim3.upgrade(sim3.state.towers[0].id)).toEqual({ ok: false, reason: 'max_level' });
  });

  it('bombs track: T1 +20% radius, T2 +15% damage, T3 cluster upgrade', () => {
    expect(resolveModifiers(up({ bombs: 1 }))).toMatchObject({ bombRadiusMult: 1.2, bombDamageMult: 1, bombletCountOverride: 0 });
    expect(resolveModifiers(up({ bombs: 2 }))).toMatchObject({ bombRadiusMult: 1.2, bombDamageMult: 1.15 });
    expect(resolveModifiers(up({ bombs: 3 }))).toMatchObject({ bombletCountOverride: 5, bombletFactorOverride: 0.35 });
    const base = towerStats('bomb', 2, emptyUpgrades());
    const t1 = towerStats('bomb', 2, up({ bombs: 1 }));
    const t2 = towerStats('bomb', 2, up({ bombs: 2 }));
    expect(t1.splashRadius).toBeCloseTo(base.splashRadius * 1.2);
    expect(t1.damageMax).toBe(base.damageMax);
    expect(t2.damageMax).toBeCloseTo(base.damageMax * 1.15);
    expect(t2.damageMin).toBeCloseTo(base.damageMin * 1.15);
    // does not leak into other towers
    expect(towerStats('archer', 1, up({ bombs: 3 }))).toEqual(towerStats('archer', 1, emptyUpgrades()));
    // in the sim
    const sim = makeSim(straightLevel(), { upgrades: up({ bombs: 2 }) });
    sim.build(SPOT, 'bomb');
    expect(sim.statsFor('bomb', 1).splashRadius).toBeCloseTo(1.2);
    const { sim: s2 } = setup(['plated'], { upgrades: up({ bombs: 1 }) });
    place(s2.state.enemies[0], 4.0, 2.5);
    freeze(s2.state.enemies[0]);
    s2.step();
    expect(s2.state.projectiles.find((p) => p.kind === 'shell')!.radius).toBeCloseTo(1.2);
  });
});
