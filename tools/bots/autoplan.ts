/* eslint-disable no-console */
/**
 * Generates the baseline "competent" plan of a level: spots ranked by how much road the archer range covers,
 * a fixed tower mix pattern, upgrades interleaved with building. The output is pasted into plans.ts (and may be
 * hand-edited). The "expert" plans come from search.ts.
 *
 *   npx tsx tools/bots/autoplan.ts --level 4
 */
import { ENEMIES } from '../../src/core/data/enemies';
import { LEVELS } from '../../src/core/data/levels';
import { deriveSpots } from '../../src/core/level';
import { buildPath, pointAt } from '../../src/core/sim/path';
import type { LevelDef, TowerKind } from '../../src/core/types';

export function coverage(level: LevelDef, x: number, y: number, range: number): number {
  const w = Math.max(...level.tiles.map((r) => r.length));
  const h = level.tiles.length;
  let total = 0;
  for (let pi = 0; pi < level.paths.length; pi++) {
    const p = buildPath(pi, level.paths[pi]);
    const step = 0.1;
    for (let d = 0; d < p.length; d += step) {
      const pt = pointAt(p, d);
      if (pt.x < 0 || pt.y < 0 || pt.x > w || pt.y > h) continue;
      if (Math.hypot(pt.x - x, pt.y - y) <= range) total += step;
    }
  }
  return total;
}

/**
 * A sensible player reads the wave previews: armored UFOs call for wizards, magic-resistant ones for archers and
 * knights, fliers rule out relying on barracks. Returns the tower kind for each of the first `n` spots (best spot first).
 */
export function towerMix(level: LevelDef, n: number): TowerKind[] {
  let total = 0;
  let armored = 0;
  let resistant = 0;
  let fliers = 0;
  for (const w of level.waves) {
    for (const g of w.groups) {
      const e = ENEMIES[g.enemy];
      if (e.boss) continue;
      const t = g.count * e.hp;
      total += t;
      armored += t * e.armor;
      resistant += t * e.magicResist;
      if (e.flier) fliers += t;
    }
  }
  const armoredShare = total ? armored / total : 0;
  const resistShare = total ? resistant / total : 0;
  const flierShare = total ? fliers / total : 0;
  const weight: Record<TowerKind, number> = {
    archer: 1.2 + 3 * resistShare,
    wizard: 0.6 + 4 * armoredShare,
    barracks: Math.max(0.15, 0.55 - 1.2 * flierShare),
  };
  const sum = weight.archer + weight.wizard + weight.barracks;
  const count: Record<TowerKind, number> = { archer: 0, wizard: 0, barracks: 0 };
  const out: TowerKind[] = [];
  for (let i = 0; i < n; i++) {
    let best: TowerKind = 'archer';
    let bestGap = -Infinity;
    for (const k of ['archer', 'wizard', 'barracks'] as TowerKind[]) {
      // stride scheduling: how far below its fair share is this kind?
      const gap = (weight[k] / sum) * (i + 1) - count[k];
      if (gap > bestGap + 1e-9) {
        bestGap = gap;
        best = k;
      }
    }
    // never open with a barracks or two expensive wizards: archers first
    if (i < 2 && best !== 'archer') best = 'archer';
    count[best]++;
    out.push(best);
  }
  return out;
}

export function autoPlan(level: LevelDef): string[] {
  const spots = deriveSpots(level)
    .map((s) => ({ s, c: coverage(level, s.x, s.y, 3.2) }))
    .sort((a, b) => b.c - a.c);
  const maxLevel = Math.max(level.towerCap.archer, level.towerCap.wizard, level.towerCap.barracks);
  const count = spots.length <= 8 ? spots.length : Math.min(14, Math.round(spots.length * 0.8));
  const mix = towerMix(level, count);
  const picked = spots.slice(0, count).map((x, i) => ({ col: x.s.col, row: x.s.row, kind: mix[i], level: 1 }));
  const out: string[] = [];
  const fmtB = (p: (typeof picked)[number]) => `b(${p.col}, ${p.row}, '${p.kind}')`;
  const fmtU = (p: (typeof picked)[number]) => `up(${p.col}, ${p.row})`;
  const capOf = (p: (typeof picked)[number]) => level.towerCap[p.kind];
  let built = 0;
  const upgradeNext = (count: number) => {
    for (let c = 0; c < count; c++) {
      const cand = picked.slice(0, built).filter((p) => p.level < capOf(p) && p.level < maxLevel).sort((a, b) => a.level - b.level)[0];
      if (!cand) return;
      cand.level++;
      out.push(fmtU(cand));
    }
  };
  const buildNext = (count: number) => {
    for (let c = 0; c < count && built < picked.length; c++) out.push(fmtB(picked[built++]));
  };
  buildNext(4);
  while (built < picked.length) {
    upgradeNext(2);
    buildNext(2);
  }
  for (let i = 0; i < 40; i++) upgradeNext(1);
  return out;
}

const idx = process.argv.indexOf('--level');
if (idx >= 0) {
  const level = LEVELS[Number(process.argv[idx + 1]) - 1];
  console.log(`  ${level.id}: {\n    competent: [\n      ${autoPlan(level).join(', ')},\n    ],\n  },`);
}
