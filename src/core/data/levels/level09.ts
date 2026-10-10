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
    { groups: [g('scout', 1, 1.25, 0), g('dart', 1, 0.9, 5)] },
    { groups: [g('plated', 8, 1.7, 0), g('skimmer', 2, 1.4, 3), g('scout', 1, 1.25, 10)] },
    { groups: [g('prism', 4, 0.95, 0), g('dart', 4, 0.5, 4), g('carrier', 1, 1.8, 12)] },
    { groups: [g('carrier', 2, 3.75, 0), g('skimmer', 3, 1.05, 3), g('scout', 3, 0.9, 8)] },
    { groups: [g('plated', 14, 1.1, 0), g('prism', 4, 1.3, 4), g('dread', 1, 1.4, 14)] },
    { groups: [g('skimmer', 4, 0.85, 0), g('dart', 3, 0.65, 4), g('carrier', 2, 3.45, 10)] },
    { groups: [g('dread', 2, 3.2, 0), g('plated', 14, 1.15, 2), g('scout', 4, 0.5, 8)] },
    { groups: [g('carrier', 2, 3.9, 0), g('prism', 13, 0.75, 3), g('skimmer', 7, 0.7, 8)] },
    { groups: [g('plated', 17, 1, 0), g('dread', 1, 3.2, 4), g('dart', 1, 0.5, 8), g('skimmer', 4, 0.8, 14)] },
    { groups: [g('prism', 9, 0.9, 0), g('carrier', 1, 4.3, 2), g('scout', 4, 0.5, 6), g('dread', 2, 3.2, 12)] },
    { groups: [g('dread', 2, 3.2, 0), g('plated', 17, 1, 3), g('skimmer', 5, 0.7, 6), g('dart', 3, 0.5, 12)] },
    { groups: [g('dread', 2, 3.2, 0), g('carrier', 1, 4.3, 2), g('prism', 4, 1.1, 5), g('plated', 14, 0.95, 8), g('skimmer', 5, 0.65, 11), g('scout', 3, 0.5, 14)] },
  ],
};
