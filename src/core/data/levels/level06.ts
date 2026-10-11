import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 06 - "Scorpion Loop". Desert. A long loop: the road crosses itself, so the centre is passed twice. */
export const level06: LevelDef = {
  id: 'level06',
  name: 'Scorpion Loop',
  biome: 'desert',
  tiles: [
    '.rdT#..c.T....',
    '.c.c#B......dT',
    'c...#.....c.d.',
    '.d.d#ddcB.d.d.',
    '############..',
    '.T..#..dB.B#.T',
    '.BT.#.....T#..',
    '.Tdr#.Brc..#..',
    '..dB#.rdT.B#B.',
    '.c..#B...d.#..',
    'T.T.#..c...#.d',
    '...B#..B..B#..',
    'd...########cT',
    '..r.....B.....',
  ],
  paths: [
    [
      { x: 4.5, y: -0.5 },
      { x: 4.5, y: 12.5 },
      { x: 11.5, y: 12.5 },
      { x: 11.5, y: 4.5 },
      { x: -0.5, y: 4.5 },
    ],
  ],
  startGold: 420,
  lives: 20,
  waveGap: 18,
  towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 3 },
  newSpecs: ['bigger_bombs', 'extra_recruits'],
  newSpecsWhy: 'plated crowds pass the loop crossing twice: Extra Recruits hold them inside Bigger Bombs blasts',
  waves: [
    { groups: [g('scout', 26, 0.35, 0), g('dart', 12, 0.25, 6)] },
    { groups: [g('plated', 8, 1.35, 0), g('skimmer', 7, 0.95, 3), g('scout', 38, 0.35, 8)] },
    { groups: [g('prism', 6, 1.2, 0), g('dart', 53, 0.2, 4), g('skimmer', 14, 0.7, 10)] },
    { groups: [g('carrier', 2, 1.65, 0), g('scout', 99, 0.2, 2), g('plated', 19, 1.2, 8)] },
    { groups: [g('skimmer', 24, 0.65, 0), g('prism', 15, 0.8, 4), g('dart', 53, 0.2, 8)] },
    { groups: [g('plated', 25, 0.95, 0), g('carrier', 2, 1.65, 3), g('scout', 99, 0.2, 8)] },
    { groups: [g('prism', 11, 1, 0), g('skimmer', 26, 0.55, 4), g('carrier', 8, 1.65, 8), g('dart', 68, 0.2, 12)] },
    { groups: [g('plated', 30, 0.8, 0), g('prism', 4, 1.55, 3), g('scout', 80, 0.2, 6), g('skimmer', 17, 0.6, 14)] },
    { groups: [g('carrier', 3, 1.65, 0), g('skimmer', 25, 0.55, 3), g('plated', 30, 0.75, 6), g('dart', 68, 0.2, 10)] },
    { groups: [g('carrier', 3, 1.65, 0), g('plated', 30, 0.75, 2), g('prism', 6, 1.25, 4), g('skimmer', 16, 0.65, 8), g('scout', 48, 0.2, 12), g('dart', 38, 0.2, 18)] },
  ],
  hints: [
    { waveIndex: 0, text: 'Two more specializations unlock: Bigger Bombs (bomb) and Extra Recruits (barracks). The road crosses itself - knights holding the crossing keep UFOs inside the bomb blasts.' },
  ],
};
