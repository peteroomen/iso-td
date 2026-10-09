import Phaser from 'phaser';
import type { EnemyId, Sim, SimEvent } from '../../core';
import { Audio } from '../services/audio';
import { COLORS } from '../ui/theme';
import { EnemyView } from './EnemyView';
import { Fx, Layers } from './Fx';
import { IsoView, TH, TW, isoX, isoY } from './iso';
import { BarInfo, KnightView } from './KnightView';
import { ProjectileView } from './ProjectileView';
import { HOVER_BOSS, HOVER_FLIER, HOVER_GROUND, bodyHeightOf } from './style';
import { TOWER_SCALE, TowerView } from './TowerView';

const TOWER_SHOOT_H: Record<string, number> = { archer: 105, wizard: 100, barracks: 60 };

/**
 * Turns the Sim snapshot + events into sprites, particles and sound.
 * Holds no game rules: it only reads `sim.state` and the drained events.
 */
export class SimRenderer {
  readonly towers = new Map<number, TowerView>();
  readonly knights = new Map<number, KnightView>();
  readonly enemies = new Map<number, EnemyView>();
  private readonly projectiles = new Map<number, ProjectileView>();
  private readonly barsGfx: Phaser.GameObjects.Graphics;
  private readonly strikeGfx: Phaser.GameObjects.Graphics;
  private readonly k: number;
  private emberAcc = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    view: IsoView,
    private readonly L: Layers,
    private readonly sim: Sim,
    readonly fx: Fx,
  ) {
    this.k = 1 / view.scale;
    this.strikeGfx = scene.add.graphics();
    L.groundFxC.add(this.strikeGfx);
    this.barsGfx = scene.add.graphics();
    L.fxC.add(this.barsGfx);
    this.barsGfx.setDepth(100000);
  }

  /** Called once per rendered frame. `events` = everything the sim emitted since the previous frame. */
  update(time: number, dt: number, events: SimEvent[]): void {
    const s = this.sim.state;

    // 1. create / update views of everything alive
    for (const t of s.towers) {
      let v = this.towers.get(t.id);
      if (!v) {
        v = new TowerView(this.scene, this.L, t);
        this.towers.set(t.id, v);
      }
      if (t.kind === 'barracks' && t.rallyX !== null && t.rallyY !== null) {
        v.setDoorFacing(t.rallyX - t.rallyY - (t.x - t.y), t);
      }
      v.update(t, dt);
    }
    for (const k of s.knights) {
      let v = this.knights.get(k.id);
      if (!v) {
        v = new KnightView(this.scene, this.L, k);
        this.knights.set(k.id, v);
      }
      v.update(k, time, dt);
    }
    for (const e of s.enemies) {
      let v = this.enemies.get(e.id);
      if (!v) {
        v = new EnemyView(this.scene, this.L, e);
        this.enemies.set(e.id, v);
      }
      v.update(e, time);
    }
    for (const p of s.projectiles) {
      let v = this.projectiles.get(p.id);
      if (!v) {
        v = new ProjectileView(this.scene, this.L, p, 0, 0);
        this.projectiles.set(p.id, v);
      }
      const tower = this.sim.getTower(p.towerId);
      const tgt = this.sim.getEnemy(p.targetId);
      const th = (tower ? TOWER_SHOOT_H[tower.kind] : 90) * TOWER_SCALE;
      const targetH = tgt ? bodyHeightOf(tgt) : 30;
      // interpolate height from tower top to target body height
      v.setHeights(th, targetH);
      v.update(p, targetH);
      if (v.isBolt) this.fx.trail(v.gx, v.gy, v.h);
    }

    // 2. events (views of dying things still exist here)
    for (const e of events) this.handle(e);

    // 3. purge views whose entity is gone
    this.purge(this.towers, new Set(s.towers.map((t) => t.id)), (v) => v.destroyAnimated());
    this.purge(this.knights, new Set(s.knights.map((k) => k.id)), (v) => v.destroy());
    this.purge(this.enemies, new Set(s.enemies.map((e) => e.id)), (v) => v.destroy());
    this.purge(this.projectiles, new Set(s.projectiles.map((p) => p.id)), (v) => v.destroy());

    this.drawBars();
    this.drawStrikes(time, dt);
    this.L.entityC.sort('depth');
  }

  private purge<V>(map: Map<number, V>, alive: Set<number>, kill: (v: V) => void): void {
    for (const [id, v] of map) {
      if (!alive.has(id)) {
        kill(v);
        map.delete(id);
      }
    }
  }

  // ----------------------------------------------------------------------------------- bars

  private drawBars(): void {
    const g = this.barsGfx;
    g.clear();
    const s = this.sim.state;
    const draw = (b: BarInfo) => {
      if (!b.show) return;
      const w = b.width * this.k;
      const h = 5 * this.k;
      const x = b.x - w / 2;
      const y = b.y - h;
      g.fillStyle(0x2e222f, 1).fillRoundedRect(x - 1.5 * this.k, y - 1.5 * this.k, w + 3 * this.k, h + 3 * this.k, 2.5 * this.k);
      g.fillStyle(0x5a3a48, 1).fillRect(x, y, w, h);
      const f = Math.max(0, Math.min(1, b.frac));
      const col = b.color === 0x6cc24a ? (f > 0.5 ? 0x6cc24a : f > 0.25 ? 0xf2c230 : 0xe5484d) : f > 0.5 ? 0x6cc24a : f > 0.25 ? 0xf2c230 : 0xe5484d;
      g.fillStyle(col, 1).fillRect(x, y, w * f, h);
      g.fillStyle(0xffffff, 0.35).fillRect(x, y, w * f, h * 0.4);
    };
    for (const e of s.enemies) {
      const v = this.enemies.get(e.id);
      if (v) draw(v.bar(e));
    }
    for (const kn of s.knights) {
      const v = this.knights.get(kn.id);
      if (v) draw(v.bar(kn));
    }
  }

  // ----------------------------------------------------------------------------------- strikes / burns

  private ellipse(g: Phaser.GameObjects.Graphics, gx: number, gy: number, r: number, mode: 'stroke' | 'fill'): void {
    const x = isoX(gx, gy);
    const y = isoY(gx, gy);
    const rx = r * TW * 0.7071;
    const ry = r * TH * 0.7071;
    if (mode === 'stroke') g.strokeEllipse(x, y, rx * 2, ry * 2);
    else g.fillEllipse(x, y, rx * 2, ry * 2);
  }

  private drawStrikes(time: number, dt: number): void {
    const g = this.strikeGfx;
    g.clear();
    const s = this.sim.state;
    for (const st of s.strikes) {
      const p = 1 - st.timer / st.delay;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.025);
      g.fillStyle(0xff5a4a, 0.1 + 0.12 * pulse);
      this.ellipse(g, st.x, st.y, st.radius, 'fill');
      g.lineStyle(4 * this.k * 0.8, 0xff7a59, 0.9);
      this.ellipse(g, st.x, st.y, st.radius, 'stroke');
      g.lineStyle(3 * this.k * 0.8, 0xffe27a, 0.95);
      this.ellipse(g, st.x, st.y, st.radius * (1 - p * 0.85), 'stroke');
      // cross-hair
      const cx = isoX(st.x, st.y);
      const cy = isoY(st.x, st.y);
      const rx = st.radius * TW * 0.7071;
      const ry = st.radius * TH * 0.7071;
      g.lineStyle(2.5 * this.k * 0.8, 0xffe27a, 0.8);
      g.lineBetween(cx - rx * 1.15, cy, cx - rx * 0.45, cy);
      g.lineBetween(cx + rx * 1.15, cy, cx + rx * 0.45, cy);
      g.lineBetween(cx, cy - ry * 1.15, cx, cy - ry * 0.45);
      g.lineBetween(cx, cy + ry * 1.15, cx, cy + ry * 0.45);
    }
    this.emberAcc += dt;
    for (const b of s.burns) {
      const f = b.timer / b.duration;
      g.fillStyle(0xff6a1a, (0.18 + 0.1 * Math.sin(time * 0.03 + b.id)) * Math.min(1, f * 2));
      this.ellipse(g, b.x, b.y, b.radius, 'fill');
      g.fillStyle(0xffc04a, 0.1 * Math.min(1, f * 2));
      this.ellipse(g, b.x, b.y, b.radius * 0.6, 'fill');
      if (this.emberAcc > 0.02) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * b.radius;
        this.fx.emberAt(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
      }
    }
    if (this.emberAcc > 0.02) this.emberAcc = 0;
  }

  // ----------------------------------------------------------------------------------- events

  private enemyHeight(type: EnemyId): number {
    if (type === 'mothership') return HOVER_BOSS + 60;
    if (type === 'skimmer') return HOVER_FLIER + 45;
    return HOVER_GROUND + 45;
  }

  private handle(e: SimEvent): void {
    const fx = this.fx;
    switch (e.type) {
      case 'build':
        this.towers.get(e.towerId)?.pop('build');
        fx.buildBurst(e.x, e.y, false);
        Audio.sfx('build_tower');
        break;
      case 'upgrade':
        this.towers.get(e.towerId)?.pop('upgrade');
        fx.buildBurst(e.x, e.y, true);
        Audio.sfx('upgrade_tower');
        break;
      case 'sell':
        fx.dust(e.x, e.y, 12);
        fx.floatText(e.x, e.y, `+${e.refund}`, COLORS.textGold, 90, 24);
        fx.hitSpark(e.x, e.y, 60, 'gold', 8);
        Audio.sfx('sell_tower');
        Audio.sfx('coin', { throttleMs: 60 });
        break;
      case 'shoot':
        if (e.kind === 'wizard') {
          Audio.sfx('wizard_cast', { volume: 0.55, detune: (Math.random() - 0.5) * 200, throttleMs: 60 });
          fx.hitSpark(e.x, e.y, 105, 'blue', 3);
        } else {
          Audio.sfx('arrow_shoot', { volume: 0.5, detune: (Math.random() - 0.5) * 240, throttleMs: 50 });
        }
        break;
      case 'hit': {
        const v = this.enemies.get(e.enemyId);
        v?.flash();
        const h = this.enemyHeight(e.enemy) - 8;
        if (e.source === 'orbital') break;
        if (e.source === 'knight' || e.source === 'militia') break;
        fx.hitSpark(e.x, e.y, h, e.damageType === 'magic' ? 'blue' : 'white', e.source === 'bolt' || e.source === 'chain' ? 6 : 3);
        if (e.source === 'arrow') Audio.sfx('arrow_hit', { volume: 0.5, throttleMs: 60 });
        else Audio.sfx('wizard_hit', { volume: 0.55, throttleMs: 70 });
        Audio.sfx('ufo_hit', { volume: 0.35, throttleMs: 140, detune: (Math.random() - 0.5) * 300 });
        break;
      }
      case 'chain': {
        const tgt = this.sim.getEnemy(e.targetId);
        const h2 = tgt ? bodyHeightOf(tgt) : 50;
        fx.lightning([
          { gx: e.fromX, gy: e.fromY, h: 50 },
          { gx: e.toX, gy: e.toY, h: h2 },
        ]);
        break;
      }
      case 'fizzle':
        fx.puff(e.x, e.y, 25);
        break;
      case 'kill': {
        const h = this.enemyHeight(e.enemy);
        const big = e.enemy === 'carrier' || e.enemy === 'dread';
        const size = e.boss ? 'huge' : big ? 'big' : 'small';
        fx.explosion(e.x, e.y, size, h);
        if (e.boss) {
          for (let i = 0; i < 6; i++) {
            this.scene.time.delayedCall(i * 140, () => fx.explosion(e.x + (Math.random() - 0.5) * 1.4, e.y + (Math.random() - 0.5) * 1.4, 'big', h + (Math.random() - 0.5) * 60));
          }
          fx.shake(10, 0.8);
          fx.screenFlash(0xffffff, 0.6, 0.6);
        } else if (big) {
          fx.shake(3, 0.2);
        }
        fx.coinPop(e.x, e.y, e.gold, h + 18);
        Audio.sfx(big || e.boss ? 'ufo_explode_big' : 'ufo_explode_small', { volume: big ? 0.9 : 0.6, throttleMs: 45, detune: (Math.random() - 0.5) * 300 });
        if (e.gold > 0) Audio.sfx('coin', { volume: 0.5, throttleMs: 80 });
        break;
      }
      case 'spawn':
        if (e.source !== 'wave') fx.puff(e.x, e.y, 40);
        break;
      case 'escortLaunch':
        if (this.enemies.has(e.fromId)) {
          fx.glowFlash(e.x, e.y, HOVER_BOSS - 10, 0xffa040, 260, 0.5);
          fx.glowFlash(e.x, e.y, 20, 0xffe27a, 160, 0.35);
        }
        break;
      case 'meleeHit': {
        Audio.sfx('sword_clash', { volume: 0.3, throttleMs: 150, detune: (Math.random() - 0.5) * 300 });
        fx.hitSpark(e.x, e.y, 38, 'white', 3);
        if (e.attacker === 'enemy') this.knights.get(e.targetId)?.flash();
        else this.enemies.get(e.targetId)?.flash();
        break;
      }
      case 'knightDeath':
        fx.puff(e.x, e.y, 25);
        Audio.sfx('knight_death', { volume: 0.5, throttleMs: 120 });
        break;
      case 'militiaExpire':
        fx.puff(e.x, e.y, 25);
        break;
      case 'orbitalWarn':
        Audio.sfx('orbital_charge');
        break;
      case 'orbitalHit':
        fx.orbitalBeam(e.x, e.y, e.radius);
        fx.shockwave(e.x, e.y, e.radius * 1.15, 0xdff7ff, 0.55, 12);
        fx.shockwave(e.x, e.y, e.radius * 0.7, 0xffe27a, 0.4, 8);
        fx.explosion(e.x, e.y, 'huge', 10);
        fx.scorch(e.x, e.y, e.radius * 0.9);
        fx.shake(11, 0.55);
        fx.screenFlash(0xe8fbff, 0.4, 0.4);
        Audio.sfx('orbital_blast');
        break;
      case 'reinforce':
        Audio.sfx('reinforcements');
        fx.dust(e.x, e.y, 14);
        fx.shockwave(e.x, e.y, 0.7, 0xbfe1ff, 0.45, 6);
        for (const id of e.knightIds) this.knights.get(id)?.dropIn();
        break;
      case 'leak':
        Audio.sfx('leak');
        fx.leakFlash();
        fx.shake(4, 0.25);
        break;
      case 'waveStart':
        Audio.sfx('wave_start');
        break;
      case 'rally':
        fx.dust(e.x, e.y, 6);
        break;
      default:
        break;
    }
  }

  // ----------------------------------------------------------------------------------- hit-testing

  /** Tower under a world-local point (towers are tall, so test sprite bounds), front-most first. */
  towerAt(lx: number, ly: number): number | null {
    let best: number | null = null;
    let bestDepth = -Infinity;
    for (const [id, v] of this.towers) {
      if (v.hitTest(lx, ly) && v.container.depth > bestDepth) {
        best = id;
        bestDepth = v.container.depth;
      }
    }
    return best;
  }
}
