import Phaser from 'phaser';
import { KNIGHT, MAX_TOWER_LEVEL, RALLY_PATH_TOLERANCE, TOWERS, TOWER_KINDS, type AbilityId, type FailReason, type Sim, type TowerKind, type TowerState } from '../../core';
import type { GroundMarkers } from '../render/GroundMarkers';
import type { IsoView } from '../render/iso';
import type { SimRenderer } from '../render/SimRenderer';
import { TEX } from '../render/textures';
import { Audio } from '../services/audio';
import { COLORS } from '../ui/theme';
import { ptrX, ptrY } from '../ui/viewport';
import type { AbilityBar } from './AbilityBar';
import type { Hud } from './Hud';
import { RadialMenu, type RadialItem } from './RadialMenu';
import type { TipRow, TipSpec } from './Tooltip';
import { isHud } from './widgets';

type Mode = { kind: 'idle' } | { kind: 'ability'; id: AbilityId } | { kind: 'rally'; towerId: number };

const REASON: Record<FailReason, string> = {
  gold: 'Not enough gold',
  capped: 'Unlocks later in the campaign',
  max_level: 'Already at max level',
  occupied: 'Spot already in use',
  no_spot: 'No build spot here',
  no_tower: 'No tower here',
  wrong_kind: 'Barracks only',
  out_of_range: 'Out of range',
  not_on_road: 'Pick a spot on the road',
  cooldown: 'Still recharging',
  wave_in_progress: 'Wave in progress',
  no_more_waves: 'No more waves',
  not_running: 'Start the first wave first',
  ended: 'The battle is over',
};

const TOWER_ICON: Record<TowerKind, { key: (lvl: number) => string; h: number }> = {
  archer: { key: (l) => `towers/archer_level_${l}`, h: 52 },
  wizard: { key: (l) => `towers/wizard_level_${l}`, h: 44 },
  barracks: { key: (l) => `towers/barrack_level_${l}_1`, h: 50 },
  bomb: { key: (l) => `towers/bomb_level_${l}`, h: 52 },
};

const TOWER_BLURB: Record<TowerKind, string> = {
  archer: 'Fast and cheap. Shoots ground UFOs and fliers.',
  wizard: 'Magic bolts ignore armor. Shoots ground UFOs and fliers.',
  barracks: 'Knights block ground UFOs and fight them. Cannot stop fliers.',
  bomb: 'Lobs shells that blast whole groups of ground UFOs.',
};

const TOWER_ROLE: Record<TowerKind, string> = { archer: 'Fast', wizard: 'Magic', barracks: 'Blocks', bomb: 'Splash' };

const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));

export interface InteractionDeps {
  scene: Phaser.Scene;
  sim: Sim;
  view: IsoView;
  simView: SimRenderer;
  markers: GroundMarkers;
  hud: Hud;
  abilities: AbilityBar;
  isBlocked: () => boolean;
  /** Map pan / zoom state: a press that turned into a drag or pinch is not a tap. */
  camera?: { readonly gestureHappened: boolean };
}

/** Pointer + keyboard interaction: build/upgrade menus, ability targeting, rally placement. */
export class InteractionController {
  private readonly menu: RadialMenu;
  private mode: Mode = { kind: 'idle' };
  private selectedTower: number | null = null;
  private menuSpot: number | null = null;
  private hoverTower: number | null = null;
  private readonly occupied = new Set<number>();
  private occupancySig = NaN;
  private occupancyCount = -1;
  private readonly d: InteractionDeps;

