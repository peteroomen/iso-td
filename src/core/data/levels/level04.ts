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
  towerCap: { archer: 3, wizard: 3, barracks: 2 },
  waves: [
    { groups: [g('scout', 12, 0.65, 0)] },
    { groups: [g('dart', 12, 0.45, 0), g('scout', 24, 0.65, 5)] },
    { groups: [g('prism', 2, 1.5, 0), g('scout', 33, 0.55, 3)] },
    { groups: [g('plated', 5, 2.1, 0), g('skimmer', 9, 0.9, 4), g('dart', 14, 0.45, 10)] },
    { groups: [g('prism', 9, 1.1, 0), g('scout', 20, 0.6, 6), g('skimmer', 14, 0.8, 10)] },
    { groups: [g('plated', 5, 2, 0), g('prism', 3, 1.65, 4), g('dart', 38, 0.3, 8)] },
    { groups: [g('skimmer', 19, 0.75, 0), g('prism', 12, 0.95, 3), g('scout', 25, 0.5, 6)] },
    { groups: [g('plated', 6, 1.7, 0), g('prism', 3, 1.5, 2), g('dart', 29, 0.35, 8), g('skimmer', 19, 0.6, 12)] },
    { groups: [g('prism', 4, 1.25, 0), g('plated', 6, 1.55, 2), g('skimmer', 16, 0.65, 6), g('scout', 24, 0.45, 10), g('dart', 17, 0.35, 16)] },
  ],
  hints: [
    { waveIndex: 2, text: 'Prism UFOs carry a magic shield - wizard bolts barely scratch them. Use archers and knights. Mix both tower kinds: plated UFOs still need wizards.' },
  ],
};
