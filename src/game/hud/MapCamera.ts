import Phaser from 'phaser';
import { CSS_PER_UNIT, SAFE, UI_SCALE } from '../ui/theme';
import { IsoView } from '../render/iso';
import { Hud } from './Hud';
import { DEPTH, UiButton, isHud } from './widgets';

/** Finger / mouse travel (CSS px) before a press turns into a pan; shorter presses stay taps. */
const DRAG_CSS_PX = 10;

interface Touch {
  id: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** pressed on a HUD widget: never pans / pinches */
  hud: boolean;
  panning: boolean;
  panOffX: number;
  panOffY: number;
  button: 'left' | 'mid' | 'right';
}

export interface MapCameraDeps {
  scene: Phaser.Scene;
  view: IsoView;
  world: Phaser.GameObjects.Container;
  hud: Hud;
  isBlocked: () => boolean;
  /** called when the view starts to move (open radial menus are anchored to the screen and must close) */
  onMove: () => void;
}

/**
 * Pinch / wheel zoom and drag pan for the iso map. Only the `world` container moves: HUD objects live outside it.
 * `gestureHappened` tells the tap handler that the current press was a drag / pinch and must not select anything.
 */
export class MapCamera {
  private readonly touches = new Map<number, Touch>();
  private pinch: { d0: number; z0: number; lx: number; ly: number } | null = null;
  private gestured = false;
  private targetZoom = 1;
  private focus = { x: 0, y: 0 };
  private readonly resetBtn: UiButton;
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key> = {};

  constructor(private readonly d: MapCameraDeps) {
    const { scene, view } = d;
    const input = scene.input;
    this.focus = { x: view.area.x + view.area.w / 2, y: view.area.y + view.area.h / 2 };
    input.on('pointerdown', this.onDown, this);
    input.on('pointermove', this.onMoveEvt, this);
    input.on('pointerup', this.onUp, this);
    input.on('pointerupoutside', this.onUp, this);
    input.on('wheel', this.onWheel, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off('pointerdown', this.onDown, this);
      input.off('pointermove', this.onMoveEvt, this);
      input.off('pointerup', this.onUp, this);
      input.off('pointerupoutside', this.onUp, this);
      input.off('wheel', this.onWheel, this);
    });

    const kb = input.keyboard;
    if (kb) {
      for (const k of ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT']) this.keys[k] = kb.addKey(k, false);
      kb.on('keydown-PLUS', () => this.zoomBy(1.25));
      kb.on('keydown-NUMPAD_ADD', () => this.zoomBy(1.25));
      kb.on('keydown-EQUALS', () => this.zoomBy(1.25));
      kb.on('keydown-MINUS', () => this.zoomBy(0.8));
      kb.on('keydown-NUMPAD_SUBTRACT', () => this.zoomBy(0.8));
      kb.on('keydown-ZERO', () => this.reset());
      kb.on('keydown-HOME', () => this.reset());
    }

    // "fit" button: only visible while the view is zoomed / panned
    const u = UI_SCALE;
    const bw = 84;
    this.resetBtn = new UiButton(scene, 0, 0, { w: bw, h: 46, label: 'Fit', fontSize: 22, fill: 0x4c6fd0, radius: 12, onClick: () => this.reset() }).setBaseScale(u);
    this.resetBtn.setPosition(scene.scale.width - SAFE.r - 14 - 42 * u, scene.scale.height - SAFE.b - 14 - 23 * u).setDepth(DEPTH.bar).setVisible(false);
    scene.add.existing(this.resetBtn);
  }

  /** Screen rectangle of the "fit" button (other HUD pieces avoid it). */
  buttonRect(): { x: number; y: number; w: number; h: number } {
    const u = UI_SCALE;
    return { x: this.resetBtn.x - 42 * u, y: this.resetBtn.y - 23 * u, w: 84 * u, h: 46 * u };
  }

  /** True while the current press has turned into a pan / pinch (so releasing it must not tap anything). */
  get gestureHappened(): boolean {
    return this.gestured;
  }

  // ------------------------------------------------------------------------------------------ api

  reset(): void {
    this.targetZoom = 1;
    const v = this.d.view;
    this.focus = { x: v.area.x + v.area.w / 2, y: v.area.y + v.area.h / 2 };
    // animate back: target zoom 1 and slide the offsets in update()
    this.resetting = true;
    this.d.onMove();
  }
  private resetting = false;

