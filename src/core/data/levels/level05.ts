import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 05 - "Oasis Crossroads". Desert. Two entrances whose roads cross in the middle; carriers appear. */
export const level05: LevelDef = {
  id: 'level05',
  name: 'Oasis Crossroads',
  biome: 'desert',
  tiles: [
    '..rd...r.#.d.',
    '....T.Td.#T..',
    '..dcB...B#..r',
    '#######..#..c',
    '..B.BT#.c#Bd.',
    '..T..B#Bc#r..',
    '...#######...',
    '.T.#TB#B.T...',
    '.T.#..#.BrB..',
    'd.B#d.#######',
    '..c#Bd.dBd.rT',
    '...#.r.T.....',
    '...#TT..r....',
  ],
  paths: [
    [
      { x: -0.5, y: 3.5 },
      { x: 6.5, y: 3.5 },
      { x: 6.5, y: 9.5 },
      { x: 13.5, y: 9.5 },
    ],
    [
      { x: 9.5, y: -0.5 },
      { x: 9.5, y: 6.5 },
      { x: 3.5, y: 6.5 },
      { x: 3.5, y: 13.5 },
    ],
  ],
  startGold: 400,
  lives: 20,
  waveGap: 18,
  towerCap: { archer: 3, wizard: 3, barracks: 3 },
  waves: [
    { groups: [g('scout', 10, 0.75, 0), g('scout', 10, 0.75, 2, 1)] },
    { groups: [g('dart', 10, 0.55, 0), g('dart', 10, 0.55, 3, 1), g('scout', 18, 0.75, 8)] },
    { groups: [g('prism', 1, 2.6, 0), g('plated', 2, 2.4, 2, 1), g('skimmer', 7, 0.75, 6, 1)] },
    { groups: [g('carrier', 1, 1, 0), g('scout', 23, 0.6, 2, 1), g('skimmer', 11, 0.85, 8)] },
    { groups: [g('carrier', 1, 1, 0, 1), g('prism', 1, 2.3, 2), g('dart', 43, 0.3, 6, 1), g('plated', 3, 2.4, 10)] },
    { groups: [g('carrier', 2, 2.45, 0), g('carrier', 1, 1, 4, 1), g('skimmer', 16, 0.7, 4, 1), g('scout', 27, 0.5, 8)] },
    { groups: [g('plated', 4, 2.15, 0), g('prism', 1, 2.2, 1, 1), g('carrier', 1, 2.45, 6, 1), g('dart', 43, 0.25, 10)] },
    { groups: [g('carrier', 2, 2.45, 0), g('carrier', 1, 2.45, 2, 1), g('skimmer', 31, 0.55, 4), g('prism', 3, 1.6, 8, 1)] },
    { groups: [g('plated', 4, 1.85, 0), g('plated', 3, 2, 1, 1), g('carrier', 1, 2.45, 5), g('scout', 37, 0.4, 8, 1), g('dart', 26, 0.3, 12)] },
    { groups: [g('carrier', 1, 2.45, 0), g('carrier', 1, 2.45, 1, 1), g('prism', 1, 1.45, 3), g('plated', 4, 1.7, 4, 1), g('skimmer', 23, 0.55, 7), g('dart', 31, 0.3, 12, 1)] },
  ],
  hints: [
    { waveIndex: 3, text: 'Carriers are tough, cost 2 lives and release 3 Darts when destroyed - finish them away from the exit.' },
  ],
};
