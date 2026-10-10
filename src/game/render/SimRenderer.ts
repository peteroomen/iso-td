import Phaser from 'phaser';
import type { EnemyId, Sim, SimEvent } from '../../core';
import { Audio } from '../services/audio';
import { SPECS } from '../../core';
import { COLORS } from '../ui/theme';
import { EnemyView } from './EnemyView';
import { Fx, Layers } from './Fx';
import { IsoView, TH, TW, isoX, isoY } from './iso';
import { BarInfo, KnightView } from './KnightView';
import { ProjectileView } from './ProjectileView';
import { FXTEX, SPEC_COLOR } from './specVisuals';
import { HOVER_BOSS, HOVER_FLIER, HOVER_GROUND, bodyHeightOf } from './style';
import { TowerView, towerMuzzleOffset, towerShootHeight } from './TowerView';

/** Height (source px) a knight's arrow leaves at. */
const KNIGHT_SHOOT_H = 38;

interface NetMesh {
  img: Phaser.GameObjects.Image;
  enemyIds: number[];
  slowed: boolean;
  age: number;
  duration: number;
  fade: number;
  w: number;
  h: number;
}

const killNow = (v: { destroy(): void }): void => v.destroy();
const killAnimated = (v: { destroyAnimated(): void }): void => v.destroyAnimated();


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
  /** Frame counter: views touched this frame get stamped, the rest are purged (no per-frame Set allocations). */
  private frame = 0;
  private readonly bar: BarInfo = { x: 0, y: 0, frac: 1, width: 0, show: false, burn: false };
  private barsDirty = false;
  private strikesDirty = false;
  /** Hunting Nets: spread nets lying on the ground while UFOs are caught in them. */
  private readonly nets: NetMesh[] = [];

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
    const frame = ++this.frame;

    // 1. create / update views of everything alive
    for (const t of s.towers) {
      let v = this.towers.get(t.id);
      if (!v) {
        v = new TowerView(this.scene, this.L, t, this.fx);
        this.towers.set(t.id, v);
      }
      if (t.kind === 'barracks' && t.rallyX !== null && t.rallyY !== null) {
        v.setDoorFacing(t.rallyX - t.rallyY - (t.x - t.y), t);
      }
      v.stamp = frame;
      v.update(t, dt);
    }
    for (const k of s.knights) {
      let v = this.knights.get(k.id);
      if (!v) {
        v = new KnightView(this.scene, this.L, k);
        this.knights.set(k.id, v);
      }
      v.stamp = frame;
      v.update(k, time, dt);
    }
    for (const e of s.enemies) {
      let v = this.enemies.get(e.id);
      if (!v) {
        v = new EnemyView(this.scene, this.L, e);
        this.enemies.set(e.id, v);
      }
      v.stamp = frame;
      v.update(e, time);
      if (e.burning) v.tickBurn(e, dt, this.lick);
    }
    this.updateNets(dt);
    for (const p of s.projectiles) {
      let v = this.projectiles.get(p.id);
      if (!v) {
        v = new ProjectileView(this.scene, this.L, p, 0, 0);
        this.projectiles.set(p.id, v);
        if (v.golden) this.goldenGlint(p);
      }
      const tower = this.sim.getTower(p.towerId);
      if (v.isLob) {
        v.stamp = frame;
        v.setHeights((p.kind === 'shell' || p.kind === 'net') && tower ? towerShootHeight(tower.kind, tower.level) : 0, 0);
        v.update(p, 0);
        continue;
      }
      const tgt = this.sim.getEnemy(p.targetId);
      const th = p.kind === 'knightArrow' ? KNIGHT_SHOOT_H : tower ? towerShootHeight(tower.kind, tower.level) : 70;
      const targetH = tgt ? bodyHeightOf(tgt) : 30;
      // interpolate height from tower top to target body height
      v.stamp = frame;
      v.setHeights(th, targetH);
      v.update(p, targetH);
      if (v.isBolt) this.fx.trail(v.gx, v.gy, v.h);
      else if (v.golden) this.fx.trail(v.gx, v.gy, v.h, true);
      else if (v.kind === 'missile') this.fx.rocketTrail(v.gx, v.gy, v.h);
    }

    // 2. events (views of dying things still exist here)
    for (const e of events) this.handle(e);

    // 3. purge views whose entity is gone
    this.purge(this.towers, killAnimated);
    this.purge(this.knights, killNow);
    this.purge(this.enemies, killNow);
    this.purge(this.projectiles, killNow);

    this.drawBars();
    this.drawStrikes(time, dt);
    this.L.entityC.sort('depth');
  }

  private purge<V extends { stamp: number }>(map: Map<number, V>, kill: (v: V) => void): void {
    for (const [id, v] of map) {
      if (v.stamp !== this.frame) {
        kill(v);
        map.delete(id);
      }
    }
  }

  // ----------------------------------------------------------------------------------- bars

  private drawBars(): void {
    const g = this.barsGfx;
    const s = this.sim.state;
    const k = this.k;
    const b = this.bar;
    let cleared = false;
    const draw = () => {
      if (!b.show) return;
      // only touch the Graphics when there is something to draw (or something stale to wipe)
      if (!cleared) {
        g.clear();
        cleared = true;
      }
      const w = b.width * k;
      const h = 6 * k;
      const x = b.x - w / 2;
      const y = b.y - h;
      const o = 1.5 * k;
      const f = Math.max(0, Math.min(1, b.frac));
      g.fillStyle(0x2e222f, 1).fillRoundedRect(x - o, y - o, w + 2 * o, h + 2 * o, 3 * k);
      g.fillStyle(0x5a3a48, 1).fillRect(x, y, w, h);
      g.fillStyle(b.burn ? 0xff8a1f : f > 0.5 ? 0x6cc24a : f > 0.25 ? 0xf2c230 : 0xe5484d, 1).fillRect(x, y, w * f, h);
      g.fillStyle(0xffffff, 0.35).fillRect(x, y, w * f, h * 0.38);
      if (b.burn) g.fillStyle(0xffe27a, 0.45).fillRect(x, y + h * 0.62, w * f, h * 0.38);
    };
    for (const e of s.enemies) {
      const v = this.enemies.get(e.id);
      if (v) {
        v.bar(e, b);
        draw();
      }
    }
    for (const kn of s.knights) {
      const v = this.knights.get(kn.id);
      if (v) {
        v.bar(kn, b);
        draw();
      }
    }
    if (!cleared && this.barsDirty) g.clear();
    this.barsDirty = cleared;
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
    const s = this.sim.state;
    const any = s.strikes.length > 0 || s.burns.length > 0;
    if (!any) {
      if (this.strikesDirty) {
        g.clear();
        this.strikesDirty = false;
      }
      return;
    }
    this.strikesDirty = true;
    g.clear();
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
    for (const b of s.burns) {
      const f = b.timer / b.duration;
      const fade = Math.min(1, f * 2);
      g.fillStyle(0xff6a1a, (0.26 + 0.12 * Math.sin(time * 0.03 + b.id)) * fade);
      this.ellipse(g, b.x, b.y, b.radius, 'fill');
      g.fillStyle(0xffc04a, 0.16 * fade);
      this.ellipse(g, b.x, b.y, b.radius * 0.6, 'fill');
      g.lineStyle(3 * this.k * 0.8, 0xffa040, 0.7 * fade);
      this.ellipse(g, b.x, b.y, b.radius, 'stroke');
      const n = Math.max(1, Math.round(dt * 60 * 1.5));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * b.radius;
        this.fx.emberAt(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
      }
    }
  }

  // ----------------------------------------------------------------------------------- events

  /** Body-centre height of an enemy: its live view (follows netted fliers sinking) or the type's default. */
  private heightOfId(id: number, type: EnemyId): number {
    return this.enemies.get(id)?.bodyH() ?? this.enemyHeight(type);
  }

  private readonly lick = (x: number, y: number): void => this.fx.flameAt(x, y);

  private enemyHeight(type: EnemyId): number {
    if (type === 'mothership') return HOVER_BOSS + 36;
    if (type === 'skimmer') return HOVER_FLIER + 30;
    return HOVER_GROUND + 30;
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
        if (e.kind === 'bomb') {
          this.bombLaunch(e.towerId);
        } else if (e.kind === 'wizard') {
          Audio.sfx('wizard_cast', { volume: 0.55, detune: (Math.random() - 0.5) * 200, throttleMs: 60 });
          fx.hitSpark(e.x, e.y, towerShootHeight('wizard', 2), 'blue', 3);
        } else {
          Audio.sfx('arrow_shoot', { volume: 0.5, detune: (Math.random() - 0.5) * 240, throttleMs: 50 });
        }
        break;
      case 'explode':
        this.bombBlast(e);
        break;
      case 'cluster':
        fx.puff(e.x, e.y, 14);
        fx.hitSpark(e.x, e.y, 16, 'gold', 6);
        Audio.sfx('build_tower', { volume: 0.12, detune: 1200, throttleMs: 120 });
        break;
      case 'hit': {
        const v = this.enemies.get(e.enemyId);
        v?.flash();
        const h = this.heightOfId(e.enemyId, e.enemy) - 4;
        if (e.source === 'orbital') break;
        if (e.source === 'shell' || e.source === 'bomblet') break; // the explosion already shows it
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
        const h1 = this.heightAround(e.fromX, e.fromY);
        // later jumps arrive a beat after the previous one and are dimmer
        const k = e.jump === 1 ? 1 : e.jump === 2 ? 0.72 : 0.5;
        const go = () => {
          fx.lightning([{ gx: e.fromX, gy: e.fromY, h: h1 }, { gx: e.toX, gy: e.toY, h: h2 }], 0x9fe0ff, k);
          fx.hitSpark(e.toX, e.toY, h2, 'blue', 2 + Math.round(3 * k));
        };
        if (e.jump === 1) go();
        else this.scene.time.delayedCall(70 * (e.jump - 1), go);
        Audio.sfx('wizard_hit', { volume: 0.3 * k, detune: 300 + e.jump * 150, throttleMs: 150 });
        break;
      }
      case 'specialize': {
        const v = this.towers.get(e.towerId);
        v?.pop('upgrade');
        fx.specBurst(e.x, e.y, e.specId, SPEC_COLOR[e.specId], (v ? towerShootHeight(e.kind, 3) : 60) + 22);
        fx.floatText(e.x, e.y, SPECS[e.specId].name, '#ffe27a', towerShootHeight(e.kind, 3) + 54, 22);
        fx.shake(2.5, 0.2);
        Audio.sfx('upgrade_tower');
        this.scene.time.delayedCall(140, () => Audio.sfx('star_earned', { volume: 0.4, throttleMs: 200 }));
        break;
      }
      case 'netLaunch': {
        Audio.sfx('arrow_shoot', { volume: 0.34, detune: 500, throttleMs: 120 });
        break;
      }
      case 'net': {
        fx.netLand(e.x, e.y, e.radius);
        this.nets.push(this.makeNet(e));
        Audio.sfx('sword_clash', { volume: 0.2, detune: 900, throttleMs: 200 });
        break;
      }
      case 'netExpire': {
        const h = this.enemies.get(e.enemyId)?.bodyH() ?? 40;
        fx.ropeSnap(e.x, e.y, h);
        break;
      }
      case 'missileLaunch': {
        const v = this.towers.get(e.towerId);
        if (v) {
          v.kickPod();
          const m = v.podMouth();
          fx.muzzleBlast(m.x, m.y, 0.7);
        }
        Audio.sfx('arrow_shoot', { volume: 0.5, detune: -700, throttleMs: 150 });
        Audio.sfx('arrow_shoot', { volume: 0.3, detune: -1000, throttleMs: 150 });
        break;
      }
      case 'ignite': {
        if (!e.refreshed) {
          const h = this.heightOfId(e.enemyId, 'scout');
          fx.glowFlash(e.x, e.y, h, 0xff7a2a, 90, 0.25);
          for (let i = 0; i < 4; i++) fx.flameAt(isoX(e.x, e.y) + (Math.random() - 0.5) * 16, isoY(e.x, e.y) - h + (Math.random() - 0.5) * 10);
        }
        break;
      }
      case 'knightShoot': {
        Audio.sfx('arrow_shoot', { volume: 0.2, detune: 350 + Math.random() * 200, throttleMs: 120 });
        break;
      }
      case 'fizzle':
        fx.puff(e.x, e.y, 25);
        break;
      case 'kill': {
        const h = this.heightOfId(e.enemyId, e.enemy);
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
        fx.coinPop(e.x, e.y, e.gold, h + 14);
        Audio.sfx(big || e.boss ? 'ufo_explode_big' : 'ufo_explode_small', { volume: big ? 0.9 : 0.6, throttleMs: 45, detune: (Math.random() - 0.5) * 300 });
        if (e.gold > 0) Audio.sfx('coin', { volume: 0.5, throttleMs: 80 });
        break;
      }
      case 'spawn':
        if (e.source !== 'wave') fx.puff(e.x, e.y, 40);
        break;
      case 'escortLaunch':
        if (this.enemies.has(e.fromId)) {
          fx.glowFlash(e.x, e.y, HOVER_BOSS - 6, 0xffa040, 260, 0.5);
          fx.glowFlash(e.x, e.y, 10, 0xffe27a, 160, 0.35);
        }
        break;
      case 'meleeHit': {
        Audio.sfx('sword_clash', { volume: 0.3, throttleMs: 150, detune: (Math.random() - 0.5) * 300 });
        fx.hitSpark(e.x, e.y, 30, 'white', 3);
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

  // ----------------------------------------------------------------------------------- bomb tower

  private bombLaunch(towerId: number): void {
    const v = this.towers.get(towerId);
    const t = this.sim.getTower(towerId);
    if (v && t) {
      const m = towerMuzzleOffset('bomb', t.level);
      if (m) this.fx.muzzleBlast(v.container.x + m.x, v.container.y + m.y, t.spec === 'bigger_bombs' ? 1.75 : 1);
    }
    // a low "thump": the build sound pitched way down (the cannon sounds least wrong of the existing sfx)
    Audio.sfx('build_tower', { volume: 0.32, detune: -1000 + (Math.random() - 0.5) * 160, throttleMs: 80 });
  }

  private bombBlast(e: Extract<SimEvent, { type: 'explode' }>): void {
    if (e.kind === 'missile') {
      // a small, sharp blast: the bomblet-size effect plus a little fireball
      this.fx.bombBlast(e.x, e.y, Math.max(0.45, e.radius), false, false);
      this.fx.explosion(e.x, e.y, 'small', 26);
      Audio.sfx('ufo_explode_small', { volume: 0.34, detune: -150 + (Math.random() - 0.5) * 200, throttleMs: 70 });
      return;
    }
    const shell = e.kind === 'shell';
    this.fx.bombBlast(e.x, e.y, e.radius, shell, shell && this.sim.getTower(e.towerId)?.level === 3);
    if (shell) Audio.sfx('ufo_explode_small', { volume: 0.55, detune: -500 + (Math.random() - 0.5) * 200, throttleMs: 60 });
    else Audio.sfx('ufo_explode_small', { volume: 0.22, detune: 100 + Math.random() * 300, throttleMs: 90 });
  }

  // ----------------------------------------------------------------------------------- spec effects

  /** Body height of whichever living UFO stands at a grid point (chain lightning starts there), else a ground default. */
  private heightAround(gx: number, gy: number): number {
    let best = 52;
    let bd = 0.09;
    for (const en of this.sim.state.enemies) {
      const d = (en.x - gx) * (en.x - gx) + (en.y - gy) * (en.y - gy);
      if (d < bd) {
        bd = d;
        best = this.enemies.get(en.id)?.bodyH() ?? bodyHeightOf(en);
      }
    }
    return best;
  }

  private goldenGlint(p: { towerId: number; fromX: number; fromY: number }): void {
    const t = this.sim.getTower(p.towerId);
    const h = t ? towerShootHeight(t.kind, t.level) : 80;
    this.fx.hitSpark(p.fromX, p.fromY, h, 'gold', 7);
    this.fx.glowFlash(p.fromX, p.fromY, h, 0xffe27a, 110, 0.3);
    Audio.sfx('star_earned', { volume: 0.11, detune: 600, throttleMs: 400 });
  }

  private makeNet(e: Extract<SimEvent, { type: 'net' }>): NetMesh {
    const rx = e.radius * TW * 0.7071 * 2;
    const img = this.scene.add.image(isoX(e.x, e.y), isoY(e.x, e.y), FXTEX.netMesh).setAlpha(0);
    img.setDisplaySize(rx, rx * (TH / TW));
    this.L.fxC.addAt(img, 0);
    return { img, enemyIds: e.enemyIds, slowed: e.enemyIds.length === 0 || e.slowedIds.length > 0, age: 0, duration: e.duration, fade: 0, w: rx, h: rx * (TH / TW) };
  }

  /** The net stays while any caught UFO is still netted (bosses: it just shows for the slow's duration), then fades. */
  private updateNets(dt: number): void {
    for (let i = this.nets.length - 1; i >= 0; i--) {
      const n = this.nets[i];
      n.age += dt;
      let alive = n.age < n.duration + 0.25;
      if (alive && n.enemyIds.length > 0 && n.age > 0.1 && !n.slowed) {
        alive = false;
        for (const id of n.enemyIds) if (this.sim.getEnemy(id)?.netted) alive = true;
      }
      if (!alive) n.fade += dt / 0.35;
      if (n.fade >= 1) {
        n.img.destroy();
        this.nets.splice(i, 1);
        continue;
      }
      const born = Math.min(1, n.age / 0.18);
      const settle = 1 + 0.25 * (1 - born) * (1 - born);
      const pulse = 0.82 + 0.1 * Math.sin(n.age * 6);
      n.img.setAlpha(born * pulse * (1 - n.fade) * (n.slowed ? 0.7 : 1)).setDisplaySize(n.w * settle, n.h * settle);
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
