import { describe, expect, it } from 'vitest';
import { Recorder, makeSim, straightLevel, wave } from './helpers';

describe('waves', () => {
  it('starts paused on wave 0 and only begins when called', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout', count: 2 }), wave({ enemy: 'scout' })] }));
    expect(sim.state.status).toBe('pre');
    expect(sim.state.wave.index).toBe(0);
    expect(sim.state.wave.total).toBe(2);
    sim.runFor(5);
    expect(sim.state.enemies.length).toBe(0);
    expect(sim.state.wave.countdown).toBeNull();
    expect(sim.callNextWave().ok).toBe(true);
    expect(sim.state.status).toBe('running');
    expect(sim.state.wave.index).toBe(1);
  });

  it('spawns groups on schedule (delay + i * interval)', () => {
    const sim = makeSim(
      straightLevel({ waves: [wave({ enemy: 'scout', count: 3, interval: 2, delay: 1 }, { enemy: 'dart', count: 1, delay: 4 })] }),
    );
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(8);
    const spawns = rec.of('spawn').map((s) => [s.e.enemy, Math.round(s.t * 10) / 10]);
    expect(spawns).toEqual([
      ['scout', 1],
      ['scout', 3],
      ['dart', 4],
      ['scout', 5],
    ]);
  });

  it('countdown starts after spawning finishes and starts the next wave automatically', () => {
    const sim = makeSim(straightLevel({ waveGap: 10, waves: [wave({ enemy: 'scout' }), wave({ enemy: 'scout' })] }));
    sim.callNextWave();
    sim.runFor(1);
    expect(sim.state.wave.spawning).toBe(false);
    expect(sim.state.wave.countdown).toBeLessThan(10);
    expect(sim.state.wave.countdown).toBeGreaterThan(8.5);
    sim.runFor(9.5);
    expect(sim.state.wave.index).toBe(2);
    expect(sim.state.wave.countdown).toBeNull();
    expect(sim.state.wave.next).toBeNull();
  });

  it('default wave gap is 18 s', () => {
    const level = straightLevel({ waves: [wave({ enemy: 'scout' }), wave({ enemy: 'scout' })] });
    delete level.waveGap;
    const sim = makeSim(level);
    sim.callNextWave();
    sim.step();
    sim.step();
    expect(sim.state.wave.countdown!).toBeCloseTo(18, 1);
  });

  it('cannot call a wave while one is still spawning, or after the last', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout', count: 5, interval: 2 }), wave({ enemy: 'scout' })] }));
    sim.callNextWave();
    sim.runFor(1);
    expect(sim.callNextWave()).toEqual({ ok: false, reason: 'wave_in_progress' });
    const sim2 = makeSim(straightLevel({ waves: [wave({ enemy: 'scout' })] }));
    sim2.callNextWave();
    sim2.runFor(1);
    expect(sim2.callNextWave()).toEqual({ ok: false, reason: 'no_more_waves' });
  });

  it('early call pays floor(remaining * 1.5) gold and cuts both ability cooldowns by remaining * 0.5', () => {
    const sim = makeSim(straightLevel({ startGold: 100, waves: [wave({ enemy: 'scout' }), wave({ enemy: 'scout' })] }));
    expect(sim.callNextWave().ok).toBe(true);
    expect(sim.state.gold).toBe(100); // first call: no bonus
    sim.runFor(1);
    expect(sim.castOrbital({ x: 6, y: 2.5 }).ok).toBe(true);
    expect(sim.castReinforcements({ x: 6.5, y: 2.5 }).ok).toBe(true);
    sim.runFor(2);
    const remaining = sim.state.wave.countdown!;
    const goldBefore = sim.state.gold;
    const orb = sim.state.abilities.orbital.cooldown;
    const rei = sim.state.abilities.reinforce.cooldown;
    expect(sim.state.wave.earlyBonus).toBe(Math.floor(remaining * 1.5));
    sim.drainEvents();
    expect(sim.callNextWave().ok).toBe(true);
    expect(sim.state.gold).toBe(goldBefore + Math.floor(remaining * 1.5));
    expect(sim.state.abilities.orbital.cooldown).toBeCloseTo(Math.max(0, orb - remaining * 0.5));
    expect(sim.state.abilities.reinforce.cooldown).toBeCloseTo(Math.max(0, rei - remaining * 0.5));
    expect(sim.state.wave.index).toBe(2);
    const ev = sim.drainEvents();
    expect(ev.find((e) => e.type === 'waveCalledEarly')).toMatchObject({ type: 'waveCalledEarly', bonus: Math.floor(remaining * 1.5) });
    expect(ev.find((e) => e.type === 'waveStart')).toMatchObject({ early: true, number: 2 });
  });

  it('exposes next wave composition for the UI', () => {
    const level = straightLevel({
      waves: [
        wave({ enemy: 'scout', count: 4 }, { enemy: 'dart', count: 2 }, { enemy: 'scout', count: 3, delay: 9 }),
        wave({ enemy: 'skimmer', count: 2 }),
      ],
    });
    const sim = makeSim(level);
    expect(sim.state.wave.next).toEqual({
      number: 1,
      entries: [
        { enemy: 'scout', count: 7 },
        { enemy: 'dart', count: 2 },
      ],
      paths: [0],
      hasFlier: false,
      hasBoss: false,
    });
    sim.callNextWave();
    expect(sim.state.wave.next!.number).toBe(2);
    expect(sim.state.wave.next!.hasFlier).toBe(true);
  });
});

