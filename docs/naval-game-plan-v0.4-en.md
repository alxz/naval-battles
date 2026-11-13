# Naval-Battles — Project Plan v0.4

*Solo hobby project · 12 Nov 2026 · Replaces plans v0.1–v0.3 and the web draft "Sails & Powder"*

*Companion document: `art-and-tools-guide-v0.1.md` (sprite specifications, art pipeline, tools).*

**Status:** planning done · decisions confirmed · next step is milestone M0.

---

## 0. How to read this plan

| Section | What it gives you |
|---|---|
| 1 | The game in one page |
| 2 | Decision log: what is fixed, and why |
| 3 | Scope: what is in the first version and what waits |
| 4 | Game rules for the first version (the design spec) |
| 5 | Technical architecture |
| 6 | **Roadmap: releases, milestones, checklists** |
| 7 | How we work together |
| 8 | Risks |
| 9 | Open decisions (1 item, with a default) |
| A, B | Glossary of sailing terms · change history |

All numbers in this plan are **starting values**. They live in JSON data files and are tuned by playing.

---

## 1. The game in brief

**Naval-Battles** is a top-down pixel-art naval game set in the Caribbean in 1650–1720, the Golden Age of Piracy. You command one armed sailing ship. You read the wind, fight with broadsides, board and capture enemy ships, trade in ports and grow your captain. The campaign is open-ended and can be saved at any time.

- **Side:** you choose **English captain** (pirate hunter) or **Pirate** at the start.
- **Goal:** the highest score: gold earned plus ships sunk and captured.
- **Platforms:** web browser first, then iPhone and iPad from the same code.
- **Stages:** Stage 1 is single player against bots (this plan). Stage 2 adds nations, fleets and weather. Stage 3 is multiplayer.

**Core loop:** sail → find a target → fight → sink or capture → take the loot → return to port → sell, repair, recruit, rearm → improve the captain → hunt bigger ships.

**Design principle:** simple first, deeper later. Each system starts as the smallest version that is fun.

---

## 2. Decision log

Status **Confirmed** means you approved it. Do not change these without a new discussion.

| # | Topic | Decision | Why | Status |
|---|---|---|---|---|
| D1 | Title | **Naval-Battles** (working title); repository `naval-battles` | Your choice | Confirmed 12 Nov |
| D2 | Engine | **Phaser 4** (2D) | Pixel art is 2D; Phaser supports it directly and is the easiest to learn. Version 4 is stable (4.2.x) | Confirmed 12 Nov |
| D3 | Camera | **Top-down world.** Ships start as one rotating sprite; later they use pre-rendered direction frames for a 3D look (D18) | The game math stays simple in both cases | Confirmed 12 Nov |
| D4 | 3D feel | Simulation tracks height `z`; the ball is drawn above its shadow | Real gravity arcs without a 3D engine | Confirmed 12 Nov |
| D5 | Backend | **Python + FastAPI + SQLite**; stores accounts, cloud saves, leaderboard | The game runs in the browser; Node.js is not needed in Stage 1 | Confirmed 12 Nov |
| D6 | Game rules | All rules in a separate `sim/` module with no Phaser code | Testable, and can move to a server for multiplayer | Confirmed 12 Nov |
| D7 | Setting | **Caribbean, 1650–1720** | Pirates against navies; ships of all nations were similar | Confirmed 12 Nov |
| D8 | Factions | **England + Pirates**; player picks a side | Covers both scenarios with the least content | Confirmed 12 Nov |
| D9 | Score | Total gold **earned** + ships sunk + ships captured | Your answer | Confirmed 12 Nov |
| D10 | Losing your ship | Captain survives, loses part of the gold, restarts with a sloop | Your answer | Confirmed 12 Nov |
| D11 | Captured ships | You can **take a captured ship as your own**, or sell it as a prize | Main way to get a bigger ship; no shipyard purchases needed | Confirmed 12 Nov |
| D12 | Work style | **Mix:** I write the larger pieces and explain them; you write small parts and tune numbers | Your answer | Confirmed 12 Nov |
| D13 | Pace | 8–10 hours per week; **a first playable version as early as possible** | Your answer | Confirmed 12 Nov |
| D14 | Hardware | Develop on Windows/Linux; build iOS on the MacBook Pro; test on iPad and iPhone | Your equipment | Confirmed 12 Nov |
| D15 | Roadmap order | Game first, **backend after the web alpha** | Gets you a playable game sooner; Python learning starts early through helper scripts (5.6) | Proposed (open decision O1) |
| D16 | Aiming | **Manual gun elevation** with a landing marker, plus random factors so that no shot is certain. The same rules apply to bots | Your note: aiming must stay partly a matter of luck after the player has learned it | Confirmed 12 Nov |
| D17 | Client language | **TypeScript** (compiled by Vite), using the gentle rules in 5.8 | You want to learn better practices; you know Java and C#, so types feel familiar. The gentle rules keep the cost low | Confirmed 12 Nov |
| D18 | Art path | Step 1: Kenney Pirate Pack placeholders. Step 2: **3D look from pre-rendered sprites** (Kenney Pirate Kit or your own models), as a **pixel look at 640 × 360** | You want a 3D look without a 3D engine. Small files, hides modelling flaws, easy to retouch by hand. The art spike in M2 may still change the camera angle, and we can revisit the style if the spike looks wrong | Confirmed 12 Nov |
| D19 | Living world | Your new ideas are staged (section 3.3). The cheapest, most valuable parts form their own release **R4 "Living Sea"**, after the campaign works | Sailing must not be boring, but R1–R3 must stay fast | Confirmed 12 Nov |
| D20 | Quests | One small **contract system** carries all quest ideas; new quest types are added as data and small scripts | Bounties, treasure, person hunts, ghost ships and guild jobs share one structure | Proposed |
| D21 | Apple Developer Program | Join at milestone **M10**; until then a free Apple ID is enough to test on your own devices | Saves about 99 USD per year for months | Confirmed 12 Nov |

