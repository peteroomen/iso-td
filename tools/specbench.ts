/* eslint-disable no-console */
/**
 * Specialization micro-benchmark: one Lv3 tower (plain, or with each of its two specs) next to two plain Lv3 companions on a
 * straight road, against fixed UFO mixes. Prints, per mix, the share of the wave's HP that was killed before it left the map
 * (higher = better) and the lives leaked, so the two options of a tower can be compared on swarms, armor, magic resistance,
 * fliers, heavies and the boss.
 *
 *   npx tsx tools/specbench.ts [--seeds 6] [--md]       # --md prints the markdown table used in docs/BALANCE.md
 */
import { SPECS_BY_TOWER } from '../src/core/data/specs';
import { FIXED_DT } from '../src/core/data/rules';
import { Sim } from '../src/core/sim/Sim';
import type { EnemyId, LevelDef, SpecId, TowerKind, WaveDef } from '../src/core/types';

const SEEDS = Number(process.argv.includes('--seeds') ? process.argv[process.argv.indexOf('--seeds') + 1] : 6);

function arena(waves: WaveDef[]): LevelDef {
  return {
    id: 'bench',
    name: 'Bench',
    biome: 'winter',
    // road along row 3; spots on both sides: row 2 (x 2,5,8,11) and row 4 (x 2,5,8,11)
    tiles: ['..............', '..............', '..B..B..B..B..', '##############', '..B..B..B..B..', '..............', '..............'],
    paths: [[{ x: -0.5, y: 3.5 }, { x: 14.5, y: 3.5 }]],
    startGold: 99999,
    lives: 9999,
    waveGap: 18,
    towerCap: { archer: 3, wizard: 3, barracks: 3, bomb: 3 },
    specsUnlocked: true,
    waves,
  };
}

const g = (enemy: EnemyId, count: number, interval: number, delay = 0) => ({ enemy, count, interval, delay, path: 0 });

export interface Mix {
  id: string;
  label: string;
  wave: WaveDef;
  /** Number of plain Lv3 companion sets (archer, wizard, bomb, barracks) beside the tower under test (default 1; at most 7 towers fit). */
  sets?: number;
}

/** The UFO mixes the specs are compared on. Sizes are chosen so that the plain companions alone leak roughly half. */
export const MIXES: Mix[] = [
  { id: 'swarm', label: 'swarm (scouts + darts)', wave: { groups: [g('scout', 260, 0.1), g('dart', 100, 0.12, 2)] } },
  { id: 'armor', label: 'armor (plated)', wave: { groups: [g('plated', 40, 0.6)] } },
  { id: 'resist', label: 'magic resist (prism)', wave: { groups: [g('prism', 70, 0.35)] } },
  { id: 'air', label: 'fliers (skimmers)', wave: { groups: [g('skimmer', 56, 0.35)] } },
  { id: 'heavy', label: 'heavies (dreadnought + carrier)', wave: { groups: [g('dread', 5, 2.5), g('carrier', 8, 1.5, 2)] } },
  { id: 'mixed', label: 'mixed wave', wave: { groups: [g('plated', 12, 1), g('prism', 14, 0.9, 1), g('skimmer', 18, 0.5, 2), g('scout', 50, 0.2, 3), g('dread', 2, 1.5, 8)] } },
  { id: 'boss', label: 'Mothership', wave: { groups: [g('mothership', 1, 1)] }, sets: 2 },
];

export interface BenchResult {
  /** Share (0..1) of the wave's total HP that was removed (killed, or damaged before it leaked), averaged over seeds. */
  stopped: number;
  /** Lives leaked (UFO `lives` value), averaged over seeds. */
  leaked: number;
}

/** Runs one arena: two plain Lv3 companions (archer, wizard) plus, optionally, the tower under test (Lv3, with `spec` or plain). */
function once(kind: TowerKind | null, spec: SpecId | null, mix: Mix, seed: number): { stopped: number; leaked: number } {
  const sim = new Sim(arena([mix.wave]), { seed });
  const lv3 = (spot: number, k: TowerKind): number => {
    sim.build(spot, k);
    const id = sim.state.towers.find((t) => t.spotId === spot)!.id;
    sim.upgrade(id);
    sim.upgrade(id);
    return id;
  };
  // companions: plain Lv3 archer, wizard, bomb, barracks (x `sets`); the tower under test sits on spot 1
  const spots = [0, 2, 3, 4, 5, 6, 7];
  const set: TowerKind[] = ['archer', 'wizard', 'bomb', 'barracks'];
  const sets = mix.sets ?? 1;
  for (let i = 0; i < sets * set.length && i < spots.length; i++) lv3(spots[i], set[i % set.length]);
  if (kind) {
    const id = lv3(1, kind);
    if (spec) sim.specialize(id, spec);
  }
  sim.callNextWave();
  const hp = new Map<number, number>(); // last seen hp of every UFO
  const maxHp = new Map<number, number>();
  let leakedHp = 0;
  for (let i = 0; i < Math.round(1200 / FIXED_DT); i++) {
    sim.step(FIXED_DT);
    for (const e of sim.state.enemies) {
      hp.set(e.id, e.hp);
      maxHp.set(e.id, e.maxHp);
    }
    for (const ev of sim.drainEvents()) if (ev.type === 'leak') leakedHp += hp.get(ev.enemyId) ?? 0;
    if (!sim.state.wave.spawning && sim.state.enemies.length === 0 && sim.state.wave.countdown === null) break;
  }
  let pool = 0;
  for (const v of maxHp.values()) pool += v;
  return { stopped: pool > 0 ? 1 - leakedHp / pool : 1, leaked: sim.state.stats.leaked };
}

export function bench(kind: TowerKind | null, spec: SpecId | null, mix: Mix, seeds = SEEDS): BenchResult {
  let st = 0;
  let lk = 0;
  for (let s = 1; s <= seeds; s++) {
    const r = once(kind, spec, mix, s);
    st += r.stopped;
    lk += r.leaked;
  }
  return { stopped: st / seeds, leaked: lk / seeds };
}

/** Markdown comparison: per tower kind, rows = mixes, columns = no tower / plain Lv3 / option A / option B (share of HP stopped). */
export function markdown(seeds = SEEDS): string {
  const out: string[] = [];
  for (const kind of ['archer', 'wizard', 'bomb', 'barracks'] as TowerKind[]) {
    const [a, b] = SPECS_BY_TOWER[kind];
    out.push(`**${kind}** (Lv3 ${kind} beside plain Lv3 companions (archer, wizard, bomb, barracks); cells: % of the wave's HP stopped / lives leaked)`, '');
    out.push(`| UFO mix | companions only | plain Lv3 | ${a} | ${b} | better |`, '|---|---|---|---|---|---|');
    for (const mix of MIXES) {
      const none = bench(null, null, mix, seeds);
      const plain = bench(kind, null, mix, seeds);
      const ra = bench(kind, a, mix, seeds);
      const rb = bench(kind, b, mix, seeds);
      const f = (r: BenchResult) => `${(100 * r.stopped).toFixed(0)}% / ${r.leaked.toFixed(1)}`;
      const d = ra.stopped - rb.stopped;
      const better = Math.abs(d) < 0.02 ? 'tie' : d > 0 ? a : b;
      out.push(`| ${mix.label} | ${f(none)} | ${f(plain)} | ${f(ra)} | ${f(rb)} | ${better} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

if (process.argv[1]?.endsWith('specbench.ts')) console.log(markdown());
