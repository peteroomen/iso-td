# UFO Defense - balance notes

This file has two parts: the hand-written notes below and the generated report (between the `balance:generated` markers),
which `npm run balance` rewrites in place. Everything the report says comes from running the real `Sim` headless, so
re-run it after changing any number in `src/core/data/*` or a level.

## How the numbers were produced

* **Bots** (`tools/bots`): a bot is a list of scripted actions (`build` / `up` / `rally`, executed in order as soon as they
  are affordable) plus a policy for abilities and early wave calls. Plans live in `tools/bots/plans.ts`.
  * `competent`: plan from `tools/bots/autoplan.ts` (spots ranked by how much road their range covers, tower mix read
    from the wave previews: armored UFOs -> wizards, magic-resistant -> archers, fliers -> fewer barracks, **dense ground
    swarms (scouts, darts, carrier darts) -> bombs, flier-heavy and armor-heavy maps -> no bombs**; upgrades round-robin;
    **every build spot ends up covered**, so "all spots maxed" is reachable), assumes **2 star points per previously
    cleared level** spent in a fixed sensible order, Orbital Strike on the densest cluster (>= 150 damage worth of
    targets, or any cluster about to leak), Reinforcements in front of the leading ground UFOs, calls the next wave early
    only when the map is empty. `autoplan.ts --level N --write` regenerates a level's competent plan in `plans.ts`.
    The shipped competent plans build 3 / 1 / 2 / 1 / 2 / 2 / 2 / 1 / 0 / 1 bomb towers on levels 1-10. Level 9 (7 spots,
    armor-heavy) had its bomb replaced by a barracks by hand: with it the plan lost to archer-only.
  * `expert`: same abilities idea with lower thresholds, **3 stars per cleared level**, calls early whenever the map is
    nearly clear and nothing dangerous is past 55% of the road. On levels 3-9 it also uses a plan optimised offline by
    `tools/bots/search.ts` (hill climbing over build order and tower kinds - now including bombs - against the real sim,
    objective = lives over several seeds that are *not* the reporting seeds). Expert plans do not fill every spot, so the
    expert bot ends the later levels with 1 000+ unspent gold; that is not a target (only the competent bot is held to the
    leftover-gold goal). The expert plans of levels 5 and 6 were re-searched for the bomb tower (both use bombs now).
  * `naive`: cheapest tower (archer) on every spot, nearest the spawn first, upgrades when affordable, 1 star per level,
    no abilities, never calls early.
  * `idle`: calls wave 1 and then does nothing.
  * `archer-only` / `wizard-only` / `barracks-only` / `bomb-only`: the competent bot with every build forced to one tower kind.
* The star upgrades are bought greedily in this order (`tools/bots/stars.ts`): Orbital 1, Archers 1, Barracks 1, Archers 2,
  Orbital 2, Wizards 1, Reinforcements 1, Barracks 2, Wizards 2, Archers 3, **Bombs 1**, Reinforcements 2, **Bombs 2**,
  Orbital 3, Barracks 3, Wizards 3, Reinforcements 3, **Bombs 3**. With the sixth track the tree costs 36 stars but only 30
  are earnable, so the whole tree can never be bought; the bots simply stop at their budget (competent: 2 stars per cleared
  level = 18 on level 10, i.e. A3 W2 B2 O2 R1 X1; expert: 27 on level 10). Bombs are bought late on purpose: the radius is a
  nice-to-have while armor piercing and the cheaper wizards decide more levels.
* **Waves**: each level's wave list is a hand-written *shape* (which enemies appear in which wave, intros in tiny numbers
  first, timing of the groups). The numbers inside it are searched by `tools/bots/shape.ts`: one overall size factor plus
  one multiplier per UFO class (plated, prism, skimmer, scouts+darts, carrier, dread), hill-climbed against the real sim so
  that (a) competent wins every seed with ~13 lives, (b) archer-only, wizard-only **and bomb-only** all do clearly worse and
  at least one of archer/wizard nearly loses (from level 4), (c) competent ends with little gold and is not maxed before the
  last third. The result is baked into the level files as plain numbers (`tools/bots/tune.ts` does the same for a plain size
  factor). The final search used seeds 1-5 and 21-23 (a few of the reporting seeds are in the fit, the rest of 1-12 are a
  sanity check), 70-150 iterations per level. Always re-check with `npm run balance`.
* Seeds 1-5 are used for reporting; the expert plan search used 101-108.

## Specializations (levels 7-10): what changed and how it was balanced

* **Mechanics** are in DESIGN section 12 (numbers in `SPEC_TUNING`, `src/core/data/specs.ts`). Specs cost 300 g each, so on the gold-starved
  levels a spec always displaces upgrades/towers: that is the intended trade-off.