**Two plans existed.** The folder `web_claude` holds a different draft ("Sails & Powder": Three.js, TypeScript, Spain, 1700–1725). Your confirmed decisions above override it. Its best ideas are merged into this plan; Appendix B lists them. Please use only the latest plan version from now on, and replace the old `PROJECT_INSTRUCTIONS.md` with the new `project-summary.md`.

---

## 3. Scope

### In the first version (Stage 1)

| Area | Included |
|---|---|
| Sailing | One global wind, rudder, sail slider 0–100%, three rig types |
| Combat | Port and starboard broadsides, gravity ballistics, 3 ammunition types |
| Damage | Hull, sails, crew |
| Capture | Surrender, boarding, loot, take the ship or sell it |
| World | One Caribbean map, 6 ports, time acceleration |
| Ports | Market (5 goods), repairs, crew, ammunition, prize sales |
| Captain | 3 skills: Navigation, Battle, Morale |
| Ships | Sloop, brigantine, merchantman, frigate |
| Bots | Merchant, navy patrol, pirate; three skill tiers |
| Living sea | Provisions and fishing, contracts and rumours, sea events, outlaw rule, trade that reacts to sunk ships |
| Saving | Local saves with export to file; cloud saves in release R6 |

### Later (the "parking lot")

New ideas go here, not into the current milestone.

- **Stage 2:** Spain, France, the Dutch; full reputation and letters of marque; fleets; crew morale and experience, rum rations; buying and upgrading ships; storms, fog, regional wind, shallows, day and night; seasons; merchant guilds; more quest types; playable merchant role; fire, flooding, mast loss; repairs at sea; bow and stern guns; treasure fleets and galleons; new maps (Mediterranean, Atlantic); Ironman mode.
- **Stage 3:** real-time multiplayer.

### 3.3 Your ideas, staged

Each idea is split into a small first version and a deeper later version.

| Idea | Stage 1 (release) | Stage 2 |
|---|---|---|
| **Sailing is never boring** | Time acceleration (R3). Sea events and contracts (R4) | Weather, day and night |
| **Side quests** | Contract system with 2 types: **Bounty** and **Treasure map** (R4) | Find a person, lost ship, ghost ship, hidden island, escort, smuggling |
| **Shooting stays partly luck** | Per-salvo and per-gun error, crew, wind, **gun wear** (R2) | Sea state and weather |
| **More kinds of enemies** | Bot skill tiers, armed merchantman, navy sloop-of-war (R2). **Outlaw rule** (R4) | Full reputation with every faction |
| **Food and water** | **Provisions** bought in port; **fishing** at sea (R4) | Fresh water on islands, rum rations and crew morale |
| **Meaningful trade** | Port stocks set prices; merchants carry real goods; a sunk merchant causes a shortage (R3) | Guilds that hire pirates, seasons, convoys |
| **Player roles** | English captain, Pirate | Merchant |

---

## 4. Game rules — first version

### 4.1 Scale, camera and time

| Item | Starting value |
|---|---|
| Logical resolution | 640 × 360 px, scaled ×2, ×3 or ×4 with sharp pixels |
| World scale | 1 m = 2 px, so the screen shows 320 × 180 m |
| Tactical zoom | Key **Z** zooms out to 1 m = 1 px (640 × 360 m) |
| Map size | About 6 × 4 km |
| Time acceleration | ×1, ×2, ×4, ×8; drops to ×1 when a ship comes into view |
| Pause | Always available |
| Game day | 2 real minutes at ×1 |
| Speed scale | A global multiplier on ship speeds (start at ×2) |

**Finding from the review:** v0.1 gave guns a 500 m range, but the screen is only 320 m wide. Version 0.2 limits gun range to about 250 m and adds the tactical zoom. This also matches history: broadsides were effective at a few hundred metres at most.

### 4.2 Wind

- One global wind with a direction and a strength from 0 to 1.
- Default: the Caribbean **trade wind from the east-north-east**. Sailing west is easy; coming back east needs tacking.
- The wind drifts slowly in small random steps. The HUD shows an arrow and the strength.

### 4.3 Sailing

You control the **rudder** and the **sail level** (0–100%).

`α` is the angle between your heading and the direction the wind comes **from**. At 0° the bow points into the wind.

**Polar table** (share of top speed at each angle; values between points are interpolated):

| Rig | No-go zone | 50° | 70° | 90° | 135° | 180° | Ships |
|---|---|---|---|---|---|---|---|
| Fore-and-aft | below 40° | 0.40 | 0.65 | 0.90 | 1.00 | 0.65 | Sloop |
| Mixed | below 48° | 0.10 | 0.50 | 0.80 | 1.00 | 0.75 | Brigantine |
| Square | below 55° | 0 | 0.30 | 0.70 | 1.00 | 0.85 | Frigate, merchantman |

Sloops sail closer to the wind, so a small ship can escape upwind from a frigate.

