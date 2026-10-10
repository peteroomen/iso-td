import { describe, expect, it } from 'vitest';
import { SPECS, SPECS_BY_TOWER, SPEC_IDS, SPEC_TUNING, specCost } from '../src/core/data/specs';
import { LEVELS } from '../src/core/data/levels';
import { emptyUpgrades } from '../src/core/data/upgrades';
import { Sim } from '../src/core/sim/Sim';
import { towerStats } from '../src/core/sim/stats';
import type { EnemyState, SpecId, TowerKind, UpgradeState } from '../src/core/types';
import { Recorder, makeSim, straightLevel, wave } from './helpers';

const up = (o: Partial<UpgradeState>): UpgradeState => ({ ...emptyUpgrades(), ...o });
const lvl = (over: Parameters<typeof straightLevel>[0] = {}) => straightLevel({ specsUnlocked: true, startGold: 3000, ...over });

/** Builds a tower of `kind` on `spot`, upgrades it to level 3 and (optionally) buys `spec`. */
function lv3(sim: Sim, kind: TowerKind, spot = 1, spec?: SpecId): number {
  expect(sim.build(spot, kind).ok).toBe(true);
  const id = sim.state.towers[sim.state.towers.length - 1].id;
  expect(sim.upgrade(id).ok).toBe(true);
  expect(sim.upgrade(id).ok).toBe(true);
  if (spec) expect(sim.specialize(id, spec).ok).toBe(true);
  return id;
}

describe('specializations: data', () => {
  it('has two specs per tower kind, ~300 gold each', () => {
    expect(SPEC_IDS.length).toBe(8);
    for (const kind of ['archer', 'wizard', 'barracks', 'bomb'] as TowerKind[]) {
      expect(SPECS_BY_TOWER[kind].length).toBe(2);
      for (const id of SPECS_BY_TOWER[kind]) {
        expect(SPECS[id].tower).toBe(kind);
        expect(specCost(id)).toBeGreaterThanOrEqual(250);
        expect(specCost(id)).toBeLessThanOrEqual(350);
      }
    }
  });
});

