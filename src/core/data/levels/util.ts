import type { EnemyId, SpawnGroup } from '../../types';

/** Compact spawn-group constructor: `g('scout', count, interval, delay, path = 0)`. */
export function g(enemy: EnemyId, count: number, interval: number, delay: number, path = 0): SpawnGroup {
  return { enemy, count, interval, delay, path };
}