```
targetSpeed = maxSpeed × polar(α) × sailLevel × (0.4 + 0.6 × wind)
              × (0.2 + 0.8 × sailCondition) × (1 + 0.015 × Navigation)

speed    += (targetSpeed − speed) × (1 − e^(−dt / 5 s))        // heavy ships change speed slowly
turnRate  = baseTurnRate × (0.3 + 0.7 × min(1, speed / (0.5 × maxSpeed)))
            × (1 + 0.02 × Navigation)                           // a slow ship steers badly
```

Inside the no-go zone the ship slows and stops ("in irons"). Touching land stops the ship and damages the hull a little.

### 4.4 Guns and ballistics

- **Broadsides only.** Port and starboard batteries, each with its own reload timer.
- **Fire arc:** ±25° around the line at a right angle to the hull.
- **Aiming:** you set the gun **elevation from 0° to 10°**. A marker on the water shows where the shot will land.
- **Ripple fire:** the guns of one side fire one after another within about 0.4 s.
- **Crew:** each gun needs 4 sailors. With too few sailors, fewer guns fire.

**Ball physics** (30 steps per second):

```
start:     gun position on the hull side, height 2 m
velocity:  ship velocity + 85 m/s at a right angle to the hull, raised by the elevation
each step: vz −= 9.81 × dt;  position += velocity × dt
range ≈ v0² × sin(2 × elevation) / g        →  about 250 m at 10°, flight time about 3 s
```

Real muzzle speed was about 400 m/s. The game uses 85 m/s so that arcs are visible and fit the screen. Air drag is left out of the first version.

**Hit zones.** A ship is a rectangle with two height zones:

| Zone | Height | A hit damages |
|---|---|---|
| Hull | water to deck edge (about 2.5 m) | hull and crew |
| Rigging | deck edge to mast top | sails |
| Miss | ball reaches the water | splash only |

So aiming low hits the hull, and aiming high hits the sails.

**Accuracy: skill plus luck.** A player who has learned to aim must still miss sometimes. Two random errors are added to every broadside:

| Error | Applies to | Represents |
|---|---|---|
| **Salvo error** | The whole broadside, in elevation | The roll of the ship at the moment of firing. The whole salvo lands long or short together |
| **Gun error** | Each ball, in direction and elevation | The gun crew and the state of the gun |

```
σ_gun   = 1.5° × ammoSpread × (1.4 − 0.06 × Battle) × (1 + crewShortage) × (1 + 0.5 × gunWear)
σ_salvo = 0.6° × (1 + wind) × (1.2 − 0.04 × Battle)
```

- **Gun wear** goes from 0 to 1. Each broadside adds a little; the shipyard resets it for gold. Worn guns scatter more.
- **The landing marker is an ellipse**, not a point. Its size shows the current uncertainty, so the player sees why a shot may miss.
- **Bots use the same formulas.** A bot's skill tier sets its Battle skill and adds an aiming delay.
- Weather and sea state join the formula in Stage 2.
- The random numbers come from a seeded generator, so results can be repeated in tests.

**Reload time** = `baseReload × min(2.5, maxCrew / crew) × (1 − 0.03 × Battle)`.

### 4.5 Ammunition

| Type | Range | Spread | Hull | Sails | Crew | Use it to |
|---|---|---|---|---|---|---|
| Round shot | 100% | ×1.0 | 100% | 10% | 15% | sink |
| Chain shot | 60% | ×1.5 | 10% | 100% | 10% | stop a ship that runs |
| Grape shot | 30%, 8 pellets | ×2.0 | 0% | 10% | 100% | clear the deck before boarding |

Percentages multiply the base gun damage. Ammunition is bought in ports and is limited.

### 4.6 Ship state

| Value | Effect |
|---|---|
| Hull points | At 0 the ship sinks and leaves a floating loot crate |
| Sail condition 0–100% | Multiplies speed (4.3) |
| Crew | Fewer sailors: slower reload, fewer guns, weaker boarding |
| Ammunition | Three counters |
| Gun wear 0–1 | Worn guns are less accurate (4.4) |
| Provisions | Days of food and water for the crew (4.16) |
| Cargo and gold | Limited by the hold |

Repairs happen only in ports.

### 4.7 Capture and boarding

Your rule is kept: a ship can be captured when 80% of its crew is down or 80% of its sails are destroyed. One refinement is added so that chain shot alone does not win every fight.

| Enemy state | What happens |
|---|---|
| **Crew at 20% or less** | The enemy **strikes its colours**: it surrenders with no fight when you come alongside |
| **Sails at 20% or less** | The enemy cannot escape. You can board, but the crew **fights** |
| Merchant with heavy damage | May surrender early |

**Boarding:** come within 25 m at a relative speed under 3 m/s and press **Board**. One roll decides the fight:

```
attack  = yourCrew  × (1 + 0.04 × Battle + 0.03 × Morale) × random(0.8 … 1.2)
defence = theirCrew × 1.1                                  × random(0.8 … 1.2)
```

- **You win:** the ship is captured. Both sides lose crew in proportion to the strength ratio.
- **You lose:** you lose crew and must wait 30 s before a new attempt.
- Pirate bots can board you in the same way.

**After a capture** you take the gold and as much cargo as your hold allows. Then you choose:

| Choice | Result |
|---|---|
| **Take the ship** | It becomes your ship. Your crew, cargo and gold move over. The old ship is left behind |
| **Send as prize** | Costs 10 sailors as a prize crew. You receive 50% of the ship's value at your next friendly port |
| **Sink** | Counts as a ship sunk |
| **Release** | No reward; kept for the reputation system in Stage 2 |