describe('specializations: gating', () => {
  it('is locked on levels 1-6 and allowed on levels 7-10 (also with a different tower cap on replays)', () => {
    LEVELS.forEach((l, i) => {
      const sim = new Sim({ ...l, startGold: 5000 });
      expect(sim.specsUnlocked, l.id).toBe(i >= 6);
      if (i < 6) return;
      const spot = sim.spots[0].id;
      sim.build(spot, 'archer');
      const t = sim.state.towers[0];
      sim.upgrade(t.id);
      sim.upgrade(t.id);
      expect(sim.canSpecialize(t.id, 'eagle_eye').ok, l.id).toBe(true);
    });
    const sim6 = new Sim({ ...LEVELS[5], startGold: 5000 });
    sim6.build(sim6.spots[0].id, 'archer');
    const t6 = sim6.state.towers[0];
    sim6.upgrade(t6.id);
    sim6.upgrade(t6.id);
    expect(sim6.specialize(t6.id, 'eagle_eye')).toEqual({ ok: false, reason: 'locked' });
    expect(t6.spec).toBeNull();
  });

  it('option SimOptions.specs overrides the level flag', () => {
    expect(makeSim(straightLevel(), { specs: true }).specsUnlocked).toBe(true);
    expect(makeSim(lvl(), { specs: false }).specsUnlocked).toBe(false);
  });

  it('reasons: no_tower, wrong_kind, not_max_level, gold, already_specialized', () => {
    const sim = makeSim(lvl({ startGold: 800 }));
    expect(sim.specialize(99, 'eagle_eye').reason).toBe('no_tower');
    sim.build(1, 'archer');
    const id = sim.state.towers[0].id;
    expect(sim.specialize(id, 'eagle_eye').reason).toBe('not_max_level');
    sim.upgrade(id);
    expect(sim.specialize(id, 'eagle_eye').reason).toBe('not_max_level');
    sim.upgrade(id);
    expect(sim.specialize(id, 'fire_mages').reason).toBe('wrong_kind');
    expect(sim.specialize(id, 'nonsense' as SpecId).reason).toBe('wrong_kind');
    (sim.state as { gold: number }).gold = 299;
    expect(sim.specialize(id, 'eagle_eye').reason).toBe('gold');
    expect(sim.canSpecialize(id, 'eagle_eye')).toEqual({ ok: false, reason: 'gold' });
    (sim.state as { gold: number }).gold = 1000;
    expect(sim.specialize(id, 'eagle_eye').ok).toBe(true);
    // exclusive & permanent
    expect(sim.specialize(id, 'hunting_nets').reason).toBe('already_specialized');
    expect(sim.specialize(id, 'eagle_eye').reason).toBe('already_specialized');
    expect(sim.state.towers[0].spec).toBe('eagle_eye');
    expect(sim.upgrade(id).reason).toBe('max_level');
  });

  it('locked is reported before the other reasons', () => {
    const sim = makeSim(straightLevel());
    sim.build(1, 'archer');
    expect(sim.specialize(sim.state.towers[0].id, 'eagle_eye').reason).toBe('locked');
  });

  it('costs gold, is part of the investment and 60% of it is refunded on sale', () => {
    const sim = makeSim(lvl());
    const id = lv3(sim, 'archer');
    const before = sim.state.gold;
    const invested = sim.state.towers[0].invested;
    expect(invested).toBe(340);
    expect(sim.specialize(id, 'hunting_nets').ok).toBe(true);
    expect(sim.state.gold).toBe(before - 300);
    expect(sim.state.towers[0].invested).toBe(640);
    expect(sim.state.towers[0].sellValue).toBe(Math.floor(640 * 0.6));
    expect(sim.state.stats.goldSpent).toBe(640);
    const g = sim.state.gold;
    expect(sim.sell(id).ok).toBe(true);
    expect(sim.state.gold).toBe(g + 384);
    // selling a specialized tower frees the spot: a new tower starts without spec
    sim.build(1, 'archer');
    expect(sim.state.towers[0].spec).toBeNull();
  });

  it('emits a specialize event', () => {
    const sim = makeSim(lvl());
    const id = lv3(sim, 'wizard');
    sim.drainEvents();
    sim.specialize(id, 'fire_mages');
    expect(sim.drainEvents()).toEqual([{ type: 'specialize', towerId: id, kind: 'wizard', specId: 'fire_mages', x: 5.5, y: 1.5, cost: 300 }]);
  });

  it('statsFor previews a spec and ignores it below level 3 or for the wrong kind', () => {
    const sim = makeSim(lvl());
    expect(sim.statsFor('archer', 3, 'eagle_eye').range).toBeCloseTo(3.8 * SPEC_TUNING.eagle_eye.rangeMult);
    expect(sim.statsFor('archer', 2, 'eagle_eye').range).toBeCloseTo(3.5);
    expect(sim.statsFor('archer', 3, 'fire_mages').spec).toBeNull();
    expect(sim.specCostOf('chain_lightning')).toBe(300);
  });
});

