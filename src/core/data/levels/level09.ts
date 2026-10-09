import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 09 - "Icebound Bastion". Winter. A tight switchback with only a handful of build spots. */
export const level09: LevelDef = {
  id: 'level09',
  name: 'Icebound Bastion',
  biome: 'winter',
  tiles: [
    'cc..cr....... ',
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
    ' .....T.....# ',
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
  towerCap: { archer: 3, wizard: 3, barracks: 3 },
  waves: [
    { groups: [g('scout', 14, 0.65, 0), g('dart', 8, 0.45, 5)] },
    { groups: [g('plated', 8, 1.65, 0), g('skimmer', 8, 0.95, 3), g('scout', 13, 0.65, 10)] },
    { groups: [g('prism', 6, 0.8, 0), g('dart', 44, 0.3, 4), g('carrier', 1, 1.0, 12)] },
    { groups: [g('carrier', 10, 2.1, 0), g('skimmer', 12, 0.7, 3), g('scout', 24, 0.45, 8)] },
    { groups: [g('plated', 15, 1.1, 0), g('prism', 6, 1.1, 4), g('dread', 1, 1.0, 14)] },
    { groups: [g('skimmer', 17, 0.6, 0), g('dart', 23, 0.35, 4), g('carrier', 10, 1.95, 10)] },
    { groups: [g('dread', 3, 2.4, 0), g('plated', 14, 1.15, 2), g('scout', 56, 0.3, 8)] },
    { groups: [g('carrier', 10, 2.2, 0), g('prism', 24, 0.65, 3), g('skimmer', 31, 0.5, 8)] },
    { groups: [g('plated', 17, 1.0, 0), g('dread', 2, 2.4, 4), g('dart', 40, 0.25, 8), g('skimmer', 16, 0.55, 14)] },
    { groups: [g('prism', 16, 0.75, 0), g('carrier', 6, 2.4, 2), g('scout', 56, 0.3, 6), g('dread', 4, 2.4, 12)] },
    { groups: [g('dread', 3, 2.4, 0), g('plated', 19, 1.0, 3), g('skimmer', 22, 0.5, 6), g('dart', 34, 0.3, 12)] },
    { groups: [g('dread', 3, 2.4, 0), g('carrier', 4, 2.4, 2), g('prism', 7, 0.95, 5), g('plated', 14, 0.95, 8), g('skimmer', 18, 0.45, 11), g('scout', 39, 0.3, 14)] },
  ],
};