### 4.8 Captain

Levels 1–10. Each level gives 1 skill point. Each skill goes from 0 to 10.

| Skill | Effect per point |
|---|---|
| **Navigation** | +1.5% speed, +2% turn rate |
| **Battle** | −3% reload time, better accuracy, +4% boarding strength |
| **Morale** | +3% boarding strength, −3% crew hire cost, enemies surrender sooner |

Experience comes from ships sunk and captured, prizes sold and trade profit.

**If your ship sinks:** the captain reaches the nearest friendly port, receives a basic sloop with a small crew, and loses 50% of the gold on hand and all cargo. Skills and score stay.

### 4.9 World and ports

One tile map built in the **Tiled** editor: sea, islands, 6 ports. The geography is simplified.

| Port | Owner | Open to |
|---|---|---|
| Port Royal | England | English captain |
| Bridgetown | England | English captain |
| St. John's | England | English captain |
| Nassau | Pirates | Pirate |
| Tortuga | Pirates | Pirate |
| Curaçao | Neutral free port | Both |

Sail slowly into the harbour zone and choose **Enter port**. The port screen offers:

| Service | Details |
|---|---|
| **Market** | 5 goods: sugar, rum, tobacco, cocoa, cloth. Prices follow each port's stock (see below) |
| **Shipyard** | Repair hull and sails, service the guns, sell prize ships |
| **Tavern** | Hire sailors from a limited daily pool; buy provisions; hear rumours (R4) |
| **Armory** | Buy round, chain and grape shot |
| **Admiralty / Pirate council** | Collect bounties; take contracts (R4); view score and statistics |

**Trade with a purpose.** Each port produces some goods and consumes others, and keeps a stock of each.

```
price = basePrice × (targetStock / currentStock), limited to 0.4 … 2.5 × basePrice
```

- Production and consumption change the stocks every game day.
- A merchant bot picks the route with the best profit, loads real goods and delivers them. Its arrival changes the stocks at both ports.
- If the merchant is sunk or plundered, the goods never arrive and the price at the destination rises. Pirate activity therefore moves the market, with no extra system.

### 4.10 Ships

| Class | Length | Rig | Guns per side | Crew | Hold | Top speed | Turn | Hull | Role |
|---|---|---|---|---|---|---|---|---|---|
| Sloop | 15 m | fore-and-aft | 4 | 60 | 40 | 11 kn | 14°/s | 220 | Your first ship; pirates |
| Brigantine | 20 m | mixed | 6 | 90 | 80 | 10 kn | 11°/s | 320 | Pirates, patrols |
| Merchantman | 28 m | square | 3 | 40 | 300 | 6 kn | 5°/s | 400 | Slow, rich, weakly armed |
| Frigate | 35 m | square | 12 | 180 | 120 | 9 kn | 7°/s | 600 | Royal Navy; the "boss" |

1 knot = 0.514 m/s. The merchantman is weakly armed, so new players have a fair first target.

**Variants** are data only and need no new art:

| Variant | Change | Purpose |
|---|---|---|
| Armed merchantman | 8 guns per side, crew 120 | A merchant that fights back |
| Navy sloop-of-war | Sloop with crew 90 and a better captain | A fast patrol that can catch you |
| Skill tier: green / regular / veteran | Captain skills 1 / 4 / 8 | The same ship can be easy or dangerous |

### 4.11 Bots

| Bot | Behaviour |
|---|---|
| **Merchant** | Carries goods on the most profitable route (4.9), runs from enemies, surrenders when beaten. Armed merchantmen fight |
| **Navy patrol** | Patrols an area; attacks pirates and a pirate player |
| **Pirate** | Hunts merchants and an English player; runs when its hull is below 30%. Also attacks an **outlaw** pirate player (4.16) |

Each bot is a simple state machine:

```
Travel / Patrol → (enemy seen) → Chase → Engage
Engage → (hull low)       → Flee
Engage → (target beaten)  → Board → Travel / Patrol
Any state → (land ahead)  → Avoid land
```

- **Bots follow the same rules as you.** They send the same commands (rudder, sails, fire, board) and feel the same wind.
- If the target lies inside the no-go zone, the bot tacks towards it.
- In **Engage** the bot turns its side to the target, computes the elevation from the range formula, adds an aiming error and fires when the target is inside the fire arc.
- A spawner keeps 8–15 bots alive and creates new ones outside your view.
- **Difficulty** changes the mix of skill tiers and the bots' reaction time.

### 4.12 Score

```
score = total gold earned + (500 × ships sunk + 1000 × ships captured) × class multiplier
class multiplier: sloop 1 · brigantine 1.5 · merchantman 1.5 · frigate 3
```

### 4.13 Saving

A save is one JSON file with a `version` field. The game autosaves when you enter a port, and you can save by hand at sea. Saves are stored in the browser, with **Export** and **Import** to a file. Cloud saves arrive in release R6.

### 4.14 Controls

| Action | Keyboard | Touch |
|---|---|---|
| Rudder | A / D | Wheel on the left |
| Sails | W / S | Slider on the right |
| Fire port / starboard | Q / E | Two fire buttons |
| Gun elevation | R / F | Up and down buttons |
| Ammunition | 1 / 2 / 3 | Ammunition button |
| Board | B | Board button |
| Zoom | Z | Pinch or button |
| Time speed / pause | T / Space | Buttons |
| Map / menu | M / Esc | Buttons |

### 4.15 HUD and visual style