describe('Archer: Eagle Eye', () => {
  it('+30% range, +20% damage (multiplying the Archers star tree)', () => {
    const base = towerStats('archer', 3, up({ archers: 2 }));
    const eagle = towerStats('archer', 3, up({ archers: 2 }), 'eagle_eye');
    expect(eagle.range).toBeCloseTo(base.range * 1.3);
    expect(eagle.damageMin).toBeCloseTo(base.damageMin * 1.2);
    expect(eagle.damageMax).toBeCloseTo(base.damageMax * 1.2);
    const sim = makeSim(lvl());
    const id = lv3(sim, 'archer', 1, 'eagle_eye');
    expect(sim.getTower(id)!.range).toBeCloseTo(3.8 * 1.3);
  });

  it('every 4th arrow (each arrow of a double shot counts) ignores all armor, also with the star armor piercing', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'plated', count: 6, interval: 0.6 })] }), { upgrades: up({ archers: 3 }) });
    lv3(sim, 'archer', 1, 'eagle_eye');
    sim.callNextWave();
    const seen = new Map<number, { ignore: boolean; pierce: number }>();
    for (let i = 0; i < 60 * 25; i++) {
      sim.step();
      for (const p of sim.state.projectiles) if (p.kind === 'arrow' && !seen.has(p.id)) seen.set(p.id, { ignore: p.armorIgnore, pierce: p.armorPierce });
    }
    const arrows = [...seen.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    expect(arrows.length).toBeGreaterThan(12);
    arrows.forEach((a, i) => {
      if (i % 4 === 3) {
        expect(a.ignore).toBe(true);
        expect(a.pierce).toBe(1);
      } else {
        expect(a.ignore).toBe(false);
        expect(a.pierce).toBeCloseTo(0.3);
      }
    });
  });

  it('the armor-ignoring arrow deals its full raw damage to a plated UFO', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'plated', count: 3, interval: 1 })] }));
    lv3(sim, 'archer', 1, 'eagle_eye');
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(25);
    const hits = rec.of('hit').filter((h) => h.e.source === 'arrow').map((h) => h.e as Extract<typeof h.e, { type: 'hit' }>);
    const full = hits.filter((h) => Math.abs(h.amount - h.raw) < 1e-9);
    const reduced = hits.filter((h) => Math.abs(h.amount - h.raw * 0.2) < 1e-9);
    expect(full.length).toBeGreaterThan(2);
    expect(reduced.length).toBeGreaterThan(full.length);
  });
});

