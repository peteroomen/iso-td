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
  towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 3 },
  newSpecs: ['chain_lightning', 'homing_missiles'],
  newSpecsWhy: 'skimmer flocks and prism packs fill the switchbacks: Chain Lightning leaps through them, Missiles hit both',
  waves: [
    { groups: [g('scout', 16, 0.35, 0)] },
    { groups: [g('dart', 16, 0.25, 0), g('scout', 30, 0.35, 5)] },
    { groups: [g('prism', 2, 1.55, 0), g('scout', 42, 0.25, 3)] },
    { groups: [g('plated', 4, 2.35, 0), g('skimmer', 23, 0.45, 4), g('dart', 17, 0.25, 10)] },
    { groups: [g('prism', 8, 1.15, 0), g('scout', 25, 0.3, 6), g('skimmer', 35, 0.4, 10)] },
    { groups: [g('plated', 4, 2.25, 0), g('prism', 3, 1.7, 4), g('dart', 49, 0.15, 8)] },
    { groups: [g('skimmer', 48, 0.4, 0), g('prism', 11, 1, 3), g('scout', 32, 0.25, 6)] },
    { groups: [g('plated', 5, 1.9, 0), g('prism', 3, 1.55, 2), g('dart', 37, 0.2, 8), g('skimmer', 48, 0.25, 12)] },
    { groups: [g('prism', 4, 1.35, 0), g('plated', 5, 1.65, 2), g('skimmer', 39, 0.3, 6), g('scout', 30, 0.25, 10), g('dart', 22, 0.2, 16)] },
  ],
  hints: [
    { waveIndex: 0, text: 'NEW: Specializations! A Lv3 tower can buy one permanent power for 300 g. Unlocked now: Chain Lightning (wizard) and Homing Missiles (bomb) - tap a Lv3 tower to see them.' },
    { waveIndex: 2, text: 'Prism UFOs carry a magic shield - wizard bolts barely scratch them. Use archers and knights. Mix both tower kinds: plated UFOs still need wizards.' },
  ],
};
