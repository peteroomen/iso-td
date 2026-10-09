import Phaser from 'phaser';
import { ENEMIES, type Sim, type Vec2 } from '../../core';
import { Audio } from '../services/audio';
import { COLORS, GAME_H, GAME_W, textStyle } from '../ui/theme';
import { IsoView } from '../render/iso';
import { TEX } from '../render/textures';
import { Hud } from './Hud';
import { DEPTH, markHud } from './widgets';
import type { TipRow, TipSpec } from './Tooltip';

const R = 30;

interface Btn {
  path: number;
  c: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  face: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  shown: boolean;
  hovered: boolean;
  pos: Vec2;
}

/** Pulsing "incoming wave" buttons at the spawn entrances with a countdown ring and a composition tooltip. */
export class WaveCall {
  private readonly btns: Btn[] = [];

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
      const pos = { x: Phaser.Math.Clamp(sp.x, 56, GAME_W - 56), y: Phaser.Math.Clamp(sp.y - 34, 120, GAME_H - 110) };
      const c = scene.add.container(pos.x, pos.y).setDepth(DEPTH.hud + 5).setVisible(false);
      const face = scene.add.graphics();
      const ring = scene.add.graphics();
      const icon = scene.add.image(0, -1, TEX.ufo).setDisplaySize(R * 1.25, R * 1.25);
      const label = scene.add.text(0, R + 16, '', textStyle(20)).setOrigin(0.5);
      c.add([face, icon, ring, label]);
      c.setSize(R * 2 + 12, R * 2 + 12).setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Circle(R + 6, R + 6, R + 6), hitAreaCallback: Phaser.Geom.Circle.Contains });
      markHud(c);
      const btn: Btn = { path: i, c, ring, face, label, shown: false, hovered: false, pos };
      c.on('pointerover', () => {
        btn.hovered = true;
        Audio.sfx('ui_hover', { volume: 0.35, throttleMs: 90 });
        this.hud.tooltip.show(this.tip(), c.x, c.y - R - 8, c.y < 260 ? 'below' : 'above');
      });
      c.on('pointerout', () => {
        btn.hovered = false;
        this.hud.tooltip.hide();
      });
      c.on('pointerdown', () => scene.tweens.add({ targets: c, scale: 0.9, duration: 60 }));
      c.on('pointerup', () => {
        Audio.sfx('ui_click');
        this.hud.tooltip.hide();
        this.onCall();
      });
      this.btns.push(btn);
    });
  }

  private tip(): TipSpec {
    const w = this.sim.state.wave;
    const next = w.next;
    if (!next) return { title: 'No more waves' };
    const rows: TipRow[] = next.entries.map((e) => {
      const def = ENEMIES[e.enemy];
      return { icon: `ufo/${def.sprite}`, iconH: 30, text: def.name, right: `x${e.count}` };
    });
    if (next.hasFlier) rows.push({ text: 'Flying UFOs: knights cannot block them', color: '#9ee6ff', size: 15 });
    if (next.hasBoss) rows.push({ text: 'BOSS WAVE!', color: '#ff8a80', size: 20 });
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
    for (const b of this.btns) {
      const used = !!st.wave.next && st.wave.next.paths.includes(b.path);
      const show = can && used;
      if (show !== b.shown) {
        b.shown = show;
        this.scene.tweens.killTweensOf(b.c);
        if (show) {
          b.c.setVisible(true).setScale(0.2).setAlpha(0);
          this.scene.tweens.add({ targets: b.c, scale: 1, alpha: 1, duration: 360, ease: 'Back.easeOut' });
        } else {
          if (b.hovered) this.hud.tooltip.hide();
          b.hovered = false;
          this.scene.tweens.add({ targets: b.c, scale: 0.2, alpha: 0, duration: 200, ease: 'Back.easeIn', onComplete: () => !b.shown && b.c.setVisible(false) });
        }
      }
      if (!b.c.visible) continue;
      const first = st.wave.index === 0;
      const frac = st.wave.countdown !== null ? Phaser.Math.Clamp(st.wave.countdown / st.wave.countdownMax, 0, 1) : 1;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.007);
      if (!b.hovered && b.shown) b.c.setScale(1 + 0.05 * pulse);
      const g = b.face;
      g.clear();
      const hot = first || (st.wave.earlyBonus > 0 && b.hovered);
      g.fillStyle(0xff7a59, 0.18 + 0.2 * pulse).fillCircle(0, 0, R + 11 + 4 * pulse);
      g.fillStyle(COLORS.ink, 1).fillCircle(0, 0, R + 4);
      g.fillStyle(hot ? 0xe5484d : 0xc23a4a, 1).fillCircle(0, 0, R);
      g.fillStyle(0xffffff, 0.16).fillEllipse(0, -R * 0.45, R * 1.5, R * 0.8);
      const ring = b.ring;
      ring.clear();
      if (!first) {
        ring.lineStyle(7, COLORS.ink, 1).beginPath().arc(0, 0, R + 9, 0, Math.PI * 2).strokePath();
        ring.lineStyle(4, 0xffd34e, 1).beginPath().arc(0, 0, R + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false).strokePath();
      }
      b.label.setText(first ? 'START' : st.wave.countdown !== null ? `${Math.ceil(st.wave.countdown)}s` : '');
      b.label.setColor(first ? COLORS.textGold : COLORS.text);
      if (b.hovered) this.hud.tooltip.show(this.tip(), b.c.x, b.c.y - R - 8, b.c.y < 260 ? 'below' : 'above');
    }
  }
}
