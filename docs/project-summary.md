# Project Summary — "Naval-Battles" (working title)

Use this as project instructions or as context for any AI assistant. It reflects **plan v0.6 (13 Nov 2026)**, which is the single source of truth; if this summary disagrees with the plan, the plan wins. Full documents: `naval-game-plan-v0.6-en.md` (Russian: `-ru`), `art-and-tools-guide-v0.2.md` (scale and direction count under review) and `dev-log-en.md` (what was done, problems and fixes).

## About the developer
- Solo hobby developer. Native language: Russian (English is fine).
- Some experience with JavaScript, PHP, Java, C#. New to Phaser and game development. Learning Python.
- Wants step-by-step explanations: explain each new concept before the code; small runnable steps.
- Work style: the assistant writes the larger pieces and explains them; the developer writes small parts and tunes numbers.
- Time: 8–10 hours per week. Develops on Windows/Linux; MacBook Pro for iOS builds; tests on iPad and iPhone.
- Principle: **simple first, deeper later.** Every new idea gets a small first version and a release; it never enters a milestone that has already started.

## The game
Top-down naval game, **Caribbean 1650–1720**. Open-ended single-player campaign against bots, with saves. Side in Stage 1: **Pirate** (D29); the English captain arrives in Stage 2 with Spain. Score = net gold gained + ships sunk + ships captured (D30). Sailing must never be boring: contracts, sea events, provisions and a market that reacts fill the time between fights.

## Confirmed decisions (do not change without discussion)
- **Engine:** Phaser 4 (2D), **version 4.2.1 pinned exactly** (D32). Top-down world math. Phaser code only in `scenes/` and `render/`.
- **3D feel:** the simulation tracks height `z`; the ball is drawn above its shadow.
- **Art path:** Kenney placeholders; later a 3D look from pre-rendered sprites made from Kenney Pirate Kit models or own models, in a pixel look. **16 directions** for draft art; the M2 art spike (a full day) compares 16 and 32 (D33).
- **Client:** **TypeScript** (strict, gentle rules: plain interfaces first, no `any`, no clever generics), Vite, Vitest, lil-gui for live tuning. Maps in Tiled.
- **Backend:** Python 3.12–3.13 (via uv), FastAPI, SQLModel, SQLite; only accounts, cloud saves and leaderboard. Built after the web alpha (O1 default).
- **iOS:** installable web app first, then Capacitor. Apple Developer Program is bought at M10.
- **Living Sea** is its own release R4; **fun check 2 after R3 decides which parts are built** (D35).
- **Factions:** England + Pirates as factions; the player is a Pirate in Stage 1 (D29). Spain and France in Stage 2.
- **Score and saving (D30, confirmed 13 Nov):** score counts net gold gained (loot, prizes, bounties, trade profit); manual saves in port, autosave on entering port, suspend save at sea (deleted when loaded).
- **Aiming:** manual gun elevation with random factors; bots use the same rules.
- **Project setup (D22):** the client was created by hand (Vite `vanilla-ts` + `npm install phaser`).
- **Loop (D23):** fixed 30 Hz step with interpolation; commands wait in a queue and run at the start of the next step. Deterministic per browser engine only (Chrome and Safari may differ in the last digits), so saves store the full world state and tests use tolerances.
- **Touch (D24):** four temporary buttons now (rudder `<` `>`, sails `-` `+`); final touch controls with an assisted-aim option in M8.
- **Combat tuning (D28):** targets first (duel 2–4 min; 1–2 hits per 4-gun salvo at 150 m), then a Monte Carlo hit table (`tools/hit_table.py`), then damage per hit.
- **Economy guards (D31):** per-unit price impact, 10–15% buy/sell spread, off-map imports refill stock to at least 30% of target; a 1,000-day headless run (real TS `sim/` code, CSV plotted in Python) before R3.
- **Angles (D34):** one tested module `sim/angles.ts` (`headingRadToBearingDeg`, `bearingDegToHeadingRad`, `twaDeg`, `compassPoint`) converts sim heading (rad, 0 = east, clockwise), compass bearing (deg, 0 = north) and wind angle TWA (deg off the wind). Fields carry units: `ShipState.headingRad`, `Wind.fromRad`, `twaDeg`.
- **Fun checks (D35)** with written pass/fail criteria after R1 and R3. **Schedule (D36):** dates are likely estimates; hours logged per session; recompute after each release.

