import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 06 - "Scorpion Loop". Desert. A long loop: the road crosses itself, so the centre is passed twice. */
export const level06: LevelDef = {
  id: 'level06',
  name: 'Scorpion Loop',
  biome: 'desert',
  tiles: [
    ' rdT#..c.T... ',
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
    ' .r.....B.... ',
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
  towerCap: { archer: 3, wizard: 3, barracks: 3 },
  waves: [
    { groups: [g('scout', 14, 0.7, 0), g('dart', 8, 0.5, 6)] },
    { groups: [g('plated', 4, 2.4, 0), g('skimmer', 6, 1.0, 3), g('scout', 22, 0.65, 8)] },
    { groups: [g('prism', 5, 1.15, 0), g('dart', 29, 0.4, 4), g('skimmer', 13, 0.75, 10)] },
    { groups: [g('carrier', 1, 2.4, 0), g('scout', 56, 0.4, 2), g('plated', 7, 2.05, 8)] },
    { groups: [g('skimmer', 21, 0.7, 0), g('prism', 15, 0.85, 4), g('dart', 30, 0.35, 8)] },
    { groups: [g('plated', 11, 1.7, 0), g('carrier', 1, 2.4, 3), g('scout', 56, 0.35, 8)] },
    { groups: [g('prism', 11, 1.0, 0), g('skimmer', 23, 0.55, 4), g('carrier', 4, 2.4, 8), g('dart', 38, 0.3, 12)] },
    { groups: [g('plated', 12, 1.5, 0), g('prism', 3, 1.5, 3), g('scout', 45, 0.4, 6), g('skimmer', 15, 0.6, 14)] },
    { groups: [g('carrier', 2, 2.4, 0), g('skimmer', 22, 0.55, 3), g('plated', 12, 1.4, 6), g('dart', 38, 0.3, 10)] },
    { groups: [g('carrier', 2, 2.4, 0), g('plated', 13, 1.4, 2), g('prism', 4, 1.25, 4), g('skimmer', 14, 0.65, 8), g('scout', 26, 0.4, 12), g('dart', 21, 0.35, 18)] },
  ],
};
