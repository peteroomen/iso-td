import type { EnemyId } from '../types';

/** UFO table (docs/DESIGN.md §6). */
export interface EnemyDef {
  id: EnemyId;
  name: string;
  /** Sprite file under sprites/ufo (without extension). */
  sprite: string;
  hp: number;
  /** Tiles per second. */
  speed: number;
  /** 0..1 fraction of physical damage ignored. */
  armor: number;
  /** 0..1 fraction of magic damage ignored. */
  magicResist: number;
  gold: number;
  /** Lives lost when it leaks. */
  lives: number;
  meleeDamage: number;
  meleeCooldown: number;
  /** High flier: knights/militia ignore it; towers still hit it. */
  flier: boolean;
  /** Can be stopped by knights. (fliers and the boss cannot) */
  blockable: boolean;
  boss: boolean;
  scale: number;
  /** On death, release `count` of `enemy` at this enemy's path progress. */
  onDeath?: { enemy: EnemyId; count: number };
  /** Periodically launch escorts from this enemy's position. */
  launcher?: { interval: number; spawns: { enemy: EnemyId; count: number }[] };
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  scout: { id: 'scout', name: 'Scout', sprite: 'ufo_1', hp: 20, speed: 1.0, armor: 0, magicResist: 0, gold: 3, lives: 1, meleeDamage: 2, meleeCooldown: 1.0, flier: false, blockable: true, boss: false, scale: 1 },
  dart: { id: 'dart', name: 'Dart', sprite: 'ufo_2', hp: 15, speed: 1.8, armor: 0, magicResist: 0, gold: 4, lives: 1, meleeDamage: 1, meleeCooldown: 0.8, flier: false, blockable: true, boss: false, scale: 0.85 },
  skimmer: { id: 'skimmer', name: 'Skimmer', sprite: 'ufo_3', hp: 60, speed: 1.1, armor: 0, magicResist: 0, gold: 9, lives: 1, meleeDamage: 0, meleeCooldown: 1, flier: true, blockable: false, boss: false, scale: 1 },
  plated: { id: 'plated', name: 'Plated', sprite: 'ufo_4', hp: 160, speed: 0.7, armor: 0.8, magicResist: 0, gold: 15, lives: 1, meleeDamage: 6, meleeCooldown: 1.2, flier: false, blockable: true, boss: false, scale: 1 },
  prism: { id: 'prism', name: 'Prism', sprite: 'ufo_5', hp: 120, speed: 1.0, armor: 0, magicResist: 0.7, gold: 15, lives: 1, meleeDamage: 4, meleeCooldown: 1.0, flier: false, blockable: true, boss: false, scale: 1 },
  carrier: {
    id: 'carrier', name: 'Carrier', sprite: 'ufo_6', hp: 300, speed: 0.7, armor: 0, magicResist: 0, gold: 20, lives: 2, meleeDamage: 8, meleeCooldown: 1.5, flier: false, blockable: true, boss: false, scale: 1.3,
    onDeath: { enemy: 'dart', count: 3 },
  },
  dread: { id: 'dread', name: 'Dreadnought', sprite: 'ufo_7', hp: 800, speed: 0.6, armor: 0.6, magicResist: 0.4, gold: 40, lives: 3, meleeDamage: 25, meleeCooldown: 1.5, flier: false, blockable: true, boss: false, scale: 1.5 },
  mothership: {
    id: 'mothership', name: 'Mothership', sprite: 'mothership', hp: 14000, speed: 0.35, armor: 0.4, magicResist: 0.4, gold: 0, lives: 20, meleeDamage: 0, meleeCooldown: 1, flier: false, blockable: false, boss: true, scale: 2.2,
    launcher: { interval: 8, spawns: [{ enemy: 'scout', count: 2 }, { enemy: 'dart', count: 1 }] },
  },
};

export const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];
