import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 09 - "Icebound Bastion". Winter. A tight switchback with only a handful of build spots. */
export const level09: LevelDef = {
  id: 'level09',
  name: 'Icebound Bastion',
  biome: 'winter',
  tiles: [
    'cc..cr........',
    '#############.',
    '...B.r.cdB.c#.',
    'T.......d...#B',
    '.....cB.....#.',
    'r############r',
    '.#....r.c.B...',
    'B#...d.....c..',
    '.#.T.B.T..dTTT',
    '.############c',
    '........c.d.#.',
    '......T.....#.',
  ],
  paths: [
    [
      { x: -0.5, y: 1.5 },
      { x: 12.5, y: 1.5 },
      { x: 12.5, y: 5.5 },
      { x: 1.5, y: 5.5 },
      { x: 1.5, y: 9.5 },
      { x: 12.5, y: 9.5 },
      { x: 12.5, y: 12.5 },
    ],
  ],
  startGold: 450,
  lives: 20,
  waveGap: 18,
  towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 3 },
  waves: [
    { groups: [g('scout', 3, 1, 0), g('dart', 1, 0.7, 5)] },
    { groups: [g('plated', 3, 2.1, 0), g('skimmer', 5, 1.05, 3), g('scout', 2, 1, 10)] },
    { groups: [g('prism', 2, 1.05, 0), g('dart', 8, 0.45, 4), g('carrier', 1, 1.25, 12)] },
    { groups: [g('carrier', 4, 2.7, 0), g('skimmer', 8, 0.8, 3), g('scout', 4, 0.7, 8)] },
    { groups: [g('plated', 6, 1.4, 0), g('prism', 2, 1.45, 4), g('dread', 1, 1.1, 14)] },
    { groups: [g('skimmer', 11, 0.65, 0), g('dart', 4, 0.55, 4), g('carrier', 4, 2.5, 10)] },
    { groups: [g('dread', 3, 2.6, 0), g('plated', 6, 1.45, 2), g('scout', 10, 0.45, 8)] },
    { groups: [g('carrier', 4, 2.8, 0), g('prism', 8, 0.85, 3), g('skimmer', 19, 0.55, 8)] },
    { groups: [g('plated', 7, 1.25, 0), g('dread', 2, 2.6, 4), g('dart', 7, 0.4, 8), g('skimmer', 10, 0.6, 14)] },
    { groups: [g('prism', 5, 1, 0), g('carrier', 2, 3.05, 2), g('scout', 10, 0.45, 6), g('dread', 3, 2.6, 12)] },
    { groups: [g('dread', 3, 2.6, 0), g('plated', 7, 1.25, 3), g('skimmer', 14, 0.55, 6), g('dart', 6, 0.45, 12)] },
    { groups: [g('dread', 3, 2.6, 0), g('carrier', 2, 3.05, 2), g('prism', 2, 1.25, 5), g('plated', 6, 1.2, 8), g('skimmer', 12, 0.5, 11), g('scout', 7, 0.45, 14)] },
  ],
};
