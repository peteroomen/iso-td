import { ENEMIES, type EnemyId } from '../../core';
import { TEX } from '../render/textures';

/** One-line flavour/description shown on the "new UFO" card and nowhere else. Numbers are derived (see traitsOf). */
export const ENEMY_BLURB: Record<EnemyId, string> = {
  scout: 'The invasion foot soldier. Average speed, easy to stop.',
  dart: 'Zips down the road. Stop it before it reaches the exit!',
  skimmer: 'Hovers high above the road, out of reach of your knights.',
  plated: 'Thick metal plating shrugs off arrows.',
  prism: 'A shimmering energy shield soaks up magic.',
  carrier: 'A heavy transport that cracks open when destroyed.',
  dread: 'A walking fortress that smashes through knights.',
  mothership: 'The invasion flagship. Launches escorts as it advances.',
};

export interface Trait {
  /** Texture key of the small icon. */
  icon: string;
  label: string;
  /** Chip fill colour. */
  color: number;
  /** Label colour in tooltips. */
  text: string;
}

const pct = (x: number): number => Math.round(x * 100);
const plural = (name: string, n: number): string => (n === 1 ? name : `${name}s`);

/** Key traits of an enemy, all derived from the ENEMIES table. Most important first. */
export function traitsOf(id: EnemyId): Trait[] {
  const d = ENEMIES[id];
  const out: Trait[] = [];
  if (d.launcher) {
    const n = d.launcher.spawns.reduce((a, s) => a + s.count, 0);
    out.push({ icon: TEX.ufo, label: `Launches ${n} UFOs every ${Math.round(d.launcher.interval)}s`, color: 0xa8483a, text: '#ff9a8a' });
  }
  if (d.flier) out.push({ icon: TEX.wing, label: 'Flies over knights', color: 0x3f7fb5, text: '#9ee6ff' });
  if (d.armor >= 0.1) {
    const counter = d.armor >= 0.5 && d.armor - d.magicResist >= 0.2 ? ' - use Wizards' : '';
    out.push({ icon: TEX.shield, label: `Armor ${pct(d.armor)}%${counter}`, color: 0x6c7488, text: '#d6dcea' });
  }
  if (d.magicResist >= 0.1) {
    const counter = d.magicResist >= 0.5 && d.magicResist - d.armor >= 0.2 ? ' - use Archers' : '';
    out.push({ icon: TEX.shield, label: `${d.magicResist >= 0.5 ? 'Magic shield' : 'Magic resist'} ${pct(d.magicResist)}%${counter}`, color: 0x7a55b8, text: '#cdb3ff' });
  }
  if (d.armor >= 0.3 && d.magicResist >= 0.3) out.push({ icon: TEX.orbital, label: 'Orbital Strike ignores both', color: 0x3f7f45, text: '#9bf06a' });
  if (d.onDeath) {
    const into = ENEMIES[d.onDeath.enemy];
    out.push({ icon: TEX.ufo, label: `Splits into ${d.onDeath.count} ${plural(`${into.name}`, d.onDeath.count)}`, color: 0xb07a2a, text: '#ffd34e' });
  }
  if (d.blockable && d.meleeDamage >= 20) out.push({ icon: TEX.skull, label: 'Crushes knights', color: 0xa8483a, text: '#ff9a8a' });
  if (d.speed >= 1.5) out.push({ icon: TEX.ff, label: 'Very fast', color: 0x3f8a55, text: '#9bf06a' });
  if (d.lives >= 2) out.push({ icon: TEX.heart, label: `Costs ${d.lives} lives if it escapes`, color: 0xa8483a, text: '#ff9a8a' });
  if (!d.blockable && !d.flier) out.push({ icon: TEX.gear, label: 'Cannot be blocked', color: 0x6c7488, text: '#d6dcea' });
  return out;
}

/** "HP 800  Speed 0.6  Bounty 40" stats line. */
export function statLine(id: EnemyId): string {
  const d = ENEMIES[id];
  const speed = Number.isInteger(d.speed) ? d.speed.toFixed(1) : String(Number(d.speed.toFixed(2)));
  const parts = [`HP ${d.hp}`, `Speed ${speed}`];
  if (d.gold > 0) parts.push(`Bounty ${d.gold}`);
  return parts.join('   ');
}
