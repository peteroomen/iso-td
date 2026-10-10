import Phaser from 'phaser';
import type { TowerState } from '../../core';
import { depthOf, isoX, isoY } from './iso';
import { Layers } from './Fx';
import { TEX } from './textures';

/**
 * Towers are drawn at NATIVE scale (1.0): the pack's towers are authored for these tiles (base diamond ~ the
 * orange disc of tiles/buildspot_*.png, ~122 x 57 px) and any magnification would thicken their outline.
 *
 * FOOT = pixel inside the tower PNG that must sit on the cell centre (= tile top-face centre = disc centre):
 * the centre of the tower's own base diamond. Measured with PIL on the alpha>128 silhouette:
 *   - stone towers (archer / barracks): the silhouette's bottom tip is the front vertex of the base diamond and the
 *     walls reach their full width W one diamond half-height above it, so centreY = bottomY - 0.288 * W
 *     (diamond ratio 144/250 of the tiles: half-height = 0.288 W). archer W=129 (bottom 164/174/179 -> 37 px up),
 *     barracks W=120 (bottom 153 -> 35 px up). centreX = bbox centre (symmetric).
 *   - wizard rock slab: the sprites carry transparent padding (bbox x 15..120 / y 9..111 at L1), the slab's own
 *     base is the grey block (x ~42..110, front edge y ~94): centre (76, 76) at L1/L2, (70, 74) at L3 (slab visual centre ~72 + a few px so the rock sits on the disc).
 * All levels of a tower share the same footprint so upgrading grows the tower upwards without jumping.
 * `unitY` = y (sprite px) of the archer unit's feet, `gem` = staff gem position for the wizard flash.
 */
interface FootSpec {
  x: number;
  y: number;
  /** archer: y of the runtime archer's feet / wizard: staff gem (x, y) in sprite px. */
  unitY?: number;
  gem?: [number, number];
  /** bomb: barrel mouth (x, y) in sprite px. */
  muzzle?: [number, number];
  /** y (px above the footprint centre) of arrow / bolt launch. */
  shootH: number;
}
const FOOT: Record<TowerState['kind'], FootSpec[]> = {
  archer: [
    { x: 64.5, y: 127, unitY: 60, shootH: 67 },
    { x: 65, y: 137, unitY: 60, shootH: 77 },
    { x: 65, y: 142, unitY: 59, shootH: 83 },
  ],
  wizard: [
    { x: 76, y: 76, gem: [58, 18], shootH: 64 },
    { x: 76, y: 76, gem: [57, 18], shootH: 64 },
    { x: 70, y: 74, gem: [50, 12], shootH: 68 },
  ],
  barracks: [
    { x: 70.5, y: 118, shootH: 60 },
    { x: 70.5, y: 118, shootH: 60 },
    { x: 70.5, y: 118, shootH: 60 },
  ],
  // bomb (PIL, alpha>128): L1 W=136 / walls 122 wide (bottom 140 -> 35 px up), L2 W=146 (bottom 167 -> 42 up), L3 W=147 (bottom 182 -> 42 up).
  // `muzzle` = centre of the barrel mouth (the barrel points up-right), shootH = its height above the footprint centre.
  bomb: [
    { x: 67.5, y: 105, muzzle: [91, 16], shootH: 89 },
    { x: 73, y: 125, muzzle: [104, 18], shootH: 107 },
    { x: 73.5, y: 140, muzzle: [115, 24], shootH: 116 },
  ],
};
/** Half-height of the base diamond + margin: where the level pips sit below the footprint centre. */
const PIPS_Y = 46;

function footOf(kind: TowerState['kind'], level: number): FootSpec {
  const t = FOOT[kind];
  return t[Math.max(0, Math.min(t.length - 1, level - 1))];
}

/** Height (px above the footprint centre) projectiles / sparks leave a tower at. */
export function towerShootHeight(kind: TowerState['kind'], level: number): number {
  return footOf(kind, level).shootH;
}

/** Offset (px, relative to the footprint centre / container origin) of a bomb tower's barrel mouth. */
export function towerMuzzleOffset(kind: TowerState['kind'], level: number): { x: number; y: number } | null {
  const f = footOf(kind, level);
  return f.muzzle ? { x: f.muzzle[0] - f.x, y: f.muzzle[1] - f.y } : null;
}

function bodyKey(t: TowerState, door: number): string {
  if (t.kind === 'bomb') return `towers/bomb_level_${t.level}`;
  if (t.kind === 'archer') return `towers/archer_level_${t.level}`;
  if (t.kind === 'wizard') return `towers/wizard_level_${t.level}`;
  return `towers/barrack_level_${t.level}_${door === 2 ? 2 : 1}`;
}

/** Visual for one tower: body sprite, archer/bow animation, wizard flash, level pips, pop tweens. */
export class TowerView {
  readonly container: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Image;
  private readonly unit?: Phaser.GameObjects.Image;
  private readonly bow?: Phaser.GameObjects.Image;
  private readonly glow?: Phaser.GameObjects.Image;
  private readonly pips: Phaser.GameObjects.Graphics;
  private level = 0;
  /** Frame stamp used by SimRenderer to purge views of removed entities without allocating. */
  stamp = 0;
  private lastShots: number;
  private bowT = 99;
  private flashT = 99;
  private recoilT = 99;
  private flipped = false;
  private door = 1;
  private popTween?: Phaser.Tweens.Tween;
  readonly gx: number;
  readonly gy: number;
  readonly kind: TowerState['kind'];