* **Wizard Lv3** lost the Arc Bolt chain (now the Chain Lightning spec). Compensation: 45-70 / 1.3 s -> 54-82 / 1.25 s (about +23% dps). Levels 4-6
  (the only ones with a base Lv3 wizard and no specs) give the same competent / expert / mono results as before (12.8 / 13.6 / 13.6 competent),
  and L10 got ~3 lives easier because single-target damage matters against the Mothership.
* **Numbers after tuning with `tools/specbench.ts`** (first drafts in brackets): Eagle Eye range x1.3 [1.4], damage x1.2 [1.3]; Hunting Nets every
  6.5 s [9], radius 1.2 [1.0], root 3 s [2.5]; Chain Lightning 50/35/20% within 1.5 t [70/50/35%, 1.6]; Fire Mages 40 true dps [6]; Bigger Bombs
  radius x1.4 [1.5], damage x1.25 [1.4]; Homing Missiles every 5 s [6], 90 damage [60], splash 0.7 [0.5]; Bow Training 9-13 every 1.0 s [6-9 / 1.2].
  The drafts made Eagle Eye and Chain Lightning dominant and Nets, Fire Mages, Homing Missiles and Bow Training marginal.
* **Bots**: the competent / expert plans buy specs through per-level "slots" (`tools/bots/specs.ts`: which kind, which spec, after how many builds);
  `nospec` never specializes; the eight `spec:<id>` bots force one option for every slot of its tower kind (and make sure two towers of that kind are
  specialized), so the two options of a tower are compared on the same economy and waves.
* **Levels 7-10 were re-tuned** (`shape.ts`, 6 seeds, kept the shape): with specs the old waves were far too easy. L10 start gold 400 -> 700 (specs
  cost 1 200 g there and the Mothership fight is a race that is lost if the towers are not maxed); L8/L9 expert plans were re-searched.
  Without specs the same bot (`nospec`) averages 2.5 / 0.1 / 6.0 / 12.4 lives on L7-L10: from level 7 on specs are close to mandatory.
* **Result of the comparison** (all tables below): the two options of each tower are within 0.0-0.9 lives (<= 7%) over L7-L10. Many variants are
  identical on a level because the slot of that kind is not used there (or the level is decided by waves before the spec arrives): the real
  differences are in the micro-benchmark: Eagle Eye wins armor, Nets win fliers / heavies / mixed / boss; Chain Lightning wins swarms, armor and
  fliers, Fire Mages wins heavies and the boss; Bigger Bombs wins armor / heavies, Homing Missiles wins fliers; Bow Training wins fliers, Extra
  Recruits wins swarms / armor / resist.
* **Known soft spots**: L10 `nospec` equals `competent` (the specs are bought late there, after the towers are maxed, and the lives are decided by
  earlier waves) and wizard-only is not below competent on L10 (13.0 vs 12.4 over 8 seeds; seed 1, used by the tests, is fine). The L7-L10 bot
  results are cliff-like (an average of 12 can hide a 6 and an 18).

## Targets and how they are met

| target | result |
|---|---|
| competent wins everything, 10-17 lives on average | L3-L10: 12.2-16.6 (L1-L2 are deliberately gentle: 20 / 20). |
| expert reaches 18+ (3 stars) everywhere | yes, 19.4-20.0 average on every level (L4 and L10 have single seeds at 17). |
| naive loses from L4 onward | yes (0 wins on L3-L10); it still wins L1 and some L2 runs. |
| idle always loses | yes, on wave 1-4. |
| every single-kind bot is worse than competent from L4 on, and archer-only or wizard-only loses (or nearly) | yes on every level L4-L10 (see the variants table), bomb-only included: it loses everything from L2 on. |
| competent ends with <= ~600 gold and keeps investing into the last third | yes: 56-485 gold left on every level, last purchase at 90-100% of the run. L9 (7 spots) is the only level that reaches "everything maxed" before the end (91% of the run); L1 reaches it at 90%. |
| the competent bot builds bomb towers on most levels, but they are not dominant | 9 of 10 plans contain bombs (not L9, 7 spots and armor-heavy). Replacing every bomb by an archer changes the average lives by +4.4 (L4), +1.3 (L5), -3.0 (L6), +0.2 (L7), -0.3 (L8), -0.4 (L10) and ~0 on L1-L3: a useful swarm specialist on the ground-swarm levels, a slight liability on the flier-heavy ones. |
| the Mothership dies late on the road | competent 85%, expert 84% (seeds 1-5). |

## Changes to global data (and why)

