import Phaser from 'phaser';
import { ENEMIES, withSeenEnemies, type EnemyId, type Sim } from '../../core';
import { Audio } from '../services/audio';
import { getSave, updateSave } from '../services/save';
import { COLORS, FONT, GAME_H, GAME_W, textStyle } from '../ui/theme';
import { ENEMY_BLURB, statLine, traitsOf } from './enemyInfo';
import { DEPTH, UiButton, drawPanel, markHud } from './widgets';

const W = 372;
const PAD = 14;
const PORTRAIT_W = 112;
const PORTRAIT_H = 104;
const MAX_CHIPS = 5;
/** Delay after the level starts before the first card slides in (lets the level banner finish). */
const START_DELAY = 1800;
/** Delay after the previous wave finished spawning. */
const WAVE_DELAY = 700;
/** The card tucks itself away after this long if nobody clicked it, so it never hogs the map. */
const AUTO_HIDE = 16000;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Pending {
  number: number;
  ids: EnemyId[];
  queue: EnemyId[];
  done: boolean;
  readySince: number;
}

const unseen = (id: string): boolean => !getSave().seenEnemies.includes(id);

/** Marks enemies as seen in the save (no write when nothing changes). */
export function markEnemiesSeen(ids: readonly string[]): void {
  if (ids.some(unseen)) updateSave((s) => withSeenEnemies(s, ids));
}

/**
 * Kingdom-Rush style "new enemy" card. When the next wave contains a UFO the player has never met it slides
 * in at a free corner of the screen once the previous wave finished spawning (or shortly after level start).
 * It never pauses the game; "Got it" (or the wave starting) marks the enemies as seen.
 */
