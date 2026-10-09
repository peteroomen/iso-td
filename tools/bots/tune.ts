/* eslint-disable no-console */
/**
 * Wave-size tuner: bisects a uniform scale factor K applied to a level's wave counts (spawn intervals shrink with
 * K^-0.25 so the stream density follows) until a bot averages `--target` lives, then optionally bakes the scaled
 * numbers back into the level file. The *shape* of the waves (which enemy appears where) stays hand-written.
 *
 *   npx tsx tools/bots/tune.ts --level 7 [--bot competent] [--target 13.5] [--seeds 11,12,13,14,15] [--write]
 *   npx tsx tools/bots/tune.ts --level 7 --scale 1.1 --write      # apply a fixed K instead of bisecting
 *
 * Tuning uses seeds that are not the reporting seeds (1-5) so the report is an honest out-of-sample check.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../../src/core/data/levels';
import type { LevelDef, SpawnGroup } from '../../src/core/types';
import { BOTS } from './bots';
import { PLANS } from './plans';
import { runBot } from './runner';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

export function scaleGroup(g: SpawnGroup, k: number): SpawnGroup {
  if (g.enemy === 'mothership') return g;
  const count = Math.max(1, Math.round(g.count * k));
  const interval = Math.max(0.05, Math.round(g.interval * Math.pow(k, -0.25) * 20) / 20);
  return { ...g, count, interval };
}

export function scaleLevel(l: LevelDef, k: number): LevelDef {
  return { ...l, waves: l.waves.map((w) => ({ groups: w.groups.map((g) => scaleGroup(g, k)) })) };
}

function avgLives(l: LevelDef, botName: string, seeds: number[]): { lives: number; wins: number } {
  let t = 0;
  let wins = 0;
  for (const s of seeds) {
    const r = runBot(l, BOTS[botName], PLANS[l.id], s);
    t += r.lives;
    if (r.status === 'won') wins++;
  }
  return { lives: t / seeds.length, wins };
}

const fmtGroup = (g: SpawnGroup) => `g('${g.enemy}', ${g.count}, ${g.interval}, ${g.delay}${g.path ? `, ${g.path}` : ''})`;

/** Replaces the `waves: [ ... ],` block of a level file with the given waves. */
export function bake(file: URL, waves: LevelDef['waves']): void {
  const src = readFileSync(file, 'utf8');
  const a = src.indexOf('  waves: [\n');
  const b = src.indexOf('\n  ],\n', a);
  if (a < 0 || b < 0) throw new Error('cannot find the waves block');
  const body = waves.map((w) => `    { groups: [${w.groups.map(fmtGroup).join(', ')}] },`).join('\n');
  writeFileSync(file, `${src.slice(0, a)}  waves: [\n${body}${src.slice(b)}`);
}

function main(): void {
  const n = Number(arg('level', '4'));
  const level = LEVELS[n - 1];
  const botName = arg('bot', 'competent');
  const target = Number(arg('target', '13.5'));
  const seeds = arg('seeds', '11,12,13,14,15').split(',').map(Number);
  const fixed = process.argv.includes('--scale') ? Number(arg('scale', '1')) : null;
  let k = 1;
  if (fixed !== null) k = fixed;
  else {
    let lo = 0.3;
    let hi = 3;
    for (let i = 0; i < 11; i++) {
      const mid = Math.sqrt(lo * hi);
      const r = avgLives(scaleLevel(level, mid), botName, seeds);
      console.error(`  K=${mid.toFixed(3)} -> ${r.lives.toFixed(1)} lives (${r.wins}/${seeds.length} wins)`);
      if (r.lives > target) lo = mid;
      else hi = mid;
    }
    k = Math.sqrt(lo * hi);
  }
  const scaled = scaleLevel(level, k);
  const r = avgLives(scaled, botName, seeds);
  console.log(`level ${n}: K=${k.toFixed(3)} -> ${r.lives.toFixed(1)} lives on tuning seeds`);
  if (process.argv.includes('--write')) {
    bake(new URL(`../../src/core/data/levels/level${String(n).padStart(2, '0')}.ts`, import.meta.url), scaled.waves);
    console.log('written');
  }
}

if (process.argv[1]?.endsWith('tune.ts')) main();