- **HUD:** wind arrow and compass, speed, sail slider, bars for hull / sails / crew, ammunition, two reload indicators, target panel with the enemy's bars, minimap, time-speed buttons.
- **Ships:** 30–70 px long, with three sail states and a wake behind.
- **Effects:** ball with shadow, splashes, splinters, gun smoke, animated water, foam on coasts.
- **Art path:** Kenney Pirate Pack placeholders first; a 3D look from pre-rendered sprites later (D18).
- **Sprite sizes, frame counts, file sizes, pipeline and tools:** see `art-and-tools-guide-v0.1.md`.

### 4.16 Living sea (release R4)

These rules make the time between fights interesting. All of them reuse systems that exist by R3.

**Provisions**

- One value: **days of food and water** for the current crew. A ship carries up to 30 days.
- One day is used per game day. Provisions are bought in the tavern; the price grows with crew size.
- At zero, the ship loses 5% of its crew each day and reloads 25% slower.
- **Fishing:** when the ship is nearly stopped, the wind is not strong and no enemy is in sight, choose **Fish**. Time runs fast; every 6 game hours add 1 day of provisions, up to 5 days per stop.

**Contracts and rumours** (the quest system)

A contract is plain data: who gives it, the type, the target, the steps and the reward.

| Type | Given by | What you do |
|---|---|---|
| **Bounty** | Admiralty or Pirate council | Find a named ship and sink or capture it. Tavern rumours tell where it was last seen |
| **Treasure map** | Tavern, or loot from a captured ship | Sail to the marked spot on an island, stop and dig. Another ship may be after the same treasure |

Stage 2 adds types on the same system: find a person, lost ship, ghost ship, hidden island, guild jobs.

**Sea events**

When nothing is in sight for a while, the game may place one event near your course: floating wreckage with loot, castaways who join your crew, a merchant under attack, a derelict ship.

**Outlaw rule**

A pirate player who attacks another pirate ship becomes an **outlaw** for 20 game days. Pirate bots attack on sight and the pirate havens are closed; the neutral port stays open. Each new attack restarts the count. The full reputation system replaces this rule in Stage 2.

---

## 5. Technical architecture

### 5.1 Overview

```
 Keyboard / touch ──▶ commands ──┐
                                 ▼
 Bot AI ────────────▶ commands ─▶ sim/  (pure TypeScript, no Phaser)
                                 │  wind · ships · guns · damage · boarding · economy
                                 ▼
                          world state (plain data)
                 ┌───────────────┼────────────────┐
                 ▼               ▼                ▼
          Phaser scenes         HUD          save file (JSON)
                                                  │  HTTPS, from release R6
                                                  ▼
                                   Python FastAPI ── SQLite
```

### 5.2 Five architecture rules

1. **`sim/` has no Phaser code.** It holds data and math only. Phaser scenes read the state and draw it.
2. **Fixed time step:** 30 simulation steps per second on every device. Drawing runs at the screen's frame rate.
3. **The world state is plain data** (numbers, strings, arrays). A save is `JSON.stringify(state)`.
4. **Everything is a command.** The player and the bots change the world only through commands such as `setRudder`, `setSails`, `fire`, `board`.
5. **All balance numbers live in JSON files**, never in code.

### 5.3 Repository

```
naval-battles/
├── client/
│   ├── public/assets/        # sprites/, tiles/, maps/, audio/
│   ├── src/
│   │   ├── main.ts           # Phaser configuration
│   │   ├── sim/              # world, wind, sailing, ballistics, damage,
│   │   │                     # boarding, captain, economy, contracts,
│   │   │                     # events, rng, ai/
│   │   ├── scenes/           # Boot, Preload, Menu, Sea, Hud, Port (.ts)
│   │   ├── render/           # ShipView, ProjectileView, effects
│   │   ├── input/            # keyboard, touch → commands
│   │   ├── data/             # ships, polars, ammo, goods, ports (JSON)
│   │   └── save/             # saveManager, api
│   └── tests/                # Vitest tests for sim/
├── tools/                    # Python helper scripts
├── server/                   # Python FastAPI (release R6)
└── docs/                     # this plan, summary, notes
```

### 5.4 Tech stack

| Area | Choice |
|---|---|
| Game engine | Phaser 4.x |
| Client language | **TypeScript** (strict mode, gentle rules in 5.8), compiled by Vite |
| Build and dev server | Vite |
| Tests | Vitest (client), pytest (Python) |
| Live tuning panel | lil-gui |
| Maps / art | Tiled / Aseprite or a free editor |
| Backend | Python 3.12+, FastAPI, SQLModel, SQLite (PostgreSQL later) |
| Login | Argon2 password hashing + JWT |
| Python tools | uv, ruff, Pydantic, Pillow |
| iOS | Installable web app first, then Capacitor + Xcode |
| Version control | Git + GitHub |

### 5.5 Conventions

- Units: metres and seconds. `x` points east, `y` points south, the same as the screen.
- Angles in the simulation: 0 = east, clockwise, the same as Phaser.
- The HUD shows compass bearings (0 = north). One helper function converts them.
- Wind direction always means where the wind comes **from**.

### 5.6 Python from the first weeks

The backend comes late, so these small scripts give you Python practice early:

| Script | Milestone | What it does |
|---|---|---|
| `tools/range_table.py` | M2 | Prints gun range and flight time for each elevation |
| `tools/validate_data.py` | M3 | Checks all JSON data files with Pydantic |
| `tools/render_directions.py` | M2 (art spike) | Blender script: renders a 3D ship model in 32 directions |
| `tools/make_spritesheet.py` | M2, M8 | Packs PNG frames into a sprite sheet with Pillow |

