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
  towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 3 },
  newSpecs: ['hunting_nets', 'bow_training'],
  newSpecsWhy: 'skimmers and dart swarms meet at the crossing: Nets drag fliers down, Bow Training knights shoot them',
  waves: [
    { groups: [g('scout', 10, 0.85, 0), g('scout', 10, 0.85, 2, 1)] },
    { groups: [g('dart', 10, 0.5, 0), g('dart', 10, 0.5, 3, 1), g('scout', 17, 0.85, 8)] },
    { groups: [g('prism', 1, 2.75, 0), g('plated', 3, 2.2, 2, 1), g('skimmer', 11, 0.65, 6, 1)] },
    { groups: [g('carrier', 1, 1.05, 0), g('scout', 22, 0.55, 2, 1), g('skimmer', 16, 0.75, 8)] },
    { groups: [g('carrier', 1, 1.05, 0, 1), g('prism', 1, 2.5, 2), g('dart', 40, 0.3, 6, 1), g('plated', 5, 2.2, 10)] },
    { groups: [g('carrier', 1, 2.65, 0), g('carrier', 1, 1.05, 4, 1), g('skimmer', 24, 0.6, 4, 1), g('scout', 25, 0.45, 8)] },
    { groups: [g('plated', 5, 2.1, 0), g('prism', 1, 2.35, 1, 1), g('carrier', 1, 2.65, 6, 1), g('dart', 40, 0.3, 10)] },
    { groups: [g('carrier', 1, 2.65, 0), g('carrier', 1, 2.65, 2, 1), g('skimmer', 46, 0.45, 4), g('prism', 3, 1.65, 8, 1)] },
    { groups: [g('plated', 5, 1.7, 0), g('plated', 5, 1.9, 1, 1), g('carrier', 1, 2.65, 5), g('scout', 35, 0.35, 8, 1), g('dart', 24, 0.3, 12)] },
    { groups: [g('carrier', 1, 2.65, 0), g('carrier', 1, 2.65, 1, 1), g('prism', 1, 1.45, 3), g('plated', 5, 1.6, 4, 1), g('skimmer', 35, 0.45, 7), g('dart', 29, 0.3, 12, 1)] },
  ],
  hints: [
    { waveIndex: 0, text: 'Two more specializations unlock: Hunting Nets (archer) and Bow Training (barracks). Nets drag skimmers to the ground, Bow Training knights shoot them.' },
    { waveIndex: 3, text: 'Carriers are tough, cost 2 lives and release 3 Darts when destroyed - finish them away from the exit.' },
  ],
};