* **Bomb tower (new).** Final numbers: Lv1 100 gold, 12-22 dmg, 2.0 s, range 3.0, blast radius 1.0; Lv2 +160, 26-48, 1.9 s, 3.2,
  1.1; Lv3 +240, 54-84, 1.8 s, 3.4, 1.2 with Cluster Bomb (3 bomblets, radius 0.5, 30% damage). The first draft used the design
  brief's numbers (cost 125 / +200 / +300, damage 8-15 / 18-32 / 35-55, 2.5 / 2.4 / 2.3 s, radius 0.8 / 0.9 / 1.0). With those the
  competent plans (bombs built where the swarms are) averaged 89 lives summed over L2-L9 against 108 for the pre-bomb plans on the
  same waves, and a Lv3 bomb (625 gold in total) was out-damaged by a 340-gold archer even against a swarm (one tower, 40
  scouts: archer 0 leaks, bomb 6): a shell only helps for the 3-5 enemies
  inside its blast, and the 2.3 s cooldown means just 3-4 shells per pass. A sweep over damage / cooldown / radius / cost showed that
  **cost** was the biggest lever, then damage and cooldown, then radius. The shipped numbers give the bomb the same price as the
  wizard (100 / 160 / 240), a bit more damage per second and a larger blast, in exchange for being ground-only, physical (armor
  applies: plated take 20%, dread 40%) and dodgeable.
* **Star track 'bombs'** (+20% blast radius, +15% damage, 5 bomblets at 35%) and the tower cap schedule (L1 1, L2-L5 2, L6+ 3) are as
  designed; they were not changed by the balancing.
* Plated armor 0.5 -> 0.8, prism magic resistance 0.5 -> 0.7, dreadnought 0.3/0.3 -> 0.6/0.4 and bounty 70 -> 40, Mothership
  0.8/0.8 -> 0.4/0.4 and HP 6000 -> 14000 (earlier balance pass, unchanged): these are what make archers, wizards and bombs
  counters of different UFOs (arrows 20% of their damage on plated, bolts 30% on prisms, shells 20% / 100% / 40% on plated /
  prism / dread).
* HP of the other UFOs and the archer / wizard / barracks numbers are unchanged. Tests that pinned the old armor/resist/HP/bounty
  numbers read the values from the data tables.
* Level data: the tower caps gained the `bomb` entry. After the bomb tower and the extended star tree the waves of levels 4-10 were
  re-searched with `shape.ts` (now with bomb-only in the objective). Level 9 was additionally reshaped by hand
  before the final search (far fewer fodder / skimmers / carriers and almost no darts, many more plated and prisms, two dreadnoughts
  instead of three per wave): with the old composition both competent and archer-only lost exactly two dreadnoughts (6 lives) and cleared
  everything else, so the search could not separate them. Level 10's start gold went from 450 to 400 (the final wave sat on a cliff:
  with 450 the wizard-only bot sometimes won with 19 lives). The hint texts are unchanged.

## What each introduction does

Single-tower variants (competent plan/stars/abilities, every tower forced to one kind), from the table below:

* **Skimmer (L2)**: barracks-only goes from 19.8 lives (L1) to a loss on wave 5. Knights cannot block fliers. Bomb-only loses too
  (shells cannot hit fliers), as it does on every later level.
* **Plated (L3)**: archer-only drops to ~11 lives (competent 16.6), still a clean win - L3 is early and only the archer reaches level 3
  there. Wizard-only is fine (18.2).
* **Prism (L4)**: wizard-only and bomb-only lose every run, archer-only wins 1/5 (the new star order delays armor piercing, which the
  plated-heavy waves need).
* **Carrier (L5)**: 2 lives and 3 Darts on death; archer-only and wizard-only win 2/5 with 0.8 / 1.6 lives.
* **L6-L8**: mono builds average 0.6-8.6 lives (archer-only 8.6 / 0.0 / 0.6, wizard-only 2.6 / 8.2 / 5.0).
* **Dreadnought (L7)**: 800 HP, 3 lives, 25 melee damage - archer-only cannot stop it (0 wins), wizard-only wins 5/5 with 8.2.
* **L9**: the tight 7-spot map; archer-only wins but with 9.6 lives vs 12.2 for the mix, wizard-only 4.2.
* **Mothership (L10)**: archer-only 3.8 (2/5 wins), wizard-only loses on the final wave.

### The Mothership fight (L10)

* HP 14 000, armor/MR 0.4, speed 0.35 (59 tiles of road, ~170 s). Competent bot: the Mothership spawns at ~t=490 s (wave 15; most
  towers are level 3 by then) and dies at ~85% of the road, after fire from every tower on four legs of the road; expert bot: dies at
  ~84% of the road.
* Bombs can hit it (it is a ground target) but it moves at 0.35 t/s, so every shell lands: a Lv3 bomb does ~70 x 100% per 1.8 s to
  it (x0.6 armor) plus bomblets. It also keeps the escorts (2 scouts + 1 dart every 8 s) in the blast. Orbital Strike does not decide the
  fight: one cast is 60 (84 with the star) true damage plus 45 burn, ~0.5% of the HP.
* Knights do nothing against it (not blockable); archers (armor piercing matters: 0.4 -> 0.1) and wizards contribute roughly equally.
  The lives lost on this level (4 on average) come from the preceding waves and the escorts.

