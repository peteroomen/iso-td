/* eslint-disable no-console */
/**
 * Plan optimiser: hill-climbs a bot plan (order of builds / upgrades and tower kinds) for one level by running the
 * real Sim headless. Used offline to produce the "expert" plans in plans.ts; not part of `npm run balance`.
 *
 *   npx tsx tools/bots/search.ts --level 4 [--iters 600] [--seeds 4] [--scale 1.0] [--from competent|expert|empty] [--bot expert] [--as competent|expert]
 *
 * `--scale` evaluates against proportionally larger waves, so the objective does not saturate at 20 lives.
 */
import { LEVELS } from '../../src/core/data/levels';
import { deriveSpots } from '../../src/core/level';
import { Rng } from '../../src/core/rng';
import type { LevelDef, TowerKind } from '../../src/core/types';
import { BOTS } from './bots';
import { PLANS } from './plans';
import { levelNumber, runBot } from './runner';
import type { PlanAction } from './types';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

/** Scales wave counts (used while searching at a harder-than-final difficulty). */
export function scaleWaves(l: LevelDef, k: number): LevelDef {
  if (k === 1) return l;
  return {
    ...l,
    waves: l.waves.map((w) => ({
      groups: w.groups.map((g) => ({
        ...g,
        count: g.enemy === 'mothership' ? 1 : Math.max(1, Math.round(g.count * Math.pow(k, 0.8))),
        interval: Math.round(g.interval * Math.pow(k, -0.2) * 20) / 20,
      })),
    })),
  };
}

type Genome = PlanAction[];
const key = (a: readonly [number, number]) => `${a[0]},${a[1]}`;

function valid(g: Genome, level: LevelDef): boolean {
  const kinds = new Map<string, TowerKind>();
  const lv = new Map<string, number>();
  for (const a of g) {
    if (a.do === 'build') {
      if (kinds.has(key(a.at))) return false;
      kinds.set(key(a.at), a.kind);
      lv.set(key(a.at), 1);
    } else if (a.do === 'up') {
      const k = kinds.get(key(a.at));
      if (!k) return false;
      const n = (lv.get(key(a.at)) ?? 1) + 1;
      if (n > level.towerCap[k] || n > 3) return false;
      lv.set(key(a.at), n);
    }
  }
  return true;
}

function evaluate(level: LevelDef, plan: Genome, botName: string, seeds: number[]): number {
  let total = 0;
  for (const seed of seeds) {
    const r = runBot(level, BOTS[botName], { competent: plan, expert: plan }, seed);
    total += r.status === 'won' ? 10 + r.lives : (r.wave / r.totalWaves) * 8 + r.lives * 0.01;
  }
  return total / seeds.length;
}

function mutate(g: Genome, level: LevelDef, rng: Rng, spots: { col: number; row: number }[]): Genome {
  const out = g.slice();
  const roll = rng.next();
  const kinds: TowerKind[] = ['archer', 'wizard', 'barracks', 'bomb'];
  if (roll < 0.3 && out.length > 1) {
    const i = rng.int(0, out.length - 1);
    const j = Math.max(0, Math.min(out.length - 1, i + rng.int(-4, 4)));
    const [x] = out.splice(i, 1);
    out.splice(j, 0, x);
  } else if (roll < 0.5) {
    const idx = out.map((a, i) => (a.do === 'build' ? i : -1)).filter((i) => i >= 0);
    if (idx.length) {
      const i = idx[rng.int(0, idx.length - 1)];
      const a = out[i] as Extract<PlanAction, { do: 'build' }>;
      out[i] = { ...a, kind: kinds[rng.int(0, 3)] };
    }
  } else if (roll < 0.7) {
    const used = new Set(out.filter((a) => a.do === 'build').map((a) => key(a.at)));
    const free = spots.filter((s) => !used.has(`${s.col},${s.row}`));
    if (free.length) {
      const s = free[rng.int(0, free.length - 1)];
      out.splice(rng.int(0, out.length), 0, { do: 'build', at: [s.col, s.row], kind: kinds[rng.int(0, 3)] });
    }
  } else if (roll < 0.85) {
    // add an upgrade for a random built spot
    const built = out.filter((a) => a.do === 'build');
    if (built.length) {
      const a = built[rng.int(0, built.length - 1)];
      out.splice(rng.int(0, out.length), 0, { do: 'up', at: a.at });
    }
  } else if (out.length > 3) {
    out.splice(rng.int(0, out.length - 1), 1);
  }
  return valid(out, level) ? out : g;
}

function fmt(a: PlanAction): string {
  if (a.do === 'build') return `b(${a.at[0]}, ${a.at[1]}, '${a.kind}')`;
  if (a.do === 'up') return `up(${a.at[0]}, ${a.at[1]})`;
  return `rally(${a.at[0]}, ${a.at[1]}, ${a.to[0]}, ${a.to[1]})`;
}

function main(): void {
  const n = Number(arg('level', '1'));
  const level0 = LEVELS[n - 1];
  const scale = Number(arg('scale', '1'));
  const level = scaleWaves(level0, scale);
  const iters = Number(arg('iters', '400'));
  const nSeeds = Number(arg('seeds', '4'));
  const botName = arg('bot', 'expert');
  const from = arg('from', 'competent');
  const seeds = Array.from({ length: nSeeds }, (_, i) => 101 + i);
  const spots = deriveSpots(level);
  const plan0 = PLANS[level0.id];
  let cur: Genome = from === 'empty' ? [] : [...((from === 'expert' ? plan0?.expert ?? plan0?.competent : plan0?.competent) ?? [])];
  if (cur.length === 0) cur = [{ do: 'build', at: [spots[0].col, spots[0].row], kind: 'archer' }];
  const rng = new Rng(Number(arg('rngseed', '7')));
  let best = evaluate(level, cur, botName, seeds);
  console.error(`L${levelNumber(level)} start score ${best.toFixed(2)} (${cur.length} actions)`);
  for (let it = 0; it < iters; it++) {
    let cand = mutate(cur, level, rng, spots);
    if (rng.next() < 0.5) cand = mutate(cand, level, rng, spots);
    if (cand === cur) continue;
    const sc = evaluate(level, cand, botName, seeds);
    if (sc >= best) {
      if (sc > best) console.error(`  it ${it}: ${sc.toFixed(2)}`);
      best = sc;
      cur = cand;
    }
  }
  console.error(`final score ${best.toFixed(2)}`);
  console.log(`    ${arg('as', 'expert')}: [\n      ${cur.map(fmt).join(', ')},\n    ],`);
}

main();
