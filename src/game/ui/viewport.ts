import Phaser from 'phaser';
import { setViewMetrics } from './theme';

/** Scenes that should not be restarted on resize (they only exist for a moment, or manage themselves). */
const SKIP = new Set(['Boot', 'Preload']);

/** Implemented by scenes that can re-layout without a plain restart (the in-game scene keeps its simulation). */
export interface ViewResizable {
  onViewResize(): void;
}

const isResizable = (s: unknown): s is ViewResizable => typeof (s as Partial<ViewResizable>).onViewResize === 'function';

let probe: HTMLElement | null = null;

/** Safe-area insets in CSS px, read through a hidden element padded with env(safe-area-inset-*). */
function readInsets(): { l: number; t: number; r: number; b: number } {
  try {
    if (!probe) {
      probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
        'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.appendChild(probe);
    }
    const cs = getComputedStyle(probe);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  } catch {
    return { l: 0, t: 0, r: 0, b: 0 };
  }
}

/** Touch device held upright: the layout would be tiny, so an HTML overlay asks to rotate instead. */
function portraitBlocked(): boolean {
  try {
    return window.matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 900px)').matches;
  } catch {
    return false;
  }
}

/** Reads the live canvas size into the theme (GAME_W / GAME_H / UI_SCALE / SAFE). */
export function syncViewMetrics(game: Phaser.Game): void {
  const sc = game.scale;
  const cssPerUnit = sc.height > 0 ? sc.displaySize.height / sc.height : 1;
  setViewMetrics(sc.width, sc.height, cssPerUnit, readInsets());
}

/**
 * Keeps the theme's live size in sync with the (EXPAND-scaled) canvas and re-lays out the running scenes
 * whenever it changes (window resize, rotation, fullscreen). Resizes are debounced and ignored while the
 * "rotate your device" overlay is up.
 */
export function installViewport(game: Phaser.Game): void {
  syncViewMetrics(game);
  let timer = 0;
  let lastW = game.scale.width;
  let lastH = game.scale.height;
  let lastCss = game.scale.displaySize.height;
  let wasBlocked = false;

  const relayout = (): void => {
    timer = 0;
    const blocked = portraitBlocked();
    document.documentElement.classList.toggle('rotate-needed', blocked);
    if (blocked) {
      if (!wasBlocked) {
        wasBlocked = true;
        // stop the sim behind the overlay
        for (const sc of game.scene.getScenes(true)) (sc as unknown as { onPortraitBlock?: () => void }).onPortraitBlock?.();
      }
      return;
    }
    wasBlocked = false;
    const sc = game.scale;
    const css = sc.displaySize.height;
    if (sc.width === lastW && sc.height === lastH && Math.abs(css - lastCss) < 0.5) return;
    lastW = sc.width;
    lastH = sc.height;
    lastCss = css;
    syncViewMetrics(game);
    for (const s of game.scene.getScenes(false)) {
      const key = s.sys.settings.key;
      if (SKIP.has(key)) continue;
      if (isResizable(s)) {
        s.onViewResize();
      } else if (s.sys.isActive() || s.sys.isPaused()) {
        // meta scenes are cheap and stateless: rebuilding them at the new size is the safest re-layout
        s.scene.restart(s.sys.settings.data);
      }
    }
  };

  const schedule = (): void => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(relayout, 140);
  };
  game.scale.on(Phaser.Scale.Events.RESIZE, schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('resize', schedule);
  try {
    window.matchMedia('(orientation: portrait)').addEventListener('change', schedule);
  } catch {
    /* old browsers */
  }
  schedule();
}

/** Enter fullscreen (and try to lock landscape on phones); leave it if already fullscreen. */
export function toggleFullscreen(scale: Phaser.Scale.ScaleManager): void {
  if (scale.isFullscreen) {
    scale.stopFullscreen();
    try {
      screen.orientation?.unlock?.();
    } catch {
      /* ignore */
    }
    return;
  }
  if (!scale.fullscreen.available) return;
  scale.once(Phaser.Scale.Events.ENTER_FULLSCREEN, () => {
    try {
      const lock = (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock;
      lock?.call(screen.orientation, 'landscape').catch(() => undefined);
    } catch {
      /* not supported (desktop, iOS) */
    }
  });
  scale.startFullscreen();
}

export const fullscreenAvailable = (scale: Phaser.Scale.ScaleManager): boolean => scale.fullscreen.available;
