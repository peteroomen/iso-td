/* eslint-disable no-console */
/**
 * Map-fit study for the specialization unlock schedule (docs/BALANCE.md, "Unlock schedule").
 *
 *   npx tsx tools/specmap.ts [--seeds 12] [--levels 4,5,6,7]
 *       Benefit matrix: for every level and every spec X, the lives gained by the competent bot when ONLY X is available
 *       (forced for two towers of its kind, see tools/bots/specs.ts) over the same bot without any specialization; then the
 *       best assignment of the 8 specs to the levels (two per level, two different tower kinds, every spec once).
 *   npx tsx tools/specmap.ts --bots [--seeds 12] [--ref <git rev>]
 *       The same question asked of the real bots: the waves of each level (as of git revision --ref, default HEAD) are scaled until
 *       the no-spec competent bot averages ~9 lives; then every spec is compared with a control that has the same early Lv3 upgrades but
 *       does not buy it (so the 300 g really have to pay for themselves), and the best assignment is searched like above.
 *   npx tsx tools/specmap.ts --context     (uses the shipped `LevelDef.newSpecs`)
 *       In-context check: per level, the competent bot with the cumulative unlock set vs. the same set without the level's new
 *       pair, and the forced variants "cumulative minus new pair plus one new spec".
 */
import { execSync } from 'node:child_process';
import { LEVELS, unlockedSpecsFor } from '../src/core/data/levels';
import { SPECS, SPEC_IDS } from '../src/core/data/specs';
import { FIXED_DT } from '../src/core/data/rules';
import { deriveSpots } from '../src/core/level';
import { Sim } from '../src/core/sim/Sim';
import type { EnemyId, LevelDef, SpecId, TowerKind } from '../src/core/types';
import { BOTS } from './bots/bots';
import { PLANS } from './bots/plans';
import { MAX_SIM_SECONDS, levelNumber, runBot } from './bots/runner';
import { starBudget, upgradesForStars } from './bots/stars';
import { scaleGroup } from './bots/tune';
import type { BotConfig } from './bots/types';

const argv = process.argv.slice(2);
const arg = (k: string, d: string) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const SEEDS = Number(arg('--seeds', '12'));
const KIT = Number(arg('--kit', '9'));
const LEVEL_NUMS = arg('--levels', '4,5,6,7').split(',').map(Number);

export interface Score {
  lives: number;
  wins: number;
  runs: number;
}

export function score(level: LevelDef, cfg: BotConfig, seeds = SEEDS): Score {
  let lives = 0;
  let wins = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const r = runBot(level, cfg, PLANS[level.id], seed);
    lives += r.lives;
    if (r.status === 'won') wins++;
  }
  return { lives: lives / seeds, wins, runs: seeds };
}

const f1 = (x: number) => x.toFixed(1);
const fmt = (s: Score) => `${f1(s.lives)} (${s.wins}/${s.runs})`;
const levelOf = (n: number) => LEVELS[n - 1];

/** Competent-plan kit on a level: tower kinds in build order with their cells. */
function kit(level: LevelDef): { at: readonly [number, number]; kind: TowerKind }[] {
  return PLANS[level.id].competent.flatMap((a) => (a.do === 'build' ? [{ at: a.at, kind: a.kind }] : [])).slice(0, KIT);
}

/**
 * Arena run on the REAL map: all towers of the competent plan stand from the start at Lv3 (plenty of gold, lives never run out,
 * no abilities, no early calls), the level's waves are enlarged by `scale`, and `spec` (if any) is bought for the first two
 * towers of its kind. Returns the lives the UFOs leaked over the whole level. No economy, no build order: it isolates what a
 * specialization does on this road, this tower layout and this wave mix.
 */
export function arena(level: LevelDef, scale: number, spec: SpecId | null, seed: number): number {
  const scaled: LevelDef = {
    ...level,
    startGold: 1e7,
    lives: 99999,
    waves: level.waves.map((w) => ({ groups: w.groups.map((gr) => ({ ...gr, count: Math.max(1, Math.round(gr.count * scale)), interval: gr.interval / scale })) })),
  };
  const sim = new Sim(scaled, { seed, upgrades: upgradesForStars(starBudget(levelNumber(level), 2)), events: false, specs: true });
  const spots = new Map(deriveSpots(scaled).map((sp) => [`${sp.col},${sp.row}`, sp.id]));
  let n = 0;
  for (const k of kit(level)) {
    const spot = spots.get(`${k.at[0]},${k.at[1]}`)!;
    sim.build(spot, k.kind);
    const t = sim.towerAtSpot(spot)!;
    sim.upgrade(t.id);
    sim.upgrade(t.id);
    if (spec && k.kind === SPECS[spec].tower && n < 2) {
      sim.specialize(t.id, spec);
      n++;
    }
  }
  sim.callNextWave();
  for (let i = 0; i < Math.round(MAX_SIM_SECONDS / FIXED_DT) && sim.state.status !== 'won' && sim.state.status !== 'lost'; i++) sim.step();
  return sim.state.stats.leaked;
}