describe('leaks, defeat, victory', () => {
  it('leaking enemies reduce lives by their lives value', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout', count: 3, interval: 0.5 }, { enemy: 'carrier', count: 1, delay: 1 })] }));
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.until(() => sim.state.status !== 'running', 120);
    expect(rec.of('leak').length).toBe(4);
    expect(sim.state.lives).toBe(20 - 3 - 2);
    expect(sim.state.stats.leaked).toBe(5);
    expect(sim.state.status).toBe('won'); // everything gone, lives left
    expect(sim.state.stars).toBe(2); // 15 lives -> 2 stars
  });

  it('running out of lives is defeat; the sim then freezes and rejects commands', () => {
    const sim = makeSim(straightLevel({ lives: 2, waves: [wave({ enemy: 'scout', count: 5, interval: 0.5 })] }));
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.until(() => sim.state.status !== 'running', 120);
    expect(sim.state.status).toBe('lost');
    expect(sim.state.lives).toBe(0);
    expect(rec.of('lost').length).toBe(1);
    expect(rec.of('won').length).toBe(0);
    const t = sim.state.time;
    sim.step();
    expect(sim.state.time).toBe(t);
    expect(sim.build(0, 'archer')).toEqual({ ok: false, reason: 'ended' });
    expect(sim.callNextWave()).toEqual({ ok: false, reason: 'ended' });
  });

  it('boss leak costs 20 lives = instant defeat', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'mothership' })] }));
    sim.callNextWave();
    sim.runFor(60);
    expect(sim.state.status).toBe('lost');
  });

  it('victory needs all waves spawned and no enemies alive; stars follow lives left', () => {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout' }), wave({ enemy: 'scout' })] }));
    sim.build(1, 'archer');
    sim.build(4, 'archer');
    sim.callNextWave();
    const rec = new Recorder(sim);
    rec.seconds(5);
    expect(sim.state.status).toBe('running'); // wave 2 still to come
    rec.until(() => sim.state.status === 'won', 120);
    expect(sim.state.status).toBe('won');
    expect(sim.state.stars).toBe(3);
    expect(rec.of('won')[0].e).toEqual({ type: 'won', lives: 20, stars: 3 });
  });

  it('stars: 18+ lives = 3, 6..17 = 2, below = 1', () => {
    const run = (leaks: number) => {
      const sim = makeSim(straightLevel({ waves: [wave({ enemy: 'scout', count: leaks, interval: 0.2 })] }));
      sim.callNextWave();
      sim.runFor(60);
      return sim.state;
    };
    expect(run(2).stars).toBe(3);
    expect(run(3).stars).toBe(2);
    expect(run(14).stars).toBe(2);
    expect(run(15).stars).toBe(1);
  });
});
