import type { LevelDef } from '../../types';
import { level01 } from './level01';
import { level02 } from './level02';
import { level03 } from './level03';
import { level04 } from './level04';
import { level05 } from './level05';
import { level06 } from './level06';
import { level07 } from './level07';
import { level08 } from './level08';
import { level09 } from './level09';
import { level10 } from './level10';

/** Campaign levels in play order. */
export const LEVELS: readonly LevelDef[] = [level01, level02, level03, level04, level05, level06, level07, level08, level09, level10];

export function getLevel(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}
