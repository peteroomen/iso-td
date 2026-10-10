import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/core/data/enemies';
import { LEVELS } from '../src/core/data/levels';
import { deriveSpots, levelHeight, levelWidth, validateLevel } from '../src/core/level';
import type { EnemyId, LevelDef } from '../src/core/types';
import { BOTS } from '../tools/bots/bots';
import { PLANS } from '../tools/bots/plans';
import { runBot } from '../tools/bots/runner';

const WAVES = [6, 7, 8, 9, 10, 10, 12, 12, 12, 15];
const BIOMES = ['spring', 'spring', 'spring', 'desert', 'desert', 'desert', 'winter', 'winter', 'winter', 'mixed'];
/** archer / wizard / barracks / bomb caps per level (bomb Lv3 unlocks on level 6). */
const CAPS = [
  [1, 1, 1, 1],
  [2, 2, 2, 2],
  [3, 2, 2, 2],
  [3, 3, 2, 2],
  [3, 3, 3, 2],
  [3, 3, 3, 3],
  [3, 3, 3, 3],
  [3, 3, 3, 3],
  [3, 3, 3, 3],
  [3, 3, 3, 3],
];
/** First level in which each enemy is introduced (DESIGN section 7). */
const INTRO: Partial<Record<EnemyId, number>> = { scout: 1, dart: 1, skimmer: 2, plated: 3, prism: 4, carrier: 5, dread: 7, mothership: 10 };

const enemiesOf = (l: LevelDef) => new Set(l.waves.flatMap((w) => w.groups.map((g) => g.enemy)));

describe('campaign levels', () => {
  it('has 10 valid, uniquely named levels in order', () => {
    expect(LEVELS.length).toBe(10);
    expect(LEVELS.map((l) => l.id)).toEqual(LEVELS.map((_, i) => `level${String(i + 1).padStart(2, '0')}`));
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(10);
    for (const l of LEVELS) expect(validateLevel(l), l.id).toEqual([]);
  });

  it('follows the campaign table: biome, wave count, tower caps, grid size', () => {
    LEVELS.forEach((l, i) => {
      expect(l.biome, l.id).toBe(BIOMES[i]);
      expect(l.waves.length, l.id).toBe(WAVES[i]);
      expect([l.towerCap.archer, l.towerCap.wizard, l.towerCap.barracks, l.towerCap.bomb], l.id).toEqual(CAPS[i]);
      expect(l.lives).toBe(20);
      expect(l.startGold, l.id).toBeGreaterThanOrEqual(250);
      expect(l.startGold, l.id).toBeLessThanOrEqual(520);
      expect(levelWidth(l), l.id).toBeGreaterThanOrEqual(10);
      expect(levelWidth(l), l.id).toBeLessThanOrEqual(14);
      expect(levelHeight(l), l.id).toBeGreaterThanOrEqual(10);
      expect(levelHeight(l), l.id).toBeLessThanOrEqual(14);
    });
  });

  it('introduces each enemy type at its level and not before', () => {
    LEVELS.forEach((l, i) => {
      const n = i + 1;
      const used = enemiesOf(l);
      for (const [id, intro] of Object.entries(INTRO) as [EnemyId, number][]) {
        if (n < intro) expect(used.has(id), `${l.id} must not use ${id}`).toBe(false);
      }
      for (const [id, intro] of Object.entries(INTRO) as [EnemyId, number][]) {
        if (n === intro) expect(used.has(id), `${l.id} introduces ${id}`).toBe(true);
      }
      expect([...used].every((u) => ENEMIES[u])).toBe(true);
    });
  });

  it('gives a hint at (and only at) levels that introduce an enemy, shown the wave before it appears', () => {
    const introLevels = new Set([2, 3, 4, 5, 7, 10]);
    LEVELS.forEach((l, i) => {
      if (i === 0) return;
      const n = i + 1;
      expect(!!l.hints?.length, `${l.id} hints`).toBe(introLevels.has(n));
      const newEnemy = (Object.entries(INTRO) as [EnemyId, number][]).find(([, v]) => v === n)?.[0];
      if (newEnemy) {
        const first = l.waves.findIndex((w) => w.groups.some((g) => g.enemy === newEnemy));
        expect(l.hints!.some((h) => h.waveIndex === first), `${l.id} hint for ${newEnemy}`).toBe(true);
      }
    });
  });

  it('introduces new enemies in small numbers first', () => {
    LEVELS.forEach((l, i) => {
      const n = i + 1;
      const id = (Object.entries(INTRO) as [EnemyId, number][]).find(([, v]) => v === n && n > 1)?.[0];
      if (!id || id === 'mothership') return;
      const first = l.waves.find((w) => w.groups.some((g) => g.enemy === id))!;
      const count = first.groups.filter((g) => g.enemy === id).reduce((s, g) => s + g.count, 0);
      expect(count, `${l.id} first ${id} wave`).toBeLessThanOrEqual(4);
    });
  });

  it('has the designed map features', () => {
    const [, , l3, , l5, l6, , l8, l9, l10] = LEVELS;
    // L3: two paths that fork and rejoin (share their first and last cells)
    expect(l3.paths.length).toBe(2);
    expect(l3.paths[0][0]).toEqual(l3.paths[1][0]);
    expect(l3.paths[0].at(-1)).toEqual(l3.paths[1].at(-1));
    expect(l3.paths[0][2]).not.toEqual(l3.paths[1][2]);
    // L5 / L8: two entrances (different start points); L8 merges onto a shared trunk, L5 crosses
    for (const l of [l5, l8]) {
      expect(l.paths.length).toBe(2);
      expect(l.paths[0][0]).not.toEqual(l.paths[1][0]);
      expect(new Set(l.waves.flatMap((w) => w.groups.map((g) => g.path)))).toEqual(new Set([0, 1]));
    }
    expect(l8.paths[0].at(-1)).toEqual(l8.paths[1].at(-1));
    expect(l5.paths[0].at(-1)).not.toEqual(l5.paths[1].at(-1));
    // L6: a single long path that visits the same cell twice (the loop crossing)
    expect(l6.paths.length).toBe(1);
    const cells = new Map<string, number>();
    const p = l6.paths[0];
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1];
      const b = p[i];
      const steps = Math.round(Math.hypot(b.x - a.x, b.y - a.y));
      for (let s = 0; s < steps; s++) {
        const x = Math.floor(a.x + ((b.x - a.x) * s) / steps + 0.5 * Math.sign(b.x - a.x));
        const y = Math.floor(a.y + ((b.y - a.y) * s) / steps + 0.5 * Math.sign(b.y - a.y));
        if (x >= 0 && y >= 0 && x < levelWidth(l6) && y < levelHeight(l6)) cells.set(`${x},${y}`, (cells.get(`${x},${y}`) ?? 0) + 1);
      }
    }
    expect([...cells.values()].some((v) => v >= 2)).toBe(true);
    // L9: few build spots
    expect(deriveSpots(l9).length).toBeLessThanOrEqual(8);
    for (const l of LEVELS.filter((x) => x !== l9)) expect(deriveSpots(l).length, l.id).toBeGreaterThan(deriveSpots(l9).length);
    // L10: mixed biome with a biome map covering all three biomes; the Mothership only in the final wave
    expect(l10.biome).toBe('mixed');
    expect(new Set(l10.biomeMap!.join(''))).toEqual(new Set(['s', 'd', 'w']));
    l10.waves.forEach((w, i) => expect(w.groups.some((g) => g.enemy === 'mothership'), `wave ${i + 1}`).toBe(i === l10.waves.length - 1));
    expect(l10.waves.at(-1)!.groups.filter((g) => g.enemy !== 'mothership').length).toBeGreaterThan(0);
  });

  it('waves escalate: the last wave is the biggest threat of the level', () => {
    const threat = (l: LevelDef, i: number) => l.waves[i].groups.reduce((s, g) => s + g.count * ENEMIES[g.enemy].hp, 0);
    for (const l of LEVELS) {
      const n = l.waves.length;
      expect(threat(l, n - 1) + 1, l.id).toBeGreaterThan(threat(l, 0) * 3);
    }
  });
});

