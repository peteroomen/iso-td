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
  waves: [
    { groups: [g('scout', 13, 0.7, 0), g('dart', 6, 0.55, 6)] },
    { groups: [g('plated', 3, 2.6, 0), g('skimmer', 14, 0.8, 3), g('scout', 19, 0.65, 8)] },
    { groups: [g('prism', 4, 1.3, 0), g('dart', 26, 0.4, 4), g('skimmer', 30, 0.6, 10)] },
    { groups: [g('carrier', 1, 2.5, 0), g('scout', 49, 0.4, 2), g('plated', 6, 2.25, 8)] },
    { groups: [g('skimmer', 48, 0.55, 0), g('prism', 11, 0.9, 4), g('dart', 26, 0.35, 8)] },
    { groups: [g('plated', 8, 1.8, 0), g('carrier', 1, 2.5, 3), g('scout', 49, 0.35, 8)] },
    { groups: [g('prism', 8, 1.1, 0), g('skimmer', 53, 0.45, 4), g('carrier', 4, 2.5, 8), g('dart', 34, 0.3, 12)] },
    { groups: [g('plated', 9, 1.55, 0), g('prism', 3, 1.65, 3), g('scout', 40, 0.4, 6), g('skimmer', 34, 0.5, 14)] },
    { groups: [g('carrier', 2, 2.5, 0), g('skimmer', 50, 0.45, 3), g('plated', 9, 1.45, 6), g('dart', 34, 0.3, 10)] },
    { groups: [g('carrier', 2, 2.5, 0), g('plated', 9, 1.45, 2), g('prism', 4, 1.4, 4), g('skimmer', 32, 0.55, 8), g('scout', 24, 0.4, 12), g('dart', 19, 0.35, 18)] },
  ],
};