## Economy check

The old tables had the competent bot end L7 with 4 900, L9 with 4 600 and L10 with 10 700 unspent gold: those levels were
limited by the number of build spots (11 / 7 / 17), not by money. The dreadnought bounty was cut and the waves of L7/L9/L10 rebuilt
from fewer, tougher UFOs. With the bomb tower the competent bot still ends every level with 56-485 gold ("Economy" table in the
report): levels 2-8 and 10 are gold-starved all the way (never maxed, last purchase in the final 1-10% of the run), levels 1 and 9
reach "everything built and maxed" at 90-91% of the run. Level 9 is the exception that needed the heavy plated / prism waves (which pay 15
gold each) to stay in line, hence its 485 gold left.

## Concerns / degenerate strategies

* **Seed noise / cliffs.** Waves sit on a cliff for the mechanical bots (a few % more enemies flips 17 lives into 5), most of
  all on L8 (two entrances), L9 (two leaked dreadnoughts = 6 lives) and L10 (the wizard-only bot jumps between 0 and 20 lives with tiny
  wave changes). The shipped numbers were chosen on 8 seeds including some reporting ones; the 12-seed check of L10 gives competent 15.8,
  expert 19.1, archer-only 4.6, wizard-only 0.0.
* **Strong counters make the mixed plan mandatory from L4.** A player who builds only one tower kind will lose from L4 on; the
  tower mix tooltips / wave previews matter. Archers are still the best value per gold against unarmored fodder.
* **The bomb is a swarm / crowd tool, nothing else.** It cannot touch skimmers, does a fifth of its damage to plated, misses Darts
  (and anything moving much faster than ~1 t/s: the shell lands where the target *was* ~1 s earlier) and is at its best against
  UFOs that stand still: a barracks hold in front of a bomb tower turns every shell into a full-damage hit. That synergy is not modelled by
  the bots (they place bombs by road coverage), so a human can do better than the competent bot with them.
* **Bomb stars are the lowest priority of the bots**, since only 30 of the 36 stars can be earned; a player who goes bomb-heavy will
  give up e.g. reinforcements 3 / wizards 3.
* **Barracks holds are very strong.** An engaged UFO stops, so a knight post inside the kill zone of two or three towers
  is a multiplier; that is why `expert` plans always have a barracks on a bend. Barracks alone, however, lose to fliers
  (every level from L2).
* **Early calls pay twice**: +1.5 gold per second left and -0.5 s on both cooldowns per second left.
* **Expert plans do not use all spots** and leave 1 000+ gold at the end of most levels; only competent is held to the gold goal.
* Idle loses on wave 2-4 rather than wave 1-2 on the early levels because the first waves are small by design.

<!-- balance:generated:start -->
# UFO Defense - balance report

Generated by `npm run balance` (tools/balance.ts). Every number comes from running the real `Sim` headless with scripted bots (see tools/bots).

Seeds per bot and level: 8. Cells show: wins / lives left (min/avg/max over all seeds, 0 = lost) / average wave number reached by the lost runs / average gold left unspent at the end (g).

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
| bomb-only | 2/level | competent | competent | plan (competent), only bomb |
| nospec | 2/level | competent | competent | plan (competent), no specializations |
| spec:eagle_eye | 2/level | competent | competent | plan (competent), every spec slot of its kind = eagle_eye |
| spec:hunting_nets | 2/level | competent | competent | plan (competent), every spec slot of its kind = hunting_nets |
| spec:chain_lightning | 2/level | competent | competent | plan (competent), every spec slot of its kind = chain_lightning |
| spec:fire_mages | 2/level | competent | competent | plan (competent), every spec slot of its kind = fire_mages |
| spec:bigger_bombs | 2/level | competent | competent | plan (competent), every spec slot of its kind = bigger_bombs |
| spec:homing_missiles | 2/level | competent | competent | plan (competent), every spec slot of its kind = homing_missiles |
| spec:bow_training | 2/level | competent | competent | plan (competent), every spec slot of its kind = bow_training |
| spec:extra_recruits | 2/level | competent | competent | plan (competent), every spec slot of its kind = extra_recruits |

Star upgrades by level (competent / expert; A archers, W wizards, B barracks, O orbital, R reinforcements, X bombs):

