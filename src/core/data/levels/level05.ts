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
  towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 2 },
  waves: [
    { groups: [g('scout', 20, 0.65, 0), g('scout', 20, 0.65, 2, 1)] },
    { groups: [g('dart', 20, 0.45, 0), g('dart', 20, 0.45, 3, 1), g('scout', 36, 0.65, 8)] },
    { groups: [g('prism', 1, 2.4, 0), g('plated', 3, 2.25, 2, 1), g('skimmer', 11, 0.65, 6, 1)] },
    { groups: [g('carrier', 1, 0.9, 0), g('scout', 45, 0.5, 2, 1), g('skimmer', 17, 0.75, 8)] },
    { groups: [g('carrier', 1, 0.9, 0, 1), g('prism', 1, 2.15, 2), g('dart', 84, 0.25, 6, 1), g('plated', 4, 2.25, 10)] },
    { groups: [g('carrier', 2, 2.3, 0), g('carrier', 1, 0.9, 4, 1), g('skimmer', 25, 0.6, 4, 1), g('scout', 53, 0.4, 8)] },
    { groups: [g('plated', 5, 2.1, 0), g('prism', 1, 2.05, 1, 1), g('carrier', 1, 2.3, 6, 1), g('dart', 84, 0.25, 10)] },
    { groups: [g('carrier', 2, 2.3, 0), g('carrier', 1, 2.3, 2, 1), g('skimmer', 49, 0.5, 4), g('prism', 5, 1.45, 8, 1)] },
    { groups: [g('plated', 5, 1.75, 0), g('plated', 4, 1.9, 1, 1), g('carrier', 1, 2.3, 5), g('scout', 72, 0.3, 8, 1), g('dart', 51, 0.25, 12)] },
    { groups: [g('carrier', 1, 2.3, 0), g('carrier', 1, 2.3, 1, 1), g('prism', 1, 1.3, 3), g('plated', 5, 1.6, 4, 1), g('skimmer', 37, 0.5, 7), g('dart', 60, 0.25, 12, 1)] },
  ],
  hints: [
    { waveIndex: 3, text: 'Carriers are tough, cost 2 lives and release 3 Darts when destroyed - finish them away from the exit.' },
  ],
};