function arenaMean(level: LevelDef, scale: number, spec: SpecId | null, seeds: number): number {
  let t = 0;
  for (let seed = 1; seed <= seeds; seed++) t += arena(level, scale, spec, seed);
  return t / seeds;
}

/** Wave scale at which the plain kit leaks about `target` lives (bisection, 3 seeds). */
function calibrate(level: LevelDef, target: number): number {
  let lo = 1;
  let hi = 16;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    if (arenaMean(level, mid, null, 2) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Prints the best assignments of the eight specs to the levels (two per level, two different tower kinds, every spec once). */
function assign(benefit: Map<string, number>): void {
  // best assignment: ordered pairs of specs of different kinds, every spec once
  type Pair = [SpecId, SpecId];
  const pairs: Pair[] = [];
  for (let i = 0; i < SPEC_IDS.length; i++) for (let j = i + 1; j < SPEC_IDS.length; j++) if (SPECS[SPEC_IDS[i]].tower !== SPECS[SPEC_IDS[j]].tower) pairs.push([SPEC_IDS[i], SPEC_IDS[j]]);
  const results: { total: number; pairs: Pair[] }[] = [];
  const rec = (li: number, used: Set<SpecId>, chosen: Pair[], total: number): void => {
    if (li === LEVEL_NUMS.length) {
      results.push({ total, pairs: [...chosen] });
      return;
    }
    for (const p of pairs) {
      if (used.has(p[0]) || used.has(p[1])) continue;
      const v = benefit.get(`${LEVEL_NUMS[li]}|${p[0]}`)! + benefit.get(`${LEVEL_NUMS[li]}|${p[1]}`)!;
      used.add(p[0]);
      used.add(p[1]);
      chosen.push(p);
      rec(li + 1, used, chosen, total + v);
      chosen.pop();
      used.delete(p[0]);
      used.delete(p[1]);
    }
  };
  rec(0, new Set(), [], 0);
  results.sort((a, b) => b.total - a.total);
  console.log('\nbest assignments (total lives gained):');
  for (const r of results.slice(0, 8)) console.log(f1(r.total).padStart(6), LEVEL_NUMS.map((n, i) => `L${n}: ${r.pairs[i].join(' + ')}`).join('   '));
}

function matrix(): void {
  const benefit = new Map<string, number>(); // `${levelNum}|${spec}`
  const TARGET = Number(arg('--target', '40'));
  console.log(`Arena benefit = lives NOT leaked when two towers of the kind get this spec (${SEEDS} seeds), on the real map with the competent plan's kit at Lv3, waves enlarged until the plain kit leaks ~${TARGET} lives\n`);
  const header = ['spec', ...LEVEL_NUMS.map((n) => `L${n}`)];
  const base = new Map<number, number>();
  const scales = new Map<number, number>();
  for (const n of LEVEL_NUMS) {
    scales.set(n, calibrate(levelOf(n), TARGET));
    base.set(n, arenaMean(levelOf(n), scales.get(n)!, null, SEEDS));
  }
  console.log(header.join(' | '));
  console.log(['wave scale', ...LEVEL_NUMS.map((n) => scales.get(n)!.toFixed(2))].join(' | '));
  console.log(['kit A/W/B/X', ...LEVEL_NUMS.map((n) => (['archer', 'wizard', 'barracks', 'bomb'] as TowerKind[]).map((k) => kit(levelOf(n)).filter((x) => x.kind === k).length).join('/'))].join(' | '));
  console.log(['plain leak', ...LEVEL_NUMS.map((n) => f1(base.get(n)!))].join(' | '));
  for (const id of SPEC_IDS) {
    const cells = LEVEL_NUMS.map((n) => {
      const d = base.get(n)! - arenaMean(levelOf(n), scales.get(n)!, id, SEEDS);
      benefit.set(`${n}|${id}`, d);
      return `${d >= 0 ? '+' : ''}${f1(d)}`;
    });
    console.log([id, ...cells].join(' | '));
  }
  assign(benefit);
}

/** Waves of a level as committed in git revision `rev` (parsed from the source), so the study can use a map's wave mix before it was retuned. */
function wavesAt(n: number, rev: string): LevelDef['waves'] {
  const file = `src/core/data/levels/level${String(n).padStart(2, '0')}.ts`;
  const src = execSync(`git show ${rev}:${file}`, { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  const waves: LevelDef['waves'] = [];
  for (const line of src.split('\n')) {
    if (!/^\s*\{ groups: \[/.test(line)) continue;
    const groups = [...line.matchAll(/g\('(\w+)', (\d+), ([\d.]+), ([\d.]+)(?:, (\d+))?\)/g)].map((m) => ({ enemy: m[1] as EnemyId, count: Number(m[2]), interval: Number(m[3]), delay: Number(m[4]), path: Number(m[5] ?? 0) }));
    waves.push({ groups });
  }
  return waves;
}

function botMatrix(): void {
  const ref = arg('--ref', 'HEAD');
  const benefit = new Map<string, number>();
  const base = new Map<number, Score>();
  const levels = new Map<number, LevelDef>();
  console.log(`Bot benefit = lives gained when the competent bot buys this spec (two towers of its kind, only this spec available) vs. the same bot with the same early Lv3 upgrades but without buying it (${SEEDS} seeds). Waves of git ${ref}, scaled per level until the no-spec bot averages ~9 lives.\n`);
  for (const n of LEVEL_NUMS) {
    const orig = levelOf(n);
    const waves = wavesAt(n, ref);
    const at = (k: number): LevelDef => ({ ...orig, newSpecs: [], waves: waves.map((w) => ({ groups: w.groups.map((gr) => scaleGroup(gr, k)) })) });
    let lo = 0.5;
    let hi = 3;
    for (let i = 0; i < 8; i++) {
      const mid = Math.sqrt(lo * hi);
      if (score(at(mid), { ...BOTS.nospec, availSpecs: [] }, 6).lives > 9) lo = mid;
      else hi = mid;
    }
    const lvl = at(Math.sqrt(lo * hi));
    levels.set(n, lvl);
    base.set(n, score(lvl, { ...BOTS.nospec, availSpecs: [] }));
    console.log(`L${n}: wave scale ${Math.sqrt(lo * hi).toFixed(2)}, no-spec bot ${fmt(base.get(n)!)}`);
  }
  console.log('\n' + ['spec', ...LEVEL_NUMS.map((n) => `L${n}`)].join(' | '));
  const control = new Map<string, Score>();
  for (const id of SPEC_IDS) {
    const cells = LEVEL_NUMS.map((n) => {
      const key = `${n}|${SPECS[id].tower}`;
      const cfg = { ...BOTS[`spec:${id}`], availSpecs: [id] };
      if (!control.has(key)) control.set(key, score(levels.get(n)!, { ...cfg, skipSpecBuy: true }));
      const s = score(levels.get(n)!, cfg);
      const d = s.lives - control.get(key)!.lives;
      benefit.set(`${n}|${id}`, d);
      return `${d >= 0 ? '+' : ''}${f1(d)} (${f1(s.lives)})`;
    });
    console.log([id, ...cells].join(' | '));
  }
  assign(benefit);
}

function context(): void {
  console.log(`In-context check (${SEEDS} seeds): competent bot, lives (wins)\n`);
  console.log('level | new pair | cumulative set | without the new pair | gain | ' + 'each new spec forced on top of the previous set');
  for (const n of LEVEL_NUMS) {
    const lvl = levelOf(n);
    const cum = unlockedSpecsFor(lvl);
    const prev = cum.filter((id) => !lvl.newSpecs?.includes(id));
    const withAll = score(lvl, BOTS.competent);
    const without = score(lvl, { ...BOTS.competent, availSpecs: prev });
    const each = (lvl.newSpecs ?? []).map((id) => `${id} ${fmt(score(lvl, { ...BOTS[`spec:${id}`], availSpecs: [...prev, id] }))}`);
    console.log(`L${n} | ${(lvl.newSpecs ?? []).join(' + ')} | ${fmt(withAll)} | ${fmt(without)} | ${f1(withAll.lives - without.lives)} | ${each.join(', ')}`);
  }
}

if (process.argv[1]?.endsWith('specmap.ts')) {
  if (argv.includes('--context')) context();
  else if (argv.includes('--bots')) botMatrix();
  else matrix();
}
