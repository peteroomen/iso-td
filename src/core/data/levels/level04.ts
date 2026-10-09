import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 04 - "Dune Crossing". Desert. Three long switchbacks; prism UFOs (magic resistant) appear. */
export const level04: LevelDef = {
  id: 'level04',
  name: 'Dune Crossing',
  biome: 'desert',
  tiles: [
    '..Tdc.#..... ',
    '......#...r..',
    '.Bd.B.#c...rd',
    'c.#####..r.r.',
    'd.#.B..B.B...',
    '.B#T...d.....',
    '..#########..',
    'c...B.TT.c#B.',
    '.....r.B.B#..',
    '.r.T.######..',
    '.r..B#.rc....',
    '.....#rBc...c',
    ' ....#...... ',
  ],
  paths: [
    [
      { x: 6.5, y: -0.5 },
      { x: 6.5, y: 3.5 },
      { x: 2.5, y: 3.5 },
      { x: 2.5, y: 6.5 },
      { x: 10.5, y: 6.5 },
      { x: 10.5, y: 9.5 },
      { x: 5.5, y: 9.5 },
      { x: 5.5, y: 13.5 },
    ],
  ],
  startGold: 360,
  lives: 20,
  waveGap: 18,
  towerCap: { archer: 3, wizard: 3, barracks: 2 },
  waves: [
    { groups: [g('scout', 14, 0.65, 0)] },
    { groups: [g('dart', 14, 0.45, 0), g('scout', 27, 0.65, 5)] },
    { groups: [g('prism', 3, 1.4, 0), g('scout', 38, 0.55, 3)] },
    { groups: [g('plated', 6, 2.05, 0), g('skimmer', 6, 1.0, 4), g('dart', 16, 0.45, 10)] },
    { groups: [g('prism', 12, 1.0, 0), g('scout', 23, 0.6, 6), g('skimmer', 10, 0.85, 10)] },
    { groups: [g('plated', 5, 1.95, 0), g('prism', 4, 1.55, 4), g('dart', 44, 0.3, 8)] },
    { groups: [g('skimmer', 13, 0.8, 0), g('prism', 16, 0.9, 3), g('scout', 29, 0.5, 6)] },
    { groups: [g('plated', 7, 1.65, 0), g('prism', 4, 1.4, 2), g('dart', 33, 0.35, 8), g('skimmer', 13, 0.65, 12)] },
    { groups: [g('prism', 6, 1.15, 0), g('plated', 7, 1.5, 2), g('skimmer', 11, 0.7, 6), g('scout', 28, 0.45, 10), g('dart', 19, 0.35, 16)] },
  ],
  hints: [
    { waveIndex: 2, text: 'Prism UFOs carry a magic shield - wizard bolts barely scratch them. Use archers and knights.' },
  ],
};