| level | competent (2*) | expert (3*) |
|---|---|---|
| 1 | 0 pts: A0 W0 B0 O0 R0 X0 | 0 pts: A0 W0 B0 O0 R0 X0 |
| 2 | 2 pts: A1 W0 B0 O1 R0 X0 | 3 pts: A1 W0 B1 O1 R0 X0 |
| 3 | 4 pts: A1 W0 B1 O1 R0 X0 | 6 pts: A2 W0 B1 O1 R0 X0 |
| 4 | 6 pts: A2 W0 B1 O1 R0 X0 | 9 pts: A2 W1 B1 O2 R1 X0 |
| 5 | 8 pts: A2 W1 B1 O2 R0 X0 | 12 pts: A2 W1 B2 O2 R1 X0 |
| 6 | 10 pts: A2 W1 B1 O2 R1 X0 | 15 pts: A2 W2 B2 O2 R1 X0 |
| 7 | 12 pts: A2 W1 B2 O2 R1 X0 | 18 pts: A3 W2 B2 O2 R1 X1 |
| 8 | 14 pts: A2 W2 B2 O2 R1 X0 | 21 pts: A3 W2 B2 O2 R2 X2 |
| 9 | 16 pts: A3 W2 B2 O2 R1 X0 | 24 pts: A3 W2 B2 O3 R2 X2 |
| 10 | 18 pts: A3 W2 B2 O2 R1 X1 | 27 pts: A3 W2 B3 O3 R2 X2 |

## Results

| level | competent | expert | naive | idle |
|---|---|---|---|---|
| 1 Meadow Landing | 8/8 win / 20/20.0/20 / - / g54 | 8/8 win / 20/20.0/20 / - / g112 | 8/8 win / 20/20.0/20 / - / g106 | 0/8 win / 0/0.0/0 / 3.0 / g300 |
| 2 Blossom Bend | 8/8 win / 20/20.0/20 / - / g93 | 8/8 win / 20/20.0/20 / - / g55 | 5/8 win / 0/3.1/8 / 6.0 / g44 | 0/8 win / 0/0.0/0 / 2.0 / g320 |
| 3 Twin Creeks | 8/8 win / 12/16.3/20 / - / g114 | 8/8 win / 20/20.0/20 / - / g139 | 0/8 win / 0/0.0/0 / 5.6 / g32 | 0/8 win / 0/0.0/0 / 2.0 / g340 |
| 4 Dune Crossing | 8/8 win / 8/12.4/17 / - / g91 | 8/8 win / 17/19.6/20 / - / g417 | 0/8 win / 0/0.0/0 / 6.0 / g55 | 0/8 win / 0/0.0/0 / 2.0 / g360 |
| 5 Oasis Crossroads | 8/8 win / 12/13.8/17 / - / g116 | 8/8 win / 20/20.0/20 / - / g1246 | 0/8 win / 0/0.0/0 / 4.9 / g59 | 0/8 win / 0/0.0/0 / 1.0 / g400 |
| 6 Scorpion Loop | 8/8 win / 8/13.8/18 / - / g83 | 8/8 win / 20/20.0/20 / - / g2331 | 0/8 win / 0/0.0/0 / 4.0 / g34 | 0/8 win / 0/0.0/0 / 3.0 / g420 |
| 7 Frostbite Pass | 8/8 win / 13/15.3/17 / - / g97 | 8/8 win / 20/20.0/20 / - / g94 | 0/8 win / 0/0.0/0 / 7.0 / g76 | 0/8 win / 0/0.0/0 / 4.0 / g440 |
| 8 Glacier Junction | 8/8 win / 6/12.1/18 / - / g213 | 8/8 win / 20/20.0/20 / - / g2479 | 0/8 win / 0/0.0/0 / 3.8 / g40 | 0/8 win / 0/0.0/0 / 1.0 / g450 |
| 9 Icebound Bastion | 8/8 win / 8/11.4/14 / - / g450 | 8/8 win / 14/19.3/20 / - / g1445 | 0/8 win / 0/0.0/0 / 5.4 / g79 | 0/8 win / 0/0.0/0 / 4.0 / g450 |
| 10 The Mothership | 8/8 win / 8/12.4/14 / - / g74 | 8/8 win / 20/20.0/20 / - / g189 | 0/8 win / 0/0.0/0 / 7.0 / g42 | 0/8 win / 0/0.0/0 / 4.0 / g700 |

### Single-tower-type variants

Competent bot (same plan, stars and abilities) but every tower is forced to one kind. Shows which enemy introductions punish which mix.