describe('Archer: Hunting Nets', () => {
  it('throws a net every 6.5 s at the densest cluster; caught UFOs are rooted for 3 s, then released', () => {
    // 3 plated in a tight group, 1 plated ahead of them, all in range at once
    const sim = makeSim(
      lvl({ waves: [wave({ enemy: 'plated', count: 3, interval: 0.3 }, { enemy: 'plated', count: 1, delay: 4 })] }),
    );
    const id = lv3(sim, 'archer', 1, 'hunting_nets');
    expect(sim.getTower(id)!.specCooldownMax).toBe(SPEC_TUNING.hunting_nets.cooldown);
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('net').length > 0, 40)).toBe(true);
    const launch = rec.of('netLaunch')[0];
    const net = rec.of('net')[0];
    expect(net.t).toBeGreaterThan(launch.t);
    expect(net.t - launch.t).toBeLessThan(0.7); // short flight
    expect(net.e.radius).toBe(SPEC_TUNING.hunting_nets.radius);
    expect(net.e.duration).toBe(SPEC_TUNING.hunting_nets.rootDuration);
    expect(net.e.enemyIds.length).toBeGreaterThanOrEqual(2);
    expect(net.e.slowedIds).toEqual([]);
    const caught = sim.state.enemies.filter((e) => net.e.enemyIds.includes(e.id));
    expect(caught.every((e) => e.netted)).toBe(true);
    const x0 = caught.map((e) => e.x);
    rec.seconds(2.4);
    expect(caught.map((e) => e.x)).toEqual(x0); // rooted
    expect(caught.every((e) => e.netted && e.netTimer > 0)).toBe(true);
    rec.seconds(0.8);
    expect(rec.of('netExpire').length).toBeGreaterThan(0);
    expect(caught.some((e) => !e.netted)).toBe(true);
    rec.seconds(1);
    expect(caught.some((e, i) => !e.netted && e.x > x0[i])).toBe(true); // moving again
    // the timer: next net no earlier than 9 s after the first launch
    rec.until(() => rec.of('netLaunch').length >= 2, 60);
    if (rec.of('netLaunch').length >= 2) expect(rec.of('netLaunch')[1].t - launch.t).toBeGreaterThanOrEqual(SPEC_TUNING.hunting_nets.cooldown - 0.02);
  });

  it('does nothing without UFOs in range and fires at once when one arrives', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'scout', count: 1 })] }));
    const id = lv3(sim, 'archer', 1, 'hunting_nets');
    sim.runFor(10);
    expect(sim.getTower(id)!.specCooldown).toBe(0);
    expect(sim.state.projectiles.length).toBe(0);
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('netLaunch').length > 0, 30)).toBe(true);
    expect(sim.getTower(id)!.specCooldown).toBeGreaterThan(SPEC_TUNING.hunting_nets.cooldown - 0.5);
  });

  it('aims at the densest cluster, not at the leader', () => {
    // first UFO is alone 3 tiles ahead of a pack of 4 (all inside the 3.8 range of the tower at x=5.5)
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'plated', count: 1 }, { enemy: 'plated', count: 4, interval: 0.25, delay: 3.5 })] }));
    lv3(sim, 'archer', 1, 'hunting_nets');
    sim.callNextWave();
    const rec = new Recorder(sim);
    // throw only once the pack is also in range: hold the timer
    (sim.state.towers[0] as { specCooldown: number }).specCooldown = 8; // hold the net until the pack is in range too
    expect(rec.until(() => rec.of('net').length > 0, 60)).toBe(true);
    expect(rec.of('net')[0].e.enemyIds.length).toBeGreaterThanOrEqual(3);
  });

  it('bosses are slowed 50% for 3 s instead of rooted', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'mothership', count: 1 })] }));
    lv3(sim, 'archer', 1, 'hunting_nets');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('net').length > 0, 60)).toBe(true);
    const boss = sim.state.enemies.find((e) => e.boss)!;
    const net = rec.of('net')[0].e;
    expect(net.enemyIds).toContain(boss.id);
    expect(net.slowedIds).toContain(boss.id);
    expect(boss.netted).toBe(false);
    expect(boss.slowed).toBe(true);
    expect(boss.slowFactor).toBe(0.5);
    const x0 = boss.progress;
    rec.seconds(1);
    expect(boss.progress - x0).toBeCloseTo(0.35 * 0.5, 1); // still walks, at half speed
  });

  it('pulls fliers down: a netted skimmer is engaged by knights, a free one is not', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'skimmer', count: 1 })] }));
    lv3(sim, 'archer', 1, 'hunting_nets');
    sim.build(3, 'barracks'); // rally post on the road at (2.5, 2.5), where the net lands
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.step();
    const sk = sim.state.enemies[0] as { hp: number; maxHp: number } & EnemyState;
    sk.hp = sk.maxHp = 100000; // keep it alive for the observation
    let engagedFree = false;
    expect(
      rec.until(() => {
        if (!sk.netted && sk.engaged) engagedFree = true;
        return sk.netted;
      }, 40),
    ).toBe(true);
    expect(engagedFree).toBe(false);
    expect(sk.flier).toBe(true);
    let engaged = false;
    for (let i = 0; i < 60 * 2.4 && sk.netted; i++) {
      rec.step();
      if (sk.engaged) engaged = true;
    }
    expect(engaged).toBe(true);
    expect(sk.engagedBy.length).toBeGreaterThan(0);
  });

  it('a free (un-netted) skimmer is never engaged', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'skimmer', count: 1 })] }));
    sim.build(3, 'barracks');
    sim.callNextWave();
    const rec = new Recorder(sim);
    let engaged = false;
    for (let i = 0; i < 60 * 15; i++) {
      rec.step();
      if (sim.state.enemies[0]?.engaged) engaged = true;
    }
    expect(engaged).toBe(false);
  });

  it('a netted flier counts as ground for bombs, a free one does not', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'skimmer', count: 1 })] }));
    lv3(sim, 'archer', 1, 'hunting_nets');
    lv3(sim, 'bomb', 4);
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.step();
    const sk = sim.state.enemies[0] as { hp: number; maxHp: number } & EnemyState;
    sk.hp = sk.maxHp = 100000;
    rec.until(() => sk.netted, 40);
    const shellsBefore = rec.of('shoot').filter((x) => x.e.kind === 'bomb').length;
    rec.seconds(2);
    expect(rec.of('shoot').filter((x) => x.e.kind === 'bomb').length).toBeGreaterThan(shellsBefore);
  });
});

