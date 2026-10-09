import Phaser from 'phaser';
import { ENEMIES, type EnemyId, type Sim, type Vec2 } from '../../core';
import { getSave } from '../services/save';
import { Audio } from '../services/audio';
import { COLORS, GAME_H, GAME_W, SAFE, UI_SCALE, textStyle } from '../ui/theme';
import { IsoView } from '../render/iso';
import { TEX } from '../render/textures';
import { Hud, barBottom } from './Hud';
import { DEPTH, markHud } from './widgets';
import { traitsOf } from './enemyInfo';
import type { TipRow, TipSpec } from './Tooltip';

const R = 30;

interface Btn {
  path: number;
  c: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  face: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  shown: boolean;
  hovered: boolean;
  pos: Vec2;
  /** Cached draw keys so Graphics are only redrawn when something visibly changed. */
  faceKey: number;
  ringKey: number;
}

const isNew = (id: EnemyId): boolean => !getSave().seenEnemies.includes(id);

/** Pulsing "incoming wave" buttons at the spawn entrances with a countdown ring and a composition tooltip. */
export class WaveCall {
  private readonly btns: Btn[] = [];
  private tipKey = '';
  private freshKey = '';
  private fresh = false;
  private readonly wu = Math.min(UI_SCALE, 1.4);

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: Sim,
    view: IsoView,
    private readonly hud: Hud,
    private readonly onCall: () => void,
  ) {
    sim.paths.forEach((p, i) => {
      const a = p.pts[0];
      const b = p.pts[1];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const out = { x: a.x + ((a.x - b.x) / l) * 0.55, y: a.y + ((a.y - b.y) / l) * 0.55 };
      const sp = view.toScreen(out.x, out.y);
      const wu = this.wu;
      const pos = { x: Phaser.Math.Clamp(sp.x, 56 * wu + SAFE.l, GAME_W - 56 * wu - SAFE.r), y: Phaser.Math.Clamp(sp.y - 34 * wu, barBottom() + 64 * wu, GAME_H - 110 * wu - SAFE.b) };
      const c = scene.add.container(pos.x, pos.y).setDepth(DEPTH.hud + 5).setVisible(false).setScale(wu);
      const glow = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7a59).setDisplaySize((R + 18) * 2, (R + 18) * 2);
      const face = scene.add.graphics();
      const ring = scene.add.graphics();
      const icon = scene.add.image(0, -1, TEX.ufo).setDisplaySize(R * 1.25, R * 1.25);
      const label = scene.add.text(0, R + 16, '', textStyle(20)).setOrigin(0.5);
      const badge = scene.add.container(R * 0.78, -R * 0.78).setVisible(false);
      const bg = scene.add.graphics();
      bg.fillStyle(COLORS.ink, 1).fillCircle(0, 0, 13);
      bg.fillStyle(COLORS.gold, 1).fillCircle(0, 0, 10);
      badge.add([bg, scene.add.text(0, 1, '!', textStyle(17, '#2e222f', { strokeThickness: 0 })).setOrigin(0.5)]);
      c.add([glow, face, icon, ring, label, badge]);
      c.setSize(R * 2 + 12, R * 2 + 12).setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Circle(R + 6, R + 6, R + 6), hitAreaCallback: Phaser.Geom.Circle.Contains });
      markHud(c);
      const btn: Btn = { path: i, c, ring, face, glow, badge, label, shown: false, hovered: false, pos, faceKey: -1, ringKey: -1 };
      c.on('pointerover', () => {
        btn.hovered = true;
        Audio.sfx('ui_hover', { volume: 0.35, throttleMs: 90 });
        this.showTip(btn);
      });
      c.on('pointerout', () => {
        btn.hovered = false;
        this.tipKey = '';
        this.hud.tooltip.hide();
      });
      c.on('pointerdown', () => scene.tweens.add({ targets: c, scale: 0.9 * wu, duration: 60 }));
      c.on('pointerup', () => {
        Audio.sfx('ui_click');
        this.hud.tooltip.hide();
        this.onCall();
      });
      this.btns.push(btn);
    });
  }

  /** Screen rectangles occupied by the call buttons (other HUD pieces avoid covering them). */
  avoidRects(): { x: number; y: number; w: number; h: number }[] {
    const k = this.wu;
    return this.btns.map((b) => ({ x: b.pos.x - (R + 16) * k, y: b.pos.y - (R + 16) * k, w: (R + 16) * 2 * k, h: ((R + 16) * 2 + 34) * k }));
  }

  private showTip(b: Btn): void {
    // near the top of the screen the tip drops under the button (and its countdown label), otherwise it sits above
    if (b.c.y < 260) this.hud.tooltip.show(this.tip(), b.c.x, b.c.y + (R + 34) * this.wu, 'below');
    else this.hud.tooltip.show(this.tip(), b.c.x, b.c.y - (R + 8) * this.wu, 'above');
  }

  private tip(): TipSpec {
    const w = this.sim.state.wave;
    const next = w.next;
    if (!next) return { title: 'No more waves' };
    const fresh = next.entries.filter((e) => isNew(e.enemy));
    const rows: TipRow[] = next.entries.map((e) => {
      const def = ENEMIES[e.enemy];
      const n = isNew(e.enemy);
      return { icon: `ufo/${def.sprite}`, iconH: 30, text: n ? `${def.name}  NEW!` : def.name, color: n ? COLORS.textGold : undefined, right: `x${e.count}` };
    });
    if (next.hasFlier) rows.push({ text: 'Flying UFOs: knights cannot block them', color: '#9ee6ff', size: 15 });
    if (next.hasBoss) rows.push({ text: 'BOSS WAVE!', color: '#ff8a80', size: 20 });
    for (const e of fresh) {
      if (fresh.length > 1) rows.push({ text: ENEMIES[e.enemy].name, color: COLORS.textGold, size: 15 });
      for (const t of traitsOf(e.enemy).slice(0, 3)) rows.push({ icon: t.icon, iconH: 18, text: t.label, color: t.text, size: 15 });
    }
    const first = w.index === 0;
    return {
      title: first ? 'Start the invasion' : `Wave ${next.number} of ${w.total}`,
      rows,
      note: first ? 'Click to send the first wave.' : w.earlyBonus > 0 ? `Call early for +${w.earlyBonus} gold and faster abilities.` : 'Click to call it now.',
      noteColor: w.earlyBonus > 0 ? COLORS.textGold : undefined,
    };
  }

  update(time: number): void {
    const st = this.sim.state;
    const can = this.sim.canCallNextWave().ok && !!st.wave.next;
    const next = st.wave.next;
    const fk = `${next?.number ?? 0}|${getSave().seenEnemies.length}`;
    if (fk !== this.freshKey) {
      this.freshKey = fk;
      this.fresh = !!next && next.entries.some((e) => isNew(e.enemy));
    }
    const first = st.wave.index === 0;
    const frac = st.wave.countdown !== null ? Phaser.Math.Clamp(st.wave.countdown / st.wave.countdownMax, 0, 1) : 1;
    const secs = st.wave.countdown !== null ? Math.ceil(st.wave.countdown) : -1;
    for (const b of this.btns) {
      const used = !!next && next.paths.includes(b.path);
      const show = can && used;
      if (show !== b.shown) {
        b.shown = show;
        this.scene.tweens.killTweensOf(b.c);
        if (show) {
          b.c.setVisible(true).setScale(0.2 * this.wu).setAlpha(0);
          this.scene.tweens.add({ targets: b.c, scale: this.wu, alpha: 1, duration: 360, ease: 'Back.easeOut' });
        } else {
          if (b.hovered) this.hud.tooltip.hide();
          b.hovered = false;
          this.scene.tweens.add({ targets: b.c, scale: 0.2, alpha: 0, duration: 200, ease: 'Back.easeIn', onComplete: () => !b.shown && b.c.setVisible(false) });
        }
      }
      if (!b.c.visible) continue;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.007);
      if (!b.hovered && b.shown) b.c.setScale(this.wu * (1 + 0.05 * pulse));
      b.glow.setAlpha(0.35 + 0.4 * pulse);
      b.badge.setVisible(this.fresh).setScale(1 + 0.12 * pulse);
      const hot = first || (st.wave.earlyBonus > 0 && b.hovered);
      const faceKey = hot ? 1 : 0;
      if (faceKey !== b.faceKey) {
        b.faceKey = faceKey;
        const g = b.face;
        g.clear();
        g.fillStyle(COLORS.ink, 1).fillCircle(0, 0, R + 4);
        g.fillStyle(hot ? 0xe5484d : 0xc23a4a, 1).fillCircle(0, 0, R);
        g.fillStyle(0xffffff, 0.16).fillEllipse(0, -R * 0.45, R * 1.5, R * 0.8);
      }
      // countdown ring: redrawn only when the arc moves by about 2 degrees
      const ringKey = first ? 0 : 1 + Math.round(frac * 180);
      if (ringKey !== b.ringKey) {
        b.ringKey = ringKey;
        const ring = b.ring;
        ring.clear();
        if (!first) {
          ring.lineStyle(7, COLORS.ink, 1).beginPath().arc(0, 0, R + 9, 0, Math.PI * 2).strokePath();
          ring.lineStyle(4, 0xffd34e, 1).beginPath().arc(0, 0, R + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false).strokePath();
        }
      }
      b.label.setText(first ? 'START' : secs >= 0 ? `${secs}s` : '');
      const col = first ? COLORS.textGold : COLORS.text;
      if (b.label.style.color !== col) b.label.setColor(col); // setColor re-renders the text canvas, so only on change
      if (b.hovered) {
        // the tooltip text only changes when the wave or the seconds tick over
        const key = `${next?.number ?? 0}|${secs}|${this.fresh}`;
        if (key !== this.tipKey) {
          this.tipKey = key;
          this.showTip(b);
        }
      }
    }
  }
}
