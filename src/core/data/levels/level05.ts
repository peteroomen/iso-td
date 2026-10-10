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
    { groups: [g('scout', 13, 0.7, 0), g('scout', 13, 0.7, 2, 1)] },
    { groups: [g('dart', 13, 0.5, 0), g('dart', 13, 0.5, 3, 1), g('scout', 24, 0.7, 8)] },
    { groups: [g('prism', 1, 2.55, 0), g('plated', 2, 2.4, 2, 1), g('skimmer', 8, 0.7, 6, 1)] },
    { groups: [g('carrier', 1, 0.95, 0), g('scout', 30, 0.55, 2, 1), g('skimmer', 13, 0.8, 8)] },
    { groups: [g('carrier', 1, 0.95, 0, 1), g('prism', 1, 2.25, 2), g('dart', 56, 0.25, 6, 1), g('plated', 3, 2.4, 10)] },
    { groups: [g('carrier', 2, 2.4, 0), g('carrier', 1, 0.95, 4, 1), g('skimmer', 19, 0.65, 4, 1), g('scout', 35, 0.45, 8)] },
    { groups: [g('plated', 4, 2.2, 0), g('prism', 1, 2.15, 1, 1), g('carrier', 1, 2.4, 6, 1), g('dart', 56, 0.25, 10)] },
    { groups: [g('carrier', 2, 2.4, 0), g('carrier', 1, 2.4, 2, 1), g('skimmer', 37, 0.55, 4), g('prism', 4, 1.55, 8, 1)] },
    { groups: [g('plated', 4, 1.85, 0), g('plated', 3, 2, 1, 1), g('carrier', 1, 2.4, 5), g('scout', 48, 0.35, 8, 1), g('dart', 34, 0.25, 12)] },
    { groups: [g('carrier', 1, 2.4, 0), g('carrier', 1, 2.4, 1, 1), g('prism', 1, 1.4, 3), g('plated', 4, 1.7, 4, 1), g('skimmer', 28, 0.55, 7), g('dart', 40, 0.25, 12, 1)] },
  ],
  hints: [
    { waveIndex: 3, text: 'Carriers are tough, cost 2 lives and release 3 Darts when destroyed - finish them away from the exit.' },
  ],
};
