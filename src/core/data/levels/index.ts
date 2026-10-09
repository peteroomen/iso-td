import type { LevelDef } from '../../types';
import { level01 } from './level01';

/** Campaign levels in play order. Other levels are appended here. */
export const LEVELS: readonly LevelDef[] = [level01];

export function getLevel(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}