  constructor(deps: InteractionDeps) {
    this.d = deps;
    this.menu = new RadialMenu(deps.scene, deps.hud);
    const input = deps.scene.input;
    input.mouse?.disableContextMenu();
    input.on('pointerdown', this.onDown, this);
    input.on('pointermove', this.onMove, this);
    input.on('pointerup', this.onUp, this);
    deps.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off('pointerdown', this.onDown, this);
      input.off('pointermove', this.onMove, this);
      input.off('pointerup', this.onUp, this);
    });
  }

  get armedAbility(): AbilityId | null {
    return this.mode.kind === 'ability' ? this.mode.id : null;
  }

  // ------------------------------------------------------------------ feedback helpers

  private fail(reason: FailReason | undefined, x?: number, y?: number): void {
    const msg = REASON[reason ?? 'ended'];
    this.d.hud.toast(msg, x, y);
    Audio.sfx('ui_error', { throttleMs: 120 });
  }

  // ------------------------------------------------------------------ mode control

  cancelAll(): void {
    this.setMode({ kind: 'idle' });
    this.closeMenu();
  }

  /** Returns true if Esc did something other than pausing. */
  handleEscape(): boolean {
    if (this.mode.kind !== 'idle') {
      this.cancelAll();
      return true;
    }
    if (this.menu.isOpen || this.selectedTower !== null) {
      this.closeMenu();
      return true;
    }
    return false;
  }

  private setMode(m: Mode): void {
    this.mode = m;
    const mk = this.d.markers;
    mk.reticle = null;
    this.d.abilities.setArmed(m.kind === 'ability' ? m.id : null);
    mk.showSpotGlow = m.kind === 'idle';
    if (m.kind === 'ability') {
      this.closeMenu();
      this.d.scene.input.setDefaultCursor('crosshair');
      mk.range = null;
      mk.setRallyFlags([]);
    } else if (m.kind === 'rally') {
      this.d.scene.input.setDefaultCursor('crosshair');
      const t = this.d.sim.getTower(m.towerId);
      if (t) mk.range = { gx: t.x, gy: t.y, r: t.range, color: 0x7dff8a };
      this.refreshFlags();
    } else {
      this.d.scene.input.setDefaultCursor('default');
      this.d.hud.tooltip.hide();
    }
  }

  armAbility(id: AbilityId): void {
    const sim = this.d.sim;
    if (this.mode.kind === 'ability' && this.mode.id === id) {
      this.setMode({ kind: 'idle' });
      return;
    }
    const ab = sim.state.abilities[id];
    if (sim.state.status === 'pre') {
      this.fail('not_running', this.d.abilities.slotPos(id).x + 60, this.d.abilities.slotPos(id).y - 50);
      return;
    }
    if (ab.cooldown > 0) {
      this.fail('cooldown', this.d.abilities.slotPos(id).x + 60, this.d.abilities.slotPos(id).y - 50);
      return;
    }
    Audio.sfx('ui_click');
    this.setMode({ kind: 'ability', id });
    this.updateReticle(this.d.scene.input.activePointer);
  }

  // ------------------------------------------------------------------ menus

  /** Briefly shows a (new / upgraded) tower's range once its menu is gone. */
  private flashRange(towerId: number): void {
    const t = this.d.sim.getTower(towerId);
    if (!t) return;
    const r = { gx: t.x, gy: t.y, r: t.range, color: t.kind === 'barracks' ? 0x7dff8a : 0xffffff };
    const mk = this.d.markers;
    mk.range = r;
    this.d.scene.time.delayedCall(1400, () => {
      if (mk.range === r && this.selectedTower === null && this.menuSpot === null && this.mode.kind === 'idle') mk.range = null;
    });
  }

  private closeMenu(): void {
    this.menu.close();
    this.menuSpot = null;
    this.selectedTower = null;
    const mk = this.d.markers;
    mk.selected = null;
    mk.range = null;
    mk.range2 = null;
    mk.setRallyFlags([]);
    if (this.mode.kind === 'rally') this.setMode({ kind: 'idle' });
  }

  private refreshFlags(): void {
    const mk = this.d.markers;
    const t = this.selectedTower !== null ? this.d.sim.getTower(this.selectedTower) : undefined;
    if (t && t.kind === 'barracks' && t.rallyX !== null && t.rallyY !== null) mk.setRallyFlags([{ gx: t.rallyX, gy: t.rallyY }]);
    else mk.setRallyFlags([]);
  }

  private anchorFor(gx: number, gy: number, lift: number): { x: number; y: number } {
    const p = this.d.view.toScreen(gx, gy);
    return { x: p.x, y: p.y - lift * this.d.view.scale };
  }

  private openBuildMenu(spotId: number): void {
    const { sim, markers } = this.d;
    const spot = sim.spots[spotId];
    this.menuSpot = spotId;
    this.selectedTower = null;
    markers.selected = null;
    markers.range = null;
    const a = this.anchorFor(spot.x, spot.y, 40);
    const items: RadialItem[] = TOWER_KINDS.map((kind) => ({
      icon: TOWER_ICON[kind].key(1),
      iconH: TOWER_ICON[kind].h,
      color: kind === 'archer' ? 0x4f7d3a : kind === 'wizard' ? 0x4a5cb0 : kind === 'bomb' ? 0xb0502e : 0x8a5a3a,
      cost: () => sim.costOf(kind),
      state: () => {
        const r = sim.canBuild(spotId, kind);
        return r.ok ? 'ok' : r.reason === 'capped' ? 'locked' : r.reason === 'gold' ? 'poor' : 'ok';
      },
      tip: () => this.buildTip(kind),
      onHover: (over) => {
        const st = sim.statsFor(kind, 1);
        markers.range = over ? { gx: spot.x, gy: spot.y, r: st.range, color: kind === 'barracks' ? 0x7dff8a : 0xffffff } : null;
      },
      role: TOWER_ROLE[kind],
      onSelect: () => {
        const r = sim.build(spotId, kind);
        if (r.ok) {
          this.closeMenu();
          const nt = sim.towerAtSpot(spotId);
          if (nt) this.flashRange(nt.id);
        } else this.fail(r.reason, a.x, a.y - 110);
      },
    }));
    markers.hoverSpot = spotId;
    this.menu.open(a.x, a.y, items);
    Audio.sfx('ui_click', { volume: 0.5 });
  }

  private openTowerMenu(towerId: number): void {
    const { sim, markers } = this.d;
    const t = sim.getTower(towerId);
    if (!t) return;
    this.selectedTower = towerId;
    this.menuSpot = null;
    markers.selected = { gx: t.x, gy: t.y };
    markers.range = { gx: t.x, gy: t.y, r: t.range, color: t.kind === 'barracks' ? 0x7dff8a : 0xffffff };
    this.refreshFlags();
    const a = this.anchorFor(t.x, t.y, 50);
    const items: RadialItem[] = [];
    // upgrade
    items.push({
      icon: TEX.upgrade,
      iconH: 40,
      color: 0x3f7f45,
      cost: () => sim.upgradeCostOf(towerId),
      badge: undefined,
      state: () => {
        const r = sim.canUpgrade(towerId);
        if (r.ok) return 'ok';
        if (r.reason === 'gold') return 'poor';
        return 'locked';
      },
      tip: () => this.upgradeTip(towerId),
      onHover: (over) => {
        const cur = sim.getTower(towerId);
        if (!cur || cur.level >= MAX_TOWER_LEVEL) return;
        const next = sim.statsFor(cur.kind, cur.level + 1);
        markers.range2 = over ? { gx: cur.x, gy: cur.y, r: next.range, color: 0xffe27a } : null;
      },
      role: 'Upgrade',
      onSelect: () => {
        const r = sim.upgrade(towerId);
        if (r.ok) {
          this.closeMenu();
          this.flashRange(towerId);
        } else this.fail(r.reason, a.x, a.y - 110);
      },
    });
    if (t.kind === 'barracks') {
      items.push({
        icon: TEX.flag,
        iconH: 40,
        color: 0x3a63c9,
        state: () => 'ok',
        role: 'Rally',
        tip: () => ({ title: 'Rally point', note: 'Move your knights: then click on the road inside the green circle.' }),
        onSelect: () => {
          this.menu.close();
          this.setMode({ kind: 'rally', towerId });
        },
      });
    }
    items.push({
      icon: TEX.sell,
      iconH: 40,
      color: 0x9a5a1a,
      state: () => 'ok',
      tip: () => ({
        title: 'Sell tower',
        rows: [{ text: 'Refund', right: `+${sim.sellValueOf(towerId)}`, rightColor: COLORS.textGold }],
        note: 'Returns 60% of the gold you invested.',
      }),
      role: 'Sell',
      confirmText: () => `Confirm ${sim.sellValueOf(towerId)}g?`,
      onSelect: () => {
        const r = sim.sell(towerId);
        if (r.ok) this.closeMenu();
        else this.fail(r.reason, a.x, a.y - 110);
      },
    });
    this.menu.open(a.x, a.y, items);
    Audio.sfx('ui_click', { volume: 0.5 });
  }

  // ------------------------------------------------------------------ tooltips

  private statRows(kind: TowerKind, level: number, vs?: { kind: TowerKind; level: number }): TipRow[] {
    const sim = this.d.sim;
    const s = sim.statsFor(kind, level);
    const o = vs ? sim.statsFor(vs.kind, vs.level) : null;
    const pair = (a: string, b: string): { right: string; rightColor?: string } => (o && a !== b ? { right: `${a}  >  ${b}`, rightColor: '#9bf06a' } : { right: b });
    const dmg = (x: typeof s) => (Math.round(x.damageMin) === Math.round(x.damageMax) ? fmt(x.damageMin) : `${Math.round(x.damageMin)}-${Math.round(x.damageMax)}`);
    const rows: TipRow[] = [];
    if (kind === 'barracks') {
      rows.push({ text: 'Knights', ...pair(o ? String(o.knights) : '', String(s.knights)) });
      rows.push({ text: 'Health', ...pair(o ? fmt(o.knightHp) : '', fmt(s.knightHp)) });
      rows.push({ text: 'Damage', ...pair(o ? dmg(o) : '', dmg(s)) });
      rows.push({ text: 'Armor', ...pair(o ? `${Math.round(o.knightArmor * 100)}%` : '', `${Math.round(s.knightArmor * 100)}%`) });
      rows.push({ text: 'Respawn', right: `${fmt(s.knightRespawn)}s` });
    } else {
      rows.push({ text: 'Damage', ...pair(o ? dmg(o) : '', dmg(s)) });
      rows.push({ text: 'Fire rate', ...pair(o ? `${fmt(o.cooldown)}s` : '', `${fmt(s.cooldown)}s`) });
      rows.push({ text: 'Range', ...pair(o ? fmt(o.range) : '', fmt(s.range)) });
      if (kind === 'bomb') rows.push({ text: 'Splash radius', ...pair(o ? fmt(o.splashRadius) : '', fmt(s.splashRadius)) });
      rows.push({ text: kind === 'bomb' ? 'DPS (per target)' : 'DPS', ...pair(o ? fmt(o.dps) : '', fmt(s.dps)) });
    }
    if (s.special) rows.push({ text: s.special, color: '#ffe27a', size: 15 });
    if (s.groundOnly) rows.push({ text: "Ground only: can't hit fliers", color: '#ff9a8a', size: 15 });
    return rows;
  }

  private buildTip(kind: TowerKind): TipSpec {
    const sim = this.d.sim;
    const cost = sim.costOf(kind);
    return {
      title: TOWERS[kind].name,
      rows: this.statRows(kind, 1),
      note: TOWER_BLURB[kind],
      cost: { amount: cost, ok: sim.canAfford(cost) },
      minWidth: 210,
    };
  }

  private upgradeTip(towerId: number): TipSpec {
    const sim = this.d.sim;
    const t = sim.getTower(towerId);
    if (!t) return { title: 'Upgrade' };
    if (t.level >= MAX_TOWER_LEVEL) return { title: 'Max level', rows: this.statRows(t.kind, t.level), note: 'This tower is fully upgraded.' };
    const r = sim.canUpgrade(towerId);
    if (r.reason === 'capped') {
      return { title: 'Locked', note: `Unlocks later in the campaign. This stage allows ${TOWERS[t.kind].name}s up to level ${sim.towerCap[t.kind]}.`, noteColor: '#ffb35c', minWidth: 220 };
    }
    const cost = sim.upgradeCostOf(towerId) ?? 0;
    return {
      title: `Upgrade to Level ${t.level + 1}`,
      rows: this.statRows(t.kind, t.level + 1, { kind: t.kind, level: t.level }),
      cost: { amount: cost, ok: sim.canAfford(cost) },
      minWidth: 230,
    };
  }

  // ------------------------------------------------------------------ pointer

  private spotAt(gx: number, gy: number): number | null {
    const col = Math.floor(gx);
    const row = Math.floor(gy);
    for (const s of this.d.sim.spots) if (s.col === col && s.row === row) return s.id;
    return null;
  }

  private onMove(p: Phaser.Input.Pointer, over?: unknown[]): void {
    if (this.d.isBlocked()) return;
    const { view, markers, simView } = this.d;
    const hudOver = (over ?? this.d.scene.input.hitTestPointer(p)).some(isHud);
    if (this.mode.kind !== 'idle') {
      this.updateReticle(p);
      return;
    }
    let hoverSpot: number | null = null;
    let hoverTower: number | null = null;
    if (!hudOver) {
      const lp = view.toLocal(ptrX(p), ptrY(p));
      const tid = simView.towerAt(lp.x, lp.y);
      if (tid !== null) hoverTower = tid;
      else {
        const g = view.toGrid(ptrX(p), ptrY(p));
        hoverSpot = this.spotAt(g.x, g.y);
        if (hoverSpot !== null && this.d.sim.towerAtSpot(hoverSpot)) hoverSpot = null;
      }
    }
    markers.hoverSpot = this.menuSpot ?? hoverSpot;
    if (hoverTower !== this.hoverTower) {
      this.hoverTower = hoverTower;
      if (this.selectedTower === null && this.menuSpot === null) {
        const t = hoverTower !== null ? this.d.sim.getTower(hoverTower) : undefined;
        markers.range = t ? { gx: t.x, gy: t.y, r: t.range, color: t.kind === 'barracks' ? 0x7dff8a : 0xffffff } : null;
      }
    }
    if (!hudOver) this.d.scene.input.setDefaultCursor(hoverSpot !== null || hoverTower !== null ? 'pointer' : 'default');
  }

  private snapToRoad(gx: number, gy: number, tol: number): { x: number; y: number } | null {
    const n = this.d.sim.nearestPathPoint({ x: gx, y: gy });
    if (n && n.dist <= tol) return { x: n.x, y: n.y };
    return null;
  }

  private updateReticle(p: Phaser.Input.Pointer): void {
    const { sim, view, markers } = this.d;
    const g = view.toGrid(ptrX(p), ptrY(p));
    if (this.mode.kind === 'ability') {
      if (this.mode.id === 'orbital') {
        const ab = sim.state.abilities.orbital;
        markers.reticle = { gx: g.x, gy: g.y, r: ab.radius, valid: sim.canCastOrbital(g).ok };
      } else {
        const snap = this.snapToRoad(g.x, g.y, sim.state.abilities.reinforce.pathRange);
        const pos = snap ?? g;
        markers.reticle = { gx: pos.x, gy: pos.y, r: KNIGHT.engageRange, valid: !!snap && sim.canCastReinforcements(pos).ok, snap: snap ? { gx: snap.x, gy: snap.y } : undefined };
      }
    } else if (this.mode.kind === 'rally') {
      const snap = this.snapToRoad(g.x, g.y, RALLY_PATH_TOLERANCE);
      const pos = snap ?? g;
      const ok = !!snap && sim.canSetRally(this.mode.towerId, pos).ok;
      markers.reticle = { gx: pos.x, gy: pos.y, r: 0.35, valid: ok };
      markers.setRallyFlags([{ gx: pos.x, gy: pos.y, preview: true }]);
    }
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.d.isBlocked()) return;
    if (p.rightButtonDown()) {
      if (this.mode.kind !== 'idle' || this.menu.isOpen) this.cancelAll();
      return;
    }
    const hudHit = over.find(isHud);
    if (hudHit) {
      // keep the ring menu open when its own buttons (or other flagged widgets) are pressed
      if (!(hudHit as { __keep?: boolean }).__keep && this.mode.kind === 'idle') this.closeMenu();
      return;
    }
    // world taps act on release, so a drag / pinch (pan & zoom) never selects or builds anything
    this.tapPointer = p.id;
  }

  private tapPointer = -1;

  /** The view is being panned / zoomed: screen-anchored ring menus would detach from their spot. */
  viewMoved(): void {
    this.tapPointer = -1;
    if (this.mode.kind === 'idle' && this.menu.isOpen) this.closeMenu();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.tapPointer !== p.id) return;
    this.tapPointer = -1;
    if (this.d.isBlocked() || this.d.camera?.gestureHappened) return;
    this.tap(p);
  }

  private tap(p: Phaser.Input.Pointer): void {
    const { sim, view, simView } = this.d;
    const g = view.toGrid(ptrX(p), ptrY(p));

    if (this.mode.kind === 'ability') {
      const id = this.mode.id;
      if (id === 'orbital') {
        const r = sim.castOrbital(g);
        if (r.ok) this.setMode({ kind: 'idle' });
        else this.fail(r.reason, ptrX(p), ptrY(p) - 40);
      } else {
        const snap = this.snapToRoad(g.x, g.y, sim.state.abilities.reinforce.pathRange);
        if (!snap) {
          this.fail('not_on_road', ptrX(p), ptrY(p) - 40);
          return;
        }
        const r = sim.castReinforcements(snap);
        if (r.ok) this.setMode({ kind: 'idle' });
        else this.fail(r.reason, ptrX(p), ptrY(p) - 40);
      }
      return;
    }
    if (this.mode.kind === 'rally') {
      const towerId = this.mode.towerId;
      const snap = this.snapToRoad(g.x, g.y, RALLY_PATH_TOLERANCE);
      if (!snap) {
        this.fail('not_on_road', ptrX(p), ptrY(p) - 40);
        return;
      }
      const r = sim.setRally(towerId, snap);
      if (r.ok) {
        Audio.sfx('ui_click');
        this.setMode({ kind: 'idle' });
        this.closeMenu();
      } else this.fail(r.reason, ptrX(p), ptrY(p) - 40);
      return;
    }

    // idle: select tower / spot / nothing
    const lp = view.toLocal(ptrX(p), ptrY(p));
    const tid = simView.towerAt(lp.x, lp.y);
    if (tid !== null) {
      if (this.selectedTower === tid && this.menu.isOpen) this.closeMenu();
      else {
        this.closeMenu();
        this.openTowerMenu(tid);
      }
      return;
    }
    const spot = this.spotAt(g.x, g.y);
    if (spot !== null) {
      const tw = sim.towerAtSpot(spot);
      if (tw) {
        this.closeMenu();
        this.openTowerMenu(tw.id);
      } else if (this.menuSpot === spot) this.closeMenu();
      else {
        this.closeMenu();
        this.openBuildMenu(spot);
      }
      return;
    }
    this.closeMenu();
  }

  // ------------------------------------------------------------------ per frame

  update(time: number): void {
    const { sim, markers } = this.d;
    // which spots are free only changes on build/sell: recompute when the occupancy signature changes (no per-frame Set)
    let sig = 0;
    for (const t of sim.state.towers) sig += (t.spotId + 1) * 2654435761 + 1;
    if (sig !== this.occupancySig || sim.state.towers.length !== this.occupancyCount) {
      this.occupancySig = sig;
      this.occupancyCount = sim.state.towers.length;
      this.occupied.clear();
      for (const t of sim.state.towers) this.occupied.add(t.spotId);
      markers.emptySpots.clear();
      for (const s of sim.spots) if (!this.occupied.has(s.id)) markers.emptySpots.add(s.id);
    }
    if (this.menuSpot !== null && this.occupied.has(this.menuSpot)) this.closeMenu();
    if (this.selectedTower !== null) {
      const t: TowerState | undefined = sim.getTower(this.selectedTower);
      if (!t) {
        this.cancelAll();
      } else if (this.mode.kind === 'idle') {
        // keep the range preview in sync with upgrades
        if (markers.range) markers.range.r = t.range;
        this.refreshFlags();
      }
    }
    if (sim.state.status === 'won' || sim.state.status === 'lost') {
      if (this.mode.kind !== 'idle' || this.menu.isOpen) this.cancelAll();
    }
    this.menu.update(time);
  }

  destroy(): void {
    this.menu.close(true);
  }
}
