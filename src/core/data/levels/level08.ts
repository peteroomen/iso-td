import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 08 - "Glacier Junction". Winter. Two entrances whose roads merge into a single trunk to the exit. */
export const level08: LevelDef = {
  id: 'level08',
  name: 'Glacier Junction',
  biome: 'winter',
  tiles: [
    ' .....dddT.. ',
    'd...d....c...',
    '.B....T....d.',
    '####.cd.dT..T',
    '..B#...d..r.c',
    '...#B...BdB..',
    '...#######...',
    '..B..B#B.#.cT',
    '...d..#Tr#.Bd',
    '..T.TB#B.####',
    'dT.d..#..TB..',
    '.d...B#B.T...',
    ' .cTdT#.T... ',
  ],
  paths: [
    [
      { x: -0.5, y: 3.5 },
      { x: 3.5, y: 3.5 },
      { x: 3.5, y: 6.5 },
      { x: 6.5, y: 6.5 },
      { x: 6.5, y: 13.5 },
    ],
    [
      { x: 13.5, y: 9.5 },
      { x: 9.5, y: 9.5 },
      { x: 9.5, y: 6.5 },
      { x: 6.5, y: 6.5 },
      { x: 6.5, y: 13.5 },
    ],
  ],
  startGold: 450,
  lives: 20,
  waveGap: 18,
  towerCap: { archer: 3, wizard: 3, barracks: 3 },
  waves: [
    { groups: [g('scout', 12, 0.85, 0), g('scout', 12, 0.85, 2, 1)] },
    { groups: [g('dart', 11, 0.6, 0, 1), g('plated', 2, 2.4, 3), g('skimmer', 6, 1.0, 8)] },
    { groups: [g('prism', 2, 1.8, 0), g('prism', 2, 1.8, 3, 1), g('scout', 37, 0.45, 8, 1)] },
    { groups: [g('carrier', 2, 2.4, 0), g('carrier', 1, 1.0, 3, 1), g('skimmer', 10, 0.85, 6, 1), g('dart', 13, 0.5, 10)] },
    { groups: [g('plated', 2, 2.15, 0), g('plated', 2, 2.15, 1, 1), g('skimmer', 17, 0.6, 6)] },
    { groups: [g('carrier', 1, 1.0, 0), g('carrier', 1, 1.0, 6, 1), g('scout', 30, 0.45, 2), g('dart', 25, 0.35, 8, 1)] },
    { groups: [g('carrier', 2, 2.4, 0, 1), g('prism', 4, 1.4, 1), g('skimmer', 14, 0.6, 6), g('scout', 20, 0.5, 10, 1)] },
    { groups: [g('plated', 2, 1.7, 0), g('plated', 2, 1.85, 2, 1), g('plated', 1, 2.4, 5), g('dart', 44, 0.25, 9, 1)] },
    { groups: [g('skimmer', 14, 0.55, 0), g('skimmer', 11, 0.65, 1, 1), g('carrier', 2, 2.4, 4), g('prism', 5, 1.15, 6, 1)] },
    { groups: [g('dread', 1, 5.0, 0), g('dread', 1, 5.0, 2, 1), g('plated', 5, 1.5, 4, 1), g('scout', 56, 0.3, 6)] },
    { groups: [g('carrier', 1, 2.4, 0), g('carrier', 1, 2.4, 1, 1), g('prism', 4, 1.15, 4), g('skimmer', 18, 0.5, 6, 1), g('dart', 30, 0.3, 12)] },
    { groups: [g('dread', 1, 2.4, 0), g('dread', 1, 2.4, 1, 1), g('plated', 2, 1.35, 3), g('plated', 2, 1.35, 4, 1), g('carrier', 1, 2.4, 8), g('skimmer', 18, 0.45, 10, 1), g('scout', 37, 0.3, 14)] },
  ],
};
