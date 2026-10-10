# UFO Defense — Design & Architecture Spec

A small, polished, Kingdom-Rush-style isometric tower defense game. Browser, Phaser 3 + TypeScript + Vite.
This document is the source of truth. Numbers here are **starting values**; the balance tool (`npm run balance`) is
used to tune them and the tuned values live in `src/core/data/*`.

---

## 1. Game rules

- 10 campaign levels: 1–3 Spring, 4–6 Desert, 7–9 Winter, 10 = mixed-biome boss level.
- **Lives**: 20 per level. Leaking enemy costs its `lives` value. 0 lives → defeat.
- **Stars** on victory: ≥18 lives → 3★, ≥6 → 2★, else 1★. Best result per level is saved. Max 30★ (the star tree costs 36★ in total, so the player has to choose).
- **Tower level caps** per level (also on replay): L1 all towers max lv1; L2 all max lv2; L3 archer lv3; L4 + wizard lv3;
  L5 + barracks lv3; L6+ everything lv3. The **bomb** tower is capped 1 on L1, 2 on L2-L5 and 3 (Cluster Bomb) from L6 on.
  Encoded per level as `towerCap: { archer, wizard, barracks, bomb }`.
- **Level unlock**: level N+1 unlocks when level N is won.
- **Waves**: level starts paused-on-wave-0; the player presses the pulsing "incoming" button at a spawn to start wave 1.
  After a wave finishes spawning, a countdown (`waveGap`, default 18 s) starts toward the next wave. Player can call
  early: **bonus gold = floor(remainingSeconds × 1.5)** and **both ability cooldowns are reduced by remainingSeconds × 0.5**.
- **Victory**: all waves spawned and no enemies alive and lives > 0.
- **Selling**: refund 60% of total gold invested in that tower (specialization cost included).
- **Specializations**: unlocked on levels 7–10 (`LevelDef.specsUnlocked`, also on replays), see §12.
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

Targeting: enemy furthest along its path within range ("first"). Archer/Wizard hit ground and high-fliers; the Bomb tower
is ground-only and picks the target with the most enemies in its blast (see below).
Damage types: `physical` (×(1−armor)), `magic` (×(1−magicResist)), `true`.

| Tower | Lv | Cost | Damage | Cooldown | Range | Special |
|---|---|---|---|---|---|---|
| Archer (physical, arrow projectile 10 t/s) | 1 | 70 | 4–6 | 0.8 s | 3.2 | |
| | 2 | +110 | 8–12 | 0.7 s | 3.5 | |
| | 3 | +160 | 13–19 | 0.6 s | 3.8 | **Double Shot**: fires at 2 different targets |
| Wizard (magic, bolt projectile 7 t/s) | 1 | 100 | 12–20 | 1.5 s | 3.0 | |
| | 2 | +160 | 25–40 | 1.4 s | 3.0 | |
| | 3 | +240 | 54–82 | 1.25 s | 3.2 | pure stat tier (the former Arc Bolt chain moved to the **Chain Lightning** specialization, §12; the stats were raised to compensate: ~+23% dps) |
| Barracks | 1 | 70 | knights 1–3 / 1 s | | rally ≤ 2.5 | 2 knights, 50 HP, 0% armor |
| | 2 | +110 | 3–5 / 1 s | | | 2 knights, 90 HP, 15% armor |
| | 3 | +170 | 6–10 / 1 s | | | **3 knights**, 140 HP, 30% armor |
| Bomb (physical splash, **ground only**, lobbed shell) | 1 | 100 | 12–22 | 2.0 s | 3.0 | blast radius 1.0 |
| | 2 | +160 | 26–48 | 1.9 s | 3.2 | blast radius 1.1 |
| | 3 | +240 | 54–84 | 1.8 s | 3.4 | blast radius 1.2, **Cluster Bomb**: 3 bomblets (radius 0.5, 30% dmg) |

**Bomb tower.** Cannot target high fliers (skimmers) and its splash never touches them; the Mothership *is* hit. It lobs a
shell at the target's position **at fire time** (no lead), flight time `0.65 s + 0.06 s/tile`, so fast Darts (and anything that
keeps walking) can dodge it; engaged / slowed enemies cannot. Splash damage (physical, armor applies) is 100% within 40% of
the radius and falls linearly to 50% at the edge. Targeting: the ground enemy in range that has the most ground enemies in its
blast (ties: furthest along the path), so it is a swarm tower. **Cluster Bomb** (Lv3): on impact 3 bomblets scatter uniformly
within 0.8 t of the impact (seeded RNG, deterministic), explode 0.28 s later with radius 0.5 for 30% of the shell's rolled damage.
Costs match the wizard (100 / 160 / 240); the first-draft numbers (125 / 200 / 300, 8–15 … 35–55 dmg, 2.5 s … 2.3 s, radius 0.8 … 1.0)
were re-tuned with the balance tool, see `docs/BALANCE.md`. Sim API: projectile kinds `shell` / `bomblet`, events `explode` / `cluster`, see the source comments in `src/core/types.ts`.

