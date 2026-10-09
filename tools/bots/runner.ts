import { Sim } from '../../src/core/sim/Sim';
import { FIXED_DT } from '../../src/core/data/rules';
import type { LevelDef } from '../../src/core/types';
import { deriveSpots } from '../../src/core/level';
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
  goldEarned: number;
  /** Time the last gold was spent on a tower (build / upgrade); null if nothing was bought. */
  lastSpendTime: number | null;
  /** First time every build spot held a tower at its level cap (null = never). */
  maxedAt: number | null;
  /** Mothership levels: how far along the road (0..1) the boss was when it died (won) or when the run ended (lost). */
  bossFrac: number | null;
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
  let bossFrac: number | null = null;
  const spotCount = deriveSpots(level).length;
  let lastSpent = 0;
  let lastSpendTime: number | null = null;
  let maxedAt: number | null = null;
  while (sim.state.status !== 'won' && sim.state.status !== 'lost' && tick < maxTicks) {
    if (tick % ACT_EVERY === 0) bot.act(sim);
    if (sim.state.wave.index !== lastWave) {
      lastWave = sim.state.wave.index;
      log.push({ wave: lastWave, time: sim.state.time, lives: sim.state.lives, gold: sim.state.gold, towers: towerSummary(sim.state.towers) });
    }
    sim.step();
    if (sim.state.stats.goldSpent !== lastSpent) {
      lastSpent = sim.state.stats.goldSpent;
      lastSpendTime = sim.state.time;
    }
    if (maxedAt === null && tick % ACT_EVERY === 0 && sim.state.towers.length >= spotCount && sim.state.towers.every((t) => t.level >= level.towerCap[t.kind])) {
      maxedAt = sim.state.time;
    }
    if (sim.state.boss) {
      bossHp = sim.state.boss.hp;
      const b = sim.state.enemies.find((e) => e.boss);
      if (b) bossFrac = b.progress / b.pathLength;
    }
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
    goldEarned: s.stats.goldEarned,
    lastSpendTime,
    maxedAt,
    bossFrac,
    log,
  };
}
