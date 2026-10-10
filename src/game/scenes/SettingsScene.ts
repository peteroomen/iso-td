import Phaser from 'phaser';
import { withSettings } from '../../core';
import { Audio } from '../services/audio';
import { clearSave, getSave, updateSave } from '../services/save';
import { COLORS, GAME_H, GAME_W, textStyle } from '../ui/theme';
import { applyViewCamera, toggleFullscreen } from '../ui/viewport';
import { Button, IconButton, Panel, Slider, confirmModal, drawOutlinedRect, ensureUi } from '../ui/widgets';

export interface SettingsData {
  /** Scene that opened the overlay; it is resumed on close if it was paused. */
  returnTo?: string;
}

const DEPTH = 3000;

/** Modal overlay (launched with `scene.launch('Settings', { returnTo })`) with volume sliders, fullscreen and reset. */
export class SettingsScene extends Phaser.Scene {
  private returnTo?: string;
  private closing = false;
  private busy = false;
  private holder!: Phaser.GameObjects.Container;
  private backdrop!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Settings');
  }

  init(data: SettingsData): void {
    this.returnTo = data?.returnTo;
    this.closing = false;
    this.busy = false;
  }

  create(): void {
    applyViewCamera(this);
    ensureUi(this);
    this.input.setTopOnly(true);
    this.backdrop = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x120c1c, 1).setAlpha(0).setInteractive().setDepth(DEPTH);
    this.tweens.add({ targets: this.backdrop, alpha: 0.68, duration: 180 });

    const W = 780;
    const H = 530;
    this.holder = this.add.container(GAME_W / 2, GAME_H / 2).setDepth(DEPTH + 1);
    const panel = new Panel(this, 0, 0, W, H, { radius: 28 });
    this.holder.add(panel);

    // title ribbon
    const rib = this.add.graphics();
    drawOutlinedRect(rib, -170, -H / 2 - 28, 340, 66, 20, 0xee9a1e, 5);
    rib.fillStyle(0xffd34e, 1);
    rib.fillRoundedRect(-165, -H / 2 - 23, 330, 30, { tl: 16, tr: 16, bl: 4, br: 4 });
    const title = this.add.text(0, -H / 2 + 5, 'Settings', textStyle(40, COLORS.text, { strokeThickness: 8 })).setOrigin(0.5);
    this.holder.add([rib, title]);

    this.audioRow(-H / 2 + 112, 'Music', 'ui_music', 'music');
    this.audioRow(-H / 2 + 198, 'Sound FX', 'ui_sound', 'sfx');
    this.fullscreenRow(-H / 2 + 284);
    this.resetRow(-H / 2 + 370);

    const close = new Button(this, 0, H / 2 - 50, { width: 260, height: 64, label: 'Close', icon: 'ui_check', style: 'primary', fontSize: 32, onClick: () => this.close() });
    this.holder.add(close);

    this.holder.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: this.holder, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.busy) this.close();
    });
    this.backdrop.on('pointerdown', () => {
      if (!this.busy) this.close();
    });
  }

  // -------------------------------------------------------------------------------------------------------------
  // rows
  // -------------------------------------------------------------------------------------------------------------

  private rowFrame(y: number, label: string, icon?: string): void {
    const g = this.add.graphics();
    drawOutlinedRect(g, -340, y - 38, 680, 76, 20, 0x2f2540, 4);
    const t = this.add.text(-258, y, label, textStyle(28, COLORS.text, { strokeThickness: 5 })).setOrigin(0, 0.5);
    this.holder.add([g, t]);
    if (icon) {
      const p = this.add.graphics();
      drawOutlinedRect(p, -332, y - 26, 52, 52, 16, 0x4a3c61, 4);
      this.holder.add([p, this.add.image(-306, y, icon).setDisplaySize(30, 30)]);
    }
  }

  private audioRow(y: number, label: string, icon: string, key: 'music' | 'sfx'): void {
    this.rowFrame(y, label);
    let last = getSave().settings[key] || 0.5;
    const pct = this.add.text(318, y, '', textStyle(26, COLORS.textGold, { strokeThickness: 4 })).setOrigin(1, 0.5);
    const show = (v: number): void => {
      pct.setText(`${Math.round(v * 100)}%`);
    };
    let slider: Slider;
    const mute = new IconButton(
      this,
      -306,
      y,
      icon,
      () => {
        const cur = getSave().settings[key];
        const next = cur > 0 ? 0 : last;
        if (cur > 0) last = cur;
        apply(next);
        slider.setValue(next);
        if (key === 'sfx' && next > 0) Audio.sfx('coin');
      },
      { width: 52, height: 52, iconScale: 0.32, style: 'ghost', silent: true },
    );
    const apply = (v: number): void => {
      updateSave((s) => withSettings(s, { [key]: v }));
      Audio.refreshVolumes();
      show(getSave().settings[key]);
    };
    slider = new Slider(this, 36, y, {
      width: 330,
      value: getSave().settings[key],
      color: key === 'music' ? 0x8fe06a : 0x6fb8ff,
      onChange: (v) => apply(v),
      onRelease: (v) => {
        if (key === 'sfx') Audio.sfx('coin', { throttleMs: 0 });
        else Audio.refreshVolumes();
        if (v > 0) last = v;
      },
    });
    show(getSave().settings[key]);
    this.holder.add([mute, slider, pct]);
  }

  private fullscreenRow(y: number): void {
    this.rowFrame(y, 'Fullscreen', 'ui_fullscreen');
    const available = this.scale.fullscreen.available;
    const btn = new Button(this, 190, y, {
      width: 250,
      height: 54,
      label: this.scale.isFullscreen ? 'Exit' : available ? 'Enter' : 'Unavailable',
      icon: 'ui_fullscreen',
      style: 'secondary',
      fontSize: 26,
      disabled: !available,
      onClick: () => {
        toggleFullscreen(this.scale);
      },
    });
    const sync = (): void => {
      btn.setLabel(this.scale.isFullscreen ? 'Exit' : 'Enter');
    };
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, sync);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, sync);
      this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
    });
    this.holder.add(btn);
  }

  private resetRow(y: number): void {
    this.rowFrame(y, 'Progress', 'ui_star');
    const btn = new Button(this, 190, y, {
      width: 250,
      height: 54,
      label: 'Reset',
      icon: 'ui_reset',
      style: 'danger',
      fontSize: 26,
      onClick: () => this.askReset(),
    });
    this.holder.add(btn);
  }

  // -------------------------------------------------------------------------------------------------------------
  // actions
  // -------------------------------------------------------------------------------------------------------------

  private askReset(): void {
    if (this.busy) return;
    this.busy = true;
    const release = (): void => {
      this.busy = false;
    };
    confirmModal(this, {
      title: 'Reset progress?',
      message: 'This erases all level results, stars and upgrades.',
      confirmLabel: 'Continue',
      danger: true,
      depth: DEPTH + 10,
      height: 310,
      onClose: release,
      onCancel: release,
      onConfirm: () => {
        this.busy = true;
        this.time.delayedCall(220, () => {
          confirmModal(this, {
            title: 'Are you sure?',
            message: 'This cannot be undone. All progress will be lost for good.',
            confirmLabel: 'Erase everything',
            cancelLabel: 'Keep my game',
            danger: true,
            depth: DEPTH + 10,
            height: 310,
            onClose: release,
            onConfirm: () => this.doReset(),
          });
        });
      },
    });
  }

  private doReset(): void {
    clearSave();
    Audio.refreshVolumes();
    Audio.sfx('sell_tower');
    this.busy = true;
    // everything that is currently running/paused (the scene below, an in-game HUD, ...) is stale now
    for (const sc of this.scene.manager.getScenes(false)) {
      const key = sc.sys.settings.key;
      if (key === 'Settings') continue;
      if (sc.sys.isActive() || sc.sys.isPaused() || sc.sys.isSleeping()) this.scene.stop(key);
    }
    this.scene.start('Title');
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.tweens.add({ targets: this.holder, scale: 0.8, alpha: 0, duration: 140, ease: 'Sine.easeIn' });
    this.tweens.add({
      targets: this.backdrop,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        const back = this.returnTo;
        this.scene.stop();
        if (back && this.scene.isPaused(back)) this.scene.resume(back);
      },
    });
  }
}
