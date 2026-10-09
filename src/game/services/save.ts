import { createSaveStore, type SaveData } from '../../core';

/** Global save access for the game layer. localStorage access is guarded (private mode, blocked storage). */
function safeLocalStorage(): Storage | null {
  try {
    const ls = window.localStorage;
    const probe = '__ufo_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

const store = createSaveStore(safeLocalStorage());
let current: SaveData = store.load();

export function getSave(): SaveData {
  return current;
}

/** Apply an immutable update (e.g. `updateSave(s => buyTier(s, 'archer'))`) and persist it. */
export function updateSave(fn: (s: SaveData) => SaveData): SaveData {
  current = fn(current);
  store.save(current);
  return current;
}

export function clearSave(): SaveData {
  store.clear();
  current = store.load();
  return current;
}