From level 7 on a Lv3 tower may buy a **specialization** (§12). Archer/wizard/barracks/bomb numbers above are the *unspecialized* tiers.

Knights: walk 1.6 t/s, respawn 10 s after death at the tower, regen 2% max HP/s when not fighting.
Each knight engages one blockable enemy within 1.0 t of its rally post; an engaged enemy stops moving and fights back.
Several knights may hit the same enemy. Rally point is settable (click tower → flag button → click road within 2.5 t).
Upgrading a barracks heals/upgrades existing knights in place.

## 4. Abilities

- **Orbital Strike** — cooldown 40 s. Click ability then a map point. 1.0 s reticle, then beam: 60 **true** damage to all
  enemies (incl. fliers & boss) within radius 1.7 t. Screen shake + flash.
- **Reinforcements** — cooldown 15 s. Click then a point within 1.0 t of a path. Spawns 2 militia (knight_level_1 sprite,
  tinted) for 12 s: 30 HP, 1–3 dmg / 1 s, fight like knights with their rally fixed at the spawn point.

Both available from level 1 and start the level ready.

## 5. Star upgrade tree

6 tracks × 3 tiers, tier costs 1 / 2 / 3★ (6 per track, 36 total, but only 30★ can be earned: the player picks). Tiers bought
in order. Free reset (refund all). Old saves without the `bombs` track load with it at 0.

| Track | Tier 1 (1★) | Tier 2 (2★) | Tier 3 (3★) |
|---|---|---|---|
| Archers | +10% range | +15% damage | Armor piercing: target armor −0.30 (min 0) |
| Wizards | −10% cost (build & upgrade) | +15% damage | Bolts slow 30% for 1 s |
| Barracks | +20% knight HP | −30% respawn time | Idle regen ×3 |
| Orbital Strike | −10 s cooldown | +40% damage and +40% radius | Leaves burning ground 3 s, 15 true dps |
| Reinforcements | +50% militia HP | 3 militia | Duration 20 s, −3 s cooldown |
| Bombs | +20% blast radius (shells and bomblets) | +15% bomb damage | Cluster upgrade: 5 bomblets instead of 3, 35% damage each |

## 6. Enemies (UFOs)

Every UFO hovers. `flier: true` = high flier: knights/militia ignore it and the sprite renders higher with a
detached shadow. Visual identity via scale, tint, idle bob, and code effects (shield bubble for Prism, metallic glint
for Plated, red pulse for Dreadnought).

| id | Sprite | Name | HP | Speed | Armor | MR | Gold | Lives | Melee dmg/cd | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| scout | ufo_1 | Scout | 20 | 1.0 | 0 | 0 | 3 | 1 | 2 / 1.0 | |
| dart | ufo_2 | Dart | 15 | 1.8 | 0 | 0 | 4 | 1 | 1 / 0.8 | fast, scale 0.85 |
| skimmer | ufo_3 | Skimmer | 60 | 1.1 | 0 | 0 | 9 | 1 | – | **flier** |
| plated | ufo_4 | Plated | 160 | 0.7 | 0.8 | 0 | 15 | 1 | 6 / 1.2 | armored |
| prism | ufo_5 | Prism | 120 | 1.0 | 0 | 0.7 | 15 | 1 | 4 / 1.0 | magic shield |
| carrier | ufo_6 | Carrier | 300 | 0.7 | 0 | 0 | 20 | 2 | 8 / 1.5 | on death releases 3 Darts; scale 1.3 |
| dread | ufo_7 | Dreadnought | 800 | 0.6 | 0.6 | 0.4 | 40 | 3 | 25 / 1.5 | scale 1.5 |
| mothership | mothership.png | Mothership | 14000 | 0.35 | 0.4 | 0.4 | 0 | 20 | – | not blockable; launches 2 scouts + 1 dart every 8 s; top-of-screen HP bar |

Enemies walk their path with a small random lateral offset (±0.2 t) so groups don't stack perfectly.

