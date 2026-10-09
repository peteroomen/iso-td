import { describe, expect, it } from 'vitest';
import {
  buyTier,
  canBuyTier,
  createDefaultSave,
  isLevelUnlocked,
  nextTierCost,
  parseSave,
  recordResult,
  resetUpgrades,
  serializeSave,
  starsAvailable,
  starsEarned,
  starsForLives,
  starsSpent,
  withSettings,
  type SaveData,
} from '../src/core/progress';
import { MemoryStorage, createSaveStore, SAVE_KEY } from '../src/core/storage';

const ORDER = ['l1', 'l2', 'l3'];

function withStars(n: number): SaveData {
  // helper: 3-star clears of n/3 levels (plus remainder)
  let s = createDefaultSave();
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  let left = n;
  for (const id of ids) {
    if (left <= 0) break;
    const take = Math.min(3, left);
    s = { ...s, levels: { ...s.levels, [id]: { stars: take, completed: true } } };
    left -= take;
  }
  return s;
}

describe('stars for lives', () => {
  it('thresholds', () => {
    expect(starsForLives(20)).toBe(3);
    expect(starsForLives(18)).toBe(3);
    expect(starsForLives(17)).toBe(2);
    expect(starsForLives(6)).toBe(2);
    expect(starsForLives(5)).toBe(1);
    expect(starsForLives(1)).toBe(1);
  });
});

describe('recordResult', () => {
  it('records the first clear and keeps the best result', () => {
    let s = createDefaultSave();
    let r = recordResult(s, 'l1', 10);
    expect(r).toMatchObject({ stars: 2, gained: 2, firstClear: true });
    s = r.save;
    r = recordResult(s, 'l1', 3);
    expect(r).toMatchObject({ stars: 1, gained: 0, firstClear: false });
    expect(r.save.levels.l1).toEqual({ stars: 2, completed: true });
    r = recordResult(r.save, 'l1', 20);
    expect(r).toMatchObject({ stars: 3, gained: 1 });
    expect(r.save.levels.l1.stars).toBe(3);
    expect(s.levels.l1.stars).toBe(2); // immutable
  });
});

describe('unlocks', () => {
  it('level N+1 unlocks when level N is won', () => {
    let s = createDefaultSave();
    expect(isLevelUnlocked(s, 'l1', ORDER)).toBe(true);
    expect(isLevelUnlocked(s, 'l2', ORDER)).toBe(false);
    s = recordResult(s, 'l1', 3).save;
    expect(isLevelUnlocked(s, 'l2', ORDER)).toBe(true);
    expect(isLevelUnlocked(s, 'l3', ORDER)).toBe(false);
    expect(isLevelUnlocked(s, 'nope', ORDER)).toBe(false);
  });
});

describe('star tree purchases', () => {
  it('tier costs are 1/2/3 and bought in order; 6 per track', () => {
    let s = withStars(9);
    expect(starsAvailable(s)).toBe(9);
    expect(nextTierCost(s, 'archers')).toBe(1);
    s = buyTier(s, 'archers');
    expect(nextTierCost(s, 'archers')).toBe(2);
    s = buyTier(s, 'archers');
    s = buyTier(s, 'archers');
    expect(s.upgrades.archers).toBe(3);
    expect(starsSpent(s)).toBe(6);
    expect(starsAvailable(s)).toBe(3);
    expect(canBuyTier(s, 'archers')).toEqual({ ok: false, reason: 'max_level' });
    expect(nextTierCost(s, 'archers')).toBeNull();
    expect(buyTier(s, 'archers')).toBe(s);
  });

  it('cannot buy without enough stars', () => {
    let s = withStars(2);
    s = buyTier(s, 'wizards'); // 1
    expect(canBuyTier(s, 'wizards').ok).toBe(false); // needs 2, has 1
    expect(buyTier(s, 'wizards').upgrades.wizards).toBe(1);
    expect(canBuyTier(s, 'barracks').ok).toBe(true);
  });

  it('reset refunds everything', () => {
    let s = withStars(10);
    s = buyTier(buyTier(buyTier(s, 'orbital'), 'orbital'), 'barracks');
    expect(starsSpent(s)).toBe(4);
    s = resetUpgrades(s);
    expect(starsSpent(s)).toBe(0);
    expect(starsAvailable(s)).toBe(10);
    expect(starsEarned(s)).toBe(10);
  });
});

describe('persistence', () => {
  it('round-trips through injected storage', () => {
    const storage = new MemoryStorage();
    const store = createSaveStore(storage);
    expect(store.load()).toEqual(createDefaultSave());
    let s = recordResult(createDefaultSave(), 'l1', 20).save;
    s = buyTier(s, 'archers');
    s = withSettings(s, { music: 0.2, sfx: 3 });
    expect(store.save(s)).toBe(true);
    expect(storage.getItem(SAVE_KEY)).toBe(serializeSave(s));
    const loaded = createSaveStore(storage).load();
    expect(loaded).toEqual(s);
    expect(loaded.settings).toEqual({ music: 0.2, sfx: 1 });
    store.clear();
    expect(store.load()).toEqual(createDefaultSave());
  });

  it('survives corrupt data and missing/throwing storage', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    expect(createSaveStore(storage).load()).toEqual(createDefaultSave());
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const store = createSaveStore(throwing);
    expect(store.load()).toEqual(createDefaultSave());
    const s = recordResult(createDefaultSave(), 'l1', 20).save;
    expect(store.save(s)).toBe(false);
    expect(store.load().levels.l1.stars).toBe(3); // kept in memory
    expect(createSaveStore(null).load()).toEqual(createDefaultSave());
  });

  it('sanitizes tampered data', () => {
    const s = parseSave(
      JSON.stringify({ version: 1, levels: { l1: { stars: 99, completed: true }, bad: 5 }, upgrades: { archers: 3, wizards: -2, junk: 1 }, settings: { music: 7 } }),
    );
    expect(s.levels.l1.stars).toBe(3);
    expect(s.levels.bad).toBeUndefined();
    // 6 stars spent on archers but only 3 earned => upgrades reset
    expect(s.upgrades.archers).toBe(0);
    expect(s.upgrades.wizards).toBe(0);
    expect(s.settings.music).toBe(1);
    expect(s.settings.sfx).toBe(createDefaultSave().settings.sfx);
    expect(parseSave(null)).toEqual(createDefaultSave());
    expect(parseSave('42')).toEqual(createDefaultSave());
  });
});

describe('save flags and seen enemies', () => {
  it('round-trips and sanitizes', async () => {
    const p = await import('../src/core/progress');
    let s = p.createDefaultSave();
    s = p.withFlag(p.withSeenEnemies(s, ['scout', 'dart', 'scout']), 'endingSeen');
    const back = p.parseSave(p.serializeSave(s));
    expect(back.seenEnemies).toEqual(['scout', 'dart']);
    expect(p.hasFlag(back, 'endingSeen')).toBe(true);
    expect(p.parseSave('{"flags":[1,"x","x"],"seenEnemies":"bad"}')).toMatchObject({ flags: ['x'], seenEnemies: [] });
  });
});
