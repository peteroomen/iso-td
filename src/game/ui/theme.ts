/** Shared visual constants. The meta-UI agent owns and may extend this file; keep existing exports stable. */
/** Base ("design") size: the logical canvas is never smaller than this; EXPAND grows one side to match the device aspect. */
export const BASE_W = 1280;
export const BASE_H = 720;

/**
 * Live logical canvas size. These are ES live bindings: they are updated by `setViewMetrics` whenever the
 * canvas is resized, so importers always read the current size (prefer `viewW(scene)` / `viewH(scene)` in scenes).
 */
export let GAME_W = BASE_W;
export let GAME_H = BASE_H;
/** CSS pixels per logical unit (<1 on phones, where the 1280x720 design is shrunk). */
export let CSS_PER_UNIT = 1;
/** Extra scale for in-game HUD elements so touch targets stay >= ~44 CSS px on small screens. */
export let UI_SCALE = 1;
/** Safe-area insets (notch, rounded corners, home bar) in logical units. */
export const SAFE = { l: 0, t: 0, r: 0, b: 0 };

/** Target size of the smallest HUD button in CSS px (the bar buttons are 46 logical px tall at UI_SCALE 1). */
const MIN_TOUCH_CSS = 46;

export function setViewMetrics(w: number, h: number, cssPerUnit: number, insetsCss = { l: 0, t: 0, r: 0, b: 0 }): void {
  GAME_W = w;
  GAME_H = h;
  CSS_PER_UNIT = cssPerUnit > 0 ? cssPerUnit : 1;
  UI_SCALE = Math.min(1.8, Math.max(1, MIN_TOUCH_CSS / (46 * CSS_PER_UNIT)));
  SAFE.l = Math.round(insetsCss.l / CSS_PER_UNIT);
  SAFE.t = Math.round(insetsCss.t / CSS_PER_UNIT);
  SAFE.r = Math.round(insetsCss.r / CSS_PER_UNIT);
  SAFE.b = Math.round(insetsCss.b / CSS_PER_UNIT);
}

/** Live logical width / height of the canvas. */
export const viewW = (scene: { scale: { width: number } }): number => scene.scale.width;
export const viewH = (scene: { scale: { height: number } }): number => scene.scale.height;
/** Offsets that centre the 1280x720 design area inside the live canvas. */
export const designOffsetX = (scene: { scale: { width: number } }): number => (scene.scale.width - BASE_W) / 2;
export const designOffsetY = (scene: { scale: { height: number } }): number => (scene.scale.height - BASE_H) / 2;

export const FONT = '"Lilita One", "Trebuchet MS", sans-serif';

export const COLORS = {
  ink: 0x2e222f, // outline colour used by the sprite pack
  panel: 0x3d3150,
  panelLight: 0x584a73,
  gold: 0xffd34e,
  red: 0xe5484d,
  green: 0x6cc24a,
  blue: 0x4c8bf5,
  cream: 0xfff4d6,
  text: '#fff4d6',
  textDark: '#2e222f',
  textGold: '#ffd34e',
  textRed: '#ff6b6b',
} as const;

/** Standard text style factory. */
export function textStyle(size: number, color: string = COLORS.text, extra: Record<string, unknown> = {}) {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    stroke: '#2e222f',
    strokeThickness: Math.max(2, Math.round(size / 6)),
    // render text at 2x so it stays crisp when the canvas is FIT-scaled up
    resolution: 2,
    ...extra,
  };
}
