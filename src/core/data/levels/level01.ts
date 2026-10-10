import type { LevelDef } from '../../types';

/**
 * Level 1 - "Meadow Landing" (Spring). One winding path, scouts and darts, tutorial hints.
 * Path (cells): enter left edge row 1 -> east to x9 -> south to y4 -> west to x2 -> south to y7 -> east off the right edge.
 */
export const level01: LevelDef = {
  id: 'level01',
  name: 'Meadow Landing',
  biome: 'spring',
  tiles: [
    '.T..d..T.d.c',
    '##########..',
    '..B..B...#..',
    '.T...r..B#..',
    '..########..',
    '.d#.B..B....',
    '.T#B.r.....T',
    '..##########',
    '.....B..B...',
    'T..d..T..d.T',
  ],
  paths: [
    [
      { x: -0.5, y: 1.5 },
      { x: 9.5, y: 1.5 },
      { x: 9.5, y: 4.5 },
      { x: 2.5, y: 4.5 },
      { x: 2.5, y: 7.5 },
      { x: 12.5, y: 7.5 },
    ],
  ],
  startGold: 300,
  lives: 20,
  waveGap: 18,
  towerCap: { archer: 1, wizard: 1, barracks: 1, bomb: 1 },
  waves: [
    { groups: [{ enemy: 'scout', count: 6, interval: 1.8, delay: 0, path: 0 }] },
    { groups: [{ enemy: 'scout', count: 10, interval: 1.4, delay: 0, path: 0 }] },
    {
      groups: [
        { enemy: 'scout', count: 8, interval: 1.2, delay: 0, path: 0 },
        { enemy: 'dart', count: 6, interval: 1.0, delay: 6, path: 0 },
      ],
    },
    {
      groups: [
        { enemy: 'scout', count: 12, interval: 1.0, delay: 0, path: 0 },
        { enemy: 'dart', count: 8, interval: 0.8, delay: 5, path: 0 },
      ],
    },
    {
      groups: [
        { enemy: 'dart', count: 12, interval: 0.7, delay: 0, path: 0 },
        { enemy: 'scout', count: 12, interval: 0.9, delay: 3, path: 0 },
      ],
    },
    {
      groups: [
        { enemy: 'scout', count: 16, interval: 0.8, delay: 0, path: 0 },
        { enemy: 'dart', count: 10, interval: 0.6, delay: 5, path: 0 },
        { enemy: 'scout', count: 10, interval: 0.8, delay: 12, path: 0 },
      ],
    },
  ],
  hints: [
    { waveIndex: 0, text: 'Welcome, Commander! Tap a glowing build spot to build a tower. Archers are cheap and shoot fast.' },
    { waveIndex: 1, text: 'Barracks knights block ground UFOs and fight them. Build one on a bend of the road.' },
    { waveIndex: 2, text: 'Use Orbital Strike on a crowd of UFOs. Reinforcements drop militia anywhere near the road.' },
    { waveIndex: 3, text: 'Calling the next wave early pays bonus gold and speeds up your abilities.' },
    { waveIndex: 4, text: 'Darts are fast - knights and archers placed near the exit are your last line of defense.' },
  ],
};
