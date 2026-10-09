import { createDefaultSave, parseSave, serializeSave, type SaveData } from './progress';

/** Minimal subset of the Web Storage API (so tests can inject a fake). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const SAVE_KEY = 'ufo-defense-save-v1';

/** In-memory storage (fallback when localStorage is unavailable, and for tests). */
export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export interface SaveStore {
  load(): SaveData;
  save(data: SaveData): boolean;
  clear(): void;
}

/**
 * Creates a save store on top of any Storage-like object. All access is wrapped in try/catch; with `null`
 * (or a throwing storage) it degrades to in-memory only.
 */
export function createSaveStore(storage: KeyValueStorage | null, key: string = SAVE_KEY): SaveStore {
  let memory: string | null = null;
  return {
    load(): SaveData {
      let raw: string | null = null;
      try {
        raw = storage ? storage.getItem(key) : memory;
      } catch {
        raw = memory;
      }
      return raw ? parseSave(raw) : createDefaultSave();
    },
    save(data: SaveData): boolean {
      const str = serializeSave(data);
      memory = str;
      try {
        if (storage) storage.setItem(key, str);
        return !!storage;
      } catch {
        return false;
      }
    },
    clear(): void {
      memory = null;
      try {
        storage?.removeItem?.(key);
      } catch {
        /* ignore */
      }
    },
  };
}
