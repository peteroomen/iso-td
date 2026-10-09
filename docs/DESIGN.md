# UFO Defense — Design & Architecture Spec

A small, polished, Kingdom-Rush-style isometric tower defense game. Browser, Phaser 3 + TypeScript + Vite.
This document is the source of truth. Numbers here are **starting values**; the balance tool (`npm run balance`) is
used to tune them and the tuned values live in `src/core/data/*`.

---

## 1. Game rules

- 10 campaign levels: 1–3 Spring, 4–6 Desert, 7–9 Winter, 10 = mixed-biome boss level.
- **Lives**: 20 per level. Leaking enemy costs its `lives` value. 0 lives → defeat.
- **Stars** on victory: ≥18 lives → 3★, ≥6 → 2★, else 1★. Best result per level is saved. Max 30★.
- **Tower level caps** per level (also on replay): L1 all towers max lv1; L2 all max lv2; L3 archer lv3; L4 + wizard lv3;
  L5+ everything lv3. Encoded per level as `towerCap: { archer, wizard, barracks }`.
- **Level unlock**: level N+1 unlocks when level N is won.
- **Waves**: level starts paused-on-wave-0; the player presses the pulsing "incoming" button at a spawn to start wave 1.
  After a wave finishes spawning, a countdown (`waveGap`, default 18 s) starts toward the next wave. Player can call
  early: **bonus gold = floor(remainingSeconds × 1.5)** and **both ability cooldowns are reduced by remainingSeconds × 0.5**.
- **Victory**: all waves spawned and no enemies alive and lives > 0.
- **Selling**: refund 60% of total gold invested in that tower.
- **Gold**: start gold per level + kill bounties + early-call bonus.
- Game speed 1× / 2×, pause. Build spots are fixed (Kingdom Rush style).

## 2. Units & coordinates

The sim runs in **grid/tile units** (floats). Cell (x, y) center is at (x + 0.5, y + 0.5).
Ranges and speeds are in tiles and tiles/second. Rendering converts grid → isometric screen space.

Isometric projection (renderer only): `sx = (gx - gy) * TW/2`, `sy = (gx + gy) * TH/2`.
Neighbour directions: (x+1,y) = **SE** edge, (x,y+1) = **SW**, (x−1,y) = **NW**, (x,y−1) = **NE**.

Source tile art (`public/assets/sprites/tiles`, `roads`): 250×235 PNG blocks. The top-face diamond spans x 0–250,
y 0–~140 including a ~11 px dark outline; the block side is ~95 px deep below that. Neighbouring tiles must overlap
so outlines merge — tune `TW`/`TH` (≈ 228×128 at source scale) by screenshot until seams look clean. Draw order by (gx+gy).

### Road tile auto-selection
Each road cell's open edges = which neighbours are road (or off-map for spawn/exit cells). File `road_<biome>_<n>.png`:

| n | open edges | | n | open edges |
|---|---|---|---|---|
| 1 | NW, SE (straight) | | 7 | NW, SW, SE |
| 2 | NE, SW (straight) | | 8 | SE, SW (corner) |
| 3 | all four (cross) | | 9 | NW, NE (corner) |
| 4 | NW, NE, SW | | 10 | NE, SE (corner) |
| 5 | NW, NE, SE | | 11 | NW, SW (corner) |
| 6 | NE, SE, SW | | | |

No dead-end tile exists: spawn/exit cells must be on the map border so off-map counts as connected.

## 3. Towers

Targeting: enemy furthest along its path within range ("first"). Archer/Wizard hit ground and high-fliers.
Damage types: `physical` (×(1−armor)), `magic` (×(1−magicResist)), `true`.

| Tower | Lv | Cost | Damage | Cooldown | Range | Special |
|---|---|---|---|---|---|---|
| Archer (physical, arrow projectile 10 t/s) | 1 | 70 | 4–6 | 0.8 s | 3.2 | |
| | 2 | +110 | 8–12 | 0.7 s | 3.5 | |
| | 3 | +160 | 13–19 | 0.6 s | 3.8 | **Double Shot**: fires at 2 different targets |
| Wizard (magic, bolt projectile 7 t/s) | 1 | 100 | 12–20 | 1.5 s | 3.0 | |
| | 2 | +160 | 25–40 | 1.4 s | 3.0 | |
| | 3 | +240 | 45–70 | 1.3 s | 3.2 | **Arc Bolt**: chains to 2 more enemies within 1.5 t, 50% dmg |
| Barracks | 1 | 70 | knights 1–3 / 1 s | | rally ≤ 2.5 | 2 knights, 50 HP, 0% armor |
| | 2 | +110 | 3–5 / 1 s | | | 2 knights, 90 HP, 15% armor |
| | 3 | +170 | 6–10 / 1 s | | | **3 knights**, 140 HP, 30% armor |