  zoomBy(f: number, fx = this.focus.x, fy = this.focus.y): void {
    const v = this.d.view;
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom * f, v.minZoom, v.maxZoom);
    this.focus = { x: fx, y: fy };
    this.resetting = false;
    this.d.onMove();
  }

  // ------------------------------------------------------------------------------------------ input

  private static buttonOf(p: Phaser.Input.Pointer): Touch['button'] {
    if (p.rightButtonDown()) return 'right';
    if (p.middleButtonDown()) return 'mid';
    return 'left';
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.touches.size === 0) this.gestured = false;
    const hud = over.some(isHud) || this.d.isBlocked();
    this.touches.set(p.id, { id: p.id, x: p.x, y: p.y, sx: p.x, sy: p.y, hud, panning: false, panOffX: this.d.view.offX, panOffY: this.d.view.offY, button: MapCamera.buttonOf(p) });
    this.resetting = false;
    this.targetZoom = this.d.view.zoom;
    this.maybeStartPinch();
  }

  private maybeStartPinch(): void {
    const ts = [...this.touches.values()].filter((t) => !t.hud);
    if (ts.length < 2) return;
    const [a, b] = ts;
    const d0 = Math.hypot(a.x - b.x, a.y - b.y);
    if (d0 < 8) return;
    const v = this.d.view;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    this.pinch = { d0, z0: v.zoom, lx: (mx - v.offX) / v.scale, ly: (my - v.offY) / v.scale };
    this.gestured = true;
    for (const t of ts) t.panning = false;
    this.d.onMove();
  }

  private onMoveEvt(p: Phaser.Input.Pointer): void {
    const t = this.touches.get(p.id);
    if (!t) return;
    t.x = p.x;
    t.y = p.y;
    const v = this.d.view;
    if (t.hud || this.d.isBlocked()) return;
    if (this.pinch) {
      const ts = [...this.touches.values()].filter((q) => !q.hud);
      if (ts.length >= 2) {
        const [a, b] = ts;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const z = Phaser.Math.Clamp(this.pinch.z0 * (d / this.pinch.d0), v.minZoom * 0.98, v.maxZoom * 1.02);
        v.zoom = z;
        v.scale = v.fitScale * z;
        v.offX = mx - this.pinch.lx * v.scale;
        v.offY = my - this.pinch.ly * v.scale;
        v.clampPan();
        this.targetZoom = z;
        return;
      }
    }
    if (this.touches.size > 1) return;
    if (!p.isDown) return;
    if (!t.panning) {
      const thr = t.button === 'left' ? DRAG_CSS_PX / CSS_PER_UNIT : 3;
      if (Math.hypot(p.x - t.sx, p.y - t.sy) < thr) return;
      t.panning = true;
      this.gestured = true;
      t.panOffX = v.offX;
      t.panOffY = v.offY;
      this.d.onMove();
    }
    this.resetting = false;
    v.offX = t.panOffX + (p.x - t.sx);
    v.offY = t.panOffY + (p.y - t.sy);
    v.clampPan();
    // the pan may be clamped: re-base so the content follows the finger again as soon as it can
    t.panOffX = v.offX - (p.x - t.sx);
    t.panOffY = v.offY - (p.y - t.sy);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.touches.delete(p.id);
    if (this.pinch && [...this.touches.values()].filter((q) => !q.hud).length < 2) {
      this.pinch = null;
      // the remaining finger must not start panning from its old anchor
      for (const t of this.touches.values()) {
        t.sx = t.x;
        t.sy = t.y;
        t.panning = false;
        t.panOffX = this.d.view.offX;
        t.panOffY = this.d.view.offY;
      }
      // snap back into the allowed range (pinch is allowed to overshoot slightly)
      this.targetZoom = Phaser.Math.Clamp(this.d.view.zoom, this.d.view.minZoom, this.d.view.maxZoom);
      this.focus = { x: p.x, y: p.y };
    }
  }

  private onWheel(p: Phaser.Input.Pointer, over: unknown[], _dx: number, dy: number): void {
    if (this.d.isBlocked() || (over as Phaser.GameObjects.GameObject[]).some(isHud)) return;
    this.zoomBy(Math.exp(-dy * 0.0014), p.x, p.y);
  }

  // ------------------------------------------------------------------------------------------ frame

  /** Eases toward the target zoom / reset and applies keyboard panning; syncs the world container. Returns nothing. */
  update(dt: number): void {
    const v = this.d.view;
    if (!this.pinch) {
      if (this.resetting) {
        const k = 1 - Math.exp(-dt * 12);
        v.zoom += (1 - v.zoom) * k;
        v.scale = v.fitScale * v.zoom;
        v.offX += (v.fitOffX - v.offX) * k;
        v.offY += (v.fitOffY - v.offY) * k;
        if (Math.abs(v.zoom - 1) < 0.002 && Math.abs(v.offX - v.fitOffX) < 0.5 && Math.abs(v.offY - v.fitOffY) < 0.5) {
          v.resetView();
          this.resetting = false;
        }
      } else if (Math.abs(this.targetZoom - v.zoom) > 0.0005 && !this.anyPanning()) {
        const k = 1 - Math.exp(-dt * 14);
        v.setZoomAt(v.zoom + (this.targetZoom - v.zoom) * k, this.focus.x, this.focus.y);
      }
    }
    // keyboard pan
    const kk = this.keys;
    if (kk.W && !this.d.isBlocked()) {
      const sp = 620 * dt;
      const dx = (kk.A.isDown || kk.LEFT.isDown ? sp : 0) - (kk.D.isDown || kk.RIGHT.isDown ? sp : 0);
      const dy = (kk.W.isDown || kk.UP.isDown ? sp : 0) - (kk.S.isDown || kk.DOWN.isDown ? sp : 0);
      if (dx || dy) {
        if (this.resetting) this.resetting = false;
        v.panBy(dx, dy);
        this.d.onMove();
      }
    }
    const w = this.d.world;
    w.setScale(v.scale);
    if (w.x !== v.offX || w.y !== v.offY) {
      // (screen shake in Fx offsets the container around view.offX/offY itself)
      w.setPosition(v.offX, v.offY);
    }
    const show = !v.isFit;
    if (show !== this.resetBtn.visible) this.resetBtn.setVisible(show);
  }

  private anyPanning(): boolean {
    for (const t of this.touches.values()) if (t.panning) return true;
    return false;
  }
}
