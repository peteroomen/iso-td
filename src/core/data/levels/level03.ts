import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 03 - "Twin Creeks". Spring. The road forks around a central island and rejoins; plated UFOs appear. */
export const level03: LevelDef = {
  id: 'level03',
  name: 'Twin Creeks',
  biome: 'spring',
  tiles: [
    ' dr..T.T.... ',
    '......r.....T',
    '.TB..B.....T.',
    '...#######...',
    '.B.#B....#BB.',
    '####..B..####',
    '.BT#....B#B..',
    '...#######.c.',
    '..Bdd..B.....',
    '.......d.rrd.',
    ' T..Td....Td ',
  ],
  paths: [
    [
      { x: -0.5, y: 5.5 },
      { x: 3.5, y: 5.5 },
      { x: 3.5, y: 3.5 },
      { x: 9.5, y: 3.5 },
      { x: 9.5, y: 5.5 },
      { x: 13.5, y: 5.5 },
    ],
    [
      { x: -0.5, y: 5.5 },
      { x: 3.5, y: 5.5 },
      { x: 3.5, y: 7.5 },
      { x: 9.5, y: 7.5 },
      { x: 9.5, y: 5.5 },
      { x: 13.5, y: 5.5 },
    ],
  ],
  startGold: 340,
  lives: 20,
  waveGap: 18,
  towerCap: { archer: 3, wizard: 2, barracks: 2 },
  waves: [
    { groups: [g('scout', 8, 1.1, 0), g('scout', 8, 1.1, 3, 1)] },
    { groups: [g('dart', 8, 0.65, 0), g('scout', 17, 0.85, 2, 1)] },
    { groups: [g('plated', 2, 2.4, 0), g('scout', 9, 0.95, 2, 1), g('skimmer', 4, 1.55, 6)] },
    { groups: [g('skimmer', 9, 0.95, 0, 1), g('dart', 11, 0.6, 4), g('scout', 13, 0.75, 6, 1)] },
    { groups: [g('plated', 1, 2.4, 0), g('plated', 1, 2.4, 2, 1), g('scout', 28, 0.55, 4)] },
    { groups: [g('dart', 9, 0.6, 0), g('dart', 9, 0.6, 2, 1), g('skimmer', 4, 1.25, 5, 1), g('plated', 3, 2.4, 10)] },
    { groups: [g('plated', 1, 2.4, 0), g('plated', 1, 2.4, 1, 1), g('skimmer', 7, 0.9, 4), g('scout', 14, 0.7, 6, 1)] },
    { groups: [g('scout', 8, 0.75, 0), g('scout', 8, 0.75, 2, 1), g('plated', 2, 2.4, 4), g('plated', 2, 2.4, 5, 1), g('skimmer', 5, 0.95, 8), g('dart', 8, 0.55, 14, 1)] },
  ],
  hints: [
    { waveIndex: 2, text: 'Plated UFOs shrug off most arrows and knight blows - wizard magic cuts right through.' },
  ],
};