Knights: walk 1.6 t/s, respawn 10 s after death at the tower, regen 2% max HP/s when not fighting.
Each knight engages one blockable enemy within 1.0 t of its rally post; an engaged enemy stops moving and fights back.
Several knights may hit the same enemy. Rally point is settable (click tower → flag button → click road within 2.5 t).
Upgrading a barracks heals/upgrades existing knights in place.

## 4. Abilities

- **Orbital Strike** — cooldown 40 s. Click ability then a map point. 1.0 s reticle, then beam: 60 **true** damage to all
  enemies (incl. fliers & boss) within radius 1.4 t. Screen shake + flash.
- **Reinforcements** — cooldown 15 s. Click then a point within 1.0 t of a path. Spawns 2 militia (knight_level_1 sprite,
  tinted) for 12 s: 30 HP, 1–3 dmg / 1 s, fight like knights with their rally fixed at the spawn point.

Both available from level 1 and start the level ready.

## 5. Star upgrade tree

5 tracks × 3 tiers, tier costs 1 / 2 / 3★ (6 per track, 30 total). Tiers bought in order. Free reset (refund all).

| Track | Tier 1 (1★) | Tier 2 (2★) | Tier 3 (3★) |
|---|---|---|---|
| Archers | +10% range | +15% damage | Armor piercing: target armor −0.30 (min 0) |
| Wizards | −10% cost (build & upgrade) | +15% damage | Bolts slow 30% for 1 s |
| Barracks | +20% knight HP | −30% respawn time | Idle regen ×3 |
| Orbital Strike | −10 s cooldown | +40% damage and +40% radius | Leaves burning ground 3 s, 15 true dps |
| Reinforcements | +50% militia HP | 3 militia | Duration 20 s, −3 s cooldown |

## 6. Enemies (UFOs)

Every UFO hovers. `flier: true` = high flier: knights/militia ignore it and the sprite renders higher with a
detached shadow. Visual identity via scale, tint, idle bob, and code effects (shield bubble for Prism, metallic glint
for Plated, red pulse for Dreadnought).

| id | Sprite | Name | HP | Speed | Armor | MR | Gold | Lives | Melee dmg/cd | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| scout | ufo_1 | Scout | 20 | 1.0 | 0 | 0 | 3 | 1 | 2 / 1.0 | |
| dart | ufo_2 | Dart | 15 | 1.8 | 0 | 0 | 4 | 1 | 1 / 0.8 | fast, scale 0.85 |
| skimmer | ufo_3 | Skimmer | 30 | 1.1 | 0 | 0 | 6 | 1 | – | **flier** |
| plated | ufo_4 | Plated | 80 | 0.7 | 0.5 | 0 | 10 | 1 | 6 / 1.2 | armored |
| prism | ufo_5 | Prism | 60 | 1.0 | 0 | 0.5 | 10 | 1 | 4 / 1.0 | magic shield |
| carrier | ufo_6 | Carrier | 150 | 0.7 | 0 | 0 | 20 | 2 | 8 / 1.5 | on death releases 3 Darts; scale 1.3 |
| dread | ufo_7 | Dreadnought | 400 | 0.6 | 0.3 | 0.3 | 40 | 3 | 25 / 1.5 | scale 1.5 |
| mothership | mothership.png | Mothership | 6000 | 0.35 | 0.4 | 0.4 | 0 | 20 | – | not blockable; launches 2 scouts + 1 dart every 8 s; top-of-screen HP bar |

Enemies walk their path with a small random lateral offset (±0.2 t) so groups don't stack perfectly.

## 7. Campaign

| L | Biome | Waves | Introduces | Map feature |
|---|---|---|---|---|
| 1 | Spring | 6 | scout, dart | single winding path, includes tutorial hints |
| 2 | Spring | 7 | skimmer | |
| 3 | Spring | 8 | plated | path forks (two branches rejoin) |
| 4 | Desert | 9 | prism | |
| 5 | Desert | 10 | carrier | two entrances |
| 6 | Desert | 10 | – (mix) | long loop |
| 7 | Winter | 12 | dread | |
| 8 | Winter | 12 | – | two entrances that merge |
| 9 | Winter | 12 | – | few, tight build spots |
| 10 | Mixed spring→desert→winter | 15 | mothership (final wave) | long path through all biomes |

Start gold roughly 250–450, tuned by the balance tool. Grids up to ~14×14; camera fits the map into the play area.

