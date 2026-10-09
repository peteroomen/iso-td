# UFO Defense - balance notes

This file has two parts: the hand-written notes below and the generated report (between the `balance:generated` markers),
which `npm run balance` rewrites in place. Everything the report says comes from running the real `Sim` headless, so
re-run it after changing any number in `src/core/data/*` or a level.

## How the numbers were produced

* **Bots** (`tools/bots`): a bot is a list of scripted actions (`build` / `up` / `rally`, executed in order as soon as they
  are affordable) plus a policy for abilities and early wave calls. Plans live in `tools/bots/plans.ts`.
  * `competent`: plan from `tools/bots/autoplan.ts` (spots ranked by how much road their range covers, tower mix read
    from the wave previews: armored UFOs -> wizards, magic-resistant -> archers, fliers -> fewer barracks; upgrades
    round-robin), assumes **2 star points per previously cleared level** spent in a fixed sensible order, Orbital Strike on
    the densest cluster (>= 150 damage worth of targets, or any cluster about to leak), Reinforcements in front of the
    leading ground UFOs, calls the next wave early only when the map is empty.
  * `expert`: same abilities idea with lower thresholds, **3 stars per cleared level**, calls early whenever the map is
    nearly clear and nothing dangerous is past 55% of the road. On levels 3-9 it also uses a plan optimised offline by
    `tools/bots/search.ts` (hill climbing over build order and tower kinds against the real sim, objective = lives over
    4 seeds that are *not* the reporting seeds).
  * `naive`: cheapest tower (archer) on every spot, nearest the spawn first, upgrades when affordable, 1 star per level,
    no abilities, never calls early.
  * `idle`: calls wave 1 and then does nothing.
  * `archer-only` / `wizard-only` / `barracks-only`: the competent bot with every build forced to one tower kind.
* The star upgrades are bought greedily in this order: Orbital 1, Archers 1, Barracks 1, Archers 2, Orbital 2, Wizards 1,
  Reinforcements 1, Barracks 2, Wizards 2, Archers 3, Reinforcements 2, Orbital 3, Barracks 3, Wizards 3, Reinforcements 3.
* **Waves**: each level's wave list is a hand-written *shape* (which enemies appear in which wave, intros in tiny numbers
  first, timing of the groups) scaled by a per-wave threat budget that ramps from ~20% to 100% of a per-level maximum.
  The maximum was bisected (`competent` should average ~13 lives on levels 4-10), light fodder (scouts/darts/skimmers)
  is capped per wave so heavy UFOs carry the rest, and the result is baked into the level files as plain numbers.
* Seeds 1-5 are used for reporting; the plan search used 101-104.

## Targets and how they are met

| target | result |
|---|---|
| competent wins everything, 10-17 lives on average | L4-L10: 12.8-15.0. **L1-L3 are deliberately gentler** (20 / 20 / ~17): the naive bot has to be able to scrape through them, and archer spam only stops working when armored and magic-resistant UFOs arrive (L4+). |
| expert reaches 18+ (3 stars) everywhere | yes, 18.4-20.0 average on every level (L6 is the lowest) |
| naive loses from L4 onward | yes (0 wins on L4-L10); it still wins L1 (20 lives) and about half of its L2/L3 runs with 0-5 lives |
| idle always loses | yes, on wave 2-3 (wave 1 on L8, whose two entrances leak twice as fast) |

## Changes to global data (and why)

All of these were needed because tower power is high compared to the DESIGN.md enemy table (see the unit counts in the
"Levels" table below): with the original HP a competent player needed 150-300 UFOs per wave on levels 4-9.
Tower numbers, plated armor and prism resistance are pinned by existing tests and were **not** changed.

* HP doubled for skimmer (30 -> 60), plated (80 -> 160), prism (60 -> 120), carrier (150 -> 300), dreadnought (400 -> 800).
  Scout and dart keep their HP (the level-1 smoke tests depend on them).
* Bounties raised for skimmer (6 -> 9), plated (10 -> 15), prism (10 -> 15), dreadnought (40 -> 70) so the heavier UFOs
  still pay for the towers that kill them. The carrier bounty (20) is unchanged (pinned by a test).
