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
  newSpecs: ['eagle_eye', 'fire_mages'],
  newSpecsWhy: 'Dreadnoughts and plated heavies crawl the pass: Eagle Eye ignores armor, Fire Mages resistance',
  waves: [
    { groups: [g('scout', 3, 1.05, 0), g('dart', 2, 0.7, 6)] },
    { groups: [g('plated', 4, 1.95, 0), g('skimmer', 4, 1.05, 3), g('scout', 5, 0.95, 10)] },
    { groups: [g('prism', 1, 1.25, 0), g('dart', 8, 0.45, 4), g('carrier', 1, 1.6, 12)] },
    { groups: [g('carrier', 2, 3.05, 0), g('skimmer', 9, 0.85, 3), g('scout', 6, 0.7, 8)] },
    { groups: [g('plated', 10, 1.3, 0), g('prism', 1, 1.75, 4), g('dread', 2, 1.25, 14)] },
    { groups: [g('skimmer', 11, 0.7, 0), g('dart', 6, 0.5, 4), g('carrier', 2, 3.15, 10)] },
    { groups: [g('dread', 3, 3, 0), g('plated', 8, 1.4, 2), g('scout', 11, 0.5, 8)] },
    { groups: [g('carrier', 2, 3.25, 0), g('prism', 5, 1.1, 3), g('skimmer', 20, 0.5, 8)] },
    { groups: [g('plated', 12, 1.25, 0), g('dread', 3, 3, 4), g('dart', 7, 0.45, 8), g('skimmer', 7, 0.7, 14)] },
    { groups: [g('prism', 4, 1.2, 0), g('carrier', 1, 3.8, 2), g('scout', 11, 0.5, 6), g('dread', 3, 3, 12)] },
    { groups: [g('dread', 3, 3, 0), g('plated', 12, 1.25, 3), g('skimmer', 11, 0.6, 6), g('dart', 6, 0.45, 12)] },
    { groups: [g('dread', 3, 3, 0), g('carrier', 1, 3.8, 2), g('prism', 2, 1.45, 5), g('plated', 9, 1.1, 8), g('skimmer', 8, 0.6, 11), g('scout', 7, 0.5, 14)] },
  ],
  hints: [
    { waveIndex: 0, text: 'The last specializations unlock here: Eagle Eye (archer) and Fire Mages (wizard). All eight powers are available now - a Lv3 tower picks one (300 g).' },
    { waveIndex: 4, text: 'A Dreadnought approaches: 800 HP, armored and magic-resistant, and it crushes knights. Focus every tower on it - an Orbital Strike ignores its armor.' },
  ],
};
