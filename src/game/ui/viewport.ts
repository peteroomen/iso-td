import Phaser from 'phaser';
import { pauseReasons } from './pauseReasons';
import { BASE_H, BASE_W, setViewMetrics, textResolution } from './theme';

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

// ------------------------------------------------------------------------------------------------ backing store
//
// Hi-DPI strategy. Phaser 3 has no `resolution` option, so the game runs in Scale.NONE at the PHYSICAL size of the
// window (CSS size x min(devicePixelRatio, cap), canvas CSS size = window size). Game code keeps its logical space
// (height 720 on wide screens, width 1280 on narrow ones; see viewW / viewH): every scene's main camera is zoomed by
// k = physical px per logical unit with origin (0,0) (`applyViewCamera`), so logical (x, y) lands on physical pixel
// (k x, k y). Pointer coordinates (physical) are converted back with `ptrX / ptrY`. Text resolution follows k.

/** Backing store budget (physical pixels). Lower on low-end devices. Override with ?maxpx=... / ?maxdpr=... for testing. */
function pixelBudget(): number {
  const q = new URLSearchParams(location.search);
  const o = Number(q.get('maxpx'));
  if (o > 0) return o;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowEnd = (nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2;
  return lowEnd ? 1.9e6 : 3.7e6;
}

function maxDpr(): number {
  const o = Number(new URLSearchParams(location.search).get('maxdpr'));
  return o > 0 ? o : 3;
}

export interface Backing {
  /** physical canvas size (backing store) */
  pw: number;
  ph: number;
  /** logical size seen by game code */
  lw: number;
  lh: number;
  /** physical px per logical unit */
  k: number;
}

/** Pure sizing rule: CSS size + devicePixelRatio -> backing store size, logical size and zoom. */
export function computeBacking(cssW: number, cssH: number, dpr: number, budget = pixelBudget(), dprCap = maxDpr()): Backing {
  cssW = Math.max(1, cssW);
  cssH = Math.max(1, cssH);
  let s = Math.min(Math.max(1, dpr || 1), dprCap);
  s = Math.min(s, Math.sqrt(budget / (cssW * cssH)));
  let pw = Math.max(1, Math.round(cssW * s));
  let ph = Math.max(1, Math.round(cssH * s));
  const wide = pw / ph >= BASE_W / BASE_H; // logical canvas: >= 1280x720, grows on one axis to match the aspect
  let k = wide ? ph / BASE_H : pw / BASE_W;
  if (k < 1) {
    // never render below the logical resolution (tiny windows / huge screens over budget): the browser downsamples
    pw = Math.round(pw / k);
    ph = Math.round(ph / k);
    k = 1;
  }
  const lw = wide ? Math.round(pw / k) : BASE_W;
  const lh = wide ? BASE_H : Math.round(ph / k);
  return { pw, ph, lw, lh, k };
}

let cur: Backing = { pw: BASE_W, ph: BASE_H, lw: BASE_W, lh: BASE_H, k: 1 };
let cssSize = { w: BASE_W, h: BASE_H };

const hostOf = (canvas?: HTMLCanvasElement): HTMLElement => canvas?.parentElement ?? document.getElementById('game') ?? document.body;

/** Backing for the current window / host element (used before the game exists, to size the config). */
export function initialBacking(): Backing {
  const host = hostOf();
  const w = host.clientWidth || window.innerWidth || BASE_W;
  const h = host.clientHeight || window.innerHeight || BASE_H;
  return computeBacking(w, h, window.devicePixelRatio);
}

/** Pointer position in logical units (pointer.x / y are physical backing-store pixels). */
export const ptrX = (p: { x: number }): number => p.x / cur.k;
export const ptrY = (p: { y: number }): number => p.y / cur.k;

/** Re-rasterises every Text in the scene (and nested containers) at the current text resolution. */
function syncTextResolution(scene: Phaser.Scene): void {
  const r = textResolution();
  const walk = (list: Phaser.GameObjects.GameObject[]): void => {
    for (const o of list) {
      if (o instanceof Phaser.GameObjects.Text) {
        if (o.style.resolution !== r) o.setResolution(r);
      } else if (o instanceof Phaser.GameObjects.Container) {
        walk(o.list);
      }
    }
  };
  walk(scene.children.list);
}

/**
 * Makes the scene's main camera map logical units to physical pixels. Every scene calls this at the start of `create()`
 * (cameras are rebuilt on scene restart); `installViewport` calls it again for all running scenes on every resize.
 */
export function applyViewCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  const { pw, ph, k } = cur;
  cam.setSize(pw, ph);
  cam.setZoom(k);
  // zoom pivots on the viewport centre; scrolling by (size/k - size)/2 puts logical (0,0) on physical pixel (0,0)
  cam.setScroll((pw / k - pw) / 2, (ph / k - ph) / 2);
  cam.setRoundPixels(false); // would floor the (fractional) scroll
  syncTextResolution(scene);
}