describe('Wizard: Chain Lightning', () => {
  it('bolts jump 3 times for 50% / 35% / 20% within 1.5 t', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'plated', count: 6, interval: 0.5 })] }));
    lv3(sim, 'wizard', 1, 'chain_lightning');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('chain').length >= 3, 40)).toBe(true);
    const chains = rec.of('chain');
    // group per bolt: a jump 1 starts a new bolt
    const first = chains.findIndex((c) => c.e.jump === 1);
    const F = SPEC_TUNING.chain_lightning.factors;
    expect(chains[first].e.factor).toBe(F[0]);
    expect(chains[first + 1].e.jump).toBe(2);
    expect(chains[first + 1].e.factor).toBe(F[1]);
    expect(chains[first + 2].e.jump).toBe(3);
    expect(chains[first + 2].e.factor).toBe(F[2]);
    for (const c of chains.slice(first, first + 3)) expect(Math.hypot(c.e.toX - c.e.fromX, c.e.toY - c.e.fromY)).toBeLessThanOrEqual(SPEC_TUNING.chain_lightning.range + 1e-9);
    const hits = rec.log.map((x) => x.e).filter((e) => e.type === 'hit');
    const bolt = hits.find((h) => h.type === 'hit' && h.source === 'bolt') as Extract<(typeof hits)[number], { type: 'hit' }>;
    const chainHits = hits.filter((h) => h.type === 'hit' && h.source === 'chain') as Extract<(typeof hits)[number], { type: 'hit' }>[];
    expect(chainHits[0].raw).toBeCloseTo(bolt.raw * F[0]);
    expect(chainHits[1].raw).toBeCloseTo(bolt.raw * F[1]);
    expect(chainHits[2].raw).toBeCloseTo(bolt.raw * F[2]);
  });

  it('never hits the same UFO twice and stops when nothing is in range; chain hits apply the star slow', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'plated', count: 2, interval: 0.5 })] }), { upgrades: up({ wizards: 3 }) });
    lv3(sim, 'wizard', 1, 'chain_lightning');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('chain').length >= 1, 40)).toBe(true);
    rec.seconds(0.01);
    expect(sim.state.enemies.length).toBe(2);
    expect(sim.state.enemies.every((e) => e.slowed)).toBe(true); // primary and the chained one
    const perBolt = rec.of('chain').filter((c) => c.e.jump === 1);
    expect(perBolt.length).toBeGreaterThan(0);
    expect(rec.of('chain').every((c) => c.e.jump <= 1)).toBe(true); // only 2 UFOs: one jump per bolt
  });
});

