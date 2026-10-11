import type { LevelDef, SpecId } from '../../types';
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

/**
 * Specializations available on `level`: the union of `newSpecs` over the campaign levels up to and including it (matched by id).
 * A level that is not part of the campaign (tests, tools) just has its own `newSpecs`. Order = unlock order.
 */
export function unlockedSpecsFor(level: Pick<LevelDef, 'id' | 'newSpecs'>): SpecId[] {
  const out: SpecId[] = [];
  const idx = LEVELS.findIndex((l) => l.id === level.id);
  const lists = idx < 0 ? [level.newSpecs ?? []] : [...LEVELS.slice(0, idx).map((l) => l.newSpecs ?? []), level.newSpecs ?? []];
  for (const list of lists) for (const id of list) if (!out.includes(id)) out.push(id);
  return out;
}

/** 1-based campaign level number that unlocks `spec`, or null if no level does. */
export function specUnlockLevel(spec: SpecId): number | null {
  const i = LEVELS.findIndex((l) => l.newSpecs?.includes(spec));
  return i < 0 ? null : i + 1;
}
