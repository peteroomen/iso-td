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
    { groups: [g('scout', 17, 0.8, 0), g('scout', 17, 0.8, 2, 1)] },
    { groups: [g('dart', 15, 0.55, 0, 1), g('plated', 2, 2.45, 3), g('skimmer', 12, 0.85, 8)] },
    { groups: [g('prism', 3, 1.7, 0), g('prism', 3, 1.7, 3, 1), g('scout', 52, 0.4, 8, 1)] },
    { groups: [g('carrier', 1, 2.7, 0), g('carrier', 1, 1.1, 3, 1), g('skimmer', 19, 0.7, 6, 1), g('dart', 18, 0.45, 10)] },
    { groups: [g('plated', 2, 2.2, 0), g('plated', 2, 2.2, 1, 1), g('skimmer', 35, 0.5, 6)] },
    { groups: [g('carrier', 1, 1.1, 0), g('carrier', 1, 1.1, 6, 1), g('scout', 42, 0.4, 2), g('dart', 35, 0.3, 8, 1)] },
    { groups: [g('carrier', 1, 2.7, 0, 1), g('prism', 5, 1.3, 1), g('skimmer', 29, 0.5, 6), g('scout', 28, 0.45, 10, 1)] },
    { groups: [g('plated', 2, 1.7, 0), g('plated', 2, 1.9, 2, 1), g('plated', 1, 2.45, 5), g('dart', 62, 0.25, 9, 1)] },
    { groups: [g('skimmer', 29, 0.45, 0), g('skimmer', 21, 0.55, 1, 1), g('carrier', 1, 2.7, 4), g('prism', 7, 1.05, 6, 1)] },
    { groups: [g('dread', 1, 5.1, 0), g('dread', 1, 5.1, 2, 1), g('plated', 5, 1.5, 4, 1), g('scout', 79, 0.3, 6)] },
    { groups: [g('carrier', 1, 2.7, 0), g('carrier', 1, 2.7, 1, 1), g('prism', 5, 1.05, 4), g('skimmer', 37, 0.4, 6, 1), g('dart', 42, 0.3, 12)] },
    { groups: [g('dread', 1, 2.45, 0), g('dread', 1, 2.45, 1, 1), g('plated', 2, 1.35, 3), g('plated', 2, 1.35, 4, 1), g('carrier', 1, 2.7, 8), g('skimmer', 37, 0.4, 10, 1), g('scout', 52, 0.3, 14)] },
  ],
};