describe('Wizard: Fire Mages', () => {
  it('hits ignite for true damage over 4 s (ignores magic resistance), refreshing without stacking', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'prism', count: 1 })] }));
    lv3(sim, 'wizard', 1, 'fire_mages');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('ignite').length > 0, 40)).toBe(true);
    const e = sim.state.enemies[0];
    expect(rec.of('ignite')[0].e).toMatchObject({ enemyId: e.id, dps: SPEC_TUNING.fire_mages.dps, duration: SPEC_TUNING.fire_mages.duration, refreshed: false });
    expect(e.burning).toBe(true);
    expect(e.burnDps).toBe(SPEC_TUNING.fire_mages.dps);
    // damage from burn alone over the next second ~6 (true) - compare hp drop in a window without bolt hits
    const hits0 = rec.of('hit').length;
    const hp0 = e.hp;
    rec.seconds(0.5);
    if (rec.of('hit').length === hits0) expect(hp0 - e.hp).toBeCloseTo(SPEC_TUNING.fire_mages.dps * 0.5, 0);
    // another hit refreshes the timer and never raises dps
    expect(rec.until(() => rec.of('ignite').length >= 2 || sim.state.enemies.length === 0, 40)).toBe(true);
    if (rec.of('ignite').length >= 2) {
      expect(rec.of('ignite')[1].e.refreshed).toBe(true);
      expect(rec.of('ignite')[1].e.dps).toBe(SPEC_TUNING.fire_mages.dps);
    }
  });

  it('burn runs out after 4 s without a new hit', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'dread', count: 1 })] }));
    const id = lv3(sim, 'wizard', 1, 'fire_mages');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => sim.state.enemies[0]?.burning === true, 40)).toBe(true);
    sim.sell(id); // no more bolts
    const d = sim.state.enemies[0];
    expect(d.burnTimer).toBeGreaterThan(3.5);
    rec.seconds(4.2);
    expect(d.burning).toBe(false);
    expect(d.burnTimer).toBe(0);
    expect(d.burnDps).toBe(0);
  });

  it('burn damage is true damage, works on fliers and can kill', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'skimmer', count: 1 })] }));
    const id = lv3(sim, 'wizard', 1, 'fire_mages');
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.step();
    const sk = sim.state.enemies[0] as { hp: number; maxHp: number } & EnemyState;
    sk.hp = sk.maxHp = 1000;
    expect(rec.until(() => sk.burning, 40)).toBe(true);
    sim.sell(id);
    sk.hp = 9;
    rec.seconds(2);
    expect(rec.of('kill').length).toBe(1);
    expect(rec.of('kill')[0].e.enemy).toBe('skimmer');
    expect(sim.state.enemies.length).toBe(0);
  });
});

describe('Bomb: Bigger Bombs', () => {
  it('+40% radius, +25% damage, +2 bomblets (3 -> 5; with the Bombs star tier 3: 5 -> 7)', () => {
    const base = towerStats('bomb', 3, emptyUpgrades());
    const big = towerStats('bomb', 3, emptyUpgrades(), 'bigger_bombs');
    expect(big.splashRadius).toBeCloseTo(1.2 * 1.4);
    expect(big.damageMin).toBeCloseTo(base.damageMin * 1.25);
    expect(big.bomblets).toBe(5);
    expect(big.bombletRadius).toBeCloseTo(0.5 * 1.4);
    expect(base.bomblets).toBe(3);
    const star = towerStats('bomb', 3, up({ bombs: 3 }), 'bigger_bombs');
    expect(star.bomblets).toBe(7);
    expect(star.bombletDamageFactor).toBe(0.35);
    const full = towerStats('bomb', 3, up({ bombs: 3 }), 'bigger_bombs');
    expect(full.splashRadius).toBeCloseTo(1.2 * 1.2 * 1.4);
    expect(full.damageMin).toBeCloseTo(54 * 1.15 * 1.25);
  });

  it('shells carry the bigger radius and release 5 bomblets', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'scout', count: 4, interval: 0.4 })] }));
    lv3(sim, 'bomb', 1, 'bigger_bombs');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('cluster').length > 0, 40)).toBe(true);
    expect(rec.of('cluster')[0].e.bomblets.length).toBe(5);
    const ex = rec.of('explode').find((x) => x.e.kind === 'shell')!;
    expect(ex.e.radius).toBeCloseTo(1.2 * 1.4);
  });
});

