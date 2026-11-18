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
- Linux server (Ubuntu): `bash scripts/setup-linux.sh` once, then `bash scripts/run-linux.sh dev | preview | test | update`.
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

## Status (16 Nov 2026)
- M0, M1 done. **M2 done → R1 "First Duel"**: guns with ballistics and height, hit boxes, damage, sinking, accuracy (σ gun 1.8°, salvo 0.6°), bot (chase / engage / break-off, personality, tacks, avoids land), HUD panels, banner, sounds and effects, 4 ship classes.
- **M2b "Open Sea" done** (D37): 6 × 4 km sea with a reef border, 18 generated islands + 2 hand-made (volcano, village), chart (C / ESC), minimap; ship collisions; bots flee at 30% hull; repair at sea to 75%; three bots; a neutral port on the village island (safe water 300 m, repair to 90%, bots use it); fog banks (picture only).
- **D38:** ships 1.75× faster, wind 0.8 (0.6–1.0). **D39:** bigger ships in the world with new sprites, at the start of M3.
- **Now: M3** — done: step 1/1b ships × 1.2 (D39), damage slows ships (< 50% hull), wind shifts every 2.5–5 min, second port in the Isla Verde inlet; step 2 auto-bot arena (Tuning → Auto-bot: 6 bots fight each other, log download); step 3 **port law (D40)**: firing in safe water costs 2% hull and makes an offender, a hit on a protected ship does half damage, 3 shore guns per port fire at offenders within 450 m, pardon after 45 s outside (`sim/law.ts`, `sim/shore.ts`, `data/shore.json`). Step 3b: no ship is ever put on land (`isOpenWater`, `nearestOpenWater`, `gridSpot`, `placeShip` check) arena log v2 (data fingerprints, sink details, aground / on-land watchdog, class table) and hull bars over ships (`view/shipBar.ts`, `scenes/ShipBars.ts`, switch "ship bars"). Next: sail and crew damage, 3 ammunition types, ship variety, class balance (arena log), bot tiers, headless bot scenarios, `tools/validate_data.py`.
- Later: M4 boarding; M5 world, ports, trade; M6 captain and saves.
- Plan: `docs/naval-game-plan-v0.6-*.md`; log: `docs/dev-log-*.md`.

## Phaser 4 notes
- Check calls against `node_modules/phaser/types` (most examples are Phaser 3). No `Geom.Point`; `fillPoints` needs `Math.Vector2`.
- Keep text above sprites (a Text right after a Graphics broke the next sprite); draw static shapes once into textures.
- Hit flash: `setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)`.
- Touch: `addPointer`, CSS `touch-action: none`; iOS audio starts after the first tap.
- Automated key tests hold a key ~80 ms. Dev build exposes `window.naval` for headless tests.

## How to help
- Work on the current milestone only; say so if a request conflicts with a confirmed decision.
- Zips never contain `client/src/data/islands.json` (the developer's copy differs); island pictures and the port's anchorage come from running `make_islands.py` (before `npm test`).
- Deliver larger changes as a zip unpacked into the repo root; the developer runs `npm test`, `npm run dev`, then commits.
- Test every change before delivery: Vitest, build, headless browser (computer and iPhone).
- Every instruction lists `mkdir -p` for new folders; remind to run `pwd` and `git rev-parse --show-toplevel` before `git add` with explicit paths.
- Update plan (EN+RU), dev log (EN+RU) and this summary after each step.