| level | archer-only | wizard-only | barracks-only | bomb-only |
|---|---|---|---|---|
| 1 Meadow Landing | 8/8 win / 20/20.0/20 / - / g156 | 8/8 win / 20/20.0/20 / - / g43 | 8/8 win / 19/19.9/20 / - / g112 | 8/8 win / 16/18.0/19 / - / g74 |
| 2 Blossom Bend | 8/8 win / 20/20.0/20 / - / g170 | 8/8 win / 20/20.0/20 / - / g80 | 0/8 win / 0/0.0/0 / 5.0 / g34 | 0/8 win / 0/0.0/0 / 5.4 / g102 |
| 3 Twin Creeks | 8/8 win / 10/10.8/12 / - / g64 | 8/8 win / 17/18.6/20 / - / g27 | 0/8 win / 0/0.0/0 / 4.0 / g58 | 0/8 win / 0/0.0/0 / 6.5 / g59 |
| 4 Dune Crossing | 1/8 win / 0/0.1/1 / 9.0 / g64 | 0/8 win / 0/0.0/0 / 8.0 / g57 | 0/8 win / 0/0.0/0 / 5.3 / g75 | 0/8 win / 0/0.0/0 / 5.9 / g46 |
| 5 Oasis Crossroads | 3/8 win / 0/0.8/3 / 9.0 / g41 | 4/8 win / 0/1.8/6 / 7.0 / g139 | 0/8 win / 0/0.0/0 / 3.9 / g68 | 0/8 win / 0/0.0/0 / 4.0 / g76 |
| 6 Scorpion Loop | 8/8 win / 6/9.4/11 / - / g484 | 5/8 win / 0/2.0/7 / 7.3 / g103 | 0/8 win / 0/0.0/0 / 3.6 / g36 | 0/8 win / 0/0.0/0 / 4.0 / g28 |
| 7 Frostbite Pass | 0/8 win / 0/0.0/0 / 10.0 / g48 | 8/8 win / 10/12.6/16 / - / g136 | 0/8 win / 0/0.0/0 / 5.1 / g37 | 0/8 win / 0/0.0/0 / 5.9 / g73 |
| 8 Glacier Junction | 1/8 win / 0/0.8/6 / 4.1 / g252 | 7/8 win / 0/7.3/13 / 4.0 / g150 | 0/8 win / 0/0.0/0 / 2.0 / g27 | 0/8 win / 0/0.0/0 / 3.4 / g74 |
| 9 Icebound Bastion | 8/8 win / 1/6.0/12 / - / g1302 | 8/8 win / 6/9.3/14 / - / g589 | 0/8 win / 0/0.0/0 / 5.9 / g19 | 0/8 win / 0/0.0/0 / 5.5 / g97 |
| 10 The Mothership | 1/8 win / 0/0.3/2 / 7.1 / g280 | 6/8 win / 0/13.0/20 / 15.0 / g43 | 0/8 win / 0/0.0/0 / 6.1 / g37 | 0/8 win / 0/0.0/0 / 6.9 / g82 |

## Specializations

Levels 7-10 only. `competent` buys specs by the per-level rule of `tools/bots/specs.ts`; `nospec` is the same bot that never specializes; `spec:<id>` is the competent bot where every tower of that spec's kind that gets a spec uses exactly that option (and two towers of that kind are specialized), i.e. the two options of a tower are compared on the same economy and the same waves.

Lives left per level (average over the seeds; win rate in brackets):

| level | competent | nospec | spec:eagle_eye | spec:hunting_nets | spec:chain_lightning | spec:fire_mages | spec:bigger_bombs | spec:homing_missiles | spec:bow_training | spec:extra_recruits |
|---|---|---|---|---|---|---|---|---|---|---|
| 7 Frostbite Pass | 15.3 (8/8) | 2.5 (6/8) | 15.3 (8/8) | 9.3 (8/8) | 15.3 (8/8) | 15.3 (8/8) | 15.3 (8/8) | 15.3 (8/8) | 17.1 (8/8) | 17.1 (8/8) |
| 8 Glacier Junction | 12.1 (8/8) | 0.1 (1/8) | 12.1 (8/8) | 14.5 (8/8) | 12.1 (8/8) | 10.8 (7/8) | 10.3 (7/8) | 12.1 (8/8) | 12.1 (8/8) | 12.1 (8/8) |
| 9 Icebound Bastion | 11.4 (8/8) | 6.0 (8/8) | 11.4 (8/8) | 11.4 (8/8) | 11.4 (8/8) | 11.4 (8/8) | 11.4 (8/8) | 11.4 (8/8) | 11.4 (8/8) | 11.4 (8/8) |
| 10 The Mothership | 12.4 (8/8) | 12.4 (8/8) | 12.4 (8/8) | 12.4 (8/8) | 12.4 (8/8) | 12.4 (8/8) | 12.4 (8/8) | 12.4 (8/8) | 12.4 (8/8) | 12.4 (8/8) |
| **all of L7-L10** | **12.8** (32/32) | **5.3** (23/32) | **12.8** (32/32) | **11.9** (32/32) | **12.8** (32/32) | **12.4** (31/32) | **12.3** (31/32) | **12.8** (32/32) | **13.3** (32/32) | **13.3** (32/32) |

Option A vs option B of each tower (lives averaged over L7-L10, same seeds; a gap below ~10% of the plain competent result is "balanced"):

