import type { EnemyId, LevelDef, SimEvent, SpawnGroup, WaveDef } from '../src/core/types';
import { Sim, type SimOptions } from '../src/core/sim/Sim';

/**
 * A straight test level: road along row 2 (x 0..11), 6 build spots (ids 0..5):
 *   row 1: spots 0,1,2 at x = 2,5,8      row 3: spots 3,4,5 at x = 2,5,8
 * Path: (-0.5,2.5) -> (12.5,2.5), length 13.
 */
export function straightLevel(over: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    name: 'Test',
    biome: 'spring',
    tiles: ['............', '..B..B..B...', '############', '..B..B..B...', '............'],
    paths: [[{ x: -0.5, y: 2.5 }, { x: 12.5, y: 2.5 }]],
    startGold: 1000,
    lives: 20,
    waveGap: 18,
    towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 3 },
    waves: [wave({ enemy: 'scout', count: 1 })],
    ...over,
  };
}

export function group(g: Partial<SpawnGroup> & { enemy: EnemyId }): SpawnGroup {
  return { count: 1, interval: 1, delay: 0, path: 0, ...g };
}

export function wave(...gs: (Partial<SpawnGroup> & { enemy: EnemyId })[]): WaveDef {
  return { groups: gs.map(group) };
}

export function makeSim(level: LevelDef = straightLevel(), opts: SimOptions = {}): Sim {
  return new Sim(level, opts);
}

/** Steps until predicate or max seconds; returns true if the predicate fired. */
export function runUntil(sim: Sim, pred: () => boolean, maxSeconds = 600): boolean {
  const n = Math.round(maxSeconds * 60);
  for (let i = 0; i < n; i++) {
    if (pred()) return true;
    sim.step();
  }
  return pred();
}

export interface TimedEvent<T extends SimEvent = SimEvent> {
  t: number;
  e: T;
}


/** Steps the sim while logging every event with the sim time it was emitted at. */
export class Recorder {
  log: TimedEvent[] = [];
  constructor(readonly sim: Sim) {}

  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      this.sim.step();
      for (const e of this.sim.drainEvents()) this.log.push({ t: this.sim.state.time, e });
    }
  }

  seconds(s: number): void {
    this.step(Math.round(s * 60));
  }

  until(pred: () => boolean, maxSeconds = 600): boolean {
    const n = Math.round(maxSeconds * 60);
    for (let i = 0; i < n; i++) {
      if (pred()) return true;
      this.step();
    }
    return pred();
  }

  of<K extends SimEvent['type']>(type: K): TimedEvent<Extract<SimEvent, { type: K }>>[] {
    return this.log.filter((x) => x.e.type === type) as TimedEvent<Extract<SimEvent, { type: K }>>[];
  }

  /** Flush events emitted by commands issued outside step(). */
  flush(): void {
    for (const e of this.sim.drainEvents()) this.log.push({ t: this.sim.state.time, e });
  }
}
