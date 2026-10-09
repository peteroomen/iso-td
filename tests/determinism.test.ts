import { describe, expect, it } from 'vitest';
import { level01 } from '../src/core/data/levels/level01';
import { Sim } from '../src/core/sim/Sim';
import type { SimEvent, TowerKind } from '../src/core/types';

/** A scripted session on level 1 exercising towers, abilities, upgrades and early calls. */
function runScript(seed: number, ticks = 60 * 70): { state: string; events: string; snapshots: string[] } {
  const sim = new Sim(level01, { seed });
  const events: SimEvent[] = [];
  const snapshots: string[] = [];
  const plan: [number, TowerKind][] = [[1, 'archer'], [4, 'archer'], [5, 'barracks'], [2, 'wizard'], [3, 'archer']];
  for (let i = 0; i < ticks; i++) {
    if (i === 10) sim.callNextWave();
    if (i % 30 === 0) for (const [spot, kind] of plan) sim.build(spot, kind);
    if (i % 600 === 599 && sim.state.wave.countdown !== null) sim.callNextWave();
    if (i === 900) sim.castOrbital({ x: 9.5, y: 2.5 });
    if (i === 1200) sim.castReinforcements({ x: 5.5, y: 4.5 });
    if (i === 1500) sim.setRally(sim.state.towers.find((t) => t.kind === 'barracks')!.id, { x: 3.5, y: 4.5 });
    sim.step();
    events.push(...sim.drainEvents());
    if (i % 600 === 0) snapshots.push(JSON.stringify(sim.state));
  }
  return { state: JSON.stringify(sim.state), events: JSON.stringify(events), snapshots };
}

describe('determinism', () => {
  it('same seed + same commands => identical state and events at every checkpoint', () => {
    const a = runScript(42);
    const b = runScript(42);
    expect(a.snapshots).toEqual(b.snapshots);
    expect(a.state).toBe(b.state);
    expect(a.events).toBe(b.events);
    expect(a.events.length).toBeGreaterThan(1000);
  });

  it('a different seed changes the outcome details', () => {
    expect(runScript(1).state).not.toBe(runScript(2).state);
  });

  it('event recording does not influence the simulation', () => {
    const a = new Sim(level01, { seed: 7, events: true });
    const b = new Sim(level01, { seed: 7, events: false });
    for (const s of [a, b]) {
      s.build(1, 'archer');
      s.build(5, 'barracks');
      s.callNextWave();
    }
    for (let i = 0; i < 3000; i++) {
      a.step();
      b.step();
      a.drainEvents();
    }
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(b.drainEvents()).toEqual([]);
  });

  it('source files avoid Math.random / Date', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((f) => {
        const p = join(d, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
      });
    for (const f of walk('src/core')) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|from 'phaser'/);
    }
  });
});