_Balance pass:_ the HP of skimmer/plated/prism/carrier/dread (doubled) and the bounties of skimmer/plated/prism were retuned first. A
second pass made armor and magic resistance the real counters (plated 0.5 -> 0.8 armor, prism 0.5 -> 0.7 resist, dread
0.3/0.3 -> 0.6/0.4, dread bounty 70 -> 40) so single-tower builds lose from level 4 on, and turned the Mothership into a damage
sponge instead of an armor wall (HP 6000 -> 14000, armor/resist 0.8 -> 0.4). See `docs/BALANCE.md` for the reasoning and the numbers.

## 7. Campaign

| L | Name | Biome | Waves | Introduces | Map feature |
|---|---|---|---|---|---|
| 1 | Meadow Landing | Spring | 6 | scout, dart | single winding path, includes tutorial hints |
| 2 | Blossom Bend | Spring | 7 | skimmer | S-curve with two pocket spots covering two road legs each |
| 3 | Twin Creeks | Spring | 8 | plated | path forks (two branches rejoin) |
| 4 | Dune Crossing | Desert | 9 | prism | three long switchbacks |
| 5 | Oasis Crossroads | Desert | 10 | carrier | two entrances; the two roads cross in the middle |
| 6 | Scorpion Loop | Desert | 10 | – (mix) | long loop: the road crosses itself, the crossing is passed twice |
| 7 | Frostbite Pass | Winter | 12 | dread | long serpentine pass |
| 8 | Glacier Junction | Winter | 12 | – | two entrances that merge |
| 9 | Icebound Bastion | Winter | 12 | – | few, tight build spots |
| 10 | The Mothership | Mixed spring→desert→winter | 15 | mothership (final wave) | long path through all biomes |

Start gold roughly 250–450, tuned by the balance tool. Grids up to ~14×14; camera fits the map into the play area.

## 8. Balancing

`npm run balance` runs every level headless through the real sim with bots (fixed seeds, several runs each):
- **competent**: a scripted, sensible build/upgrade plan per level (defined next to each level as `botPlan`),
  uses abilities on the densest cluster when ready, assumes ~2★ per previously beaten level spent sensibly.
- **expert**: same plan + optimal early calls and ability timing; assumes 3★ per previous level.
- **bomb-only** (and archer-only / wizard-only / barracks-only): the competent bot with every build forced to one kind.
- **naive**: builds only the cheapest tower type on the spots nearest the spawn, upgrades when affordable, no abilities.
- **nospec** / **spec:<id>** (levels 7–10): the competent bot without / with a forced specialization option (see §12 and BALANCE.md).
- **idle**: builds nothing (sanity check — must lose every level, ideally on wave 1–2).

Targets: competent wins with 10–17 lives; expert can reach 18+ (3★); naive loses from L4 onward; idle always loses; from L4 on every
single-tower-kind build (archer-only / wizard-only / barracks-only / bomb-only variants of the competent bot) scores below the mixed plan and at
least one of archer-only / wizard-only loses or nearly loses; the competent bot ends every level with <= ~600 gold left and is still
buying in the last third of the level.
Output: a markdown table per level (lives left, gold left, wave reached, per-bot), an economy table (gold left, gold earned, time
when every spot was built and maxed, time of the last purchase) and the Mothership's death position, written to `docs/BALANCE.md`.

## 9. Architecture

```
src/
  core/                 # PURE TypeScript. No Phaser, no DOM, no Math.random. Deterministic.
    types.ts            # shared types (LevelDef, WaveDef, TowerKind, EnemyId, SimEvent, ...)
    rng.ts              # seeded RNG (mulberry32)
    data/towers.ts (incl. BOMB constants, splashFactor), enemies.ts, abilities.ts, upgrades.ts (star tree)
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
                                      // 'knightDeath','orbitalWarn','orbitalHit','reinforce','bossSpawn','explode','cluster','won','lost', ...
// commands return { ok: boolean, reason?: string }
sim.build(spotId, kind); sim.upgrade(towerId); sim.sell(towerId); sim.setRally(towerId, {x,y});
sim.castOrbital({x,y}); sim.castReinforcements({x,y}); sim.callNextWave();
sim.specialize(towerId, specId);       // levels 7-10, Lv3 towers, see §12
sim.canAfford/costOf helpers for UI.
```

Entities have stable numeric ids so the renderer can map them to sprites. Renderer interpolation is optional.

## 10. Presentation

