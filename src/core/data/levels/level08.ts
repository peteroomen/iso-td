import type { LevelDef } from '../../types';
import { g } from './util';

/** Level 08 - "Glacier Junction". Winter. Two entrances whose roads merge into a single trunk to the exit. */
export const level08: LevelDef = {
  id: 'level08',
  name: 'Glacier Junction',
  biome: 'winter',
  tiles: [
    '......dddT...',
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
    '..cTdT#.T....',
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
  towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 3 },
  specsUnlocked: true,
  waves: [
    { groups: [g('scout', 17, 0.8, 0), g('scout', 17, 0.8, 2, 1)] },
    { groups: [g('dart', 15, 0.55, 0, 1), g('plated', 2, 2.35, 3), g('skimmer', 20, 0.75, 8)] },
    { groups: [g('prism', 2, 1.95, 0), g('prism', 2, 1.95, 3, 1), g('scout', 51, 0.4, 8, 1)] },
    { groups: [g('carrier', 2, 2.4, 0), g('carrier', 2, 0.95, 3, 1), g('skimmer', 32, 0.6, 6, 1), g('dart', 18, 0.45, 10)] },
    { groups: [g('plated', 2, 2.15, 0), g('plated', 2, 2.15, 1, 1), g('skimmer', 59, 0.45, 6)] },
    { groups: [g('carrier', 2, 0.95, 0), g('carrier', 2, 0.95, 6, 1), g('scout', 41, 0.4, 2), g('dart', 34, 0.3, 8, 1)] },
    { groups: [g('carrier', 2, 2.4, 0, 1), g('prism', 3, 1.5, 1), g('skimmer', 49, 0.45, 6), g('scout', 27, 0.45, 10, 1)] },
    { groups: [g('plated', 2, 1.65, 0), g('plated', 2, 1.85, 2, 1), g('plated', 1, 2.35, 5), g('dart', 60, 0.25, 9, 1)] },
    { groups: [g('skimmer', 49, 0.4, 0), g('skimmer', 35, 0.5, 1, 1), g('carrier', 2, 2.4, 4), g('prism', 4, 1.2, 6, 1)] },
    { groups: [g('dread', 1, 5.1, 0), g('dread', 1, 5.1, 2, 1), g('plated', 5, 1.5, 4, 1), g('scout', 77, 0.3, 6)] },
    { groups: [g('carrier', 2, 2.4, 0), g('carrier', 2, 2.4, 1, 1), g('prism', 3, 1.2, 4), g('skimmer', 62, 0.35, 6, 1), g('dart', 41, 0.3, 12)] },
    { groups: [g('dread', 1, 2.45, 0), g('dread', 1, 2.45, 1, 1), g('plated', 2, 1.35, 3), g('plated', 2, 1.35, 4, 1), g('carrier', 2, 2.4, 8), g('skimmer', 62, 0.35, 10, 1), g('scout', 51, 0.3, 14)] },
  ],
};
