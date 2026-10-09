import Phaser from 'phaser';
import type { AbilityId, Sim } from '../../core';
import { Audio } from '../services/audio';
import { COLORS, GAME_H, textStyle } from '../ui/theme';
import { TEX } from '../render/textures';
import { Hud } from './Hud';
import { DEPTH, markHud } from './widgets';

const R = 36;

interface Slot {
  id: AbilityId;
  c: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Image;
  base: Phaser.GameObjects.Graphics;
  sweep: Phaser.GameObjects.Graphics;
  timeText: Phaser.GameObjects.Text;
  ring: Phaser.GameObjects.Graphics;
  wasReady: boolean;
  hovered: boolean;
  pressed: boolean;
}

/** Orbital Strike + Reinforcements buttons with radial cooldown sweep, ready glow and hotkeys. */
export class AbilityBar {
  private readonly slots: Slot[] = [];
  private armed: AbilityId | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: Sim,
    private readonly hud: Hud,
    onPick: (id: AbilityId) => void,
  ) {
    const defs: { id: AbilityId; icon: string; key: string; x: number }[] = [
      { id: 'orbital', icon: TEX.orbital, key: '1', x: 14 + R + 4 },
      { id: 'reinforce', icon: TEX.reinforce, key: '2', x: 14 + R + 4 + R * 2 + 18 },
    ];
    const y = GAME_H - 14 - R - 4;
    for (const d of defs) {
      const c = scene.add.container(d.x, y).setDepth(DEPTH.hud);
      const glow = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe27a).setDisplaySize(R * 3.4, R * 3.4).setAlpha(0);
      const base = scene.add.graphics();
      const icon = scene.add.image(0, -1, d.icon).setDisplaySize(R * 1.25, R * 1.25);
      const sweep = scene.add.graphics();
      const ring = scene.add.graphics();
      const timeText = scene.add.text(0, 0, '', textStyle(26)).setOrigin(0.5);
      const badge = scene.add.graphics();
      badge.fillStyle(COLORS.ink, 1).fillCircle(R * 0.68, R * 0.68, 13);
      badge.fillStyle(0xfff4d6, 1).fillCircle(R * 0.68, R * 0.68, 10);
      const keyText = scene.add.text(R * 0.68, R * 0.68 + 1, d.key, textStyle(15, '#2e222f', { strokeThickness: 0 })).setOrigin(0.5);
      c.add([glow, base, icon, sweep, ring, timeText, badge, keyText]);
      c.setSize(R * 2, R * 2).setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Circle(R, R, R), hitAreaCallback: Phaser.Geom.Circle.Contains });
      markHud(c);
      const slot: Slot = { id: d.id, c, glow, base, sweep, timeText, ring, wasReady: true, hovered: false, pressed: false };
      c.on('pointerover', () => {
        slot.hovered = true;
        scene.tweens.add({ targets: c, scale: 1.08, duration: 110, ease: 'Quad.easeOut' });
        Audio.sfx('ui_hover', { volume: 0.35, throttleMs: 90 });
        this.hud.tooltip.show(this.tip(d.id, d.key), c.x, c.y - R - 6, 'above');
      });
      c.on('pointerout', () => {
        slot.hovered = false;
        slot.pressed = false;
        scene.tweens.add({ targets: c, scale: 1, duration: 110 });
        this.hud.tooltip.hide();
      });
      c.on('pointerdown', () => {
        slot.pressed = true;
        scene.tweens.add({ targets: c, scale: 0.94, duration: 60 });
      });
      c.on('pointerup', () => {
        if (!slot.pressed) return;
        slot.pressed = false;
        scene.tweens.add({ targets: c, scale: 1.08, duration: 80, ease: 'Back.easeOut' });
        onPick(d.id);
      });
      this.slots.push(slot);
    }
  }

  private tip(id: AbilityId, key: string) {
    const ab = this.sim.state.abilities;
    if (id === 'orbital') {
      const o = ab.orbital;
      return {
        title: 'Orbital Strike',
        rows: [
          { text: 'Damage', right: `${Math.round(o.damage)} true` },
          { text: 'Radius', right: `${o.radius.toFixed(1)} tiles` },
          { text: 'Cooldown', right: `${Math.round(o.cooldownMax)}s` },
          ...(o.burn ? [{ text: 'Leaves burning ground', color: '#ffb35c' }] : []),
        ],
        note: `A beam from orbit hits every UFO in the circle, fliers and bosses too. Hotkey ${key}.`,
      };
    }
    const r = ab.reinforce;
    return {
      title: 'Reinforcements',
      rows: [
        { text: 'Militia', right: `${r.count}` },
        { text: 'Health', right: `${Math.round(r.hp)} each` },
        { text: 'Lasts', right: `${Math.round(r.duration)}s` },
        { text: 'Cooldown', right: `${Math.round(r.cooldownMax)}s` },
      ],
      note: `Drops militia anywhere close to the road to block ground UFOs. Hotkey ${key}.`,
    };
  }

  setArmed(id: AbilityId | null): void {
    this.armed = id;
  }

  /** Position of an ability button centre (for effects). */
  slotPos(id: AbilityId): { x: number; y: number } {
    const s = this.slots.find((q) => q.id === id)!;
    return { x: s.c.x, y: s.c.y };
  }

  update(time: number): void {
    const st = this.sim.state;
    for (const s of this.slots) {
      const ab = st.abilities[s.id];
      const usable = st.status === 'running';
      const ready = ab.cooldown <= 0 && usable;
      const armed = this.armed === s.id;
      const f = ab.cooldownMax > 0 ? Phaser.Math.Clamp(ab.cooldown / ab.cooldownMax, 0, 1) : 0;
      // base disc
      const base = s.base;
      base.clear();
      const fill = armed ? 0x6f5aa0 : ready ? 0x4b3b6b : 0x2f2540;
      base.fillStyle(COLORS.ink, 1).fillCircle(0, 0, R + 4);
      base.fillStyle(fill, 1).fillCircle(0, 0, R);
      base.fillStyle(0xffffff, ready ? 0.12 : 0.06).fillEllipse(0, -R * 0.45, R * 1.5, R * 0.8);
      // cooldown sweep
      const sw = s.sweep;
      sw.clear();
      if (f > 0.001) {
        sw.fillStyle(0x0d0816, 0.68);
        sw.slice(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false);
        sw.fillPath();
      } else if (!usable) {
        sw.fillStyle(0x0d0816, 0.5).fillCircle(0, 0, R);
      }
      s.timeText.setText(f > 0.001 ? String(Math.ceil(ab.cooldown)) : '');
      // ring
      const ring = s.ring;
      ring.clear();
      if (armed) {
        ring.lineStyle(5, 0xffe27a, 1).strokeCircle(0, 0, R + 6);
      } else if (ready) {
        ring.lineStyle(3, 0xffe27a, 0.5 + 0.4 * Math.sin(time * 0.006)).strokeCircle(0, 0, R + 5);
      }
      s.glow.setAlpha(armed ? 0.6 : ready ? 0.22 + 0.18 * Math.sin(time * 0.006) : 0);
      if (ready && !s.wasReady && st.status === 'running') {
        this.scene.tweens.add({ targets: s.c, scale: { from: 1.35, to: s.hovered ? 1.08 : 1 }, duration: 380, ease: 'Back.easeOut' });
      }
      s.wasReady = ready;
      s.c.setAlpha(usable ? 1 : 0.7);
    }
  }
}