### 5.7 Server API (release R6)

| Method | Path | Purpose |
|---|---|---|
| GET | /api/health | Server check |
| POST | /api/auth/register, /api/auth/login | Account and token |
| GET, PUT | /api/saves/{slot} | Load and store a save |
| POST | /api/scores | Submit a score |
| GET | /api/leaderboard | Top scores |

Tables: `users`, `saves`, `scores`.

### 5.8 TypeScript rules (gentle start)

TypeScript adds a type check on top of JavaScript. Vite compiles it without extra setup, so the daily workflow stays the same. These rules keep the learning cost small:

1. **Plain data types first.** Describe the world with `interface` and `type`, like Java or C# records. Example: `interface ShipState { x: number; y: number; heading: number; hull: number }`. No generics, no clever types until we need them.
2. **`strict` mode on from day one.** It is much harder to turn on later. We fix the first red lines together.
3. **Avoid `any`.** If a type is unclear, use `unknown` and ask.
4. **Data files get types.** Each JSON file has a matching `type`, so a typo in `ships.json` is caught early. `tools/validate_data.py` checks the same files from the Python side.
5. **Tests are TypeScript too** (Vitest runs them directly).
6. **Escape hatch.** If types cost more time than they save in one milestone, we loosen the rule for that file and write down why. We do not drop the whole language.

Expected cost: about 10% more time in M0–M2, mostly spent reading type errors. Later it saves time, because the compiler finds mistakes that would otherwise show up as odd behaviour in the game. This extra time is already inside the release dates; if R1 slips by more than a week we will reassess.

---

## 6. Roadmap

Based on 8–10 hours per week. Each release is a version you can play. Dates are targets, with about ±30% uncertainty.

### 6.1 Releases at a glance

| Release | Name | What you can do | Milestones | Effort | Target |
|---|---|---|---|---|---|
| **R1 · v0.1** | **First Duel** | Sail with the wind and sink one enemy ship | M0–M2 | 6 weeks | end of Dec 2026 |
| **R2 · v0.2** | Skirmish | Fight bots of different skill, use 3 ammunition types, board, capture and take ships | M3–M4 | 5 weeks | early Feb 2027 |
| **R3 · v0.3** | Campaign | Sail the map, trade in a market that reacts, grow the captain, save and continue | M5–M6 | 7 weeks | late Mar 2027 |
| **R4 · v0.4** | **Living Sea** | Provisions and fishing, contracts, treasure maps, sea events, outlaw rule | M7 | 3 weeks | mid Apr 2027 |
| **R5 · v0.5** | Web Alpha | 3D-look art, sound, touch controls, balance; installable on iPad | M8 | 4 weeks | mid May 2027 |
| **R6 · v0.6** | Online | Accounts, cloud saves, leaderboard | M9 | 3 weeks | end of May 2027 |
| **R7 · v0.7** | iOS | Native app on iPhone and iPad through TestFlight | M10 | 2 weeks | mid Jun 2027 |

**R1 is the fast first version you asked for.** It uses placeholder art and one bot. It answers the most important question early: is the sailing and shooting fun?

**The new ideas cost about 3 weeks.** They sit in their own release, R4, so R1–R3 keep their dates. The whole Stage 1 now takes about 30 weeks.

### 6.2 Milestones

#### M0 — Setup (1 week)
- [ ] Install VS Code, Git, Node.js LTS, Python 3.12+, uv.
- [ ] Create the GitHub repository `naval-battles` with the folders from 5.3.
- [ ] Create the Phaser project: `npm create @phaserjs/game@latest` (Vite, TypeScript option). If the template offers no TypeScript option, we add `typescript` to a plain Vite project by hand.
- [ ] Show a placeholder ship on blue water and move it with the keys.
- [ ] Open the game on the iPad over the local network.
- [ ] Check that `npm run build` and the type check both pass, and that Vitest runs one empty test.
- **You learn:** scenes, the game loop, sprites, Git basics, how TypeScript is checked.
- **Done when:** `npm run dev` shows a moving ship on the PC and on the iPad.

#### M1 — Sailing (2 weeks)
- [ ] Fixed-step loop and the first `sim/` files: world, wind, sailing.
- [ ] Rudder, sail level, polar table, inertia.
- [ ] Wind arrow, compass and speed in the HUD; camera follows the ship; zoom key.
- [ ] One island with collision.
- [ ] lil-gui panel with live sliders for wind and ship numbers.
- [ ] First tests: polar interpolation, speed formula.
- **You learn:** vectors, angles, sin and cos, delta time, unit tests.
- **Done when:** you can tack upwind, the ship stops in irons, and sailing feels good.

#### M2 — Guns and the first duel (3 weeks)
- [ ] Broadsides, reload timers, elevation control, landing marker.
- [ ] Ball physics with height; shadow and arc; splashes.
- [ ] Hit zones; hull damage; sinking.
- [ ] One simple bot: chase, turn its side, fire.
- [ ] Hull bars in the HUD; win and lose messages; restart.
- [ ] `tools/range_table.py` (your first Python script).
- [ ] **Art spike (2–3 hours):** render one Kenney Pirate Kit ship in 32 directions and show it in the game. Confirm or change the art style (D18).
- **You learn:** ballistics, collision tests, a first state machine.
- **Done when:** you can win and lose a duel against the bot. **→ Release R1 "First Duel".**

