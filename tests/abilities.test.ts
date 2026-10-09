import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/core/data/enemies';
import { Recorder, makeSim, straightLevel, wave } from './helpers';

const noUp = { archers: 0, wizards: 0, barracks: 0, orbital: 0, reinforcements: 0 };

describe('orbital strike', () => {
  it('needs a running level, has a reticle delay, deals 60 true damage in radius incl. fliers, then cools down 40 s', () => {
    const sim = makeSim(
      straightLevel({ waves: [wave({ enemy: 'dread' }, { enemy: 'skimmer', delay: 0.5 }, { enemy: 'scout', delay: 60 })] }),
    );
    expect(sim.castOrbital({ x: 3, y: 2.5 })).toEqual({ ok: false, reason: 'not_running' });
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(3);
    const dread = sim.state.enemies.find((e) => e.type === 'dread')!;
    const skim = sim.state.enemies.find((e) => e.type === 'skimmer')!;
    const hpBefore = dread.hp;
    // dread (0.6 t/s) and skimmer (1.1 t/s) move on during the 1 s delay; target between them
    const target = { x: (dread.x + skim.x) / 2 + 0.4, y: 2.5 };
    expect(Math.abs(dread.x + 0.6 - target.x)).toBeLessThan(1.3);
    expect(sim.castOrbital(target).ok).toBe(true);
    rec.flush();
    expect(rec.of('orbitalWarn').length).toBe(1);
    expect(sim.state.strikes.length).toBe(1);
    expect(sim.state.abilities.orbital.cooldown).toBeCloseTo(40);
    expect(sim.state.abilities.orbital.ready).toBe(false);
    rec.seconds(0.9);
    expect(rec.of('orbitalHit').length).toBe(0); // reticle still up
    rec.seconds(0.2);
    expect(rec.of('orbitalHit').length).toBe(1);
    expect(sim.state.strikes.length).toBe(0);
    const hit = rec.of('orbitalHit')[0].e;
    expect(hit.hits).toBeGreaterThanOrEqual(1);
    const hits = rec.log.filter((l) => l.e.type === 'hit' && l.e.source === 'orbital');
    expect(hits.length).toBe(hit.hits);
    for (const h of hits) if (h.e.type === 'hit') expect(h.e.amount).toBe(60); // true damage, armor/MR ignored
    expect(dread.hp).toBeCloseTo(hpBefore - 60);
    // cooldown
    expect(sim.castOrbital(target)).toEqual({ ok: false, reason: 'cooldown' });
    rec.seconds(38.7);
    expect(sim.state.abilities.orbital.cooldown).toBeGreaterThan(0);
    rec.seconds(0.5);
    expect(sim.state.abilities.orbital.ready).toBe(true);
    expect(rec.of('abilityReady').length).toBe(1);
  });

  it('kills fliers and ignores enemies outside the radius', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'skimmer', count: 2, interval: 4 }), wave({ enemy: 'scout' })] }));
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(4.6);
    const [first, second] = [...sim.state.enemies].sort((a, b) => b.progress - a.progress);
    expect(first.type).toBe('skimmer');
    sim.castOrbital({ x: first.x + 1.1, y: 2.5 });
    rec.seconds(1.1);
    expect(rec.of('kill').length).toBe(1);
    expect(sim.state.enemies.find((e) => e.id === first.id)).toBeUndefined();
    expect(sim.state.enemies.find((e) => e.id === second.id)).toBeDefined();
  });

  it('can be cast on the boss', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'mothership' })] }));
    sim.callNextWave();
    sim.runFor(2);
    const boss = sim.state.enemies[0];
    const hp = boss.hp;
    sim.castOrbital({ x: boss.x, y: boss.y });
    sim.runFor(1.1);
    expect(boss.hp).toBe(hp - 60);
    expect(sim.state.boss).toMatchObject({ id: boss.id, hp: boss.hp, maxHp: ENEMIES.mothership.hp });
  });

  it('star tiers: -10 s cooldown, +40% damage/radius, burning ground', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'dread' })] }), { upgrades: { ...noUp, orbital: 3 } });
    const ab = sim.state.abilities.orbital;
    expect(ab.cooldownMax).toBe(30);
    expect(ab.damage).toBeCloseTo(84);
    expect(ab.radius).toBeCloseTo(1.96);
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(3);
    const dread = sim.state.enemies[0];
    sim.castOrbital({ x: dread.x + 0.6, y: dread.y });
    rec.seconds(1.05);
    expect(rec.of('burnStart').length).toBe(1);
    expect(sim.state.burns.length).toBe(1);
    const hp = dread.hp;
    rec.seconds(1);
    // 15 true dps while standing in the fire (0.6 t/s: still in the 1.96 radius)
    expect(hp - dread.hp).toBeCloseTo(15, 0);
    rec.seconds(2.5);
    expect(sim.state.burns.length).toBe(0);
  });
});

describe('reinforcements', () => {
  it('spawns 2 militia (30 HP) near the road that expire after 12 s; 15 s cooldown', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout', delay: 300 })] }));
    sim.callNextWave();
    sim.runFor(0.5);
    expect(sim.castReinforcements({ x: 6.5, y: 0.5 })).toEqual({ ok: false, reason: 'not_on_road' });
    expect(sim.castReinforcements({ x: 6.5, y: 1.6 }).ok).toBe(true); // 0.9 from the road
    const rec = new Recorder(sim);
    rec.flush();
    const mil = sim.state.knights.filter((k) => k.kind === 'militia');
    expect(mil.length).toBe(2);
    expect(mil[0]).toMatchObject({ maxHp: 30, towerId: null });
    expect(sim.castReinforcements({ x: 6.5, y: 2.5 })).toEqual({ ok: false, reason: 'cooldown' });
    rec.seconds(11.5);
    expect(sim.state.knights.length).toBe(2);
    rec.seconds(1);
    expect(sim.state.knights.length).toBe(0);
    expect(rec.of('militiaExpire').length).toBe(2);
    expect(sim.state.abilities.reinforce.cooldown).toBeGreaterThan(0.9);
    rec.seconds(2.5);
    expect(sim.state.abilities.reinforce.ready).toBe(true);
  });

  it('militia fight enemies, and die for good', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'dread' }, { enemy: 'scout', delay: 300 })] }));
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(3);
    sim.castReinforcements({ x: 4.5, y: 2.5 });
    expect(rec.until(() => sim.state.enemies[0].engaged, 20)).toBe(true);
    expect(rec.until(() => rec.of('knightDeath').length >= 1, 20)).toBe(true);
    expect(rec.of('knightDeath')[0].e.kind).toBe('militia');
    expect(rec.of('knightRespawn').length).toBe(0);
    expect(sim.state.knights.filter((k) => k.kind === 'militia').length).toBeLessThanOrEqual(1);
    expect(rec.of('meleeHit').some((m) => m.e.attacker === 'militia')).toBe(true);
  });

  it('star tiers: +50% HP, 3 militia, 20 s duration, -3 s cooldown', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout', delay: 300 })] }), { upgrades: { ...noUp, reinforcements: 3 } });
    sim.callNextWave();
    sim.runFor(0.1);
    expect(sim.castReinforcements({ x: 6.5, y: 2.5 }).ok).toBe(true);
    const mil = sim.state.knights;
    expect(mil.length).toBe(3);
    expect(mil[0].maxHp).toBe(45);
    expect(mil[0].lifeLeft).toBeCloseTo(20);
    expect(sim.state.abilities.reinforce.cooldownMax).toBe(12);
  });
});
