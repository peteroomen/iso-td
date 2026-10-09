import { describe, expect, it } from 'vitest';
import { emptyUpgrades, resolveModifiers } from '../src/core/data/upgrades';
import { sellValue, towerCost, towerStats, upgradeCost } from '../src/core/sim/stats';
import { Recorder, makeSim, straightLevel, wave } from './helpers';

const up = (patch: Partial<ReturnType<typeof emptyUpgrades>>) => ({ ...emptyUpgrades(), ...patch });

describe('star tree modifiers (applied at construction)', () => {
  it('resolves tiers cumulatively', () => {
    expect(resolveModifiers(emptyUpgrades())).toMatchObject({ archerRangeMult: 1, archerArmorPierce: 0, wizardCostMult: 1 });
    expect(resolveModifiers(up({ archers: 2 }))).toMatchObject({ archerRangeMult: 1.1, archerDamageMult: 1.15, archerArmorPierce: 0 });
    expect(resolveModifiers(up({ archers: 3 })).archerArmorPierce).toBeCloseTo(0.3);
  });

  it('archers tier 1/2 change range and damage', () => {
    const base = towerStats('archer', 1, emptyUpgrades());
    const t1 = towerStats('archer', 1, up({ archers: 1 }));
    const t2 = towerStats('archer', 1, up({ archers: 2 }));
    expect(t1.range).toBeCloseTo(base.range * 1.1);
    expect(t1.damageMax).toBe(base.damageMax);
    expect(t2.damageMax).toBeCloseTo(base.damageMax * 1.15);
    const sim = makeSim(straightLevel(), { upgrades: up({ archers: 2 }) });
    sim.build(0, 'archer');
    expect(sim.state.towers[0].range).toBeCloseTo(3.2 * 1.1);
  });

  it('wizard tier 1 makes build and upgrade 10% cheaper', () => {
    expect(towerCost('wizard', 1, emptyUpgrades())).toBe(100);
    expect(towerCost('wizard', 1, up({ wizards: 1 }))).toBe(90);
    expect(upgradeCost('wizard', 1, up({ wizards: 1 }))).toBe(144);
    expect(upgradeCost('wizard', 2, up({ wizards: 1 }))).toBe(216);
    expect(towerCost('archer', 1, up({ wizards: 3 }))).toBe(70);
    const sim = makeSim(straightLevel({ startGold: 500 }), { upgrades: up({ wizards: 1 }) });
    sim.build(0, 'wizard');
    expect(sim.state.gold).toBe(410);
    sim.upgrade(sim.state.towers[0].id);
    expect(sim.state.gold).toBe(266);
    expect(sim.state.towers[0].invested).toBe(234);
    expect(sellValue(234)).toBe(140);
  });

  it('wizard tier 3 bolts slow enemies', () => {
    const level = straightLevel({ waves: [wave({ enemy: 'plated' })] });
    const slow = makeSim(level, { upgrades: up({ wizards: 3 }) });
    slow.build(1, 'wizard');
    slow.callNextWave();
    const rec = new Recorder(slow);
    expect(rec.until(() => rec.of('hit').length > 0, 30)).toBe(true);
    const e = slow.state.enemies[0];
    expect(e.slowed).toBe(true);
    expect(e.slowFactor).toBeCloseTo(0.7);
    // the slow expires after 1 s once the bolts stop (tower removed)
    slow.sell(slow.state.towers[0].id);
    rec.seconds(1.2);
    expect(slow.state.enemies[0].slowed).toBe(false);
    // without the star tier there is no slow
    const plain = makeSim(level);
    plain.build(1, 'wizard');
    plain.callNextWave();
    const rec2 = new Recorder(plain);
    expect(rec2.until(() => rec2.of('hit').length > 0, 30)).toBe(true);
    expect(plain.state.enemies[0].slowed).toBe(false);
  });

  it('barracks tier 1 adds 20% knight HP', () => {
    const sim = makeSim(straightLevel(), { upgrades: up({ barracks: 1 }) });
    sim.build(1, 'barracks');
    expect(sim.state.knights[0].maxHp).toBeCloseTo(60);
    expect(towerStats('barracks', 3, up({ barracks: 1 })).knightHp).toBeCloseTo(168);
  });

  it('cost helpers', () => {
    expect(towerCost('archer', 1, emptyUpgrades())).toBe(70);
    expect(towerCost('archer', 2, emptyUpgrades())).toBe(110);
    expect(towerCost('barracks', 3, emptyUpgrades())).toBe(170);
    expect(upgradeCost('archer', 3, emptyUpgrades())).toBeNull();
    expect(sellValue(70)).toBe(42);
    expect(sellValue(180)).toBe(108);
  });

  it('tower stats for tooltips', () => {
    const s = towerStats('archer', 3, emptyUpgrades());
    expect(s).toMatchObject({ damageMin: 13, damageMax: 19, cooldown: 0.6, range: 3.8, shots: 2 });
    expect(s.dps).toBeCloseTo((16 * 2) / 0.6);
    expect(towerStats('wizard', 3, emptyUpgrades())).toMatchObject({ chainCount: 2, chainRange: 1.5, chainFactor: 0.5 });
    expect(towerStats('barracks', 3, emptyUpgrades())).toMatchObject({ knights: 3, knightHp: 140, knightArmor: 0.3 });
  });
});
