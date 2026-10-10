import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/core/data/enemies';
import { LEVELS } from '../src/core/data/levels';
import { level01 } from '../src/core/data/levels/level01';
import { deriveSpots, validateLevel } from '../src/core/level';
import type { LevelDef } from '../src/core/types';
import { straightLevel } from './helpers';

describe('level validation', () => {
  it('every shipped level validates', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(1);
    for (const l of LEVELS) expect(validateLevel(l), l.id).toEqual([]);
  });

  it('level ids are unique and level 1 is first', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    expect(LEVELS[0].id).toBe('level01');
  });

  it('helper test level validates', () => {
    expect(validateLevel(straightLevel())).toEqual([]);
  });

  it('level 1 matches the design: spring, 6 waves of scouts and darts, ~8 spots, caps 1, hints', () => {
    expect(level01.biome).toBe('spring');
    expect(level01.waves.length).toBe(6);
    const used = new Set(level01.waves.flatMap((w) => w.groups.map((g) => g.enemy)));
    expect([...used].sort()).toEqual(['dart', 'scout']);
    expect(deriveSpots(level01).length).toBeGreaterThanOrEqual(7);
    expect(deriveSpots(level01).length).toBeLessThanOrEqual(10);
    expect(level01.towerCap).toEqual({ archer: 1, wizard: 1, barracks: 1, bomb: 1 });
    expect(level01.lives).toBe(20);
    expect(level01.hints!.length).toBeGreaterThan(2);
    expect(level01.startGold).toBeGreaterThanOrEqual(250);
    expect(level01.startGold).toBeLessThanOrEqual(450);
  });

  it('spots are derived row-major from B cells', () => {
    const spots = deriveSpots(straightLevel());
    expect(spots.map((s) => [s.id, s.col, s.row])).toEqual([
      [0, 2, 1],
      [1, 5, 1],
      [2, 8, 1],
      [3, 2, 3],
      [4, 5, 3],
      [5, 8, 3],
    ]);
    expect(spots[1]).toMatchObject({ x: 5.5, y: 1.5 });
  });

  const bad = (mut: (l: LevelDef) => void): string[] => {
    const l = JSON.parse(JSON.stringify(straightLevel())) as LevelDef;
    mut(l);
    return validateLevel(l);
  };

  it('catches paths leaving the road', () => {
    expect(bad((l) => (l.paths[0][0].y = 1.5)).length).toBeGreaterThan(0);
  });
  it('catches paths that start on the map', () => {
    expect(bad((l) => (l.paths[0][0].x = 0.5)).some((e) => e.includes('off-map'))).toBe(true);
  });
  it('catches spawn cells not on the border', () => {
    const errs = bad((l) => {
      l.tiles = ['............', '..B..B..B...', '.###########', '..B..B..B...', '............'];
      l.paths[0] = [{ x: 0.5, y: 2.5 }, { x: 12.5, y: 2.5 }];
      l.paths[0].unshift({ x: 0.5, y: -0.5 });
    });
    expect(errs.length).toBeGreaterThan(0);
  });
  it('catches unknown enemies and bad path indices', () => {
    expect(bad((l) => ((l.waves[0].groups[0] as { enemy: string }).enemy = 'ghost')).some((e) => e.includes('unknown enemy'))).toBe(true);
    expect(bad((l) => (l.waves[0].groups[0].path = 3)).some((e) => e.includes('path index'))).toBe(true);
  });
  it('catches missing build spots', () => {
    expect(bad((l) => (l.tiles = l.tiles.map((r) => r.replace(/B/g, '.')))).some((e) => e.includes('no build spots'))).toBe(true);
  });
  it('catches ragged rows, bad chars, dead ends and far spots', () => {
    expect(bad((l) => (l.tiles[0] = '...')).some((e) => e.includes('length'))).toBe(true);
    expect(bad((l) => (l.tiles[0] = '..........?.')).some((e) => e.includes('invalid tile'))).toBe(true);
    expect(bad((l) => (l.tiles[0] = '.#..........')).some((e) => e.includes('dead end'))).toBe(true);
    expect(bad((l) => l.tiles.push('............', '............', 'B...........')).some((e) => e.includes('not near a road'))).toBe(true);
  });
  it('mixed biome needs a biomeMap', () => {
    expect(bad((l) => (l.biome = 'mixed')).some((e) => e.includes('biomeMap'))).toBe(true);
  });
  it('enemy table covers every id used in the design', () => {
    expect(Object.keys(ENEMIES).sort()).toEqual(['carrier', 'dart', 'dread', 'mothership', 'plated', 'prism', 'scout', 'skimmer']);
  });
});