describe('Bomb: Homing Missiles', () => {
  it('every 5 s two missiles hit the furthest-forward UFOs, fliers included; shells continue', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'skimmer', count: 3, interval: 0.8 }, { enemy: 'plated', count: 2, interval: 1, delay: 1 })] }));
    const id = lv3(sim, 'bomb', 1, 'homing_missiles');
    expect(sim.getTower(id)!.specCooldownMax).toBe(SPEC_TUNING.homing_missiles.cooldown);
    (sim.state.towers[0] as { specCooldown: number }).specCooldown = 4.5; // fire once several UFOs are in range
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('missileLaunch').length > 0, 40)).toBe(true);
    const launch = rec.of('missileLaunch')[0].e;
    expect(launch.missiles.length).toBe(2);
    const targets = launch.missiles.map((m) => m.targetId);
    expect(new Set(targets).size).toBe(2);
    const inRange = sim.state.enemies
      .filter((e) => Math.hypot(e.x - 5.5, e.y - 1.5) <= 3.4)
      .sort((a, b) => b.progress - a.progress)
      .map((e) => e.id);
    expect(targets).toEqual(inRange.slice(0, 2));
    const missiles = sim.state.projectiles.filter((p) => p.kind === 'missile');
    expect(missiles.length).toBe(2);
    expect(missiles.every((m) => m.damage === SPEC_TUNING.homing_missiles.damage && m.radius === SPEC_TUNING.homing_missiles.splash && m.damageType === 'physical')).toBe(true);
    rec.seconds(6);
    const explodes = rec.of('explode').filter((x) => x.e.kind === 'missile');
    expect(explodes.length).toBeGreaterThanOrEqual(2);
    expect(explodes[0].e.radius).toBe(SPEC_TUNING.homing_missiles.splash);
    // normal shells keep flying
    expect(rec.log.some((x) => x.e.type === 'shoot' && x.e.kind === 'bomb')).toBe(true);
    // next volley 6 s after the first
    const l1 = rec.of('missileLaunch')[0].t;
    rec.until(() => rec.of('missileLaunch').length >= 2, 40);
    if (rec.of('missileLaunch').length >= 2) expect(rec.of('missileLaunch')[1].t - l1).toBeGreaterThanOrEqual(SPEC_TUNING.homing_missiles.cooldown - 0.02);
  });

  it('a missile deals its damage as physical and hits a high flier', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'skimmer', count: 1 })] }));
    lv3(sim, 'bomb', 1, 'homing_missiles');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('hit').some((h) => h.e.type === 'hit' && h.e.source === 'missile'), 40)).toBe(true);
    const h = rec.of('hit').find((x) => x.e.source === 'missile')!.e as Extract<ReturnType<typeof rec.of<'hit'>>[number]['e'], { type: 'hit' }>;
    expect(h.raw).toBeCloseTo(SPEC_TUNING.homing_missiles.damage);
    expect(h.enemy).toBe('skimmer');
  });
});

describe('Barracks: Bow Training', () => {
  it('knights shoot 9-13 damage arrows every 1 s within 2.5 t, fliers included; not while in melee', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'skimmer', count: 3, interval: 1 })] }));
    const id = lv3(sim, 'barracks', 1, 'bow_training');
    expect(sim.state.knights.every((k) => k.bow)).toBe(true);
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(18);
    const shots = rec.of('knightShoot');
    expect(shots.length).toBeGreaterThan(3);
    expect(shots.every((s) => s.e.towerId === id)).toBe(true);
    const kh = rec.of('hit').filter((h) => h.e.type === 'hit' && h.e.source === 'knightArrow').map((h) => h.e as Extract<typeof h.e, { type: 'hit' }>);
    expect(kh.length).toBeGreaterThan(0);
    for (const h of kh) {
      expect(h.raw).toBeGreaterThanOrEqual(SPEC_TUNING.bow_training.damageMin);
      expect(h.raw).toBeLessThanOrEqual(SPEC_TUNING.bow_training.damageMax);
    }
    // per knight spacing >= the bow cooldown
    const byKnight = new Map<number, number[]>();
    for (const s of shots) byKnight.set(s.e.knightId, [...(byKnight.get(s.e.knightId) ?? []), s.t]);
    for (const ts of byKnight.values()) for (let i = 1; i < ts.length; i++) expect(ts[i] - ts[i - 1]).toBeGreaterThanOrEqual(SPEC_TUNING.bow_training.cooldown - 0.02);
  });

  it('a knight in melee does not shoot', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'dread', count: 1 })], startGold: 5000 }));
    lv3(sim, 'barracks', 1, 'bow_training');
    sim.callNextWave();
    let violations = 0;
    let shots = 0;
    let fightingTicks = 0;
    for (let i = 0; i < 60 * 40; i++) {
      sim.step();
      for (const e of sim.drainEvents()) {
        if (e.type !== 'knightShoot') continue;
        shots++;
        if (sim.getKnight(e.knightId)!.mode === 'fighting') violations++;
      }
      if (sim.state.knights.some((k) => k.mode === 'fighting')) fightingTicks++;
    }
    expect(fightingTicks).toBeGreaterThan(60); // the dreadnought was fought in melee for a while
    expect(shots).toBeGreaterThan(0);
    expect(violations).toBe(0);
  });

  it('no spec = knights never shoot', () => {
    const sim = makeSim(lvl({ waves: [wave({ enemy: 'skimmer', count: 3, interval: 1 })] }));
    lv3(sim, 'barracks', 1);
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(15);
    expect(rec.of('knightShoot').length).toBe(0);
  });
});

