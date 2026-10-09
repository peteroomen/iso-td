/** Shared visual constants. The meta-UI agent owns and may extend this file; keep existing exports stable. */
export const GAME_W = 1280;
export const GAME_H = 720;

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