let patched = false;
/** Text created through add.text / make.text without an explicit resolution gets the live one. */
function patchTextFactory(): void {
  if (patched) return;
  patched = true;
  type TextFn = (this: unknown, x: number, y: number, text: unknown, style?: Record<string, unknown>) => unknown;
  for (const proto of [Phaser.GameObjects.GameObjectFactory.prototype, Phaser.GameObjects.GameObjectCreator.prototype] as unknown as Record<string, TextFn>[]) {
    const orig = proto.text;
    proto.text = function (this: unknown, ...a: unknown[]) {
      // GameObjectCreator.text takes a single config object, the factory takes (x, y, text, style)
      if (a.length === 1 && typeof a[0] === 'object') {
        const cfg = a[0] as unknown as { style?: Record<string, unknown> };
        cfg.style = { resolution: textResolution(), ...(cfg.style ?? {}) };
        return (orig as (this: unknown, c: unknown) => unknown).call(this, cfg);
      }
      return orig.call(this, a[0] as number, a[1] as number, a[2], { resolution: textResolution(), ...((a[3] as Record<string, unknown> | undefined) ?? {}) });
    } as TextFn;
  }
}

/** Reads the live canvas size into the theme (GAME_W / GAME_H / PX_PER_UNIT / UI_SCALE / SAFE). */
export function syncViewMetrics(_game?: Phaser.Game): void {
  const cssPerUnit = cur.lh > 0 ? cssSize.h / cur.lh : 1;
  setViewMetrics(cur.lw, cur.lh, cssPerUnit, readInsets(), cur.k);
}

/**
 * Sizes the canvas to the host element: canvas CSS size = host size, backing store = CSS size x capped DPR.
 * Returns true when the logical size or zoom changed.
 */
function fitBacking(game: Phaser.Game): boolean {
  const host = hostOf(game.canvas);
  const cw = host.clientWidth || window.innerWidth;
  const ch = host.clientHeight || window.innerHeight;
  const b = computeBacking(cw, ch, window.devicePixelRatio);
  const st = game.canvas.style;
  st.width = `${cw}px`;
  st.height = `${ch}px`;
  st.flex = 'none';
  const changed = b.lw !== cur.lw || b.lh !== cur.lh || Math.abs(b.k - cur.k) > 1e-4;
  const sizeChanged = game.scale.width !== b.pw || game.scale.height !== b.ph;
  cur = b;
  cssSize = { w: cw, h: ch };
  if (sizeChanged) game.scale.resize(b.pw, b.ph);
  else game.scale.refresh(); // CSS size may have changed: recompute canvasBounds / displayScale for input
  syncViewMetrics(game);
  return changed;
}

/**
 * Keeps the backing store sized to the window and re-lays out the running scenes whenever the logical size changes
 * (window resize, rotation, fullscreen, devicePixelRatio change). Cameras are updated immediately; re-layout is
 * debounced and ignored while the "rotate your device" overlay is up.
 */