**Fun check after R1.** We play it, list what feels wrong and tune it before adding content. If the core is not fun, more features will not fix it.

#### M3 — Damage, ammunition and bots (3 weeks)
- [ ] Sail and crew damage; 3 ammunition types.
- [ ] Accuracy: salvo error, gun error, gun wear; landing marker as an ellipse.
- [ ] All 4 ship classes from JSON data; three rig polars; variants and skill tiers.
- [ ] Full bot state machine; merchant, patrol and pirate behaviours; land avoidance.
- [ ] Target panel; ammunition counters.
- [ ] `tools/validate_data.py`.
- **Done when:** a pirate and a navy bot fight each other with no help from you.

#### M4 — Boarding and capture (2 weeks)
- [ ] Surrender rule; boarding roll; battle report.
- [ ] Loot crates; plunder screen; take ship / prize / sink / release.
- [ ] Ship-loss rule.
- **Done when:** you start in a sloop and end the session in a captured brigantine. **→ Release R2 "Skirmish".**

#### M5 — World and ports (4 weeks)
- [ ] Caribbean map in Tiled; 6 ports; harbour zones; minimap.
- [ ] Port screen: market, shipyard, tavern, armory, admiralty or council.
- [ ] Game clock; port stocks, production and consumption; stock-based prices; cargo.
- [ ] Bot spawner; merchants that carry real goods on profitable routes; time acceleration and pause.
- [ ] Side choice on New Game.
- **Done when:** the full loop works: sail, fight, loot, sell, repair, recruit.

#### M6 — Captain, score and saves (3 weeks)
- [ ] Experience, levels, 3 skills connected to the formulas; captain screen.
- [ ] Score and statistics screen.
- [ ] Save, load, autosave, export and import; main menu with Continue.
- [ ] Difficulty setting.
- **Done when:** you close the browser, return the next day and continue. **→ Release R3 "Campaign".**

#### M7 — Living sea (3 weeks)
- [ ] Provisions: daily use, purchase in the tavern, effects at zero; fishing.
- [ ] Contract system; Bounty and Treasure map contracts; tavern rumours; contract list in the HUD.
- [ ] Sea events: wreckage, castaways, merchant under attack, derelict.
- [ ] Outlaw rule.
- **You learn:** data-driven design: new content as data, not as new code.
- **Done when:** in one session you take a bounty, follow a rumour, catch the ship, and fish on the way home. **→ Release R4 "Living Sea".**

#### M8 — Art, sound and polish (4 weeks)
- [ ] Final art replaces the placeholders: 4 ship sheets with 32 directions, tiles, island objects, effects (see the art guide).
- [ ] Water animation, wake, smoke, splinters; sounds and music.
- [ ] Final touch controls; settings menu.
- [ ] Balance pass; performance check on iPad and iPhone.
- [ ] Installable web app (add to the home screen).
- **Done when:** a friend can play for 30 minutes without your help. **→ Release R5 "Web Alpha".**

#### M9 — Python backend (3 weeks)
- [ ] FastAPI project; SQLite with SQLModel; register and login.
- [ ] Saves API and leaderboard API; pytest tests.
- [ ] Client connection; deployment with HTTPS.
- **Done when:** you log in on the PC and continue the same campaign on the iPad. **→ Release R6 "Online".**

#### M10 — iOS app (2 weeks)
- [ ] Capacitor project; Xcode build on the MacBook; app icon and splash screen.
- [ ] Test on the iPhone and iPad; TestFlight.
- **Done when:** the app is installed from TestFlight. **→ Release R7 "iOS".**

### 6.3 Rules that keep the project on track

1. Do not start a milestone until the previous one is playable.
2. A new idea goes to the parking lot (section 3).
3. Placeholder art until R4. Draw the final ships only after the fights are fun.
4. If a milestone takes twice its estimate, we cut scope instead of extending it.
5. Every new idea gets a small first version and a release. It never enters a milestone that has already started.

**What we cut first if time is short:** sea events, fishing, prize crews (keep "take ship" and "sink"), the neutral port, the mixed rig, the difficulty setting.

### 6.4 After Stage 1

- **Stage 2, suggested order:** Spain and France with full reputation → more contract types (person hunt, lost ship, ghost ship, hidden island) → merchant guilds that hire pirates → weather, seasons, day and night → crew morale, rum and fresh water → fleets and prize ships → buying ships → playable merchant → new maps.
- **A warning about the economy.** A full trading simulation with guilds and seasons is the most common place where solo projects stall. The Stage 1 stock model already gives purposeful trade. Guilds and seasons are added one at a time, and each must show a visible effect for the player before the next begins.
- **Stage 3, multiplayer:** the server must run the simulation. Option A: a small Node.js match server runs the same `sim/` code, and Python keeps accounts and saves. Option B: port `sim/` to Python. We decide after R7.

---

## 7. How we work together

- **One milestone at a time.** Each session starts from the milestone checklist.
- **Mix mode:** I write the larger pieces as complete, runnable files and explain each new concept first. You write small parts (data files, HUD elements, Python tools) and tune the numbers.
- **Small steps.** After each step you run the game and see a change.
- **Every formula in `sim/` gets a test.**
- **Commit to Git after every working step.**
- **Language:** we talk in English; I can translate any document into Russian on request.
- **Other AI tools:** give them `project-summary.md` as context.

---

## 8. Risks

