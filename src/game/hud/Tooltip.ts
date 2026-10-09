import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W, FONT, UI_SCALE } from '../ui/theme';
import { DEPTH } from './widgets';

export interface TipRow {
  text?: string;
  right?: string;
  color?: string;
  rightColor?: string;
  /** texture key shown at the left of the row */
  icon?: string;
  iconH?: number;
  size?: number;
}

export interface TipSpec {
  title?: string;
  titleColor?: string;
  rows?: TipRow[];
  /** Wrapped paragraph under the rows. */
  note?: string;
  noteColor?: string;
  /** Show a coin + amount line. */
  cost?: { amount: number; ok: boolean; label?: string };
  minWidth?: number;
}

/** Panel look shared with the menu tooltip in ui/widgets.ts: soft drop shadow, ink outline, plum fill, thin gold inner line. */
const TIP_FILL = 0x2b2140;

/** One shared tooltip panel (rebuilt on each show). */
export class Tooltip {
  private readonly box: Phaser.GameObjects.Container;
  private visible = false;
  private sig = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.box = scene.add.container(0, 0).setDepth(DEPTH.tooltip).setVisible(false);
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.sig = '';
    this.scene.tweens.killTweensOf(this.box);
    this.box.setVisible(false);
    this.box.removeAll(true);
  }

  /** `side`: where the tooltip sits relative to the anchor point. */
  show(spec: TipSpec, ax: number, ay: number, side: 'above' | 'below' | 'right' | 'left' = 'above'): void {
    const sig = `${JSON.stringify(spec)}|${Math.round(ax)}|${Math.round(ay)}|${side}`;
    if (this.visible && sig === this.sig) return;
    this.sig = sig;
    this.scene.tweens.killTweensOf(this.box);
    this.box.removeAll(true);
    const s = this.scene;
    const pad = 14;
    const items: Phaser.GameObjects.GameObject[] = [];
    const g = s.add.graphics();
    items.push(g);
    let y = pad - 2;
    let w = spec.minWidth ?? 120;

    const place = (o: Phaser.GameObjects.GameObject & { x: number; y: number }, x: number, yy: number) => {
      o.x = x;
      o.y = yy;
      items.push(o);
    };

    if (spec.title) {
      const t = s.add.text(0, 0, spec.title, { fontFamily: FONT, fontSize: '22px', color: spec.titleColor ?? COLORS.textGold, stroke: '#2e222f', strokeThickness: 4 });
      place(t, pad, y);
      y += t.height + 4;
      w = Math.max(w, t.width + pad * 2);
    }
    const rowLayout: { l?: Phaser.GameObjects.Text; r?: Phaser.GameObjects.Text; icon?: Phaser.GameObjects.Image; y: number; h: number }[] = [];
    for (const row of spec.rows ?? []) {
      const size = row.size ?? 17;
      let x = pad;
      let h = size + 6;
      let icon: Phaser.GameObjects.Image | undefined;
      if (row.icon) {
        icon = s.add.image(0, 0, row.icon);
        const ih = row.iconH ?? 26;
        icon.setScale(ih / icon.height);
        h = Math.max(h, ih + 2);
        x += icon.displayWidth + 6;
      }
      const l = row.text !== undefined ? s.add.text(0, 0, row.text, { fontFamily: FONT, fontSize: `${size}px`, color: row.color ?? COLORS.text, stroke: '#2e222f', strokeThickness: 2 }) : undefined;
      const r = row.right !== undefined ? s.add.text(0, 0, row.right, { fontFamily: FONT, fontSize: `${size}px`, color: row.rightColor ?? COLORS.text, stroke: '#2e222f', strokeThickness: 2 }) : undefined;
      const rowW = x + (l?.width ?? 0) + (r ? 18 + r.width : 0) + pad;
      w = Math.max(w, rowW);
      rowLayout.push({ l, r, icon, y, h });
      if (icon) place(icon, pad + icon.displayWidth / 2, y + h / 2);
      if (l) place(l, x, y + (h - l.height) / 2);
      if (r) items.push(r);
      y += h;
    }
    if (spec.note) {
      const maxW = Math.max(w - pad * 2, 200);
      const n = s.add.text(0, 0, spec.note, { fontFamily: FONT, fontSize: '17px', color: spec.noteColor ?? COLORS.text, wordWrap: { width: maxW }, lineSpacing: 2 });
      place(n, pad, y + 2);
      y += n.height + 6;
      w = Math.max(w, n.width + pad * 2);
    }
    if (spec.cost) {
      const coin = s.add.image(0, 0, 'i_coin').setScale(24 / 64);
      const label = spec.cost.label ?? '';
      const t = s.add.text(0, 0, `${label}${spec.cost.amount}`, { fontFamily: FONT, fontSize: '22px', color: spec.cost.ok ? COLORS.textGold : COLORS.textRed, stroke: '#2e222f', strokeThickness: 4 });
      y += 4;
      place(coin, pad + 12, y + 14);
      place(t, pad + 30, y + 14 - t.height / 2);
      y += 28;
      w = Math.max(w, pad * 2 + 30 + t.width);
    }
    y += pad;
    for (const r of rowLayout) {
      if (r.r) r.r.setPosition(w - pad - r.r.width, r.y + (r.h - r.r.height) / 2);
    }
    g.fillStyle(COLORS.ink, 0.35).fillRoundedRect(3, 6, w, y, 12);
    g.fillStyle(COLORS.ink, 1).fillRoundedRect(0, 0, w, y, 12);
    g.fillStyle(TIP_FILL, 0.97).fillRoundedRect(4, 4, w - 8, y - 8, 9.6);
    g.lineStyle(2, COLORS.gold, 0.55).strokeRoundedRect(5, 5, w - 10, y - 10, 8);
    this.box.add(items);

    // small screens: grow the panel so the text stays readable
    const k = Math.min(UI_SCALE, 1.5);
    const W = w * k;
    const H = y * k;
    let x = ax;
    let yy = ay;
    if (side === 'above') {
      x = ax - W / 2;
      yy = ay - H - 10;
    } else if (side === 'below') {
      x = ax - W / 2;
      yy = ay + 10;
    } else if (side === 'right') {
      x = ax + 12;
      yy = ay - H / 2;
    } else {
      x = ax - W - 12;
      yy = ay - H / 2;
    }
    x = Phaser.Math.Clamp(x, 6, GAME_W - W - 6);
    yy = Phaser.Math.Clamp(yy, 6, GAME_H - H - 6);
    this.box.setScale(k).setPosition(x, yy).setVisible(true).setAlpha(0);
    this.visible = true;
    s.tweens.add({ targets: this.box, alpha: 1, duration: 110 });
  }
}
