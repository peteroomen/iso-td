/** Player abilities (docs/DESIGN.md §4). Both start every level ready. */

export const ORBITAL = {
  name: 'Orbital Strike',
  cooldown: 40,
  /** Seconds between casting (reticle) and the beam landing. */
  delay: 1.0,
  /** True damage to every enemy in radius (fliers and boss included). */
  damage: 60,
  radius: 1.4,
  /** Tier-3 burning ground. */
  burnDuration: 3,
  burnDps: 15,
} as const;

export const REINFORCE = {
  name: 'Reinforcements',
  cooldown: 15,
  /** Seconds the militia stay. */
  duration: 12,
  count: 2,
  hp: 30,
  damageMin: 1,
  damageMax: 3,
  attackCooldown: 1,
  armor: 0,
  /** Target point must be within this distance of an enemy path. */
  pathRange: 1.0,
} as const;
