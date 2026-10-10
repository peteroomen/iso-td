/* eslint-disable no-console */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../src/core/data/levels';
import { BOTS, MAIN_BOTS, VARIANT_BOTS } from './bots/bots';
import { PLANS } from './bots/plans';
import { runBot, type RunResult } from './bots/runner';
import { upgradesForStars, starBudget } from './bots/stars';
import { levelNumber } from './bots/runner';
import { deriveSpots } from '../src/core/level';

interface Args {
  level: number | null;
  bots: string[] | null;
  seeds: number;
  verbose: boolean;
  write: boolean;
  noWrite: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { level: null, bots: null, seeds: 5, verbose: false, write: false, noWrite: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--level') a.level = Number(argv[++i]);
    else if (k === '--bot') a.bots = argv[++i].split(',');
    else if (k === '--seeds') a.seeds = Math.max(1, Number(argv[++i]));
    else if (k === '--verbose' || k === '-v') a.verbose = true;
    else if (k === '--write') a.write = true;
    else if (k === '--no-write') a.noWrite = true;
    else if (k === '--help' || k === '-h') {
      console.log('usage: npm run balance -- [--level N] [--bot name[,name]] [--seeds K] [--verbose] [--write|--no-write]\nbots: ' + Object.keys(BOTS).join(', '));
      process.exit(0);
    } else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

interface Agg {
  runs: RunResult[];
  wins: number;
  min: number;
  avg: number;
  max: number;
  /** Average of lives over won runs only. */
  avgWon: number | null;
  /** Average wave number the lost runs ended on. */
  lossWave: number | null;
  gold: number;
  earned: number;
  time: number;
  /** Runs in which every spot held a tower at its cap, and their average time. */
  maxedRuns: number;
  maxedAt: number | null;
  /** Mothership level: average share of the road at which the boss died (or stood when the run ended). */
  bossFrac: number | null;
  /** Average share of the run (0..1) at which the maxed runs were maxed. */
  maxedFrac: number | null;
  /** Average of lastSpendTime / run time (how late the bot was still investing). */
  lastSpendFrac: number;
}

function aggregate(runs: RunResult[]): Agg {
  const lives = runs.map((r) => r.lives);
  const won = runs.filter((r) => r.status === 'won');
  const lost = runs.filter((r) => r.status !== 'won');
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
  return {
    runs,
    wins: won.length,
    min: Math.min(...lives),
    avg: avg(lives),
    max: Math.max(...lives),
    avgWon: won.length ? avg(won.map((r) => r.lives)) : null,
    lossWave: lost.length ? avg(lost.map((r) => r.wave)) : null,
    gold: avg(runs.map((r) => r.gold)),
    earned: avg(runs.map((r) => r.goldEarned)),
    time: avg(runs.map((r) => r.time)),
    maxedRuns: runs.filter((r) => r.maxedAt !== null).length,
    maxedAt: runs.some((r) => r.maxedAt !== null) ? avg(runs.filter((r) => r.maxedAt !== null).map((r) => r.maxedAt!)) : null,
    bossFrac: runs.some((r) => r.bossFrac !== null) ? avg(runs.filter((r) => r.bossFrac !== null).map((r) => r.bossFrac!)) : null,
    maxedFrac: runs.some((r) => r.maxedAt !== null) ? avg(runs.filter((r) => r.maxedAt !== null).map((r) => r.maxedAt! / Math.max(1, r.time))) : null,
    lastSpendFrac: avg(runs.map((r) => (r.lastSpendTime ?? 0) / Math.max(1, r.time))),
  };
}

const f1 = (x: number) => x.toFixed(1);

function cell(a: Agg): string {
  const n = a.runs.length;
  let s = `${a.wins}/${n} win`;
  s += ` | ${a.min}/${f1(a.avg)}/${a.max}`;
  s += ` | ${a.lossWave === null ? '-' : f1(a.lossWave)}`;
  s += ` | g${Math.round(a.gold)}`;
  return s;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const levels = LEVELS.filter((l) => args.level === null || levelNumber(l) === args.level);
  const botNames = args.bots ?? [...MAIN_BOTS, ...VARIANT_BOTS];
  for (const n of botNames) if (!BOTS[n]) throw new Error(`unknown bot '${n}'`);
  const t0 = Date.now();
  const results = new Map<string, Agg>(); // key level|bot

  for (const level of levels) {
    for (const name of botNames) {
      const cfg = BOTS[name];
      const runs: RunResult[] = [];
      for (let seed = 1; seed <= args.seeds; seed++) runs.push(runBot(level, cfg, PLANS[level.id], seed));
      const agg = aggregate(runs);
      results.set(`${level.id}|${name}`, agg);
      console.log(`${level.id} ${level.name.padEnd(18)} ${name.padEnd(13)} wins ${agg.wins}/${runs.length}  lives min/avg/max ${agg.min}/${f1(agg.avg)}/${agg.max}  lossWave ${agg.lossWave === null ? '-' : f1(agg.lossWave)}  gold ${Math.round(agg.gold)}  t=${Math.round(agg.time)}s  earned ${Math.round(agg.earned)}  maxed ${agg.maxedAt === null ? 'never' : `${Math.round(agg.maxedAt)}s (${agg.maxedRuns}/${runs.length}, ${Math.round(100 * agg.maxedFrac!)}%)`}  lastBuy ${Math.round(100 * agg.lastSpendFrac)}%`);
      if (args.verbose) {
        const r = runs[0];
        console.log(`  seed ${r.seed}: ${r.status} lives ${r.lives} wave ${r.wave}/${r.totalWaves}${r.bossHpLeft !== null ? ` bossHp ${Math.round(r.bossHpLeft)}` : ''}${r.bossFrac !== null ? ` boss ${r.status === 'won' ? 'died' : 'reached'} at ${Math.round(r.bossFrac * 100)}% of the road` : ''}`);
        for (const w of r.log) console.log(`    wave ${String(w.wave).padStart(2)} t=${String(Math.round(w.time)).padStart(4)}s lives ${String(w.lives).padStart(2)} gold ${String(Math.round(w.gold)).padStart(5)}  ${w.towers}`);
      }
    }
  }
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const full = args.level === null && args.bots === null;
  if ((full || args.write) && !args.noWrite) {
    writeReport(markdown(levels.map((l) => l.id), botNames, results, args.seeds));
    console.log('wrote docs/BALANCE.md');
  }
}

const START = '<!-- balance:generated:start -->';
const END = '<!-- balance:generated:end -->';

/** Replaces the generated region of docs/BALANCE.md (the hand-written notes around it are kept). */
function writeReport(generated: string): void {
  const url = new URL('../docs/BALANCE.md', import.meta.url);
  const block = `${START}\n${generated}\n${END}`;
  let out = `${block}\n`;
  if (existsSync(url)) {
    const old = readFileSync(url, 'utf8');
    const a = old.indexOf(START);
    const b = old.indexOf(END);
    if (a >= 0 && b > a) out = old.slice(0, a) + block + old.slice(b + END.length);
  }
  writeFileSync(url, out);
}

function markdown(levelIds: string[], botNames: string[], results: Map<string, Agg>, seeds: number): string {
  const out: string[] = [];
  out.push('# UFO Defense - balance report', '');
  out.push('Generated by `npm run balance` (tools/balance.ts). Every number comes from running the real `Sim` headless with scripted bots (see tools/bots).', '');
  out.push(`Seeds per bot and level: ${seeds}. Cells show: wins / lives left (min/avg/max over all seeds, 0 = lost) / average wave number reached by the lost runs / average gold left unspent at the end (g).`, '');
  out.push('Targets (docs/DESIGN.md section 8): competent wins every level with 10-17 lives on average; expert reaches 18+ (3 stars); naive loses from L4 onward; idle always loses.', '');
  out.push('## Bots', '');
  out.push('| bot | stars assumed | abilities | early calls | build |', '|---|---|---|---|---|');
  for (const n of botNames) {
    const c = BOTS[n];
    const build = c.style === 'plan' ? `plan (${c.planKind})${c.onlyKind ? `, only ${c.onlyKind}` : ''}` : c.style === 'naive' ? 'cheapest tower (archers) on the spots nearest the spawn, upgrades when affordable' : 'nothing';
    out.push(`| ${n} | ${c.starsPerLevel}/level | ${c.abilities} | ${c.early} | ${build} |`);
  }
  out.push('');
  out.push('Star upgrades by level (competent / expert):', '');
  out.push('| level | competent (2*) | expert (3*) |', '|---|---|---|');
  for (const id of levelIds) {
    const n = Number(id.replace(/\D/g, ''));
    const fmt = (per: number) => {
      const u = upgradesForStars(starBudget(n, per));
      return `${starBudget(n, per)} pts: A${u.archers} W${u.wizards} B${u.barracks} O${u.orbital} R${u.reinforcements} X${u.bombs}`;
    };
    out.push(`| ${n} | ${fmt(2)} | ${fmt(3)} |`);
  }
  out.push('');
  out.push('## Results', '');
  const mainCols = botNames.filter((n) => (MAIN_BOTS as readonly string[]).includes(n));
  const varCols = botNames.filter((n) => (VARIANT_BOTS as readonly string[]).includes(n));
  const table = (cols: string[]) => {
    out.push(`| level | ${cols.join(' | ')} |`, `|---|${cols.map(() => '---|').join('')}`);
    for (const id of levelIds) {
      const lvl = LEVELS.find((l) => l.id === id)!;
      const row = cols.map((c) => {
        const a = results.get(`${id}|${c}`);
        return a ? cell(a).replace(/ \| /g, ' / ') : '';
      });
      out.push(`| ${levelNumber(lvl)} ${lvl.name} | ${row.join(' | ')} |`);
    }
    out.push('');
  };
  if (mainCols.length) table(mainCols);
  if (varCols.length) {
    out.push('### Single-tower-type variants', '');
    out.push('Competent bot (same plan, stars and abilities) but every tower is forced to one kind. Shows which enemy introductions punish which mix.', '');
    table(varCols);
  }
  out.push('### Economy', '');
  out.push('Gold left at the end, total gold earned, the time at which every build spot held a tower at its level cap ("maxed", with the share of the run it took and in how many seeds it happened) and how late the bot was still buying (time of its last purchase as a share of the run). The goal: little gold left over, and no maxing before the last third of the level.', '');
  const ecoBots = botNames.filter((n) => n === 'competent' || n === 'expert');
  if (ecoBots.length) {
    out.push(`| level | ${ecoBots.map((n) => `${n} gold left | ${n} earned | ${n} maxed at | ${n} last buy`).join(' | ')} |`, `|---|${ecoBots.map(() => '---|---|---|---|').join('')}`);
    for (const id of levelIds) {
      const lvl = LEVELS.find((l) => l.id === id)!;
      const cols = ecoBots.map((n) => {
        const a = results.get(`${id}|${n}`);
        if (!a) return ' |  |  | ';
        const mx = a.maxedAt === null ? 'never' : `${Math.round(a.maxedAt)} s (${Math.round(100 * a.maxedFrac!)}%, ${a.maxedRuns}/${a.runs.length})`;
        return `${Math.round(a.gold)} | ${Math.round(a.earned)} | ${mx} | ${Math.round(100 * a.lastSpendFrac)}%`;
      });
      out.push(`| ${levelNumber(lvl)} ${lvl.name} | ${cols.join(' | ')} |`);
    }
    out.push('');
  }
  const boss = (['competent', 'expert', 'archer-only', 'wizard-only', 'bomb-only'] as const).map((n) => [n, results.get(`${LEVELS[9].id}|${n}`)] as const).filter(([, a]) => a && a.bossFrac !== null);
  if (boss.length) {
    out.push('Mothership (level 10): where on the road the boss was when it died (won runs) or when the run ended (lost runs): ' + boss.map(([n, a]) => `${n} ${Math.round(100 * a!.bossFrac!)}%`).join(', ') + '.', '');
  }
  out.push('## Levels', '');
  out.push('| level | name | biome | waves | start gold | spots | tower caps (A/W/B/X) | new enemies | max units in a wave |', '|---|---|---|---|---|---|---|---|---|');
  const seen = new Set<string>();
  for (const l of LEVELS) {
    const used = [...new Set(l.waves.flatMap((w) => w.groups.map((g) => g.enemy)))];
    const fresh = used.filter((u) => !seen.has(u));
    used.forEach((u) => seen.add(u));
    if (!levelIds.includes(l.id)) continue;
    const maxUnits = Math.max(...l.waves.map((w) => w.groups.reduce((n, g) => n + g.count, 0)));
    out.push(`| ${levelNumber(l)} | ${l.name} | ${l.biome} | ${l.waves.length} | ${l.startGold} | ${deriveSpots(l).length} | ${l.towerCap.archer}/${l.towerCap.wizard}/${l.towerCap.barracks}/${l.towerCap.bomb} | ${fresh.join(', ') || '-'} | ${maxUnits} |`);
  }
  out.push('');
  return out.join('\n');
}

main();
