import type { SpecId, TowerKind } from '../types';

/**
 * Tower specializations (docs/DESIGN.md section 12). From level 7 on (`LevelDef.specsUnlocked`) a Lv3 tower may buy exactly
 * ONE of the two specs of its kind. The choice is permanent and part of the tower's `invested` gold (so selling refunds 60% of it).
 */
export interface SpecDef {
  id: SpecId;
  tower: TowerKind;
  name: string;
  /** Gold. NOT affected by the star tree (the wizard "-10% cost" star only discounts build / upgrade steps). */
  cost: number;
  /** One-line description for tooltips. */
  blurb: string;
}

export const SPECS: Record<SpecId, SpecDef> = {
  eagle_eye: {
    id: 'eagle_eye',
    tower: 'archer',
    name: 'Eagle Eye',
    cost: 300,
    blurb: '+30% range, +20% damage, every 4th arrow ignores all armor',
  },
  hunting_nets: {
    id: 'hunting_nets',
    tower: 'archer',
    name: 'Hunting Nets',
    cost: 300,
    blurb: 'Every 6.5 s throws a net: UFOs near the impact are trapped for 3 s (fliers are pulled down); bosses are slowed 50%',
  },
  chain_lightning: {
    id: 'chain_lightning',
    tower: 'wizard',
    name: 'Chain Lightning',
    cost: 300,
    blurb: 'Bolts jump to 3 more UFOs for 50% / 35% / 20% damage',
  },
  fire_mages: {
    id: 'fire_mages',
    tower: 'wizard',
    name: 'Fire Mages',
    cost: 300,
    blurb: 'Hits ignite: 40 true damage per second for 4 s, ignores magic resistance',
  },
  bigger_bombs: {
    id: 'bigger_bombs',
    tower: 'bomb',
    name: 'Bigger Bombs',
    cost: 300,
    blurb: '+40% blast radius, +25% damage, +2 bomblets',
  },
  homing_missiles: {
    id: 'homing_missiles',
    tower: 'bomb',
    name: 'Homing Missiles',
    cost: 300,
    blurb: 'Every 5 s two missiles hit the furthest-forward UFOs, fliers included',
  },
  bow_training: {
    id: 'bow_training',
    tower: 'barracks',
    name: 'Bow Training',
    cost: 300,
    blurb: 'Knights that are not in melee shoot arrows (fliers included)',
  },
  extra_recruits: {
    id: 'extra_recruits',
    tower: 'barracks',
    name: 'Extra Recruits',
    cost: 300,
    blurb: '+1 knight (4), +25% knight HP, 30% faster respawn',
  },
};

export const SPEC_IDS: readonly SpecId[] = [
  'eagle_eye', 'hunting_nets', 'chain_lightning', 'fire_mages', 'bigger_bombs', 'homing_missiles', 'bow_training', 'extra_recruits',
];

/** The two specs of each tower kind, in menu order (option A, option B). */
export const SPECS_BY_TOWER: Record<TowerKind, readonly [SpecId, SpecId]> = {
  archer: ['eagle_eye', 'hunting_nets'],
  wizard: ['chain_lightning', 'fire_mages'],
  barracks: ['bow_training', 'extra_recruits'],
  bomb: ['bigger_bombs', 'homing_missiles'],
};

/** Gold cost of a spec. */
export function specCost(id: SpecId): number {
  return SPECS[id].cost;
}

/** Tunable numbers of every spec (see docs/DESIGN.md section 12 for the rules around them). */
export const SPEC_TUNING = {
  eagle_eye: {
    /** Multiplies the range (on top of the Archers star +10%). */
    rangeMult: 1.3,
    /** Multiplies damage (on top of the Archers star +15%). */
    damageMult: 1.2,
    /** Every Nth arrow fired (counting each arrow of a Double Shot volley) ignores ALL armor. */
    ignoreEvery: 4,
  },
  hunting_nets: {
    /** Seconds between nets (a timer that runs continuously; the net is thrown when it is 0 and a UFO is in range). */
    cooldown: 6.5,
    /** Radius around the impact point whose UFOs get caught. */
    radius: 1.2,
    rootDuration: 3,
    /** Bosses are slowed to this speed factor instead of rooted. */
    bossSlowFactor: 0.5,
    bossSlowDuration: 3,
    /** Flight time of the net = flightBase + flightPerTile * distance. */
    flightBase: 0.35,
    flightPerTile: 0.06,
    /** Apex height (tiles) suggested to the renderer. */
    arc: 1.2,
  },
  chain_lightning: {
    jumps: 3,
    /** Damage factor per jump (of the primary hit's damage). */
    factors: [0.5, 0.35, 0.2] as readonly number[],
    /** Max distance of each jump from the previously hit UFO. */
    range: 1.5,
  },
  fire_mages: {
    /** True damage per second while burning. */
    dps: 40,
    /** Seconds; a new hit refreshes the timer (no stacking). */
    duration: 4,
  },
  bigger_bombs: {
    /** Multiplies the blast radius of shells AND bomblets (on top of the Bombs star +20%). */
    radiusMult: 1.4,
    damageMult: 1.25,
    /** Added to the Cluster Bomb's bomblet count (3 + 2 = 5, or 5 + 2 = 7 with the Bombs star tier 3). */
    extraBomblets: 2,
  },
  homing_missiles: {
    cooldown: 5,
    count: 2,
    /** Raw physical damage of a missile (the Bombs star damage bonus applies). */
    damage: 90,
    /** Splash radius in tiles (the Bombs star radius bonus applies); hits grounded UFOs AND fliers. */
    splash: 0.7,
    /** Tiles per second. */
    speed: 6.5,
  },
  bow_training: {
    damageMin: 9,
    damageMax: 13,
    cooldown: 1.0,
    /** Range measured from the knight. */
    range: 2.5,
    /** Arrow speed in tiles per second. */
    arrowSpeed: 10,
  },
  extra_recruits: {
    extraKnights: 1,
    hpMult: 1.25,
    respawnMult: 0.7,
  },
} as const;
