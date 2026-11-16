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
1 px per game metre at zoom ×1 (ships ~2× real: sloop 30 m); zoom ×1/×2 with auto combat zoom; integer pixel scaling (logical height 400 computer/tablet, 240 phone). Text: pixel fonts at 8/16/24 px, resolution 1, `roundPixels`.

## Status (15 Nov 2026)
- M0, M1 done. **M2 done → R1 "First Duel"**: guns with ballistics and height, hit boxes, damage, sinking, accuracy (σ gun 1.8°, salvo 0.6°), bot (chase / engage / break-off, personality, tacks, avoids land), HUD panels, banner, sounds and effects, 4 ship classes.
- **Now: M2b "Open Sea"** (D37). Packages A and B done: 6 × 4 km sea with a reef border, 18 generated islands, chart (C / ESC) and minimap; ship collisions (damage by weight and speed), bots flee at 30% hull, repair at sea to 75% (sails ≤ 25%, no enemy within 500 m), three bots at random places. Next: **C** neutral port (repair 90%, no fighting nearby), fog.
- Later: M3 damage/ammo/bot tiers/class balance and ship variety; M4 boarding; M5 world, ports, trade; M6 captain and saves.
- Plan: `docs/naval-game-plan-v0.6-*.md`; log: `docs/dev-log-*.md`.

## Phaser 4 notes
- Check calls against `node_modules/phaser/types` (most examples are Phaser 3). No `Geom.Point`; `fillPoints` needs `Math.Vector2`.
- Keep text above sprites (a Text right after a Graphics broke the next sprite); draw static shapes once into textures.
- Hit flash: `setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)`.
- Touch: `addPointer`, CSS `touch-action: none`; iOS audio starts after the first tap.
- Automated key tests hold a key ~80 ms. Dev build exposes `window.naval` for headless tests.

## How to help
- Work on the current milestone only; say so if a request conflicts with a confirmed decision.
- Deliver larger changes as a zip unpacked into the repo root; the developer runs `npm test`, `npm run dev`, then commits.
- Test every change before delivery: Vitest, build, headless browser (computer and iPhone).
- Every instruction lists `mkdir -p` for new folders; remind to run `pwd` and `git rev-parse --show-toplevel` before `git add` with explicit paths.
- Update plan (EN+RU), dev log (EN+RU) and this summary after each step.
