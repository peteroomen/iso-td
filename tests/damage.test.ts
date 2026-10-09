import { describe, expect, it } from 'vitest';
import { calcDamage } from '../src/core/sim/stats';
import { Recorder, makeSim, straightLevel, wave } from './helpers';

describe('damage formulas', () => {
  it('physical is reduced by armor', () => {
    expect(calcDamage(10, 'physical', 0.5, 0)).toBeCloseTo(5);
    expect(calcDamage(10, 'physical', 0, 0.9)).toBeCloseTo(10);
  });
  it('magic is reduced by magic resist only', () => {
    expect(calcDamage(10, 'magic', 0.9, 0.5)).toBeCloseTo(5);
  });
  it('true damage ignores everything', () => {
    expect(calcDamage(60, 'true', 0.9, 0.9)).toBe(60);
  });
  it('armor pierce lowers armor but never below 0', () => {
    expect(calcDamage(10, 'physical', 0.5, 0, 0.3)).toBeCloseTo(8);
    expect(calcDamage(10, 'physical', 0.2, 0, 0.3)).toBeCloseTo(10);
  });
  it('pierce does not affect magic', () => {
    expect(calcDamage(10, 'magic', 0, 0.5, 0.3)).toBeCloseTo(5);
  });
});

describe('damage in the sim', () => {
  function firstHit(kind: 'archer' | 'wizard', enemy: 'plated' | 'prism', upgrades?: Parameters<typeof makeSim>[1]) {
    const sim = makeSim(straightLevel({ waves: [wave({ enemy })] }), upgrades);
    sim.build(1, kind);
    sim.callNextWave();
    const rec = new Recorder(sim);
    expect(rec.until(() => rec.of('hit').length > 0, 30)).toBe(true);
    return rec.of('hit')[0].e;
  }

  it('arrows are halved by plated armor, bolts are not', () => {
    const arrow = firstHit('archer', 'plated');
    expect(arrow.damageType).toBe('physical');
    expect(arrow.amount).toBeCloseTo(arrow.raw * 0.5);
    const bolt = firstHit('wizard', 'plated');
    expect(bolt.damageType).toBe('magic');
    expect(bolt.amount).toBeCloseTo(bolt.raw);
  });

  it('prism halves magic damage, not physical', () => {
    const bolt = firstHit('wizard', 'prism');
    expect(bolt.amount).toBeCloseTo(bolt.raw * 0.5);
    const arrow = firstHit('archer', 'prism');
    expect(arrow.amount).toBeCloseTo(arrow.raw);
  });

  it('archer star tier 3 pierces 0.30 armor', () => {
    const arrow = firstHit('archer', 'plated', { upgrades: { archers: 3, wizards: 0, barracks: 0, orbital: 0, reinforcements: 0 } });
    // +15% damage (tier 2) is part of raw; effective armor 0.5 - 0.3 = 0.2
    expect(arrow.amount).toBeCloseTo(arrow.raw * 0.8);
  });
});
