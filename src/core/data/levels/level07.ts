import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 07 - "Frostbite Pass". Winter. A long serpentine pass; dreadnoughts appear. */
export const level07: LevelDef = {
  id: 'level07',
  name: 'Frostbite Pass',
  biome: 'winter',
  tiles: [
    'T#.....d.T..#',
    'd#....cBTT..#',
    'c#.B......TB#',
    '.#.T.#####..#',
    '.#...#..T#..#',
    'r#.Br#.B.#..#',
    '.#d..#...#.B#',
    '.#..d#...#..#',
    '.#.B.#.B.#..#',
    'T#c..#r..#.c#',
    '.#####.B.####',
    '.c.B.dc...B..',
  ],
  paths: [
    [
      { x: 1.5, y: -0.5 },
      { x: 1.5, y: 10.5 },
      { x: 5.5, y: 10.5 },
      { x: 5.5, y: 3.5 },
      { x: 9.5, y: 3.5 },
      { x: 9.5, y: 10.5 },
      { x: 12.5, y: 10.5 },
      { x: 12.5, y: -0.5 },
    ],
  ],
  startGold: 440,
  lives: 20,
  waveGap: 18,
  towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 3 },
  waves: [
    { groups: [g('scout', 7, 0.85, 0), g('dart', 5, 0.55, 6)] },
    { groups: [g('plated', 5, 1.95, 0), g('skimmer', 4, 1, 3), g('scout', 11, 0.75, 10)] },
    { groups: [g('prism', 4, 0.9, 0), g('dart', 21, 0.35, 4), g('carrier', 1, 1.25, 12)] },
    { groups: [g('carrier', 4, 2.45, 0), g('skimmer', 10, 0.8, 3), g('scout', 17, 0.55, 8)] },
    { groups: [g('plated', 10, 1.3, 0), g('prism', 4, 1.25, 4), g('dread', 1, 1.15, 14)] },
    { groups: [g('skimmer', 12, 0.7, 0), g('dart', 16, 0.4, 4), g('carrier', 4, 2.5, 10)] },
    { groups: [g('dread', 2, 2.8, 0), g('plated', 8, 1.4, 2), g('scout', 26, 0.4, 8)] },
    { groups: [g('carrier', 4, 2.6, 0), g('prism', 16, 0.8, 3), g('skimmer', 22, 0.5, 8)] },
    { groups: [g('plated', 12, 1.2, 0), g('dread', 2, 2.8, 4), g('dart', 19, 0.35, 8), g('skimmer', 8, 0.7, 14)] },
    { groups: [g('prism', 12, 0.85, 0), g('carrier', 3, 2.95, 2), g('scout', 26, 0.4, 6), g('dread', 3, 2.8, 12)] },
    { groups: [g('dread', 2, 2.8, 0), g('plated', 12, 1.2, 3), g('skimmer', 12, 0.6, 6), g('dart', 16, 0.35, 12)] },
    { groups: [g('dread', 2, 2.8, 0), g('carrier', 2, 2.95, 2), g('prism', 6, 1.05, 5), g('plated', 9, 1.1, 8), g('skimmer', 9, 0.6, 11), g('scout', 19, 0.4, 14)] },
  ],
  hints: [
    { waveIndex: 4, text: 'A Dreadnought approaches: 800 HP, armored and magic-resistant, and it crushes knights. Focus every tower on it - an Orbital Strike ignores its armor.' },
  ],
};