// Balance sanity (full report: `npm run balance`). Single seed to keep the suite fast.
describe('balance sanity', () => {
  it('idle bot loses every level', () => {
    for (const l of LEVELS) {
      const r = runBot(l, BOTS.idle, PLANS[l.id], 1);
      expect(r.status, l.id).toBe('lost');
    }
  });

  it('competent bot wins every level', () => {
    for (const l of LEVELS) {
      const r = runBot(l, BOTS.competent, PLANS[l.id], 1);
      expect(r.status, `${l.id} lives ${r.lives}`).toBe('won');
      expect(r.lives, l.id).toBeGreaterThanOrEqual(6);
    }
  });

  it('expert bot earns three stars everywhere', () => {
    for (const l of LEVELS) {
      const r = runBot(l, BOTS.expert, PLANS[l.id], 1);
      expect(r.status, l.id).toBe('won');
      expect(r.lives, l.id).toBeGreaterThanOrEqual(18);
    }
  });

  it('naive bot cannot beat the later levels', () => {
    for (const l of LEVELS.slice(3)) {
      const r = runBot(l, BOTS.naive, PLANS[l.id], 1);
      expect(r.status, l.id).toBe('lost');
    }
  });
  it('mono builds are punished from level 4 on: archer-only and wizard-only both do worse than the mixed plan, and one of them collapses', () => {
    for (const l of LEVELS.slice(3)) {
      const comp = runBot(l, BOTS.competent, PLANS[l.id], 1).lives;
      const a = runBot(l, BOTS['archer-only'], PLANS[l.id], 1).lives;
      const w = runBot(l, BOTS['wizard-only'], PLANS[l.id], 1).lives;
      expect(a, `${l.id} archer-only ${a} vs competent ${comp}`).toBeLessThan(comp);
      expect(w, `${l.id} wizard-only ${w} vs competent ${comp}`).toBeLessThan(comp);
      expect(Math.min(a, w), `${l.id} best mono build`).toBeLessThanOrEqual(5);
    }
  }, 120_000);

  it('the competent bot does not sit on a pile of gold at the end and is still buying late in the level', () => {
    for (const l of LEVELS) {
      const r = runBot(l, BOTS.competent, PLANS[l.id], 1);
      expect(r.gold, `${l.id} gold left`).toBeLessThanOrEqual(700);
      if (r.maxedAt !== null && l.id !== 'level01') expect(r.maxedAt / r.time, `${l.id} maxed too early`).toBeGreaterThanOrEqual(0.6);
    }
  }, 120_000);

  it('the Mothership is a long fight: it survives deep into the road against the competent plan', () => {
    const l = LEVELS.at(-1)!;
    const r = runBot(l, BOTS.competent, PLANS[l.id], 1);
    expect(r.status).toBe('won');
    expect(r.bossFrac!).toBeGreaterThan(0.5);
  });
});