* Mothership: armor and magic resistance 0.4 -> 0.8 (HP 6000, speed 0.35 and the escort launcher are pinned by tests).
  With 0.4 the competent bot killed it before the road was half over; at 0.8 it dies at 83-89% of the road for the
  competent bot and ~63% for the expert, i.e. the whole map's fire is needed and Orbital Strike / burning ground are
  the only damage that ignores the armor. 0.83 is already a cliff (competent bot loses), so 0.8 is close to the edge.

## What each introduction does

Single-tower variants (competent plan/stars/abilities, every tower forced to one kind), from the table below:

* **Skimmer (L2)**: barracks-only goes from 20 lives (L1) to a loss on wave 5. Knights cannot block fliers.
* **Prism (L4)**: wizard-only collapses (1/5 wins, 0.4 lives; competent 13.0) - magic does half damage to prisms.
  It stays bad on every later level and cannot win L10 (the Mothership's 0.8 resistance).
* **Plated (L3)**: no real penalty for archer-only (18.8 vs 16.8 competent). Plated armor halves arrows, but archers get
  their level 3 on L3 while wizards are capped at level 2, and level-3 archers out-range everything. From L5 on the
  wizard-heavy mixes help, but archer-only is still the best single tower type (see concerns).
* **Carrier (L5)**: 2 lives and 3 Darts on death; it makes the late waves of L5-L10 leak in bursts.
* **Dreadnought (L7)**: 800 HP, 3 lives, 25 melee damage - it grinds knights down and is armored *and* resistant, so no
  single tower type counters it.
* **Mothership (L10)**: see below.

### The Mothership fight (L10)

* Competent bot: first lv3 tower around wave 7-8 of 15, the Mothership spawns at ~t=715 s and is killed on the road
  between tile 49 and 53 of 59 (83-89%), after absorbing several Orbital Strikes and fire from every tower on four legs of
  the road; the lives lost on this level (15.0 on average) come from the preceding waves and from the escorts (2 scouts +
  1 dart every 8 s, i.e. ~60 escorts during the crossing).
* Expert bot: dies at tile ~37 (63%), 19.4 lives on average.
* Because the boss cannot be blocked and carries 0.8 armor, knights and wizards are nearly useless against it; archers with
  the armor-piercing star upgrade and Orbital Strike are the damage that matters.

## Economy check (levels 5+)

First wave in which a tower reaches level 3 (5 seeds, identical across seeds):

| level | competent | expert |
|---|---|---|
| 5 (10 waves) | 10 | 7 |
| 6 (10 waves) | 8 | 7 |
| 7 (12 waves) | 7 | 4 |
| 8 (12 waves) | 10 | 3 |
| 9 (12 waves) | 6-7 | 4 |
| 10 (15 waves) | 7-8 | 7 |

The competent bot spreads its gold over 10-11 towers before finishing any upgrade, so it is late on the two-road levels
(L5, L8) where the waves (and thus the income) are small; a player who focuses a few spots gets level 3 by the middle of
the level (expert column). Gold is plentiful late: both bots end L7/L9/L10 with 4 500-10 700 unspent gold, i.e.
power there is limited by build spots, not money.

## Concerns / degenerate strategies

* **Archers dominate.** With the same plan and stars, archer-only is as good as or better than the competent mixed plan on
  almost every level (see the variants table). Range (3.2 -> 3.8, +10% with a star) and the level-3 double shot beat the
  wizard's range 3.0-3.2; plated armor and prism resistance are not enough to counter that. Since tower stats and the
  armor/resistance values are pinned by tests this was not retuned; the cleanest fixes are a shorter level-3 archer range
  or a higher plated armor.
* **Barracks holds are very strong.** An engaged UFO stops, so a knight post inside the kill zone of two or three towers
  is a multiplier; that is why `expert` plans always have a barracks on a bend. Barracks alone, however, lose to fliers
  (every level from L2).
* **Early calls pay twice**: +1.5 gold per second left and -0.5 s on both cooldowns per second left. The expert bot's
  advantage on L8-L10 comes largely from this.
* The skill spread is large: on L5-L9 the same level gives ~13 lives to the mechanical competent bot and 20 to the
  optimised expert plan, and both are on a cliff (a few % more enemies flips a clean win into a loss). Expect real
  players to feel this as "the last two waves decide the level".
* Idle loses on wave 2-3 rather than wave 1-2 on the early levels because the first waves are small by design.

<!-- balance:generated:start -->
# UFO Defense - balance report

Generated by `npm run balance` (tools/balance.ts). Every number comes from running the real `Sim` headless with scripted bots (see tools/bots).

Seeds per bot and level: 5. Cells show: wins / lives left (min/avg/max over all seeds, 0 = lost) / average wave number reached by the lost runs.

Targets (docs/DESIGN.md section 8): competent wins every level with 10-17 lives on average; expert reaches 18+ (3 stars); naive loses from L4 onward; idle always loses.

## Bots

| bot | stars assumed | abilities | early calls | build |
|---|---|---|---|---|
| competent | 2/level | competent | competent | plan (competent) |
| expert | 3/level | expert | expert | plan (expert) |
| naive | 1/level | none | never | cheapest tower (archers) on the spots nearest the spawn, upgrades when affordable |
| idle | 0/level | none | never | nothing |
| archer-only | 2/level | competent | competent | plan (competent), only archer |
| wizard-only | 2/level | competent | competent | plan (competent), only wizard |
| barracks-only | 2/level | competent | competent | plan (competent), only barracks |

Star upgrades by level (competent / expert):

| level | competent (2*) | expert (3*) |
|---|---|---|
| 1 | 0 pts: A0 W0 B0 O0 R0 | 0 pts: A0 W0 B0 O0 R0 |
| 2 | 2 pts: A1 W0 B0 O1 R0 | 3 pts: A1 W0 B1 O1 R0 |
| 3 | 4 pts: A1 W0 B1 O1 R0 | 6 pts: A2 W0 B1 O1 R0 |
| 4 | 6 pts: A2 W0 B1 O1 R0 | 9 pts: A2 W1 B1 O2 R1 |
| 5 | 8 pts: A2 W1 B1 O2 R0 | 12 pts: A2 W1 B2 O2 R1 |
| 6 | 10 pts: A2 W1 B1 O2 R1 | 15 pts: A2 W2 B2 O2 R1 |
| 7 | 12 pts: A2 W1 B2 O2 R1 | 18 pts: A3 W2 B2 O2 R2 |
| 8 | 14 pts: A2 W2 B2 O2 R1 | 21 pts: A3 W2 B2 O3 R2 |
| 9 | 16 pts: A3 W2 B2 O2 R1 | 24 pts: A3 W2 B3 O3 R2 |
| 10 | 18 pts: A3 W2 B2 O2 R2 | 27 pts: A3 W3 B3 O3 R2 |

## Results

| level | competent | expert | naive | idle |
|---|---|---|---|---|
| 1 Meadow Landing | 5/5 win / 20/20.0/20 / - | 5/5 win / 20/20.0/20 / - | 5/5 win / 20/20.0/20 / - | 0/5 win / 0/0.0/0 / 3.0 |
| 2 Blossom Bend | 5/5 win / 20/20.0/20 / - | 5/5 win / 20/20.0/20 / - | 2/5 win / 0/1.6/5 / 6.0 | 0/5 win / 0/0.0/0 / 2.0 |
| 3 Twin Creeks | 5/5 win / 15/16.8/20 / - | 5/5 win / 19/19.8/20 / - | 2/5 win / 0/1.0/4 / 7.7 | 0/5 win / 0/0.0/0 / 2.0 |
| 4 Dune Crossing | 5/5 win / 11/13.0/16 / - | 5/5 win / 20/20.0/20 / - | 0/5 win / 0/0.0/0 / 6.2 | 0/5 win / 0/0.0/0 / 2.0 |
| 5 Oasis Crossroads | 5/5 win / 12/13.2/15 / - | 5/5 win / 18/19.4/20 / - | 0/5 win / 0/0.0/0 / 6.0 | 0/5 win / 0/0.0/0 / 2.0 |
| 6 Scorpion Loop | 5/5 win / 9/13.0/17 / - | 5/5 win / 15/18.4/20 / - | 0/5 win / 0/0.0/0 / 6.0 | 0/5 win / 0/0.0/0 / 2.0 |
| 7 Frostbite Pass | 5/5 win / 10/13.0/19 / - | 5/5 win / 20/20.0/20 / - | 0/5 win / 0/0.0/0 / 5.0 | 0/5 win / 0/0.0/0 / 2.0 |
| 8 Glacier Junction | 5/5 win / 10/13.4/16 / - | 5/5 win / 20/20.0/20 / - | 0/5 win / 0/0.0/0 / 4.4 | 0/5 win / 0/0.0/0 / 1.0 |
| 9 Icebound Bastion | 5/5 win / 10/12.8/16 / - | 5/5 win / 20/20.0/20 / - | 0/5 win / 0/0.0/0 / 5.8 | 0/5 win / 0/0.0/0 / 2.0 |
| 10 The Mothership | 5/5 win / 12/15.0/18 / - | 5/5 win / 17/19.4/20 / - | 0/5 win / 0/0.0/0 / 6.0 | 0/5 win / 0/0.0/0 / 2.0 |

### Single-tower-type variants

Competent bot (same plan, stars and abilities) but every tower is forced to one kind. Shows which enemy introductions punish which mix.

| level | archer-only | wizard-only | barracks-only |
|---|---|---|---|
| 1 Meadow Landing | 5/5 win / 20/20.0/20 / - | 5/5 win / 20/20.0/20 / - | 5/5 win / 20/20.0/20 / - |
| 2 Blossom Bend | 5/5 win / 20/20.0/20 / - | 5/5 win / 20/20.0/20 / - | 0/5 win / 0/0.0/0 / 5.0 |
| 3 Twin Creeks | 5/5 win / 18/18.8/19 / - | 5/5 win / 17/18.2/20 / - | 0/5 win / 0/0.0/0 / 4.0 |
| 4 Dune Crossing | 5/5 win / 18/19.2/20 / - | 1/5 win / 0/0.4/2 / 8.0 | 0/5 win / 0/0.0/0 / 5.4 |
| 5 Oasis Crossroads | 5/5 win / 19/19.8/20 / - | 4/5 win / 0/4.8/13 / 8.0 | 0/5 win / 0/0.0/0 / 4.0 |
| 6 Scorpion Loop | 5/5 win / 18/19.2/20 / - | 5/5 win / 1/5.0/8 / - | 0/5 win / 0/0.0/0 / 4.0 |
| 7 Frostbite Pass | 5/5 win / 12/17.0/20 / - | 5/5 win / 9/15.0/20 / - | 0/5 win / 0/0.0/0 / 4.0 |
| 8 Glacier Junction | 5/5 win / 16/19.2/20 / - | 5/5 win / 11/14.8/20 / - | 0/5 win / 0/0.0/0 / 4.0 |
| 9 Icebound Bastion | 5/5 win / 20/20.0/20 / - | 5/5 win / 13/15.6/19 / - | 0/5 win / 0/0.0/0 / 3.8 |
| 10 The Mothership | 5/5 win / 20/20.0/20 / - | 0/5 win / 0/0.0/0 / 15.0 | 0/5 win / 0/0.0/0 / 4.0 |

## Levels

| level | name | biome | waves | start gold | spots | tower caps (A/W/B) | new enemies | max units in a wave |
|---|---|---|---|---|---|---|---|---|
| 1 | Meadow Landing | spring | 6 | 300 | 8 | 1/1/1 | scout, dart | 36 |
| 2 | Blossom Bend | spring | 7 | 320 | 10 | 2/2/2 | skimmer | 77 |
| 3 | Twin Creeks | spring | 8 | 340 | 12 | 3/2/2 | plated | 33 |
| 4 | Dune Crossing | desert | 9 | 360 | 12 | 3/3/2 | prism | 71 |
| 5 | Oasis Crossroads | desert | 10 | 400 | 14 | 3/3/3 | carrier | 72 |
| 6 | Scorpion Loop | desert | 10 | 420 | 14 | 3/3/3 | - | 80 |
| 7 | Frostbite Pass | winter | 12 | 440 | 11 | 3/3/3 | dread | 90 |
| 8 | Glacier Junction | winter | 12 | 450 | 14 | 3/3/3 | - | 63 |
| 9 | Icebound Bastion | winter | 12 | 450 | 7 | 3/3/3 | - | 85 |
| 10 | The Mothership | mixed | 15 | 450 | 17 | 3/3/3 | mothership | 118 |

<!-- balance:generated:end -->

## Re-running the tools

```
npm run balance                       # everything, writes this file (about 30 s)
npm run balance -- --level 5 --verbose --bot competent --seeds 3
npx tsx tools/bots/autoplan.ts --level 5          # baseline plan for a level
npx tsx tools/bots/search.ts --level 5 --bot expert --scale 1.1 --iters 150   # optimise an expert plan
```