| Risk | Level | What we do |
|---|---|---|
| Scope grows | High | Parking lot, cut list (6.3), one milestone at a time |
| Combat is not fun | Medium | Release R1 in 6 weeks, fun check, live tuning sliders |
| Aiming is hard to read | Medium | Landing marker, visible splashes, tactical zoom |
| Art takes too long | High | Placeholders until R4; one rotating sprite per ship |
| Scale feels wrong (ships too small or too slow) | Medium | Speed scale and zoom are single numbers; tested in M1 |
| Safari and touch problems | Medium | Test on the iPad from M0 |
| Motivation over 7 months | Medium | A playable release every 3–7 weeks |
| The living world grows without limit | High | Each idea has a small first version (3.3); the economy warning in 6.4 |
| The 3D look costs too much art time | Medium | Art spike in M2; rendering is automated by script; Kenney models as a base |
| Leaderboard cheating | Low | Accepted for a hobby game; solved with a server simulation in Stage 3 |

---

## 9. Open decisions

One decision is still open. It has a default that this plan already uses.

| # | Question | Default | Alternative |
|---|---|---|---|
| **O1** | When is the Python backend built? (D15) | **After the web alpha (M9).** The first playable versions come sooner, and Python practice starts through helper scripts | Right after the campaign works (before "Living Sea"). Cloud saves arrive earlier, but R4 and R5 move about 3 weeks later |

Closed on 12 Nov 2026: aiming (D16), client language TypeScript (D17), art style pixel look at 640 × 360 (D18), Living Sea as its own release (D19), Apple Developer Program at M10 (D21).

---

## Appendix A — Sailing terms

| Term | Meaning |
|---|---|
| Port / starboard | Left / right side of the ship, looking forward |
| Broadside | All guns of one side firing |
| Beam | The direction at a right angle to the hull |
| Heading | The direction the bow points |
| Tack | Turn the bow through the wind; sail a zigzag upwind |
| In irons | Stopped, with the bow pointing into the wind |
| No-go zone | The angles near the wind where a ship cannot sail |
| Rig | The sail arrangement: fore-and-aft, square or mixed |
| Strike the colours | Lower the flag: surrender |
| Prize | A captured ship |
| Round / chain / grape shot | Ball / two halves on a chain / a bag of small balls |

## Appendix B — Change history

### v0.4 (12 Nov 2026)

| Change | Section |
|---|---|
| Client language is **TypeScript** with gentle rules (D17); new section 5.8; M0 checks the type setup | 2, 5.4, 5.8, 6.2 |
| Art style confirmed: pixel look at 640 × 360 (D18) | 2 |
| "Living Sea" confirmed as its own release R4 (D19) | 2 |
| Apple Developer Program at M10 (D21) | 2 |
| Open decisions reduced to one (O1: backend order) | 9 |

### v0.3 (12 Nov 2026)

| Change | Section |
|---|---|
| Your new ideas staged into small first versions and later versions | 3.3 |
| New release R4 "Living Sea": provisions, fishing, contracts, sea events, outlaw rule | 4.16, 6 |
| Shooting keeps a share of luck: salvo error, gun error, gun wear, marker ellipse | 4.4 |
| Trade with a purpose: port stocks, merchants carrying real goods | 4.9 |
| Bot variety: skill tiers, armed merchantman, navy sloop-of-war | 4.10, 4.11 |
| Art path to a 3D look with pre-rendered sprites; art spike in M2 | 2 (D18), art guide |
| Aiming decision closed (D16); new open decisions O4 and O5 | 2, 9 |
| Stage 1 length: about 30 weeks (was 27) | 6.1 |

### v0.2 (12 Nov 2026)

**From your answers**

| Change | Section |
|---|---|
| Title is Naval-Battles | 1, 5.3 |
| Captured ships can become your ship | 4.7 |
| Ship-loss rule fixed: 50% of gold, restart in a sloop | 4.8 |
| A first playable release in 6 weeks; roadmap regrouped into 6 releases | 6 |
| Backend moved after the web alpha | 6 |
| Mix work style; hardware noted | 2, 7 |

**Adopted from the web draft "Sails & Powder"**

| Idea | Section |
|---|---|
| Time acceleration and pause | 4.1 |
| Trade wind as the default wind | 4.2 |
| Different polars per rig | 4.3 |
| Hull and rigging hit zones | 4.4 |
| Surrender at low crew; destroyed sails allow boarding but the crew fights | 4.7 |
| Bots use the same commands as the player; plain-data world state | 4.11, 5.2 |
| lil-gui tuning panel | 5.4 |
| Python helper scripts from the first weeks | 5.6 |
| Save export and import; installable web app before Capacitor | 4.13, 5.4 |
| Early "first duel" fun check | 6.2 |

**Not adopted from the web draft**

| Idea | Reason |
|---|---|
| Three.js and a tilted 3D camera | You confirmed Phaser 4 and top-down |
| Spain as the enemy, 1700–1725 | You confirmed England + pirates, 1650–1720 |
| Ship morale value, three boarding rounds, air drag | Simpler first; on the Stage 2 list |
| Treasure galleon | Arrives with Spain in Stage 2 |
| Automatic gun elevation | Closed in v0.3: manual elevation (D16) |

**Fixes found in the review**

| Problem in v0.1 | Fix |
|---|---|
| Gun range (500 m) was larger than the screen (320 m) | Range about 250 m; tactical zoom |
| The merchantman had 14 guns per side | 3 guns per side: a fair first target |
| Crossing the map took too long | Smaller map; time acceleration |
| One polar for all ships | Three rig types |
