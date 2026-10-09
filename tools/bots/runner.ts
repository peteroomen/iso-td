import { Sim } from '../../src/core/sim/Sim';
import { FIXED_DT } from '../../src/core/data/rules';
import type { LevelDef } from '../../src/core/types';
import { Bot, towerSummary } from './bot';
import { starBudget, upgradesForStars } from './stars';
import type { BotConfig, LevelPlan } from './types';

export interface WaveLogEntry {
  wave: number;
  time: number;
  lives: number;
  gold: number;
  towers: string;
}

export interface RunResult {
  levelId: string;
  bot: string;
  seed: number;
  status: 'won' | 'lost' | 'timeout';
  lives: number;
  /** Number of waves started when the run ended. */
  wave: number;
  totalWaves: number;
  time: number;
  gold: number;
  kills: number;
  leaked: number;
  bossHpLeft: number | null;
  log: WaveLogEntry[];
}

export const MAX_SIM_SECONDS = 2400;
/** Bots act every 6 ticks (0.1 s). */
const ACT_EVERY = 6;

export function levelNumber(level: LevelDef): number {
  return Number(level.id.replace(/\D/g, '')) || 1;
}

export function runBot(level: LevelDef, cfg: BotConfig, plan: LevelPlan | undefined, seed: number): RunResult {
  const upgrades = upgradesForStars(starBudget(levelNumber(level), cfg.starsPerLevel));
  const sim = new Sim(level, { seed, upgrades, events: false });
  const actions = cfg.style === 'plan' ? (cfg.planKind === 'expert' ? plan?.expert ?? plan?.competent : plan?.competent) ?? [] : [];
  const bot = new Bot(cfg, level, actions);
  const log: WaveLogEntry[] = [];
  let lastWave = -1;
  let tick = 0;
  const maxTicks = Math.round(MAX_SIM_SECONDS / FIXED_DT);
  let bossHp: number | null = null;
  while (sim.state.status !== 'won' && sim.state.status !== 'lost' && tick < maxTicks) {
    if (tick % ACT_EVERY === 0) bot.act(sim);
    if (sim.state.wave.index !== lastWave) {
      lastWave = sim.state.wave.index;
      log.push({ wave: lastWave, time: sim.state.time, lives: sim.state.lives, gold: sim.state.gold, towers: towerSummary(sim.state.towers) });
    }
    sim.step();
    if (sim.state.boss) bossHp = sim.state.boss.hp;
    tick++;
  }
  const s = sim.state;
  return {
    levelId: level.id,
    bot: cfg.name,
    seed,
    status: s.status === 'won' ? 'won' : s.status === 'lost' ? 'lost' : 'timeout',
    lives: s.lives,
    wave: s.wave.index,
    totalWaves: s.wave.total,
    time: s.time,
    gold: s.gold,
    kills: s.stats.kills,
    leaked: s.stats.leaked,
    bossHpLeft: s.status === 'lost' ? bossHp : null,
    log,
  };
}
