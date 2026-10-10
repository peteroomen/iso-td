import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 03 - "Twin Creeks". Spring. The road forks around a central island and rejoins; plated UFOs appear. */
export const level03: LevelDef = {
  id: 'level03',
  name: 'Twin Creeks',
  biome: 'spring',
  tiles: [
    '.dr..T.T.....',
    '......r.....T',
    '.TB..B.....T.',
    '...#######...',
    '.B.#B....#BB.',
    '####..B..####',
    '.BT#....B#B..',
    '...#######.c.',
    '..Bdd..B.....',
    '.......d.rrd.',
    '.T..Td....Td.',
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
  towerCap: { archer: 3, wizard: 2, barracks: 2, bomb: 2 },
  waves: [
    { groups: [g('scout', 10, 1.05, 0), g('scout', 10, 1.05, 3, 1)] },
    { groups: [g('dart', 10, 0.6, 0), g('scout', 22, 0.8, 2, 1)] },
    { groups: [g('plated', 2, 2.3, 0), g('scout', 12, 0.9, 2, 1), g('skimmer', 5, 1.45, 6)] },
    { groups: [g('skimmer', 12, 0.9, 0, 1), g('dart', 14, 0.55, 4), g('scout', 17, 0.7, 6, 1)] },
    { groups: [g('plated', 1, 2.3, 0), g('plated', 1, 2.3, 2, 1), g('scout', 36, 0.5, 4)] },
    { groups: [g('dart', 12, 0.55, 0), g('dart', 12, 0.55, 2, 1), g('skimmer', 5, 1.2, 5, 1), g('plated', 4, 2.3, 10)] },
    { groups: [g('plated', 1, 2.3, 0), g('plated', 1, 2.3, 1, 1), g('skimmer', 9, 0.85, 4), g('scout', 18, 0.65, 6, 1)] },
    { groups: [g('scout', 10, 0.7, 0), g('scout', 10, 0.7, 2, 1), g('plated', 2, 2.3, 4), g('plated', 2, 2.3, 5, 1), g('skimmer', 6, 0.9, 8), g('dart', 10, 0.5, 14, 1)] },
  ],
  hints: [
    { waveIndex: 2, text: 'Plated UFOs shrug off most arrows and knight blows - wizard magic cuts right through.' },
  ],
};
