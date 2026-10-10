/**
 * Why the in-game simulation is (or should be) frozen. The run steps only while the set is empty.
 *
 *  - user     the player opened the pause menu (Esc / P / button) or came back from the background; the menu is visible
 *             exactly while this reason is held
 *  - portrait the "rotate your device" overlay is up (set / cleared by the viewport from the live orientation)
 *  - settings the Settings overlay is open on top of the game
 *  - hidden   the page is in the background (visibilitychange)
 *
 * The store is module-level on purpose: the in-game scene is torn down and rebuilt on every re-layout (rotation,
 * fullscreen, resize) while the run continues, so the pause state must outlive any one scene instance. Each source only
 * ever adds / removes its own reason, so they can't overwrite each other, and duplicate or out-of-order events are
 * harmless (add / remove are idempotent).
 */
export type PauseReason = 'user' | 'portrait' | 'settings' | 'hidden';

const held = new Set<PauseReason>();
const listeners = new Set<() => void>();

const emit = (): void => {
  for (const fn of [...listeners]) fn();
};

export const pauseReasons = {
  has: (r: PauseReason): boolean => held.has(r),
  /** true while any reason is held (the sim must not step) */
  get any(): boolean {
    return held.size > 0;
  },
  add(r: PauseReason): void {
    if (held.has(r)) return;
    held.add(r);
    emit();
  },
  remove(r: PauseReason): void {
    if (held.delete(r)) emit();
  },
  set(r: PauseReason, on: boolean): void {
    if (on) this.add(r);
    else this.remove(r);
  },
  /** Drops the reasons tied to one run (a new run / leaving the level); environment reasons (portrait, hidden) stay. */
  resetRun(): void {
    const had = held.delete('user') || held.delete('settings');
    if (had) emit();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** tests */
  clear(): void {
    held.clear();
    emit();
  },
};
