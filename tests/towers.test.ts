import { describe, expect, it } from 'vitest';
import { Recorder, makeSim, straightLevel, wave } from './helpers';

describe('towers', () => {
  it('targets the enemy furthest along the path ("first")', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'plated', count: 4, interval: 1 })] }));
    const t = sim.build(1, 'archer');
    expect(t.ok).toBe(true);
    const tower = sim.state.towers[0];
    sim.callNextWave();
    let checked = 0;
    for (let i = 0; i < 60 * 14; i++) {
      sim.step();
      if (tower.targetId === null) continue;
      const inRange = sim.state.enemies.filter((e) => Math.hypot(e.x - tower.x, e.y - tower.y) <= tower.range);
      const best = inRange.reduce((a, b) => (b.progress > a.progress ? b : a));
      expect(tower.targetId).toBe(best.id);
      if (inRange.length > 1) checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('projectile damage lands on impact, kills the enemy and pays the bounty', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout' })], startGold: 200 }));
    sim.build(1, 'archer');
    expect(sim.state.gold).toBe(130);
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('kill').length > 0, 60)).toBe(true);
    const shoot = rec.of('shoot')[0];
    const firstHit = rec.of('hit')[0];
    expect(firstHit.t).toBeGreaterThan(shoot.t); // projectile took time to fly
    expect(rec.of('kill')[0].e.gold).toBe(3);
    expect(sim.state.gold).toBe(133);
    expect(sim.state.stats.kills).toBe(1);
    expect(sim.state.enemies.length).toBe(0);
  });

  it('projectile whose target died flies on and fizzles', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout', count: 2, interval: 3 })] }));
    sim.build(1, 'archer');
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => sim.state.projectiles.length > 0, 30)).toBe(true);
    const p = sim.state.projectiles[0];
    const victim = sim.state.enemies.find((e) => e.id === p.targetId)!;
    (victim as { dead: boolean }).dead = true; // white-box: target vanishes mid-flight
    rec.seconds(1);
    expect(rec.of('fizzle').length).toBe(1);
    expect(sim.state.projectiles.find((x) => x.id === p.id)).toBeUndefined();
  });

  it('archer level 3 fires at two different targets, lower levels at one', () => {
    const level = straightLevel({ waves: [wave({ enemy: 'plated', count: 3, interval: 0.5 })] });
    for (const lv of [1, 2, 3]) {
      const sim = makeSim(level);
      sim.build(1, 'archer');
      const id = sim.state.towers[0].id;
      for (let i = 1; i < lv; i++) expect(sim.upgrade(id).ok).toBe(true);
      sim.callNextWave();
      const rec = new Recorder(sim);
      rec.seconds(20);
      const perTick = new Map<number, number[]>();
      for (const s of rec.of('shoot')) perTick.set(s.t, [...(perTick.get(s.t) ?? []), s.e.targetId]);
      expect(perTick.size).toBeGreaterThan(3);
      const volleys = [...perTick.values()];
      if (lv < 3) {
        expect(volleys.every((v) => v.length === 1)).toBe(true);
      } else {
        const doubles = volleys.filter((v) => v.length === 2);
        expect(doubles.length).toBeGreaterThan(0);
        expect(doubles.every((v) => v[0] !== v[1])).toBe(true);
      }
    }
  });

  it('the base level 3 wizard has no chain (it moved to the Chain Lightning specialization)', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'plated', count: 4, interval: 0.4 })] }));
    sim.build(1, 'wizard');
    const id = sim.state.towers[0].id;
    sim.upgrade(id);
    sim.upgrade(id);
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(20);
    expect(rec.of('hit').length).toBeGreaterThan(0);
    expect(rec.of('chain').length).toBe(0);
  });

  it('level 1 wizard does not chain', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'plated', count: 4, interval: 0.4 })] }));
    sim.build(1, 'wizard');
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(20);
    expect(rec.of('hit').length).toBeGreaterThan(0);
    expect(rec.of('chain').length).toBe(0);
  });

  it('flying skimmers are hit by archers', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'skimmer' })] }));
    sim.build(1, 'archer');
    sim.build(4, 'archer');
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.until(() => sim.state.status === 'won' || sim.state.status === 'lost', 60);
    expect(rec.of('kill').length).toBe(1);
  });
});

describe('economy', () => {
  it('build, upgrade and sell move gold correctly; sell refunds 60% of invested', () => {
    const sim = makeSim(straightLevel({ startGold: 1000 }));
    expect(sim.build(0, 'archer').ok).toBe(true); // 70
    const id = sim.state.towers[0].id;
    expect(sim.state.gold).toBe(930);
    expect(sim.upgrade(id).ok).toBe(true); // +110
    expect(sim.state.gold).toBe(820);
    expect(sim.upgrade(id).ok).toBe(true); // +160
    expect(sim.state.gold).toBe(660);
    expect(sim.state.towers[0].invested).toBe(340);
    expect(sim.sellValueOf(id)).toBe(204);
    expect(sim.sell(id).ok).toBe(true);
    expect(sim.state.gold).toBe(660 + 204);
    expect(sim.state.towers.length).toBe(0);
    // spot is free again
    expect(sim.build(0, 'wizard').ok).toBe(true);
  });

  it('rejects when poor, occupied, unknown or ended', () => {
    const sim = makeSim(straightLevel({ startGold: 100 }));
    expect(sim.build(0, 'wizard').ok).toBe(true);
    expect(sim.build(0, 'archer')).toEqual({ ok: false, reason: 'occupied' });
    expect(sim.build(1, 'archer')).toEqual({ ok: false, reason: 'gold' });
    expect(sim.build(99, 'archer')).toEqual({ ok: false, reason: 'no_spot' });
    expect(sim.upgrade(12345)).toEqual({ ok: false, reason: 'no_tower' });
    expect(sim.sell(12345)).toEqual({ ok: false, reason: 'no_tower' });
    expect(sim.upgrade(sim.state.towers[0].id)).toEqual({ ok: false, reason: 'gold' });
  });

  it('enforces tower level caps with reason "capped", and max level 3', () => {
    const sim = makeSim(straightLevel({ towerCap: { archer: 1, wizard: 2, barracks: 3, bomb: 2 } }));
    sim.build(0, 'archer');
    sim.build(1, 'wizard');
    sim.build(2, 'barracks');
    const [a, w, b] = sim.state.towers.map((t) => t.id);
    expect(sim.upgrade(a)).toEqual({ ok: false, reason: 'capped' });
    expect(sim.upgrade(w).ok).toBe(true);
    expect(sim.upgrade(w)).toEqual({ ok: false, reason: 'capped' });
    expect(sim.upgrade(b).ok).toBe(true);
    expect(sim.upgrade(b).ok).toBe(true);
    expect(sim.upgrade(b)).toEqual({ ok: false, reason: 'max_level' });
    expect(sim.canUpgrade(a)).toEqual({ ok: false, reason: 'capped' });
    expect(sim.upgradeCostOf(b)).toBeNull();
  });

  it('towerCap option overrides the level cap', () => {
    const sim = makeSim(straightLevel(), { towerCap: { archer: 1, wizard: 1, barracks: 1, bomb: 1 } });
    sim.build(0, 'archer');
    expect(sim.upgrade(sim.state.towers[0].id)).toEqual({ ok: false, reason: 'capped' });
  });
});