## 8. Balancing

`npm run balance` runs every level headless through the real sim with bots (fixed seeds, several runs each):
- **competent**: a scripted, sensible build/upgrade plan per level (defined next to each level as `botPlan`),
  uses abilities on the densest cluster when ready, assumes ~2★ per previously beaten level spent sensibly.
- **expert**: same plan + optimal early calls and ability timing; assumes 3★ per previous level.
- **naive**: builds only the cheapest tower type on the spots nearest the spawn, upgrades when affordable, no abilities.
- **idle**: builds nothing (sanity check — must lose every level, ideally on wave 1–2).

Targets: competent wins with 10–17 lives; expert can reach 18+ (3★); naive loses from L4 onward; idle always loses.
Output: a markdown table per level (lives left, gold left, wave reached, per-bot), written to `docs/BALANCE.md`.

## 9. Architecture

```
src/
  core/                 # PURE TypeScript. No Phaser, no DOM, no Math.random. Deterministic.
    types.ts            # shared types (LevelDef, WaveDef, TowerKind, EnemyId, SimEvent, ...)
    rng.ts              # seeded RNG (mulberry32)
    data/towers.ts, enemies.ts, abilities.ts, upgrades.ts (star tree)
    data/levels/level01.ts … level10.ts, index.ts
    sim/Sim.ts          # the simulation (see API below) + helper modules
    progress.ts         # save model, stars, unlocks, tower caps, star spending (storage injected)
  game/                 # Phaser rendering + input + UI
    main.ts, scenes/ (Boot, Preload, Title, LevelSelect, Upgrades, Game, Hud/overlays), iso.ts, audio.ts, ...
tools/balance.ts        # node CLI via tsx
tests/                  # vitest
public/assets/sprites, public/assets/audio
```

### Sim API (contract between core and game)

```ts
const sim = new Sim(levelDef, { seed, upgrades /* purchased star tiers */, towerCap });
sim.step(dt);                         // fixed step 1/60 s; game calls N times per frame (×2 speed = 2 steps)
sim.state                             // read-only snapshot: gold, lives, wave index, countdown, towers, knights,
                                      // enemies, projectiles, abilities (cooldown remaining), status ('pre'|'running'|'won'|'lost')
sim.drainEvents(): SimEvent[]         // 'build','upgrade','sell','shoot','hit','kill','leak','waveStart','waveCalledEarly',
                                      // 'knightDeath','orbitalWarn','orbitalHit','reinforce','bossSpawn','won','lost', ...
// commands return { ok: boolean, reason?: string }
sim.build(spotId, kind); sim.upgrade(towerId); sim.sell(towerId); sim.setRally(towerId, {x,y});
sim.castOrbital({x,y}); sim.castReinforcements({x,y}); sim.callNextWave();
sim.canAfford/costOf helpers for UI.
```

Entities have stable numeric ids so the renderer can map them to sprites. Renderer interpolation is optional.

## 10. Presentation

- 1280×720 logical, `Scale.FIT`, works with mouse and touch.
- Scenes: Title → Level Select (iso island map of 10 nodes with stars, locked/unlocked) → Upgrades (star tree) →
  Game (+ pause, victory with stars animation, defeat) ; Settings (music/sfx volume, reset progress).
- In-game HUD: lives, gold, wave X/Y, speed, pause, ability buttons with radial cooldown, boss HP bar.
- Build spot click → radial menu with 3 tower icons + cost (greyed when unaffordable / capped). Tower click → upgrade
  (shows next stats), sell, rally (barracks). Range circle preview. Tooltips.
- Juice: hit flashes, UFO explosion particles, coin pop-ups (+gold), screen shake on orbital, knight swing,
  archer bow animation, wizard bolt trail, smooth UI tweens, wave-incoming indicator showing next wave composition.
- Audio: CC0 SFX and music (Kenney.nl, OpenGameArt). Credits in `CREDITS.md`.

## 11. Assets

`public/assets/sprites/` (Artyom Zagorskiy, CC0): `tiles/ground_<biome>.png`, `tiles/buildspot_<biome>.png`,
`roads/road_<biome>_<1..11>.png`, `deco/*` (trees, stones, cacti, crystals, small decorations), `towers/*`
(archer/wizard/barrack levels; barrack has two door orientations `_1`/`_2`; arrow, wizard_bullet, bow_animation_1..4,
archer.png = archer unit, stick = wizard staff, sword, shield), `units/knight_level_1..3.png`, `ufo/ufo_1..7.png`.
Boss sprite: `ufo/mothership.png` (320×271, generated to match the pack style; hangar opening at bottom-center is where escorts launch).
