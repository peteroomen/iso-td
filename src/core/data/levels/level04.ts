import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 04 - "Dune Crossing". Desert. Three long switchbacks; prism UFOs (magic resistant) appear. */
export const level04: LevelDef = {
  id: 'level04',
  name: 'Dune Crossing',
  biome: 'desert',
  tiles: [
    '..Tdc.#......',
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
    '.....#.......',
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
  towerCap: { archer: 3, wizard: 3, barracks: 2, bomb: 2 },
  waves: [
    { groups: [g('scout', 11, 0.65, 0)] },
    { groups: [g('dart', 11, 0.45, 0), g('scout', 21, 0.65, 5)] },
    { groups: [g('prism', 2, 1.55, 0), g('scout', 29, 0.55, 3)] },
    { groups: [g('plated', 7, 2.05, 0), g('skimmer', 9, 0.9, 4), g('dart', 12, 0.45, 10)] },
    { groups: [g('prism', 8, 1.15, 0), g('scout', 18, 0.6, 6), g('skimmer', 14, 0.8, 10)] },
    { groups: [g('plated', 7, 1.95, 0), g('prism', 3, 1.7, 4), g('dart', 34, 0.3, 8)] },
    { groups: [g('skimmer', 19, 0.75, 0), g('prism', 11, 1, 3), g('scout', 22, 0.5, 6)] },
    { groups: [g('plated', 8, 1.65, 0), g('prism', 3, 1.55, 2), g('dart', 26, 0.35, 8), g('skimmer', 19, 0.6, 12)] },
    { groups: [g('prism', 4, 1.3, 0), g('plated', 8, 1.45, 2), g('skimmer', 16, 0.65, 6), g('scout', 21, 0.45, 10), g('dart', 15, 0.35, 16)] },
  ],
  hints: [
    { waveIndex: 2, text: 'Prism UFOs carry a magic shield - wizard bolts barely scratch them. Use archers and knights. Mix both tower kinds: plated UFOs still need wizards.' },
  ],
};