describe('Barracks: Extra Recruits', () => {
  it('+1 knight (4), +25% HP and 30% faster respawn, multiplying the barracks star tree', () => {
    const sim = makeSim(lvl(), { upgrades: up({ barracks: 2 }) });
    const id = lv3(sim, 'barracks');
    expect(sim.state.knights.length).toBe(3);
    sim.specialize(id, 'extra_recruits');
    expect(sim.state.knights.length).toBe(4);
    expect(sim.getTower(id)!.knightIds.length).toBe(4);
    expect(sim.state.knights[0].maxHp).toBeCloseTo(140 * 1.2 * 1.25);
    expect(sim.state.knights.every((k) => k.hp === k.maxHp)).toBe(true);
    // respawn: 10 s * 0.7 (star) * 0.7 (spec)
    expect(towerStats('barracks', 3, up({ barracks: 2 }), 'extra_recruits').knightRespawn).toBeCloseTo(10 * 0.7 * 0.7);
  });

  it('a dead recruit respawns after 7 s with the spec alone (5 s with the respawn star as well)', () => {
    for (const [stars, expected] of [[0, 7], [2, 4.9]] as const) {
      const sim = makeSim(lvl({ waves: [wave({ enemy: 'dread', count: 1 })] }), { upgrades: up({ barracks: stars }) });
      lv3(sim, 'barracks', 1, 'extra_recruits');
      sim.callNextWave();
      const rec = new Recorder(sim);
      expect(rec.until(() => rec.of('knightDeath').length > 0, 120)).toBe(true);
      const death = rec.of('knightDeath')[0];
      expect(rec.until(() => rec.of('knightRespawn').some((r) => r.e.knightId === death.e.knightId), 30)).toBe(true);
      const resp = rec.of('knightRespawn').find((r) => r.e.knightId === death.e.knightId)!;
      expect(resp.t - death.t).toBeCloseTo(expected, 1);
    }
  });
});

describe('specializations: determinism', () => {
  it('same seed + commands => identical events and state, with every spec in play', () => {
    const run = () => {
      const sim = new Sim({ ...LEVELS[6], startGold: 6000 }, { seed: 5 });
      const picks: [number, TowerKind, SpecId][] = [
        [0, 'archer', 'hunting_nets'],
        [1, 'wizard', 'fire_mages'],
        [2, 'bomb', 'homing_missiles'],
        [3, 'barracks', 'bow_training'],
        [4, 'archer', 'eagle_eye'],
        [5, 'wizard', 'chain_lightning'],
        [6, 'bomb', 'bigger_bombs'],
        [7, 'barracks', 'extra_recruits'],
      ];
      for (const [spot, kind, spec] of picks) lv3(sim, kind, spot, spec);
      const events: unknown[] = [];
      sim.callNextWave();
      for (let i = 0; i < 60 * 120; i++) {
        sim.step();
        events.push(...sim.drainEvents());
      }
      return JSON.stringify([sim.state, events]);
    };
    const a = run();
    expect(a).toBe(run());
    expect(a.length).toBeGreaterThan(10000);
  });
});

