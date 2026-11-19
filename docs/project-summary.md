# Naval-Battles — project instructions

## Developer and work style
- Solo hobby developer, Russian native (English fine), 8–10 h/week. Windows/Linux; MacBook for iOS; tests on PC, iPad, iPhone.
- Knows JS/PHP/Java/C#; new to Phaser and game dev; learning Python.
- The assistant writes the larger pieces and explains each new concept before the code; the developer writes small parts and tunes numbers.
- **Simple first, deeper later.** A new idea gets a small first version and never enters a milestone that has already started (D37 is how we handle new ideas).
- Reply in Russian when the developer writes Russian. Plan and dev log exist in EN and RU; update both together.

## The game
Top-down pixel-art naval game, Caribbean 1650–1720. Single-player sandbox against bots. Stage 1: the player is a **Pirate** (D29). Score = net gold gained + ships sunk/captured; manual saves in port, suspend at sea (D30).

## Tech (confirmed)
- Client: **Phaser 4.2.1 pinned** (D32), TypeScript strict (plain interfaces, no `any`, no enums), Vite, Vitest, lil-gui. Backend later: Python 3.13 via uv, FastAPI, SQLModel, SQLite (after the web alpha). iOS: web app, then Capacitor.
- Linux server (Ubuntu): `bash scripts/setup-linux.sh` once, then `bash scripts/run-linux.sh dev | preview | test | update | arena` (arena = headless bot arena, logs on port 4180). Test build for testers: `npm run build:test` → one HTML file in `client/dist-test/` (opens from disk, no tuning panel, version shown).
- Tools in Python (`uv run --with numpy --with pillow tools/...`): `render_ship.py` (ships, 32 directions, D33), `make_islands.py` (islands), `make_sounds.py` (sounds), `range_table.py`, `hit_table.py`.
- Art, sounds and fonts are made by code or are OFL fonts (Press Start 2P, Silkscreen). No downloaded art.

## Architecture rules
1. Game rules only in `client/src/sim/`: pure TS, no Phaser. Phaser only in `scenes/`; pure screen logic in `view/`.
2. Fixed 30 Hz step with interpolation; world state is plain JSON; seeded RNG in the world (never `Math.random` in `sim/`).
3. Player and bots change the world only by commands (`setRudder`, `setSails`, `setElevation`, `fire`, …). Bots do not cheat.
4. Numbers and content in JSON (`client/src/data/`).
5. Units: game metres, seconds; x east, y south; angle 0 = east, clockwise; wind = where it comes from; field names carry units (`headingRad`, `twaDeg`).
6. A unit test for every formula in `sim/`.

## Scale and display
1 px per game metre at zoom ×1 (ships ~2.4× real: sloop 36 m, D39 × 1.2); zoom 1 / 1.5 / 2 / 3 (keys, wheel), auto combat zoom up to × 1.5 (button to switch off), spyglass × 0.5; integer pixel scaling (logical height 400 computer/tablet, 240 phone). Text: pixel fonts at 8/16/24 px, resolution 1, `roundPixels`.