## Scale and display (D26, D27, confirmed 13 Nov by the M1 scale test, O3 closed)
- Game metres: ship sizes and speeds about 2× real (sloop 30 m, frigate 70 m); 1 px per game metre at zoom ×1.
- Whole zoom steps: ×1 sailing and long-range fights, ×2 close fights. **Auto combat zoom** within the close-fight range (120 m) picks the largest step that shows both ships (spare room before zooming in; smoothed 0.25 s). Combat camera shifts toward the nearest enemy (your ship stays in the middle 80%); edge markers for ships off screen.
- Integer pixel scaling (`Scale.NONE`): logical height about 400 px on computer and tablet, 240 px on phone; width follows the screen. Values in `data/view.json`.

## Architecture rules
1. All game rules live in `client/src/sim/`: pure TypeScript, **no Phaser imports**.
2. Fixed time step: 30 simulation steps per second.
3. The world state is plain JSON-serializable data.
4. The player and the bots change the world only through commands (`setRudder`, `setSails`, `fire`, `board`). Bots do not cheat.
5. All balance numbers and content (ships, goods, ports, contracts) live in JSON data files.
6. Units: game metres, seconds; x east, y south; sim angle 0 = east, clockwise. Wind direction = where it comes from.

## Key constants (copied from plan section 4.0)
| Constant | Value |
|---|---|
| Simulation step | 30 per second |
| World unit | game metre; ships about 2× real |
| Pixels per game metre at zoom ×1 | 1 |
| Zoom | ×1 sailing/long range, ×2 close combat, auto combat zoom; tactical icon view later |
| Logical screen height | about 400 px computer and tablet, 240 px phone |
| Tile / map | 32 × 32 px / about 6 × 4 km |
| Guns | muzzle 75 m/s, elevation 0–10°, g 9.81 → max range about 200 m, flight about 2.7 s; fire arc ±25° |
| Sighting range | 1,500 m |
| Sloop | 30 m, 11.5 m/s, turn 0.8 rad/s (developer's tuning), hull 220 |
| Time | acceleration ×1–×8 and pause; game day = 2 real minutes |

## Stage 1 rules (starting values)
- **Wind:** one global wind, default trade wind from the ENE, slow drift.
- **Sailing:** rudder + sail level 0–100%. `speed = maxSpeed × polar(TWA) × sailLevel × wind × sail condition × Navigation bonus`, exponential approach (time constant 5 s); turn rate has a 0.3 minimum share. Three polars: fore-and-aft (no-go below 40°), mixed (48°), square (55°). Code matches since M1 step 3 (sail condition and Navigation join later).
- **Guns:** broadsides only, ±25° arc, manual elevation 0–10°, landing marker shown as an ellipse. The ball keeps `inheritVelocity` (start 1.0) × ship velocity. Hit test along the segment of each step.
- **Accuracy:** salvo error (ship roll, whole broadside) plus gun error per ball; both depend on Battle skill, wind, crew shortage and gun wear. Seeded random numbers. σ is tuned after the scale test (bigger ships double the hit rate).
- **Hit zones:** hull (low, about 5 m on a sloop) and rigging (high).
- **Ammunition:** round shot (hull), chain shot (sails, 60% range), grape shot (crew, 30% range).
- **Ship state:** hull points, sail condition, crew, ammunition, gun wear, provisions, cargo, gold.
- **Capture:** crew ≤ 20% → the enemy surrenders. Sails ≤ 20% → boarding is possible but fought (one roll; within 15 m hull to hull, relative speed under 5 m/s). After capture: take the ship, send as prize (50% value), sink or release.
- **Captain:** levels 1–10; skills Navigation, Battle, Morale (0–10).
- **Ship loss:** restart at the nearest friendly port in a sloop; lose 50% of gold and all cargo.
- **Ports (6):** Port Royal, Bridgetown, St. John's (English); Nassau, Tortuga (pirate); Curaçao (neutral).
- **Trade:** stocks, production, consumption and imports; `price = base × target stock / current stock`, per unit, with a spread. Merchant bots carry real goods; **pirate bots keep the loot they take**.
- **Ships (game units):** sloop 30 m / 4 guns per side, brigantine 40 m / 6, merchantman 56 m / 3, frigate 70 m / 12. Variants: armed merchantman, navy sloop-of-war. Bot skill tiers: green, regular, veteran.
- **Bots:** merchant, navy patrol, pirate; state machines (travel/patrol → chase → engage → flee or board; avoid land); tacking with hysteresis and a cooldown; headless scenario tests.
- **Living sea (R4, scope set by fun check 2):** provisions, fishing, contracts (Bounty, Treasure map), tavern rumours, sea events, outlaw rule.

## Roadmap (Stage 1, likely about 44 weeks; range 38–55)
| Release | Content | Milestones | Likely target |
|---|---|---|---|
| R1 "First Duel" | Setup, sailing, scale test, guns, one bot, juice; art spike | M0–M2 | mid Jan 2027 |
| R2 "Skirmish" | Damage, ammunition, accuracy, bots, boarding, capture | M3–M4 | early Mar 2027 |
| R3 "Campaign" | World, ports, trade, captain, saves; then fun check 2 | M5–M6 | early May 2027 |
| R4 "Living Sea" | The parts that pass fun check 2 | M7 | early Jun 2027 |
| R5 "Web Alpha" | Final art, sound, touch, balance, iOS details | M8 | late Jul 2027 |
| R6 "Online" | Python backend; privacy check | M9 | late Aug 2027 |
| R7 "iOS" | Capacitor, TestFlight, App Store guideline check | M10 | mid Sep 2027 |

**Current status:** M0 done. **M1 done (14 Nov)**: sailing with wind, polars, compass, islands with collision (push-off tries back, forward, both sides), wind drift with seeded random. **M2 in progress; step 1 built, waiting for the developer's test:** `data/guns.json` (75 m/s, g 9.81, gun height 3 m, 0–10°, ripple 0.4 s, inheritVelocity 1), `ships.json` gunsPerSide/reloadSeconds (sloop 4 / 15 s), `sim/guns.ts` (gunPosition, launchBall, stepBall, predictLanding by the same steps, orderBroadside with pendingShots, stepGunsAndBalls), world `balls`, `pendingShots`, `nextBallId`, `events` (gunFired, splash), `Simulation.takeEvents()`; screen: balls above shadows, splashes, flashes, landing crosses; keys Q/E fire, R/F elevation; `tools/range_table.py` (10° → 212 m, 2.87 s). 117 tests in sandbox (118 with the developer's). M2 steps: 1 guns · 2 hit test, zones, damage, sinking · 3 accuracy + hit_table.py · 4 bot · 5 HUD bars, win/lose, restart, touch buttons · 6 juice · 7 art spike. Developer added a second island at x + 600 in `islands.json`.