export class EnemyIntro {
  private card?: Phaser.GameObjects.Container;
  private cur: Pending | null = null;
  private lastIndex = -1;
  private hideAt = 0;
  private shownId: EnemyId | null = null;
  private disabled = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: Sim,
    /** Screen rectangles the card should not cover (wave call buttons). */
    private readonly avoid: () => Rect[],
  ) {}

  get visible(): boolean {
    return !!this.card;
  }

  /** Stop showing cards (battle over). */
  disable(): void {
    this.disabled = true;
    this.hide(true);
  }

  update(time: number): void {
    if (this.disabled) return;
    const st = this.sim.state;
    const w = st.wave;
    if (w.index !== this.lastIndex) {
      if (this.lastIndex >= 0) {
        // the wave that was "next" has started: whatever was in it counts as seen now
        if (this.cur) markEnemiesSeen(this.cur.ids);
        this.hide(false);
      }
      this.lastIndex = w.index;
      this.cur = null;
    }
    if (!this.cur) {
      if (!w.next) return;
      const ids = w.next.entries.map((e) => e.enemy);
      this.cur = { number: w.next.number, ids, queue: ids.filter(unseen), done: false, readySince: -1 };
    }
    const c = this.cur;
    if (c.done || c.queue.length === 0) return;
    if (this.card) {
      if (time > this.hideAt) {
        c.done = true;
        this.hide(false);
      }
      return;
    }
    const ready = st.status === 'pre' ? true : st.status === 'running' && !w.spawning;
    if (!ready) {
      c.readySince = -1;
      return;
    }
    if (c.readySince < 0) c.readySince = time;
    if (time - c.readySince >= (st.status === 'pre' ? START_DELAY : WAVE_DELAY)) this.show(c.queue[0], time);
  }

  // ----------------------------------------------------------------------------------------- card

  private place(h: number): { x: number; y: number } {
    const spots = [
      { x: GAME_W - W - 14, y: GAME_H - h - 14 },
      { x: GAME_W - W - 14, y: 76 },
      { x: 14, y: 76 },
    ];
    const bad = this.avoid();
    for (const s of spots) {
      const hit = bad.some((r) => s.x < r.x + r.w && s.x + W > r.x && s.y < r.y + r.h && s.y + h > r.y);
      if (!hit) return s;
    }
    return spots[0];
  }

  private show(id: EnemyId, time: number): void {
    this.hide(true);
    const s = this.scene;
    const def = ENEMIES[id];
    const card = s.add.container(0, 0).setDepth(DEPTH.bar + 2);
    markHud(card);
    this.card = card;
    this.shownId = id;
    this.hideAt = time + AUTO_HIDE;

    const body = s.add.graphics();
    const backing = s.add.rectangle(0, 0, 10, 10, 0, 0).setOrigin(0).setInteractive();
    markHud(backing);

    // portrait
    const px = PAD;
    const py = 24;
    const portrait = s.add.graphics();
    portrait.fillStyle(COLORS.ink, 1).fillRoundedRect(px - 3, py - 3, PORTRAIT_W + 6, PORTRAIT_H + 6, 16);
    portrait.fillStyle(0x5b4d78, 1).fillRoundedRect(px, py, PORTRAIT_W, PORTRAIT_H, 13);
    portrait.fillStyle(0x4a3d63, 1).fillRoundedRect(px, py + PORTRAIT_H * 0.55, PORTRAIT_W, PORTRAIT_H * 0.45, { tl: 0, tr: 0, bl: 13, br: 13 });
    portrait.fillStyle(0xffffff, 0.1).fillRoundedRect(px + 3, py + 3, PORTRAIT_W - 6, 24, 10);
    const shadow = s.add.ellipse(px + PORTRAIT_W / 2, py + PORTRAIT_H - 12, PORTRAIT_W * 0.5, 14, 0x000000, 0.35);
    const sprite = s.add.image(px + PORTRAIT_W / 2, py + PORTRAIT_H - 16, `ufo/${def.sprite}`).setOrigin(0.5, 0.85);
    const fit = Math.min((PORTRAIT_W - 16) / sprite.width, (PORTRAIT_H - 16) / sprite.height);
    sprite.setScale(fit);
    s.tweens.add({ targets: sprite, y: sprite.y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // text
    const tx = px + PORTRAIT_W + 14;
    const name = s.add.text(tx, py - 4, def.name, textStyle(30, COLORS.textGold)).setOrigin(0, 0);
    const blurb = s.add.text(tx, py + 36, ENEMY_BLURB[id], { fontFamily: FONT, fontSize: '17px', color: '#e9dfff', wordWrap: { width: W - tx - PAD }, lineSpacing: 2 });

    // trait chips (flow layout)
    const chips = s.add.container(0, 0);
    const cg = s.add.graphics();
    chips.add(cg);
    let cx = PAD;
    let cy = py + PORTRAIT_H + 12;
    const rowH = 32;
    const maxX = W - PAD;
    for (const t of traitsOf(id).slice(0, MAX_CHIPS)) {
      const label = s.add.text(0, 0, t.label, textStyle(16, COLORS.text, { strokeThickness: 2 })).setOrigin(0, 0.5);
      const icon = s.add.image(0, 0, t.icon);
      icon.setScale(20 / icon.height);
      const cw = 8 + 20 + 5 + label.width + 10;
      if (cx + cw > maxX && cx > PAD) {
        cx = PAD;
        cy += rowH;
      }
      drawPanel(cg, cx, cy, cw, 26, { r: 9, fill: t.color, bw: 2.5, gloss: false });
      icon.setPosition(cx + 8 + 10, cy + 13);
      label.setPosition(cx + 8 + 20 + 5, cy + 13);
      chips.add([icon, label]);
      cx += cw + 8;
    }
    const hasChips = traitsOf(id).length > 0;
    const footerY = cy + (hasChips ? rowH : 0) + 8;
    const stats = s.add.text(PAD, footerY + 19, statLine(id), textStyle(15, '#b9aee0', { strokeThickness: 0 })).setOrigin(0, 0.5);
    const btn = new UiButton(s, W - PAD - 52, footerY + 19, {
      w: 104,
      h: 40,
      label: 'Got it',
      fontSize: 22,
      fill: 0x4d9a3f,
      radius: 12,
      keepMenu: true,
      onClick: () => this.dismiss(),
    });
    const h = footerY + 38 + PAD;
    drawPanel(body, 0, 0, W, h, { r: 18, fill: 0x3d3150, bw: 4 });
    backing.setSize(W, h);

    // "NEW UFO" tab
    const tabW = 118;
    const tab = s.add.graphics();
    tab.fillStyle(COLORS.ink, 1).fillRoundedRect(PAD - 4, -17, tabW + 8, 34, 12);
    tab.fillStyle(0xc23a4a, 1).fillRoundedRect(PAD, -13, tabW, 26, 9);
    tab.fillStyle(0xffffff, 0.16).fillRoundedRect(PAD + 3, -11, tabW - 6, 10, 6);
    const queueLen = this.cur?.queue.length ?? 1;
    const tabText = s.add.text(PAD + tabW / 2, 0, boss(def.boss, queueLen), textStyle(17, COLORS.textGold)).setOrigin(0.5);

    card.add([body, backing, portrait, shadow, sprite, name, blurb, chips, stats, btn, tab, tabText]);

    const pos = this.place(h);
    const offX = pos.x > GAME_W / 2 ? GAME_W + 20 : -W - 20;
    card.setPosition(offX, pos.y).setAlpha(0);
    s.tweens.add({ targets: card, x: pos.x, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    Audio.sfx('ui_click', { volume: 0.4, throttleMs: 200 });
    (card as { __sprite?: Phaser.GameObjects.Image }).__sprite = sprite;
  }

  private dismiss(): void {
    const c = this.cur;
    const id = this.shownId;
    if (!c || !id) {
      this.hide(false);
      return;
    }
    markEnemiesSeen([id]);
    c.queue = c.queue.filter((q) => q !== id);
    Audio.sfx('ui_click', { volume: 0.4 });
    if (c.queue.length > 0) {
      this.hide(true);
      this.show(c.queue[0], this.scene.time.now);
    } else {
      c.done = true;
      this.hide(false);
    }
  }

  private hide(instant: boolean): void {
    const card = this.card;
    if (!card) return;
    this.card = undefined;
    this.shownId = null;
    const spr = (card as { __sprite?: Phaser.GameObjects.Image }).__sprite;
    if (spr) this.scene.tweens.killTweensOf(spr);
    this.scene.tweens.killTweensOf(card);
    if (instant) {
      card.destroy();
      return;
    }
    for (const o of card.list) if ((o as Phaser.GameObjects.GameObject).input) (o as Phaser.GameObjects.GameObject).disableInteractive();
    this.scene.tweens.add({
      targets: card,
      x: card.x > GAME_W / 2 ? GAME_W + 20 : -W - 20,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => card.destroy(),
    });
  }

  destroy(): void {
    this.hide(true);
  }
}

function boss(isBoss: boolean, queued: number): string {
  const base = isBoss ? 'NEW BOSS!' : 'NEW UFO!';
  return queued > 1 ? `${base} +${queued - 1}` : base;
}