- 1280×720 logical, `Scale.FIT`, works with mouse and touch.
- Scenes: Title → Level Select (iso island map of 10 nodes with stars, locked/unlocked) → Upgrades (star tree) →
  Game (+ pause, victory with stars animation, defeat) ; Settings (music/sfx volume, reset progress).
- In-game HUD: lives, gold, wave X/Y, speed, pause, ability buttons with radial cooldown, boss HP bar.
- Build spot click → radial menu with 4 tower icons + cost (greyed when unaffordable / capped). Tower click → upgrade
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

## 12. Tower specializations

From **level 7** onward (`LevelDef.specsUnlocked`; levels 7–10, also on replays; levels 1–6 are unaffected) a **Lv3** tower can buy
**one of two** specializations for **300 g** each. The choice is permanent for that tower (different towers of the same kind may
choose differently); the cost counts as invested gold (sell refund 60%). Passive powers only fire when UFOs are in range. Each
spec gets a code-drawn emblem on the tower plus its own effects (visuals: later phase).

Sim API: `sim.specialize(towerId, specId)` / `sim.canSpecialize(...)` (fail reasons `locked`, `wrong_kind`, `not_max_level`,
`already_specialized`, `gold`, `no_tower`, `ended`), `sim.specCostOf(id)`, `sim.statsFor(kind, level, spec?)`, `sim.statsOf(towerId)`,
`TowerState.spec / specCooldown / specCooldownMax / specCounter`, event `specialize`. Details in the comments of `src/core/types.ts`;
numbers in `SPEC_TUNING` (`src/core/data/specs.ts`).

| Tower | Option A | Option B |
|---|---|---|
| Archer | **Eagle Eye**: +30% range, +20% damage, every 4th arrow (each arrow of a Double Shot counts) ignores ALL armor | **Hunting Nets**: every 6.5 s (when a UFO is in range) a net is lobbed (~0.4–0.5 s flight) at the densest cluster; every UFO within 1.2 t of the impact is rooted 3 s; netted fliers are pulled down (count as blockable ground UFOs: knights engage them, bombs hit them); bosses are slowed 50% for 3 s instead |
| Wizard | **Chain Lightning**: bolts jump 3 times within 1.5 t for 50% / 35% / 20% of the bolt's damage | **Fire Mages**: hits ignite: 40 true dps for 4 s (ignores magic resist), a new hit refreshes, never stacks; burning UFOs show an orange HP bar |
| Bomb | **Bigger Bombs**: +40% blast radius (shell and bomblets), +25% damage, +2 bomblets | **Homing Missiles**: every 5 s (UFOs in range) 2 homing missiles at the furthest-forward UFOs (fliers included): 90 physical damage, 0.7 t splash; normal shells continue |
| Barracks | **Bow Training**: knights not in melee shoot arrows (9–13 physical, every 1.0 s, 2.5 t from the knight, fliers included) | **Extra Recruits**: +1 knight (4), +25% knight HP, 30% faster respawn |

**Interactions with the star tree** (all multiplicative unless stated):
* Archers ★1 range ×1.1 and ★2 damage ×1.15 multiply with Eagle Eye (×1.3 / ×1.2). ★3 armor piercing (−0.30) applies to every arrow;
  Eagle Eye's every-4th arrow ignores all armor (the ★3 bonus is irrelevant for it). Nets are unaffected by the stars.
* Wizards ★1 (−10% cost) discounts build / upgrades only, never the 300 g spec. ★2 +15% damage raises the bolt and so the chain jumps
  (they are fractions of the bolt); the ignite burn is flat true damage (not scaled). ★3 slow applies to the primary hit and to every chain
  jump, and to Fire Mages bolts.
* Barracks ★1 HP ×1.2 × Extra Recruits ×1.25 (= ×1.5); ★2 respawn ×0.7 × spec ×0.7 (= 4.9 s); ★3 idle regen applies to all knights.
  Bow Training arrows are not affected by any star.
* Bombs ★1 radius and ★2 damage apply to everything the bomb tower throws: shells, bomblets and Homing Missiles (damage and splash).
  Bigger Bombs multiplies on top (radius ×1.2 × 1.4, damage ×1.15 × 1.25). Bomblet count: ★3 sets 5 (35% damage), Bigger Bombs adds +2
  on top: **7 with both**. Bomblet scatter grows with the spec radius.
* Orbital Strike / Reinforcements are unaffected.

Balance goal: the two options of each tower within ~10% overall value, each clearly better on some levels / enemy mixes; see the
"Specializations" section of `docs/BALANCE.md` (bots `spec:<id>`, micro-benchmark `tools/specbench.ts`).