  constructor(
    private readonly scene: Phaser.Scene,
    L: Layers,
    st: TowerState,
  ) {
    this.gx = st.x;
    this.gy = st.y;
    this.kind = st.kind;
    this.lastShots = st.shotCount;
    this.container = scene.add.container(isoX(st.x, st.y), isoY(st.x, st.y));
    this.container.setDepth(depthOf(st.x, st.y));
    L.entityC.add(this.container);
    this.pips = scene.add.graphics();
    this.body = scene.add.image(0, 0, bodyKey(st, 1)).setScale(1);
    this.container.add([this.body, this.pips]);
    if (st.kind === 'archer') {
      this.unit = scene.add.image(0, 0, 'towers/archer').setScale(1);
      this.bow = scene.add.image(0, 0, 'towers/bow_animation_1').setScale(1).setVisible(false);
      this.container.add([this.unit, this.bow]);
    } else if (st.kind === 'wizard') {
      this.glow = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0x7fd0ff).setAlpha(0).setScale(0.8);
      this.container.add(this.glow);
    }
    this.applyLevel(st);
  }

  private applyLevel(st: TowerState): void {
    this.level = st.level;
    this.body.setTexture(bodyKey(st, this.door));
    const f = footOf(st.kind, st.level);
    this.body.setOrigin(f.x / this.body.width, f.y / this.body.height);
    if (this.unit && f.unitY !== undefined) {
      this.unit.setOrigin(0.5, 0.8);
      this.unit.y = f.unitY - f.y;
      this.unit.x = 0;
    }
    if (this.glow && f.gem) this.glow.setPosition(f.gem[0] - f.x, f.gem[1] - f.y);
    this.pips.clear();
    for (let i = 0; i < st.level; i++) {
      const x = (i - (st.level - 1) / 2) * 13;
      this.pips.fillStyle(0xffd34e, 1).fillCircle(x, PIPS_Y, 5.5);
      this.pips.lineStyle(2, 0x2e222f, 1).strokeCircle(x, PIPS_Y, 5.5);
    }
  }

  /** Face the barracks door towards the rally point (screen-space dx). */
  setDoorFacing(rallyScreenDx: number, st: TowerState): void {
    const d = rallyScreenDx < 0 ? 1 : 2;
    if (d !== this.door) {
      this.door = d;
      this.body.setTexture(bodyKey(st, d));
    }
  }

  update(st: TowerState, dt: number): void {
    if (st.level !== this.level) this.applyLevel(st);
    this.bowT += dt;
    this.flashT += dt;
    this.recoilT += dt;
    const sdx = st.facingX - st.facingY;
    if (Math.abs(sdx) > 0.05) this.flipped = sdx < 0;
    if (st.shotCount !== this.lastShots) {
      this.lastShots = st.shotCount;
      this.bowT = 0;
      this.flashT = 0;
      this.recoilT = 0;
    }
    if (this.unit && this.bow) {
      this.unit.setFlipX(this.flipped);
      const frame = this.bowT < 0.3 ? Math.min(4, 1 + Math.floor(this.bowT / 0.075)) : 0;
      if (frame > 0) {
        this.bow.setVisible(true).setTexture(`towers/bow_animation_${frame}`);
        this.bow.setFlipX(!this.flipped);
        this.bow.x = this.unit.x + (this.flipped ? -15 : 15);
        this.bow.y = this.unit.y - 20;
      } else {
        this.bow.setVisible(false);
      }
    }
    if (this.kind === 'bomb') {
      // mortar recoil: a hard squash + kick away from the barrel (down-left), settling back with a little bounce
      const T = 0.34;
      if (this.recoilT < T) {
        const u = this.recoilT / T;
        const k = u < 0.18 ? u / 0.18 : Math.pow(1 - (u - 0.18) / 0.82, 2) * (1 + 0.25 * Math.cos((u - 0.18) * 14));
        this.body.setScale(1 + 0.045 * k, 1 - 0.075 * k);
        this.body.setPosition(-4 * k, 3 * k);
      } else if (this.body.scaleY !== 1 || this.body.x !== 0) {
        this.body.setScale(1).setPosition(0, 0);
      }
    }
    if (this.glow) {
      const a = this.flashT < 0.35 ? 1 - this.flashT / 0.35 : 0;
      this.glow.setAlpha(a);
      this.glow.setScale(0.5 + a * 0.5);
      this.body.y = this.flashT < 0.15 ? -2 * (1 - this.flashT / 0.15) : 0;
    }
  }

  pop(kind: 'build' | 'upgrade'): void {
    this.popTween?.stop();
    if (kind === 'build') {
      this.container.setScale(0.2, 0.05);
      this.popTween = this.scene.tweens.add({ targets: this.container, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.easeOut' });
    } else {
      this.container.setScale(1);
      this.popTween = this.scene.tweens.add({ targets: this.container, scaleX: { from: 0.8, to: 1 }, scaleY: { from: 1.25, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      this.body.setTintFill(0xffffff);
      this.scene.time.delayedCall(110, () => this.body.active && this.body.clearTint());
    }
  }

  /** Is the world-local point on this tower's sprite? */
  hitTest(lx: number, ly: number): boolean {
    const w = this.body.displayWidth * 0.5;
    const top = this.container.y - this.body.displayHeight * this.body.originY;
    const bottom = this.container.y + 40;
    return Math.abs(lx - this.container.x) <= w * 0.85 && ly >= top && ly <= bottom;
  }

  destroyAnimated(): void {
    this.popTween?.stop();
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0,
      duration: 220,
      ease: 'Back.easeIn',
      onComplete: () => this.container.destroy(),
    });
  }

  destroy(): void {
    this.popTween?.stop();
    this.container.destroy();
  }
}
