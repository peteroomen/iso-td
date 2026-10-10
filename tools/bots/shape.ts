/* eslint-disable no-console */
/**
 * Wave composition search. The *order* of a level's waves (which group appears where, delays, intros) stays
 * hand-written; this tool searches for the numbers: one overall size factor K and a multiplier per UFO class
 * (plated, prism, skimmer, fodder = scouts+darts, carrier, dread), by hill climbing against the real sim.
 *
 * Goals scored per level (seeds that are NOT the reporting seeds):
 *   - competent bot wins every run and averages about `--target` lives;
 *   - from level 4 on, archer-only, wizard-only and bomb-only average clearly fewer lives than competent, and at least one of
 *     archer/wizard loses (or nearly loses);
 *   - competent finishes with little gold left and is not maxed before the last third of the level.
 *
 *   npx tsx tools/bots/shape.ts --level 7 [--iters 120] [--target 13.5] [--seeds 21,22,...] [--save p.json] [--start p.json (continue from)] [--load p.json (evaluate only)] [--write]
 *
 * With --write the best numbers are baked into src/core/data/levels/levelNN.ts (like tune.ts does).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../../src/core/data/levels';
import { Rng } from '../../src/core/rng';
import type { EnemyId, LevelDef } from '../../src/core/types';
import { BOTS } from './bots';
import { PLANS } from './plans';
import { runBot, type RunResult } from './runner';
import { bake, scaleGroup } from './tune';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const CLASSES = ['plated', 'prism', 'skimmer', 'fodder', 'carrier', 'dread'] as const;
type Cls = (typeof CLASSES)[number];
const classOf = (e: EnemyId): Cls | null => (e === 'scout' || e === 'dart' ? 'fodder' : e === 'mothership' ? null : (e as Cls));

interface Params {
  k: number;
  m: Record<Cls, number>;
}

function apply(l: LevelDef, p: Params): LevelDef {
  return {
    ...l,
    waves: l.waves.map((w) => ({
      groups: w.groups.map((g) => {
        const c = classOf(g.enemy);
        return c === null ? g : scaleGroup(g, p.k * p.m[c]);
      }),
    })),
  };
}

interface Eval {
  c: number;
  cMin: number;
  wins: number;
  gold: number;
  maxedFrac: number;
  a: number;
  w: number;
  bm: number;
  score: number;
}

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);

function runs(l: LevelDef, bot: string, seeds: number[]): RunResult[] {
  return seeds.map((s) => runBot(l, BOTS[bot], PLANS[l.id], s));
}

export function evaluate(l: LevelDef, n: number, seeds: number[], target: number, mono = true): Eval {
  const rc = runs(l, 'competent', seeds);
  const c = avg(rc.map((r) => r.lives));
  const wins = rc.filter((r) => r.status === 'won').length;
  const gold = avg(rc.map((r) => r.gold));
  const maxedFrac = avg(rc.map((r) => (r.maxedAt === null ? 1 : r.maxedAt / r.time)));
  let score = 0;
  score += Math.pow(Math.max(0, Math.abs(c - target) - 1.2), 2) * 2;
  score += (seeds.length - wins) * 20;
  score += Math.pow(Math.max(0, gold - 450) / 50, 2);
  score += Math.pow(Math.max(0, 0.72 - maxedFrac) * 20, 2);
  let a = 0;
  let w = 0;
  let bm = 0;
  if (n >= 4 && mono && Math.abs(c - target) < 4) {
    a = avg(runs(l, 'archer-only', seeds).map((r) => r.lives));
    w = avg(runs(l, 'wizard-only', seeds).map((r) => r.lives));
    score += Math.pow(Math.max(0, a - (c - 4)), 2) + Math.pow(Math.max(0, w - (c - 4)), 2);
    score += 2 * Math.pow(Math.max(0, Math.min(a, w) - 4), 2);
    bm = avg(runs(l, 'bomb-only', seeds).map((r) => r.lives));
    score += Math.pow(Math.max(0, bm - (c - 4)), 2);
  } else if (n >= 4 && mono) {
    score += 150; // not worth simulating the variants: the main bot is far off
    a = NaN;
    w = NaN;
    bm = NaN;
  }
  return { c, cMin: Math.min(...rc.map((r) => r.lives)), wins, gold, maxedFrac, a, w, bm, score };
}

function main(): void {
  const n = Number(arg('level', '4'));
  const level = LEVELS[n - 1];
  const iters = Number(arg('iters', '120'));
  const target = Number(arg('target', '13.5'));
  const seeds = arg('seeds', '21,22,23,24,25,26').split(',').map(Number);
  const rng = new Rng(Number(arg('rngseed', '3')));
  const reg = (p: Params) => 0.4 * (Math.pow(Math.log(p.k), 2) + CLASSES.reduce((s, c) => s + Math.pow(Math.log(p.m[c]), 2), 0));
  let cur: Params = { k: 1, m: { plated: 1, prism: 1, skimmer: 1, fodder: 1, carrier: 1, dread: 1 } };
  const cache = new Map<string, Eval>();
  const key = (p: Params) => [p.k, ...CLASSES.map((c) => p.m[c])].map((x) => x.toFixed(2)).join(',');
  const score = (p: Params): Eval => {
    const k = key(p);
    let e = cache.get(k);
    if (!e) {
      e = evaluate(apply(level, p), n, seeds, target);
      e.score += reg(p);
      cache.set(k, e);
    }
    return e;
  };
  const loadPath = arg('load', '');
  if (loadPath) cur = JSON.parse(readFileSync(loadPath, 'utf8')) as Params;
  const startPath = arg('start', '');
  if (startPath) cur = JSON.parse(readFileSync(startPath, 'utf8')) as Params;
  let best = score(cur);
  const show = (p: Params, e: Eval) =>
    `K=${p.k.toFixed(2)} ${CLASSES.map((c) => `${c}=${p.m[c].toFixed(2)}`).join(' ')} | comp ${e.c.toFixed(1)} (min ${e.cMin}, ${e.wins}/${seeds.length}) gold ${Math.round(e.gold)} maxed@${(e.maxedFrac * 100).toFixed(0)}% arch ${e.a.toFixed(1)} wiz ${e.w.toFixed(1)} bomb ${e.bm.toFixed(1)} score ${e.score.toFixed(1)}`;
  console.error(`L${n} start: ${show(cur, best)}`);
  for (let it = 0; it < (loadPath ? 0 : iters); it++) {
    const cand: Params = { k: cur.k, m: { ...cur.m } };
    const nChange = 1 + rng.int(0, 2);
    for (let j = 0; j < nChange; j++) {
      const pick = rng.int(0, CLASSES.length); // CLASSES.length = K itself
      const step = Math.exp((rng.next() - 0.5) * (rng.next() < 0.3 ? 1.4 : 0.5));
      if (pick === CLASSES.length) cand.k = Math.min(Number(arg('kmax', '2.2')), Math.max(0.2, cand.k * step));
      else cand.m[CLASSES[pick]] = Math.min(5, Math.max(0.2, cand.m[CLASSES[pick]] * step));
    }
    const e = score(cand);
    if (e.score <= best.score) {
      if (e.score < best.score - 0.01) console.error(`  it ${it}: ${show(cand, e)}`);
      best = e;
      cur = cand;
    }
  }
  console.log(`L${n} best: ${show(cur, best)}`);
  if (arg('save', '')) writeFileSync(arg('save', ''), JSON.stringify(cur));
  const final = apply(level, cur);
  const check = evaluate(final, n, [1, 2, 3, 4, 5], target);
  console.log(`   report seeds 1-5: comp ${check.c.toFixed(1)} (min ${check.cMin}) gold ${Math.round(check.gold)} maxed@${(check.maxedFrac * 100).toFixed(0)}% arch ${check.a.toFixed(1)} wiz ${check.w.toFixed(1)} bomb ${check.bm.toFixed(1)}`);
  if (process.argv.includes('--write')) {
    bake(new URL(`../../src/core/data/levels/level${String(n).padStart(2, '0')}.ts`, import.meta.url), final.waves);
    console.log('written');
  }
}

main();