## Stage 2 backlog
English captain with Spain as enemy nation; Spain and France with full reputation; more contract types (find a person, lost ship, ghost ship, hidden island); merchant guilds that hire pirates; weather, seasons, day and night; crew morale, rum and fresh water; fleets; buying ships; playable merchant; new maps. Stage 3: multiplayer, server-authoritative.

## Open decisions (defaults in use; O2, O3, O4 closed 13 Nov → D29, D26/D27, D30)
- **O1** backend order: after the web alpha (M9), default. Decide before M7.

## Phaser 4 notes (most tutorials and AI answers describe Phaser 3)
- 4.2.x ships its own types; check every call against `node_modules/phaser/types`.
- `Phaser.Geom.Point` does not exist; `Graphics.fillPoints` wants `Phaser.Math.Vector2`.
- With `pixelArt: true`, give text a `resolution` of 2–3 to keep it sharp.
- Endless water: `TileSprite` + `setScrollFactor(0)`, `setTileScale(zoom)`, `tilePosition = camera scroll / zoom`.
- Touch: `input.addPointer(2)`; `sys.game.device.input.touch`; CSS `touch-action: none`.
- iOS Safari: unlock audio on the first tap; no fullscreen API on iPhone; respect `env(safe-area-inset-*)`.
- Automated key tests must hold a key about 80 ms (`JustDown` misses shorter taps).
- A Text drawn right after a Graphics broke the next sprite in our headless test (4.2.1): keep text labels above sprites, not between a Graphics and sprites.
- Text after a Graphics glitch: draw static shapes (islands) once into a texture with `make.graphics` + `generateTexture` and show them as images.
- Integer pixel scaling: `Scale.NONE`, then `scale.setZoom(pixelScale / devicePixelRatio)` and `scale.resize(w, h)` on every window resize.

## How to help
- Work on the current milestone only. Give complete, runnable code with exact file paths and commands.
- Add a unit test for every formula in `sim/`. Write TypeScript with types for all data and state.
- Say so before proceeding if a request conflicts with a confirmed decision; do not build on proposed decisions before they are confirmed.
- Suggest small Python helper scripts where they fit.
- Reply in Russian when the developer writes in Russian; documents exist in EN and RU and both are updated together.
- Every instruction lists `mkdir -p` for new folders. Remind to run `pwd` and `git rev-parse --show-toplevel` before `git add`; work only in `naval-battles`, add explicit paths.
- Larger changes come as a zip unpacked into the repository root; the developer runs `npm test`, `npm run dev`, then commits. Test every change (Vitest, build, headless browser) before delivering.
- Ask the developer to log hours per session in the dev log (D36).
