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
  specsUnlocked: true,
  waves: [
    { groups: [g('scout', 1, 1.35, 0), g('dart', 1, 0.95, 5)] },
    { groups: [g('plated', 13, 1.6, 0), g('skimmer', 2, 1.4, 3), g('scout', 1, 1.35, 10)] },
    { groups: [g('prism', 6, 0.9, 0), g('dart', 4, 0.5, 4), g('carrier', 1, 1.75, 12)] },
    { groups: [g('carrier', 3, 3.5, 0), g('skimmer', 4, 1, 3), g('scout', 3, 0.95, 8)] },
    { groups: [g('plated', 21, 0.95, 0), g('prism', 6, 1.3, 4), g('dread', 2, 1.6, 14)] },
    { groups: [g('skimmer', 5, 0.8, 0), g('dart', 3, 0.65, 4), g('carrier', 3, 3.25, 10)] },
    { groups: [g('dread', 2, 3.5, 0), g('plated', 21, 1, 2), g('scout', 4, 0.5, 8)] },
    { groups: [g('carrier', 3, 3.7, 0), g('prism', 15, 0.7, 3), g('skimmer', 6, 0.7, 8)] },
    { groups: [g('plated', 26, 0.9, 0), g('dread', 2, 3.5, 4), g('dart', 1, 0.5, 8), g('skimmer', 5, 0.8, 14)] },
    { groups: [g('prism', 9, 0.85, 0), g('carrier', 1, 4.1, 2), g('scout', 4, 0.5, 6), g('dread', 2, 3.5, 12)] },
    { groups: [g('dread', 2, 3.5, 0), g('plated', 26, 0.9, 3), g('skimmer', 5, 0.7, 6), g('dart', 3, 0.5, 12)] },
    { groups: [g('dread', 2, 3.5, 0), g('carrier', 1, 4.1, 2), g('prism', 6, 1.05, 5), g('plated', 21, 0.85, 8), g('skimmer', 5, 0.6, 11), g('scout', 3, 0.5, 14)] },
  ],
};
