import { describe, expect, it } from 'vitest';
import { level01 } from '../src/core/data/levels/level01';
import { Sim } from '../src/core/sim/Sim';
import type { TowerKind } from '../src/core/types';

function play(plan: [number, TowerKind][], opts: { early?: boolean; seed?: number } = {}): Sim {
  const sim = new Sim(level01, { seed: opts.seed ?? 1, events: false });
  let next = 0;
  sim.callNextWave();
  for (let i = 0; i < 60 * 900 && (sim.state.status === 'running' || sim.state.status === 'pre'); i++) {
    while (next < plan.length && sim.build(plan[next][0], plan[next][1]).ok) next++;
    if (opts.early && sim.state.wave.countdown !== null && sim.state.wave.countdown < 17) sim.callNextWave();
    sim.step();
  }
  return sim;
}

describe('level 1 smoke', () => {
  const PLAN: [number, TowerKind][] = [[1, 'archer'], [4, 'archer'], [5, 'barracks'], [2, 'archer'], [3, 'archer'], [6, 'archer'], [0, 'archer'], [7, 'archer']];

  it('a simple scripted build wins level 1 with three stars', () => {
    const sim = play(PLAN, { early: true });
    expect(sim.state.status).toBe('won');
    expect(sim.state.stars).toBe(3);
    expect(sim.state.wave.index).toBe(6);
  });

  it('a thin defence still wins but loses lives', () => {
    const sim = play([[1, 'archer'], [4, 'archer'], [5, 'barracks']]);
    expect(sim.state.status).toBe('won');
    expect(sim.state.lives).toBeLessThan(20);
    expect(sim.state.lives).toBeGreaterThan(0);
  });

  it('building nothing loses', () => {
    const sim = play([]);
    expect(sim.state.status).toBe('lost');
    expect(sim.state.lives).toBe(0);
    expect(sim.state.wave.index).toBeLessThanOrEqual(3);
  });

  it('the first wave only starts when called', () => {
    const sim = new Sim(level01);
    sim.runFor(30);
    expect(sim.state.status).toBe('pre');
    expect(sim.state.enemies.length).toBe(0);
  });
});
