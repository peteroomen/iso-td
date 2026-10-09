import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 02 - "Blossom Bend". Spring. One S-curved road; skimmers (fliers) appear. */
export const level02: LevelDef = {
  id: 'level02',
  name: 'Blossom Bend',
  biome: 'spring',
  tiles: [
    ' ........rd ',
    '.d..rTT....d',
    '#########.dT',
    '..Bcc.dB#Br.',
    '...d.B..#.r.',
    '...######...',
    'c.B#..B..B.d',
    '...#T..T.r.B',
    '...########.',
    '.T.d.....T#.',
    '..d.dB..B.#.',
    ' r.d....r.#.',
  ],
  paths: [
    [
      { x: -0.5, y: 2.5 },
      { x: 8.5, y: 2.5 },
      { x: 8.5, y: 5.5 },
      { x: 3.5, y: 5.5 },
      { x: 3.5, y: 8.5 },
      { x: 10.5, y: 8.5 },
      { x: 10.5, y: 12.5 },
    ],
  ],
  startGold: 320,
  lives: 20,
  waveGap: 18,
  towerCap: { archer: 2, wizard: 2, barracks: 2 },
  waves: [
    { groups: [g('scout', 12, 0.9, 0)] },
    { groups: [g('scout', 30, 0.75, 0), g('dart', 8, 0.6, 6)] },
    { groups: [g('skimmer', 4, 1.15, 0), g('scout', 35, 0.65, 4)] },
    { groups: [g('dart', 39, 0.45, 0), g('skimmer', 13, 0.9, 6)] },
    { groups: [g('scout', 37, 0.65, 0), g('skimmer', 14, 0.85, 5), g('dart', 17, 0.5, 14)] },
    { groups: [g('dart', 31, 0.45, 0), g('scout', 31, 0.6, 4), g('skimmer', 15, 0.75, 8)] },
    { groups: [g('scout', 29, 0.6, 0), g('skimmer', 15, 0.75, 6), g('dart', 22, 0.45, 10), g('skimmer', 9, 0.6, 20)] },
  ],
  hints: [
    { waveIndex: 2, text: 'Skimmers fly over knights - archers and wizards can hit them.' },
  ],
};
