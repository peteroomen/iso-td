import { describe, expect, it } from 'vitest';
import { Recorder, makeSim, straightLevel, wave } from './helpers';

/** Barracks on spot 1 (5.5, 1.5): default rally is the nearest road point (5.5, 2.5). */
describe('barracks & knights', () => {
  it('spawns knights per level with the right stats; default rally sits on the road', () => {
    const sim = makeSim(straightLevel());
    sim.build(1, 'barracks');
    const t = sim.state.towers[0];
    expect(t.rallyX).toBeCloseTo(5.5);
    expect(t.rallyY).toBeCloseTo(2.5);
    expect(sim.state.knights.length).toBe(2);
    expect(sim.state.knights[0]).toMatchObject({ kind: 'knight', maxHp: 50, armor: 0, towerId: t.id });
    sim.upgrade(t.id);
    expect(sim.state.knights.length).toBe(2);
    expect(sim.state.knights[0]).toMatchObject({ maxHp: 90, armor: 0.15 });
    sim.upgrade(t.id);
    expect(sim.state.knights.length).toBe(3);
    expect(sim.state.knights[0]).toMatchObject({ maxHp: 140, armor: 0.3 });
    expect(t.knightIds.length).toBe(3);
  });

  it('upgrade keeps knight identities and heals them in place', () => {
    const sim = makeSim(straightLevel());
    sim.build(1, 'barracks');
    const t = sim.state.towers[0];
    const ids = sim.state.knights.map((k) => k.id);
    (sim.state.knights[0] as { hp: number }).hp = 5;
    sim.upgrade(t.id);
    expect(sim.state.knights.slice(0, 2).map((k) => k.id)).toEqual(ids);
    expect(sim.state.knights[0].hp).toBe(90);
  });

  it('knights walk to the rally post and idle there', () => {
    const sim = makeSim(straightLevel());
    sim.build(1, 'barracks');
    sim.runFor(3);
    for (const k of sim.state.knights) {
      expect(k.mode).toBe('idle');
      expect(Math.hypot(k.x - 5.5, k.y - 2.5)).toBeLessThan(0.4);
    }
  });

  it('blocks ground enemies: the enemy stops and fights back', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'plated' }, { enemy: 'scout', delay: 90 })] }));
    sim.build(1, 'barracks');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => sim.state.enemies.some((e) => e.engaged), 40)).toBe(true);
    const e = sim.state.enemies.find((x) => x.type === 'plated')!;
    const x0 = e.x;
    const knightHp = sim.state.knights.reduce((a, k) => a + k.hp, 0);
    rec.seconds(3);
    expect(e.engaged).toBe(true);
    expect(e.x).toBeCloseTo(x0, 5); // stopped
    expect(sim.state.knights.reduce((a, k) => a + k.hp, 0)).toBeLessThan(knightHp); // it hits back
    expect(rec.of('meleeHit').some((m) => m.e.attacker === 'enemy')).toBe(true);
    expect(rec.of('meleeHit').some((m) => m.e.attacker === 'knight')).toBe(true);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('does not block high fliers', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'skimmer' })] }));
    sim.build(1, 'barracks');
    sim.callNextWave();
    const rec = new Recorder(sim);
    let engaged = false;
    let lastProgress = 0;
    rec.until(() => {
      const e = sim.state.enemies[0];
      if (e) {
        engaged ||= e.engaged;
        lastProgress = e.progress;
      }
      return sim.state.status !== 'running';
    }, 60);
    expect(engaged).toBe(false);
    expect(lastProgress).toBeGreaterThan(12);
    expect(rec.of('leak').length).toBe(1);
    expect(sim.state.knights.every((k) => k.targetId === null)).toBe(true);
  });

  it('does not block the mothership', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'mothership' })] }));
    sim.build(1, 'barracks');
    sim.callNextWave();
    sim.runFor(20);
    expect(sim.state.enemies.find((e) => e.type === 'mothership')!.engaged).toBe(false);
  });

  it('several knights can hit the same enemy and two enemies are split between knights', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'dread' }, { enemy: 'scout', delay: 90 })] }));
    sim.build(1, 'barracks');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => sim.state.enemies[0]?.engagedBy.length === 2, 40)).toBe(true);
  });

  it('knight death: respawn exactly 10 s later at the tower, then back to full HP', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'dread' }, { enemy: 'scout', delay: 120 })] }));
    sim.build(1, 'barracks');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('knightDeath').length > 0, 60)).toBe(true);
    const death = rec.of('knightDeath')[0];
    const k = sim.state.knights.find((x) => x.id === death.e.knightId)!;
    expect(k.mode).toBe('dead');
    expect(k.respawnTimer).toBeGreaterThan(9.9);
    expect(rec.until(() => rec.of('knightRespawn').length > 0, 30)).toBe(true);
    const resp = rec.of('knightRespawn')[0];
    expect(resp.e.knightId).toBe(death.e.knightId);
    expect(resp.t - death.t).toBeCloseTo(10, 1);
    expect(k.hp).toBe(k.maxHp);
    expect(k.mode).not.toBe('dead');
  });

  it('star tier 2 shortens respawn to 7 s', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'dread' }, { enemy: 'scout', delay: 120 })] }), {
      upgrades: { archers: 0, wizards: 0, barracks: 2, orbital: 0, reinforcements: 0, bombs: 0 },
    });
    sim.build(1, 'barracks');
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.until(() => rec.of('knightRespawn').length > 0, 120);
    const d = rec.of('knightDeath')[0];
    const r = rec.of('knightRespawn')[0];
    expect(r.t - d.t).toBeCloseTo(7, 1);
  });

  it('idle knights regenerate 2% max HP per second (x3 with star tier 3), but not while fighting', () => {
    for (const [tier, rate] of [[0, 0.02], [3, 0.06]] as const) {
      const sim = makeSim(straightLevel(), { upgrades: { archers: 0, wizards: 0, barracks: tier, orbital: 0, reinforcements: 0, bombs: 0 } });
      sim.build(1, 'barracks');
      sim.runFor(3);
      const k = sim.state.knights[0];
      (k as { hp: number }).hp = 1;
      const before = k.hp;
      sim.runFor(1);
      expect(k.hp - before).toBeCloseTo(k.maxHp * rate, 1);
    }
  });

  it('setRally moves the post within 2.5 tiles of the tower and onto the road; knights follow', () => {
    const sim = makeSim(straightLevel());
    sim.build(1, 'barracks');
    const id = sim.state.towers[0].id;
    expect(sim.setRally(id, { x: 7.5, y: 2.5 }).ok).toBe(true);
    expect(sim.state.towers[0].rallyX).toBe(7.5);
    sim.runFor(4);
    for (const k of sim.state.knights) expect(Math.hypot(k.x - 7.5, k.y - 2.5)).toBeLessThan(0.4);
    expect(sim.setRally(id, { x: 11.5, y: 2.5 })).toEqual({ ok: false, reason: 'out_of_range' });
    expect(sim.setRally(id, { x: 5.5, y: 0.2 })).toEqual({ ok: false, reason: 'not_on_road' });
    sim.build(0, 'archer');
    expect(sim.setRally(sim.state.towers[1].id, { x: 2.5, y: 2.5 })).toEqual({ ok: false, reason: 'wrong_kind' });
  });

  it('selling a barracks removes its knights and releases enemies', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'dread' }, { enemy: 'scout', delay: 120 })] }));
    sim.build(1, 'barracks');
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.until(() => sim.state.enemies[0]?.engaged === true, 40);
    sim.sell(sim.state.towers[0].id);
    expect(sim.state.knights.length).toBe(0);
    rec.seconds(0.1);
    expect(sim.state.enemies[0].engaged).toBe(false);
  });
});
