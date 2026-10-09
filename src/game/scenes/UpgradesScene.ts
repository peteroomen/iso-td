import Phaser from 'phaser';
import {
  MAX_TIER,
  TIER_COSTS,
  TRACK_INFO,
  UPGRADE_TRACKS,
  buyTier,
  canBuyTier,
  resetUpgrades,
  starsAvailable,
  starsEarned,
  starsSpent,
  type SaveData,
  type UpgradeTrack,
} from '../../core';
import { Audio } from '../services/audio';
import { getSave, updateSave } from '../services/save';
import { COLORS, GAME_W, textStyle } from '../ui/theme';
import { addSky } from '../ui/background';
import {
  Button,
  Tooltip,
  addHeaderBar,
  confirmModal,
  drawOutlinedRect,
  ensureUi,
  fadeIn,
  fadeTo,
  lighten,
  ringPulse,
  sparkBurst,
  starChip,
  tweenNumber,
} from '../ui/widgets';
import { fitImage } from './metaData';

export interface UpgradesData {
  /** Scene key to return to (default 'LevelSelect'). */
  returnTo?: string;
}

type TierState = 'owned' | 'buyable' | 'expensive' | 'locked';

interface TierView {
  track: UpgradeTrack;
  tier: number; // 0..2
  root: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
  desc: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
  costStar: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  state: TierState;
  pulse?: Phaser.Tweens.Tween;
}

interface Column {
  track: UpgradeTrack;
  pips: Phaser.GameObjects.Graphics;
  tiers: TierView[];
  root: Phaser.GameObjects.Container;
}

const CARD_W = 218;
const CARD_GAP = 18;
const CARD_TOP = 114;
const CARD_H = 552;
const NODE_W = 192;
const NODE_H = 104;
const NODE_YS = [378, 490, 602];

export class UpgradesScene extends Phaser.Scene {
  private returnTo = 'LevelSelect';
  private columns: Column[] = [];
  private tooltip!: Tooltip;
  private chipText!: Phaser.GameObjects.Text;
  private chipRoot!: Phaser.GameObjects.Container;
  private footer!: Phaser.GameObjects.Text;
  private resetBtn!: Button;
  private shown = 0;
  private modalOpen = false;

  constructor() {
    super('Upgrades');
  }

  init(data: UpgradesData): void {
    this.returnTo = data?.returnTo ?? 'LevelSelect';
  }