## Status (19 Nov 2026, plan v0.7)
- M0, M1 done. **M2 done → R1 "First Duel"**: guns with ballistics and height, hit boxes, damage, sinking, accuracy (σ gun 1.8°, salvo 0.6°), bot (chase / engage / break-off, personality, tacks, avoids land), HUD panels, banner, sounds and effects, 4 ship classes.
- **M2b "Open Sea" done** (D37): 6 × 4 km sea with a reef border, 18 generated islands + 2 hand-made (volcano, village), chart (C / ESC), minimap; ship collisions; bots flee at 30% hull; repair at sea to 75%; three bots; a neutral port on the village island (safe water 300 m, repair to 90%, bots use it); fog banks (picture only).
- **D38:** ships 1.75× faster, wind 0.8 (0.6–1.0). **D39:** bigger ships in the world with new sprites, at the start of M3.
- **Now: M3** — done: step 1/1b ships × 1.2 (D39), damage slows ships (< 50% hull), wind shifts every 2.5–5 min, second port in the Isla Verde inlet; step 2 auto-bot arena (Tuning → Auto-bot: 6 bots fight each other, log download); step 3 **port law (D40)**: firing in safe water costs 2% hull and makes an offender, a hit on a protected ship does half damage, 3 shore guns per port fire at offenders within 450 m, pardon after 45 s outside (`sim/law.ts`, `sim/shore.ts`, `data/shore.json`). Step 3b: no ship is ever put on land (`isOpenWater`, `nearestOpenWater`, `gridSpot`, `placeShip` check) arena log v2 (data fingerprints, sink details, aground / on-land watchdog, class table) and hull bars over ships (`view/shipBar.ts`, `scenes/ShipBars.ts`, switch "ship bars"). Step 4: sails and crew take damage, 3 ammunition types (round / chain / grape, `data/ammo.json`, keys 1 2 3, touch button above L; `sim/ammo.ts`, `sim/condition.ts`). Step 4b (after the test): a sunk ship takes no orders; damage slows more (crew: speed × 0.7–1, turning × 0.4–1; round shot tears sails ×2; hull to 45%); icons on the bars; ball colours; touch minimap 2.4 buttons wide with a view box; log fixes (state before sinking, grape counted per ball). Step 4c: arena view back to the best bot after a sinking, arena results (top 3), target card top right, ammo icons, tall PC windows, "turn your device" on upright touch screens; bots chase runners and work free when stuck. Step 5: a finishing attack in a port's safe water (calculation + roll, then it leaves as an offender), berths per port (bots wait off a full port). Step 6a: collisions v2 (D44: place, own speed, squared closing speed, 30% cap, 2 s pause per pair), bot seamanship part 2 (D45: cut-off pursuit, square rigs wear, keep clear alongside, turn away after a contact, deliberate ram with a roll), headless arena (D46: `npm run headless-arena`, logs on port 4180, `run-linux.sh arena`). Step 6b: camera circle (D43), arena sails/crew bars and random flags (D47), help below the table, results SAVE LOG, Spanish port flag, bigger shore guns. Step 6c (test of 6a): bots plan ways round land (`sim/path.ts`, 10 m water grid, A*), harbour boats tow at ≥ 1.5 m/s (D49), the Isla Verde harbour only for sloop / brigantine; lead aiming, closing in, rammers (chain → grape → ram, D50); red WANTED labels; 3–5 bots in a battle (D51). Step 6d: wrecks always run for a usable port (land-aware flight), no wearing on a lee shore, bots keep out of harbours they do not use, 4 m/s in harbours, no turning onto a bank; `npm run build:test`. Step 6e (speed): distance-to-land grid, reused A* buffers, aiming table, texts redrawn only on change, static rings and flags drawn once; headless arena 2.8× faster; help (H) shows fps / frame / sim times. Next: ship variety, class balance (merchantman first), bot tiers. Proposed: **M3b "Caribbean Sea"** (D48, a new map from the developer's mockup) after M3.
- Later: M4 boarding (surrender gets likelier after 60% crew lost); **M4b "Eyes at Sea": perception (D41)**: ships and bots act only on what they see (detail by distance 200 / 450 m, flags to 400 m); M5 world, ports, trade, day and night (**D42: a 12-minute game day**); M6 captain and saves.
- Plan: `docs/naval-game-plan-v0.7-*.md`; log: `docs/dev-log-*.md`; ideas for the world (not scheduled, D37): `docs/world-ideas-*.md`.

## Phaser 4 notes
- Check calls against `node_modules/phaser/types` (most examples are Phaser 3). No `Geom.Point`; `fillPoints` needs `Math.Vector2`.
- Keep text above sprites (a Text right after a Graphics broke the next sprite); draw static shapes once into textures.
- Hit flash: `setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)`.
- Touch: `addPointer`, CSS `touch-action: none`; iOS audio starts after the first tap.
- Automated key tests hold a key ~80 ms. Dev build exposes `window.naval` for headless tests.
- Speed: `setColor` / `setStyle` redraw a Text and re-upload its texture even with the same value: use `paint()` (scenes/text.ts). A Graphics is re-triangulated every frame: draw static shapes once (texture, or draw once and move with setPosition / setRotation). Never read `offsetWidth` and similar layout values every frame.

## How to help
- Work on the current milestone only; say so if a request conflicts with a confirmed decision.
- Zips never contain `client/src/data/islands.json` (the developer's copy differs); island pictures and the port's anchorage come from running `make_islands.py` (before `npm test`).
- Deliver larger changes as a zip unpacked into the repo root; the developer runs `npm test`, `npm run dev`, then commits.
- Test every change before delivery: Vitest, build, headless browser (computer and iPhone).
- Every instruction lists `mkdir -p` for new folders; remind to run `pwd` and `git rev-parse --show-toplevel` before `git add` with explicit paths.
- Update plan (EN+RU), dev log (EN+RU) and this summary after each step.
