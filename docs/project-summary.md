# Project Summary — "Naval-Battles" (working title)

Use this as project instructions or as context for any AI assistant. It reflects plan v0.4 (12 Nov 2026). Full documents: `naval-game-plan-v0.4-en.md` and `art-and-tools-guide-v0.1.md`.

## About the developer
- Solo hobby developer. Native language: Russian (English is fine).
- Some experience with JavaScript, PHP, Java, C#. New to Phaser and game development. Learning Python.
- Wants step-by-step explanations: explain each new concept before the code; small runnable steps.
- Work style: the assistant writes the larger pieces and explains them; the developer writes small parts and tunes numbers.
- Time: 8–10 hours per week. Develops on Windows/Linux; MacBook Pro for iOS builds; tests on iPad and iPhone.
- Principle: **simple first, deeper later.** Every new idea gets a small first version and a release; it never enters a milestone that has already started.

## The game
Top-down naval game, **Caribbean 1650–1720**. Open-ended single-player campaign against bots, with saves. The player chooses a side: **English captain (pirate hunter)** or **Pirate**. Score = total gold earned + ships sunk + ships captured. Sailing must never be boring: contracts, sea events, provisions and a market that reacts fill the time between fights.

## Confirmed decisions (do not change without discussion)
- **Engine:** Phaser 4 (2D). Top-down world math.
- **3D feel:** the simulation tracks height `z`; the ball is drawn above its shadow.
- **Art path:** Kenney Pirate Pack (2D, CC0) as placeholders; later a 3D look from pre-rendered sprites (32 directions per ship) made from Kenney Pirate Kit models or own models. Style: pixel look at 640×360 (revisit only if the art spike in M2 looks wrong).
- **Client:** **TypeScript** (strict mode, with gentle rules: plain interfaces first, no `any`, no clever generics), Vite, Vitest, lil-gui for live tuning. Maps in Tiled.
- **Backend:** Python 3.12+, FastAPI, SQLModel, SQLite; only accounts, cloud saves and leaderboard. Built after the web alpha.
- **iOS:** installable web app first, then Capacitor. Apple Developer Program is bought at M10.
- **Living Sea (provisions, contracts, sea events)** is its own release R4, after the campaign works.
- **Factions:** England + Pirates. Spain and France come in Stage 2.
- **Aiming:** manual gun elevation with random factors; bots use the same rules.

## Architecture rules
1. All game rules live in `client/src/sim/`: pure TypeScript, **no Phaser imports**.
2. Fixed time step: 30 simulation steps per second.
3. The world state is plain JSON-serializable data.
4. The player and the bots change the world only through commands (`setRudder`, `setSails`, `fire`, `board`). Bots do not cheat.
5. All balance numbers and content (ships, goods, ports, contracts) live in JSON data files.
6. Units: metres, seconds; x east, y south; angle 0 = east, clockwise. Wind direction = where it comes from.

## Stage 1 rules (starting values)
- **Scale:** 640×360 logical pixels; 1 m = 2 px; 32×32 px tiles; zoom-out key; map about 6×4 km; time acceleration ×1–×8 and pause.
- **Wind:** one global wind, default trade wind from the ENE, slow drift.
- **Sailing:** rudder + sail level 0–100%. `speed = maxSpeed × polar(angle to wind) × sailLevel × wind × sail condition × Navigation bonus`, with inertia. Three polars: fore-and-aft (no-go below 40°), mixed (48°), square (55°).
- **Guns:** broadsides only, ±25° arc, manual elevation 0–10°, landing marker shown as an ellipse. Muzzle speed 85 m/s, gravity 9.81, no drag; range about 250 m. The ball inherits ship velocity.
- **Accuracy:** a salvo error (ship roll, whole broadside) plus a gun error per ball; both depend on Battle skill, wind, crew shortage and gun wear. Seeded random numbers.
- **Hit zones:** hull (low) and rigging (high).
- **Ammunition:** round shot (hull), chain shot (sails, 60% range), grape shot (crew, 30% range).
- **Ship state:** hull points, sail condition, crew, ammunition, gun wear, provisions, cargo, gold.
- **Capture:** crew ≤ 20% → the enemy surrenders. Sails ≤ 20% → boarding is possible but fought (one roll). After capture: take the ship as your own, send as prize (50% value), sink or release.
- **Captain:** levels 1–10; skills Navigation, Battle, Morale (0–10).
- **Ship loss:** restart at the nearest friendly port in a sloop; lose 50% of gold and all cargo.
- **Ports (6):** Port Royal, Bridgetown, St. John's (English); Nassau, Tortuga (pirate); Curaçao (neutral). Market, shipyard, tavern, armory, admiralty or pirate council.
- **Trade:** each port has stocks, production and consumption; `price = base × target stock / current stock`. Merchant bots carry real goods on profitable routes; sinking them causes shortages.
- **Ships:** sloop (4 guns per side), brigantine (6), merchantman (3), frigate (12). Variants: armed merchantman, navy sloop-of-war. Bot skill tiers: green, regular, veteran.
- **Bots:** merchant, navy patrol, pirate; state machines (travel/patrol → chase → engage → flee or board; avoid land).
- **Living sea (R4):** provisions in days of food, fishing when stopped; contract system with Bounty and Treasure map; tavern rumours; sea events; outlaw rule for a pirate who attacks pirates.

## Roadmap (Stage 1, about 30 weeks)
| Release | Content | Milestones |
|---|---|---|
| R1 "First Duel" (6 weeks) | Setup, sailing, guns, one bot; art spike | M0–M2 |
| R2 "Skirmish" | Damage, ammunition, accuracy, bots, boarding, capture | M3–M4 |
| R3 "Campaign" | World, ports, trade, captain, saves | M5–M6 |
| R4 "Living Sea" | Provisions, fishing, contracts, sea events, outlaw rule | M7 |
| R5 "Web Alpha" | Final art, sound, touch, balance | M8 |
| R6 "Online" | Python backend | M9 |
| R7 "iOS" | Capacitor, TestFlight | M10 |

**Current status:** M0 (setup) in progress: creating the GitHub repository `naval-battles` and cloning it on the Windows PC and the MacBook. Phaser project not created yet.

## Stage 2 backlog
Spain and France with full reputation; more contract types (find a person, lost ship, ghost ship, hidden island); merchant guilds that hire pirates; weather, seasons, day and night; crew morale, rum and fresh water; fleets; buying ships; playable merchant; new maps. Stage 3: multiplayer.

## Open decisions (default in use)
- O1 backend order: Python backend after the web alpha (M9), default; alternative is right after the campaign (R3), which delays R4 and R5 by about 3 weeks.

## How to help
- Work on the current milestone only. Give complete, runnable code with exact file paths and commands.
- Add a unit test for every formula in `sim/`. Write TypeScript with types for all data and state.
- Say so before proceeding if a request conflicts with a confirmed decision.
- Suggest small Python helper scripts where they fit.