  create(): void {
    ensureUi(this);
    this.columns = [];
    this.modalOpen = false;
    addSky(this, 'night', { clouds: 3 });
    fadeIn(this);
    Audio.music('music_menu');
    this.tooltip = new Tooltip(this);

    this.buildColumns();
    this.buildHeader();
    this.footer = this.add.text(GAME_W / 2, 697, '', textStyle(20, '#b9a9d6', { strokeThickness: 3 })).setOrigin(0.5).setDepth(10);
    this.refresh(false);
    this.shown = starsAvailable(this.save());

    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.modalOpen) this.back();
    });
  }

  /** Save as seen by the UI. Purchases always act on the real save; `?unlockAll` only affects level unlocks. */
  private save(): SaveData {
    return getSave();
  }

  // -------------------------------------------------------------------------------------------------------------
  // layout
  // -------------------------------------------------------------------------------------------------------------

  private buildHeader(): void {
    addHeaderBar(this);
    const back = new Button(this, 104, 44, { width: 170, height: 60, label: 'Back', icon: 'ui_back', style: 'secondary', fontSize: 30, onClick: () => this.back() });
    const title = this.add.text(214, 46, 'STAR UPGRADES', textStyle(42, COLORS.textGold, { strokeThickness: 8 })).setOrigin(0, 0.5);
    const { root, label } = starChip(this, 880, 44, '0 to spend', 264);
    this.chipRoot = root;
    this.chipText = label;
    this.resetBtn = new Button(this, 1150, 44, { width: 190, height: 60, label: 'Reset', icon: 'ui_reset', style: 'danger', fontSize: 30, onClick: () => this.askReset() });
    [back, title, root, this.resetBtn].forEach((o, i) => {
      o.setDepth(60).setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 400, delay: 200 + i * 70 });
    });
  }

  private buildColumns(): void {
    const totalW = UPGRADE_TRACKS.length * CARD_W + (UPGRADE_TRACKS.length - 1) * CARD_GAP;
    const x0 = (GAME_W - totalW) / 2 + CARD_W / 2;
    UPGRADE_TRACKS.forEach((track, i) => {
      const cx = x0 + i * (CARD_W + CARD_GAP);
      const root = this.add.container(cx, 0).setDepth(5);
      const card = this.add.graphics();
      card.fillStyle(COLORS.ink, 0.35);
      card.fillRoundedRect(-CARD_W / 2 + 3, CARD_TOP + 9, CARD_W, CARD_H, 26);
      drawOutlinedRect(card, -CARD_W / 2, CARD_TOP, CARD_W, CARD_H, 26, COLORS.panel, 5);
      card.fillStyle(lighten(COLORS.panel, 0.14), 1);
      card.fillRoundedRect(-CARD_W / 2 + 5, CARD_TOP + 5, CARD_W - 10, 8, { tl: 22, tr: 22, bl: 2, br: 2 });
      root.add(card);

      // icon plate
      const plate = this.add.graphics();
      plate.fillStyle(COLORS.ink, 1);
      plate.fillRoundedRect(-58, CARD_TOP + 22, 116, 116, 28);
      plate.fillStyle(PLATE_COLORS[track], 1);
      plate.fillRoundedRect(-54, CARD_TOP + 26, 108, 108, 25);
      plate.fillStyle(0xffffff, 0.16);
      plate.fillRoundedRect(-48, CARD_TOP + 31, 96, 26, { tl: 20, tr: 20, bl: 6, br: 6 });
      root.add(plate);
      const icon = this.makeTrackIcon(track, 0, CARD_TOP + 82);
      root.add(icon);
      this.tweens.add({ targets: icon, y: icon.y - 4, duration: 1400 + i * 140, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 120 });

      const name = this.add.text(0, CARD_TOP + 162, TRACK_INFO[track].name, textStyle(TRACK_INFO[track].name.length > 12 ? 27 : 31, COLORS.textGold, { strokeThickness: 6 })).setOrigin(0.5);
      const pips = this.add.graphics();
      root.add([name, pips]);

      const tiers: TierView[] = [];
      for (let t = 0; t < MAX_TIER; t++) {
        const tv = this.makeTier(track, t, NODE_YS[t]);
        root.add(tv.root);
        tiers.push(tv);
      }
      // connectors between tier nodes
      const conn = this.add.graphics();
      for (let t = 0; t < MAX_TIER - 1; t++) {
        const y1 = NODE_YS[t] + NODE_H / 2 - 2;
        const y2 = NODE_YS[t + 1] - NODE_H / 2 + 2;
        conn.fillStyle(COLORS.ink, 1);
        conn.fillRoundedRect(-9, y1, 18, y2 - y1, 3);
        conn.fillStyle(0xffd34e, 0.9);
        conn.fillRect(-4, y1, 8, y2 - y1);
      }
      root.addAt(conn, 1);

      this.columns.push({ track, pips, tiers, root });
      // staggered pop-in
      root.setAlpha(0).setScale(0.9).setY(40);
      this.tweens.add({ targets: root, alpha: 1, scale: 1, y: 0, duration: 520, ease: 'Back.easeOut', delay: 150 + i * 90 });
    });
  }

  private makeTrackIcon(track: UpgradeTrack, x: number, y: number): Phaser.GameObjects.Image {
    switch (track) {
      case 'archers':
        return fitImage(this.add.image(x, y, 'towers/archer_level_3'), 92, 96);
      case 'wizards':
        return fitImage(this.add.image(x, y, 'towers/wizard_level_3'), 96, 88);
      case 'barracks':
        return fitImage(this.add.image(x, y, 'towers/barrack_level_3_1'), 92, 92);
      case 'orbital':
        return this.add.image(x, y + 4, 'ui_orbital').setDisplaySize(92, 92);
      case 'reinforcements':
      default:
        return fitImage(this.add.image(x, y + 2, 'units/knight_level_3'), 98, 82);
    }
  }

  private makeTier(track: UpgradeTrack, tier: number, y: number): TierView {
    const root = this.add.container(0, y);
    const glow = this.add.graphics();
    const face = this.add.container(0, 0);
    const gfx = this.add.graphics();
    const label = this.add.text(-NODE_W / 2 + 16, -NODE_H / 2 + 12, `TIER ${tier + 1}`, textStyle(17, '#d8cbe8', { strokeThickness: 0 })).setOrigin(0, 0);
    const costStar = this.add.image(NODE_W / 2 - 54, -NODE_H / 2 + 22, 'ui_star').setDisplaySize(26, 26);
    const costText = this.add.text(NODE_W / 2 - 38, -NODE_H / 2 + 22, String(TIER_COSTS[tier]), textStyle(24, COLORS.textGold, { strokeThickness: 4 })).setOrigin(0, 0.5);
    const icon = this.add.image(NODE_W / 2 - 32, -NODE_H / 2 + 22, 'ui_check').setDisplaySize(32, 32).setVisible(false);
    const desc = this.add
      .text(0, 10, TRACK_INFO[track].tiers[tier], textStyle(19, COLORS.text, { strokeThickness: 3, align: 'center', wordWrap: { width: NODE_W - 24 }, lineSpacing: 0 }))
      .setOrigin(0.5, 0.5);
    face.add([gfx, label, costStar, costText, icon, desc]);
    root.add([glow, face]);
    const view: TierView = { track, tier, root, face, gfx, glow, desc, label, costText, costStar, icon, state: 'locked' };

    face.setSize(NODE_W, NODE_H);
    face.setInteractive(new Phaser.Geom.Rectangle(0, 0, NODE_W, NODE_H), Phaser.Geom.Rectangle.Contains);
    face.on('pointerover', () => {
      this.tweens.add({ targets: face, scale: view.state === 'locked' ? 1.0 : 1.04, duration: 110, ease: 'Back.easeOut' });
      if (view.state === 'buyable') Audio.sfx('ui_hover', { volume: 0.5, throttleMs: 60 });
      this.showTierTip(view);
    });
    face.on('pointerout', () => {
      this.tweens.add({ targets: face, scale: 1, duration: 110 });
      this.tooltip.hide();
    });
    face.on('pointerdown', () => {
      if (!this.modalOpen && view.state === 'buyable') this.tweens.add({ targets: face, scale: 0.96, duration: 70, yoyo: true });
      this.onTierClick(view);
    });
    return view;
  }

  // -------------------------------------------------------------------------------------------------------------
  // state
  // -------------------------------------------------------------------------------------------------------------

  private stateOf(save: SaveData, track: UpgradeTrack, tier: number): TierState {
    const owned = save.upgrades[track];
    if (tier < owned) return 'owned';
    if (tier > owned) return 'locked';
    return canBuyTier(save, track).ok ? 'buyable' : 'expensive';
  }

  private refresh(animate: boolean): void {
    const save = this.save();
    for (const col of this.columns) {
      for (const tv of col.tiers) this.paintTier(tv, this.stateOf(save, col.track, tv.tier));
      const owned = save.upgrades[col.track];
      col.pips.clear();
      for (let k = 0; k < MAX_TIER; k++) {
        const px = (k - 1) * 26;
        col.pips.fillStyle(COLORS.ink, 1);
        col.pips.fillCircle(px, CARD_TOP + 196, 9);
        col.pips.fillStyle(k < owned ? 0xffd34e : 0x5a4d68, 1);
        col.pips.fillCircle(px, CARD_TOP + 196, 6.5);
        if (k < owned) {
          col.pips.fillStyle(0xffffff, 0.5);
          col.pips.fillCircle(px - 2, CARD_TOP + 208, 2);
        }
      }
    }
    const avail = starsAvailable(save);
    if (animate) tweenNumber(this, this.chipText, this.shown, avail, (n) => `${n} to spend`, 380);
    else this.chipText.setText(`${avail} to spend`);
    this.shown = avail;
    this.resetBtn.setDisabled(starsSpent(save) === 0);
    this.footer.setText(`Earned ${starsEarned(save)} / 30 stars   |   Spent ${starsSpent(save)}   |   Tiers unlock in order`);
  }

  private paintTier(v: TierView, state: TierState): void {
    v.state = state;
    const g = v.gfx;
    g.clear();
    const w = NODE_W, h = NODE_H;
    const fills: Record<TierState, { fill: number; border: number; borderW: number }> = {
      owned: { fill: 0x3f7a3c, border: 0xffd34e, borderW: 4 },
      buyable: { fill: 0x6a58a0, border: 0xffd34e, borderW: 4 },
      expensive: { fill: 0x403452, border: COLORS.ink, borderW: 4 },
      locked: { fill: 0x2c2339, border: COLORS.ink, borderW: 4 },
    };
    const f = fills[state];
    g.fillStyle(COLORS.ink, 0.35);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 6, w, h, 18);
    g.fillStyle(f.border, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    // gold border needs an ink hairline outside it
    if (f.border !== COLORS.ink) {
      g.lineStyle(2.5, COLORS.ink, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    }
    g.fillStyle(f.fill, 1);
    g.fillRoundedRect(-w / 2 + f.borderW, -h / 2 + f.borderW, w - f.borderW * 2, h - f.borderW * 2, 14);
    g.fillStyle(0xffffff, state === 'locked' ? 0.04 : 0.1);
    g.fillRoundedRect(-w / 2 + f.borderW + 2, -h / 2 + f.borderW + 2, w - f.borderW * 2 - 4, 22, { tl: 12, tr: 12, bl: 3, br: 3 });

    const dim = state === 'locked' ? 0.5 : state === 'expensive' ? 0.85 : 1;
    v.desc.setAlpha(dim);
    v.label.setAlpha(dim);
    v.icon.setVisible(state === 'owned' || state === 'locked');
    v.icon.setTexture(state === 'owned' ? 'ui_check' : 'ui_lock');
    v.icon.setDisplaySize(state === 'owned' ? 30 : 30, 30);
    v.icon.setAlpha(state === 'locked' ? 0.7 : 1);
    const showCost = state === 'buyable' || state === 'expensive';
    v.costStar.setVisible(showCost);
    v.costText.setVisible(showCost);
    v.costText.setColor(state === 'expensive' ? COLORS.textRed : COLORS.textGold);
    v.costStar.setAlpha(state === 'expensive' ? 0.65 : 1);

    v.pulse?.stop();
    v.pulse = undefined;
    v.glow.clear();
    v.root.setAlpha(1);
    if (state === 'buyable') {
      v.glow.setAlpha(0.6);
      v.glow.fillStyle(0xffd34e, 0.35);
      v.glow.fillRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 22);
      v.pulse = this.tweens.add({ targets: v.glow, alpha: 0.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (v.face.input) v.face.input.cursor = state === 'buyable' ? 'pointer' : 'default';
  }

  private tierName(track: UpgradeTrack, tier: number): string {
    return `${TRACK_INFO[track].name} - Tier ${tier + 1}`;
  }

  private showTierTip(v: TierView): void {
    const save = this.save();
    const cost = TIER_COSTS[v.tier];
    let status: string;
    switch (v.state) {
      case 'owned':
        status = 'Unlocked';
        break;
      case 'buyable':
        status = `Click to buy for ${cost} star${cost > 1 ? 's' : ''}`;
        break;
      case 'expensive':
        status = `Need ${cost - starsAvailable(save)} more star${cost - starsAvailable(save) > 1 ? 's' : ''} (costs ${cost})`;
        break;
      default:
        status = `Buy tier ${save.upgrades[v.track] + 1} first`;
    }
    const m = v.root.getWorldTransformMatrix();
    this.tooltip.show(this.tierName(v.track, v.tier), `${TRACK_INFO[v.track].tiers[v.tier]}\n${status}`, m.tx, m.ty - NODE_H / 2);
  }

  // -------------------------------------------------------------------------------------------------------------
  // actions
  // -------------------------------------------------------------------------------------------------------------

  private onTierClick(v: TierView): void {
    if (this.modalOpen) return;
    const m = v.root.getWorldTransformMatrix();
    if (v.state === 'owned') {
      this.tweens.add({ targets: v.face, scale: { from: 1.08, to: 1.04 }, duration: 160 });
      return;
    }
    if (v.state !== 'buyable') {
      Audio.sfx('ui_error', { volume: 0.6 });
      this.tweens.add({ targets: v.face, x: { from: -7, to: 0 }, duration: 280, ease: 'Elastic.easeOut' });
      if (v.state === 'expensive') {
        this.tweens.add({ targets: this.chipRoot, scale: { from: 1.12, to: 1 }, duration: 280, ease: 'Back.easeOut' });
        this.chipText.setColor(COLORS.textRed);
        this.time.delayedCall(500, () => this.chipText.setColor(COLORS.textGold));
      }
      return;
    }
    const before = getSave();
    const after = updateSave((s) => buyTier(s, v.track));
    if (after === before) return;
    Audio.sfx('upgrade_tower');
    Audio.sfx('star_earned', { volume: 0.5 });
    this.tooltip.hide();
    this.refresh(true);
    this.tweens.add({ targets: v.face, scale: { from: 1.22, to: 1.04 }, duration: 380, ease: 'Back.easeOut' });
    sparkBurst(this, m.tx, m.ty, { count: 14, radius: 90, size: 24, depth: 200 });
    ringPulse(this, m.tx, m.ty, 0xffd34e, 100, 190);
    // the next tier lights up
    const col = this.columns.find((c) => c.track === v.track);
    const next = col?.tiers[v.tier + 1];
    if (next) this.tweens.add({ targets: next.face, scale: { from: 0.92, to: 1 }, duration: 420, ease: 'Back.easeOut', delay: 150 });
  }

  private askReset(): void {
    if (this.modalOpen) return;
    const spent = starsSpent(this.save());
    if (spent === 0) return;
    this.modalOpen = true;
    confirmModal(this, {
      title: 'Reset upgrades?',
      message: `Refund ${spent} star${spent > 1 ? 's' : ''} and remove every upgrade?\nYou can buy them again any time for free.`,
      confirmLabel: 'Refund all',
      danger: true,
      height: 350,
      onClose: () => (this.modalOpen = false),
      onConfirm: () => {
        updateSave((s) => resetUpgrades(s));
        Audio.sfx('sell_tower');
        this.refresh(true);
        sparkBurst(this, this.chipRoot.x, this.chipRoot.y, { count: 14, radius: 80, size: 22, depth: 200 });
        this.columns.forEach((c, i) => {
          this.tweens.add({ targets: c.root, scale: { from: 0.96, to: 1 }, duration: 380, ease: 'Back.easeOut', delay: i * 50 });
        });
      },
    });
  }

  private back(): void {
    fadeTo(this, () => {
      const key = this.scene.manager.keys[this.returnTo] ? this.returnTo : 'LevelSelect';
      this.scene.start(key);
    });
  }
}

const PLATE_COLORS: Record<UpgradeTrack, number> = {
  archers: 0x5aa14b,
  wizards: 0x4f77c9,
  barracks: 0xa06a45,
  orbital: 0xb04a5a,
  reinforcements: 0x8a62b8,
};