export function installViewport(game: Phaser.Game): void {
  patchTextFactory();
  fitBacking(game);
  if (import.meta.env.DEV) (window as unknown as { __viewInfo: () => unknown }).__viewInfo = () => ({ ...cur, css: { ...cssSize }, dpr: window.devicePixelRatio, canvas: [game.canvas.width, game.canvas.height] });
  let timer = 0;
  let lastW = cur.lw;
  let lastH = cur.lh;
  let lastK = cur.k;
  let lastCss = cssSize.h;

  /**
   * Portrait is derived from the live media query every time (never remembered), so a missed or duplicated
   * orientation / resize / fullscreen event can't leave the rotate overlay or the 'portrait' pause reason stuck.
   * Runs immediately on every event (not debounced) so the sim freezes the moment the overlay appears.
   */
  const syncPortrait = (): boolean => {
    const blocked = portraitBlocked();
    document.documentElement.classList.toggle('rotate-needed', blocked);
    pauseReasons.set('portrait', blocked);
    return blocked;
  };

  const relayout = (): void => {
    timer = 0;
    if (syncPortrait()) return; // no re-layout behind the overlay; the layout is unchanged when the phone comes back
    if (cur.lw === lastW && cur.lh === lastH && Math.abs(cur.k - lastK) < 1e-4 && Math.abs(cssSize.h - lastCss) < 0.5) return;
    lastW = cur.lw;
    lastH = cur.lh;
    lastK = cur.k;
    lastCss = cssSize.h;
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

  /** Window / host changed: resize the backing store right away (no stretched frames), re-layout shortly after. */
  let queued = false;
  const applySize = (): void => {
    if (!queued) return; // rAF and the timeout fallback race: whichever comes first does the work
    queued = false;
    fitBacking(game);
    for (const s of game.scene.getScenes(false)) if (s.sys.isActive() || s.sys.isPaused()) applyViewCamera(s);
    syncPortrait();
    schedule();
  };
  const onSize = (): void => {
    syncPortrait();
    if (queued) return;
    queued = true;
    requestAnimationFrame(applySize);
    // rAF is throttled / dropped while the page is hidden or mid fullscreen-transition: never rely on it alone
    window.setTimeout(applySize, 100);
  };

  // app backgrounded: freeze the run and leave the player on the pause menu when they return
  const onVisibility = (): void => {
    if (document.hidden) {
      pauseReasons.add('hidden');
      for (const sc of game.scene.getScenes(true)) (sc as unknown as { onAppHidden?: () => void }).onAppHidden?.();
    } else {
      pauseReasons.remove('hidden');
      onSize(); // the window may have been resized / rotated while away
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onVisibility);
  onVisibility();

  window.addEventListener('resize', onSize);
  window.addEventListener('orientationchange', onSize);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) unlockOrientation(); // left fullscreen by the system (back gesture): release the lock too
    onSize();
  });
  window.visualViewport?.addEventListener('resize', onSize);
  try {
    new ResizeObserver(onSize).observe(hostOf(game.canvas));
  } catch {
    /* old browsers: window resize is enough */
  }
  // browser zoom / moving the window to another monitor changes devicePixelRatio without (always) a resize event
  const watchDpr = (): void => {
    try {
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener(
        'change',
        () => {
          onSize();
          watchDpr();
        },
        { once: true },
      );
    } catch {
      /* ignore */
    }
  };
  watchDpr();
  try {
    window.matchMedia('(orientation: portrait)').addEventListener('change', onSize);
  } catch {
    /* old browsers */
  }
  // safety net for browsers that report a rotation / fullscreen switch late or not at all (Android resizes the window
  // after the orientation event): re-check the live window a few times a second, which is cheap and idempotent
  window.setInterval(() => {
    if (document.hidden) return;
    const host = hostOf(game.canvas);
    const cw = host.clientWidth || window.innerWidth;
    const ch = host.clientHeight || window.innerHeight;
    if (Math.abs(cw - cssSize.w) > 0.5 || Math.abs(ch - cssSize.h) > 0.5) onSize();
    else syncPortrait();
  }, 500);
  syncPortrait();
  schedule();
}

function unlockOrientation(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
}

/** Enter fullscreen (and try to lock landscape on phones); leave it if already fullscreen. */
export function toggleFullscreen(scale: Phaser.Scale.ScaleManager): void {
  if (scale.isFullscreen) {
    scale.stopFullscreen();
    unlockOrientation();
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
