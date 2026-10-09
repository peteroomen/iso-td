import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/core/data/enemies';
import { Recorder, makeSim, straightLevel, wave } from './helpers';

describe('enemy movement', () => {
  it('follows the path at its speed with a small lateral offset', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout', count: 6, interval: 0.1 })] }));
    sim.callNextWave();
    sim.runFor(2);
    const laterals = sim.state.enemies.map((e) => e.lateral);
    expect(laterals.every((l) => Math.abs(l) <= 0.2)).toBe(true);
    expect(new Set(laterals).size).toBeGreaterThan(1);
    for (const e of sim.state.enemies) {
      expect(Math.abs(e.y - (2.5 + e.dirX * e.lateral))).toBeLessThan(1e-9);
      expect(e.dirX).toBe(1);
    }
    const first = sim.state.enemies[0];
    expect(first.progress).toBeCloseTo(ENEMIES.scout.speed * (2 - 1 / 60), 1);
    expect(first.x).toBeCloseTo(-0.5 + first.progress);
  });

  it('darts are faster than scouts, plated slower', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout' }, { enemy: 'dart' }, { enemy: 'plated' })] }));
    sim.callNextWave();
    sim.runFor(3);
    const by = (t: string) => sim.state.enemies.find((e) => e.type === t)!.progress;
    expect(by('dart')).toBeGreaterThan(by('scout'));
    expect(by('scout')).toBeGreaterThan(by('plated'));
  });

  it('flier flag is exposed', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'skimmer' })] }));
    sim.callNextWave();
    sim.runFor(0.1);
    expect(sim.state.enemies[0].flier).toBe(true);
  });
});

describe('carrier', () => {
  it('releases 3 darts at its own path progress when it dies', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'carrier' })] }));
    sim.build(1, 'archer');
    sim.callNextWave();
    sim.runFor(2);
    const carrier = sim.state.enemies.find((e) => e.type === 'carrier')!;
    (carrier as { hp: number }).hp = 1;
    const rec = new Recorder(sim);
    let progressBefore = 0;
    expect(
      rec.until(() => {
        const c = sim.state.enemies.find((e) => e.type === 'carrier');
        if (c) progressBefore = c.progress;
        return rec.of('kill').length > 0;
      }, 30),
    ).toBe(true);
    expect(rec.of('kill')[0].e.gold).toBe(ENEMIES.carrier.gold);
    const spawns = rec.of('spawn').filter((s) => s.e.source === 'carrier');
    expect(spawns.length).toBe(3);
    expect(spawns.every((s) => s.e.enemy === 'dart')).toBe(true);
    const darts = sim.state.enemies.filter((e) => e.type === 'dart');
    expect(darts.length).toBe(3);
    for (const d of darts) expect(d.progress).toBeCloseTo(progressBefore, 1);
    expect(sim.state.status).toBe('running'); // darts keep the level alive
  });

  it('a carrier that leaks releases nothing and costs 2 lives', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'carrier' })] }));
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.until(() => sim.state.status !== 'running', 60);
    expect(sim.state.lives).toBe(18);
    expect(rec.of('spawn').length).toBe(1);
  });
});

describe('mothership', () => {
  it('announces itself, shows a boss bar and launches 2 scouts + 1 dart every 8 s from its position', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'mothership' })] }));
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(8.2);
    expect(rec.of('bossSpawn').length).toBe(1);
    expect(sim.state.boss).not.toBeNull();
    expect(rec.of('escortLaunch').length).toBe(1);
    const esc = rec.of('spawn').filter((s) => s.e.source === 'mothership').map((s) => s.e.enemy);
    expect(esc.sort()).toEqual(['dart', 'scout', 'scout']);
    const boss = sim.state.enemies.find((e) => e.boss)!;
    const escort = sim.state.enemies.find((e) => !e.boss && e.progress > 2.5)!;
    expect(Math.abs(escort.progress - boss.progress)).toBeLessThan(1.5);
    rec.seconds(8);
    expect(rec.of('escortLaunch').length).toBe(2);
    expect(boss.lateral).toBe(0);
    expect(boss.maxHp).toBe(ENEMIES.mothership.hp);
    // the boss is a damage sponge, not an armored wall: towers must be able to hurt it
    expect(ENEMIES.mothership.armor).toBeLessThanOrEqual(0.4);
    expect(ENEMIES.mothership.magicResist).toBeLessThanOrEqual(0.4);
  });
});
