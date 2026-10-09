import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 07 - "Frostbite Pass". Winter. A long serpentine pass; dreadnoughts appear. */
export const level07: LevelDef = {
  id: 'level07',
  name: 'Frostbite Pass',
  biome: 'winter',
  tiles: [
    'T#.....d.T. #',
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
    ' c.B.dc...B. ',
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
  towerCap: { archer: 3, wizard: 3, barracks: 3 },
  waves: [
    { groups: [g('scout', 16, 0.7, 0), g('dart', 10, 0.45, 6)] },
    { groups: [g('plated', 10, 1.65, 0), g('skimmer', 8, 0.85, 3), g('scout', 23, 0.6, 10)] },
    { groups: [g('prism', 6, 0.8, 0), g('dart', 44, 0.3, 4), g('carrier', 1, 1.0, 12)] },
    { groups: [g('carrier', 10, 2.0, 0), g('skimmer', 18, 0.7, 3), g('scout', 37, 0.45, 8)] },
    { groups: [g('plated', 19, 1.1, 0), g('prism', 7, 1.1, 4), g('dread', 1, 1.0, 14)] },
    { groups: [g('skimmer', 22, 0.6, 0), g('dart', 34, 0.35, 4), g('carrier', 10, 2.05, 10)] },
    { groups: [g('dread', 4, 2.4, 0), g('plated', 16, 1.2, 2), g('scout', 56, 0.35, 8)] },
    { groups: [g('carrier', 10, 2.1, 0), g('prism', 26, 0.7, 3), g('skimmer', 40, 0.45, 8)] },
    { groups: [g('plated', 23, 1.0, 0), g('dread', 3, 2.4, 4), g('dart', 41, 0.3, 8), g('skimmer', 15, 0.6, 14)] },
    { groups: [g('prism', 19, 0.75, 0), g('carrier', 7, 2.4, 2), g('scout', 56, 0.35, 6), g('dread', 5, 2.4, 12)] },
    { groups: [g('dread', 4, 2.4, 0), g('plated', 23, 1.0, 3), g('skimmer', 21, 0.5, 6), g('dart', 35, 0.3, 12)] },
    { groups: [g('dread', 4, 2.4, 0), g('carrier', 4, 2.4, 2), g('prism', 9, 0.95, 5), g('plated', 17, 0.95, 8), g('skimmer', 16, 0.5, 11), g('scout', 40, 0.35, 14)] },
  ],
  hints: [
    { waveIndex: 4, text: 'A Dreadnought approaches: 400 HP, armored and magic-resistant, and it crushes knights. Focus everything on it - an Orbital Strike helps.' },
  ],
};