| tower | option A | lives (wins) | option B | lives (wins) | gap |
|---|---|---|---|---|---|
| archer | eagle_eye | 12.8 (32/32) | hunting_nets | 11.9 (32/32) | 0.9 lives |
| wizard | chain_lightning | 12.8 (32/32) | fire_mages | 12.4 (31/32) | 0.3 lives |
| bomb | bigger_bombs | 12.3 (31/32) | homing_missiles | 12.8 (32/32) | 0.5 lives |
| barracks | bow_training | 13.3 (32/32) | extra_recruits | 13.3 (32/32) | 0.0 lives |

### Single-tower micro-benchmark

`npx tsx tools/specbench.ts`: one Lv3 tower (plain / each spec) beside plain Lv3 companions on a straight road against fixed UFO mixes; the cell is the share of the wave's HP that was removed before it left the map and the lives leaked. This is where the two options of a tower show their different strengths.

**archer** (Lv3 archer beside plain Lv3 companions (archer, wizard, bomb, barracks); cells: % of the wave's HP stopped / lives leaked)

| UFO mix | companions only | plain Lv3 | eagle_eye | hunting_nets | better |
|---|---|---|---|---|---|
| swarm (scouts + darts) | 93% / 34.4 | 98% / 12.8 | 99% / 2.6 | 99% / 5.5 | tie |
| armor (plated) | 53% / 34.9 | 58% / 33.8 | 70% / 27.3 | 68% / 27.8 | tie |
| magic resist (prism) | 89% / 20.5 | 98% / 6.1 | 100% / 1.1 | 100% / 1.8 | tie |
| fliers (skimmers) | 61% / 32.1 | 84% / 23.4 | 89% / 19.1 | 92% / 11.1 | hunting_nets |
| heavies (dreadnought + carrier) | 57% / 28.6 | 64% / 25.3 | 67% / 25.4 | 75% / 20.0 | hunting_nets |
| mixed wave | 59% / 35.0 | 65% / 29.0 | 69% / 26.6 | 74% / 19.5 | hunting_nets |
| Mothership | 20% / 21.0 | 23% / 20.9 | 25% / 21.3 | 28% / 20.0 | hunting_nets |

**wizard** (Lv3 wizard beside plain Lv3 companions (archer, wizard, bomb, barracks); cells: % of the wave's HP stopped / lives leaked)

| UFO mix | companions only | plain Lv3 | chain_lightning | fire_mages | better |
|---|---|---|---|---|---|
| swarm (scouts + darts) | 93% / 34.4 | 94% / 28.0 | 97% / 15.3 | 94% / 28.0 | chain_lightning |
| armor (plated) | 53% / 34.9 | 72% / 24.8 | 92% / 13.6 | 88% / 13.4 | chain_lightning |
| magic resist (prism) | 89% / 20.5 | 90% / 18.6 | 95% / 13.4 | 95% / 12.8 | tie |
| fliers (skimmers) | 61% / 32.1 | 77% / 18.9 | 96% / 7.5 | 77% / 18.9 | chain_lightning |
| heavies (dreadnought + carrier) | 57% / 28.6 | 64% / 25.8 | 73% / 22.1 | 76% / 22.3 | fire_mages |
| mixed wave | 59% / 35.0 | 65% / 30.4 | 71% / 27.4 | 69% / 25.9 | tie |
| Mothership | 20% / 21.0 | 24% / 20.8 | 24% / 20.6 | 30% / 20.8 | fire_mages |

**bomb** (Lv3 bomb beside plain Lv3 companions (archer, wizard, bomb, barracks); cells: % of the wave's HP stopped / lives leaked)

| UFO mix | companions only | plain Lv3 | bigger_bombs | homing_missiles | better |
|---|---|---|---|---|---|
| swarm (scouts + darts) | 93% / 34.4 | 100% / 2.5 | 100% / 0.0 | 100% / 0.0 | tie |
| armor (plated) | 53% / 34.9 | 78% / 23.9 | 91% / 14.3 | 83% / 21.6 | bigger_bombs |
| magic resist (prism) | 89% / 20.5 | 100% / 0.0 | 100% / 0.0 | 100% / 0.0 | tie |
| fliers (skimmers) | 61% / 32.1 | 61% / 32.1 | 61% / 32.1 | 78% / 17.5 | homing_missiles |
| heavies (dreadnought + carrier) | 57% / 28.6 | 69% / 22.1 | 80% / 14.3 | 75% / 17.6 | bigger_bombs |
| mixed wave | 59% / 35.0 | 82% / 19.0 | 91% / 15.3 | 88% / 11.0 | bigger_bombs |
| Mothership | 20% / 21.0 | 24% / 21.3 | 26% / 21.8 | 27% / 21.5 | tie |

**barracks** (Lv3 barracks beside plain Lv3 companions (archer, wizard, bomb, barracks); cells: % of the wave's HP stopped / lives leaked)

| UFO mix | companions only | plain Lv3 | bow_training | extra_recruits | better |
|---|---|---|---|---|---|
| swarm (scouts + darts) | 93% / 34.4 | 94% / 27.8 | 94% / 27.9 | 94% / 27.4 | tie |
| armor (plated) | 53% / 34.9 | 59% / 30.1 | 60% / 30.6 | 63% / 29.1 | extra_recruits |
| magic resist (prism) | 89% / 20.5 | 91% / 18.1 | 90% / 18.1 | 91% / 17.1 | tie |
| fliers (skimmers) | 61% / 32.1 | 61% / 32.1 | 74% / 27.8 | 61% / 32.1 | bow_training |
| heavies (dreadnought + carrier) | 57% / 28.6 | 70% / 21.6 | 73% / 21.0 | 74% / 20.8 | tie |
| mixed wave | 59% / 35.0 | 63% / 30.9 | 62% / 29.9 | 63% / 29.6 | tie |
| Mothership | 20% / 21.0 | 20% / 21.3 | 22% / 22.0 | 20% / 20.6 | tie |


### Economy

Gold left at the end, total gold earned, the time at which every build spot held a tower at its level cap ("maxed", with the share of the run it took and in how many seeds it happened) and how late the bot was still buying (time of its last purchase as a share of the run). The goal: little gold left over, and no maxing before the last third of the level.

| level | competent gold left | competent earned | competent maxed at | competent last buy | expert gold left | expert earned | expert maxed at | expert last buy |
|---|---|---|---|---|---|---|---|---|
| 1 Meadow Landing | 54 | 434 | 114 s (90%, 8/8) | 90% | 112 | 492 | 69 s (77%, 8/8) | 77% |
| 2 Blossom Bend | 93 | 1664 | never | 98% | 55 | 1695 | never | 98% |
| 3 Twin Creeks | 114 | 994 | never | 94% | 139 | 1089 | never | 93% |
| 4 Dune Crossing | 91 | 2291 | never | 97% | 417 | 2477 | never | 88% |
| 5 Oasis Crossroads | 116 | 3094 | never | 99% | 1246 | 3246 | never | 73% |
| 6 Scorpion Loop | 83 | 4907 | never | 99% | 2331 | 5025 | never | 61% |
| 7 Frostbite Pass | 97 | 2815 | never | 98% | 94 | 2888 | never | 99% |
| 8 Glacier Junction | 213 | 6143 | 399 s (99%, 8/8) | 99% | 2479 | 6239 | never | 70% |
| 9 Icebound Bastion | 450 | 3620 | 372 s (95%, 8/8) | 95% | 1445 | 3725 | never | 67% |
| 10 The Mothership | 74 | 6922 | never | 91% | 189 | 7037 | never | 86% |

Mothership (level 10): where on the road the boss was when it died (won runs) or when the run ended (lost runs): competent 85%, expert 82%, archer-only 65%, wizard-only 97%.

## Levels

| level | name | biome | waves | start gold | spots | tower caps (A/W/B/X) | new enemies | max units in a wave |
|---|---|---|---|---|---|---|---|---|
| 1 | Meadow Landing | spring | 6 | 300 | 8 | 1/1/1/1 | scout, dart | 36 |
| 2 | Blossom Bend | spring | 7 | 320 | 10 | 2/2/2/2 | skimmer | 77 |
| 3 | Twin Creeks | spring | 8 | 340 | 12 | 3/2/2/2 | plated | 33 |
| 4 | Dune Crossing | desert | 9 | 360 | 12 | 3/3/2/2 | prism | 64 |
| 5 | Oasis Crossroads | desert | 10 | 400 | 14 | 3/3/3/2 | carrier | 90 |
| 6 | Scorpion Loop | desert | 10 | 420 | 14 | 3/3/3/3 | - | 99 |
| 7 | Frostbite Pass | winter | 12 | 440 | 11 | 3/3/3/3 | dread | 35 |
| 8 | Glacier Junction | winter | 12 | 450 | 14 | 3/3/3/3 | - | 121 |
| 9 | Icebound Bastion | winter | 12 | 450 | 7 | 3/3/3/3 | - | 37 |
| 10 | The Mothership | mixed | 15 | 700 | 17 | 3/3/3/3 | mothership | 57 |

<!-- balance:generated:end -->

## Re-running the tools

```
npm run balance                       # everything, writes this file (about 30 s)
npm run balance -- --level 5 --verbose --bot competent --seeds 3
npx tsx tools/bots/autoplan.ts --level 5 [--write]   # baseline competent plan for a level (--write updates plans.ts)
npx tsx tools/bots/search.ts --level 5 --bot expert --scale 1.0 --seeds 8 --iters 250   # optimise an expert plan
npx tsx tools/bots/shape.ts --level 5 --iters 120 --seeds 21,22,23,24,25,26,27,28 [--write]   # search wave numbers (see header)
npx tsx tools/bots/tune.ts --level 5 --target 13.5 --write   # just bisect a uniform wave-size factor
```
