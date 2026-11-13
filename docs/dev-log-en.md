# Naval-Battles — Development Log

Short record of what was done, what went wrong and how it was fixed. Newest entry first. Plan: `naval-game-plan-v0.5-en.md`.

---

## 12 Nov 2026 — M0 done, M1 steps 1, 1b and 1c done

**Result:** the game runs on a desktop browser and on an iPhone. A sloop sails under the player's control; the simulation runs at a fixed 30 steps per second; 37 unit tests pass; `npm run build` passes. Everything is pushed to `alxz/naval-battles` (branch `main`).

### What was done

| Part | Result |
|---|---|
| Planning | Plans v0.1 → v0.4 (EN + RU), art guide v0.2 (EN + RU), project summary. All decisions D1–D21 confirmed |
| Repository | GitHub repo `naval-battles`, cloned on the Windows PC (folder `D:\projects\Phaser\NavalBattle\naval-battles`); starter files, `.gitignore` (includes `ext_resources/`), `.gitattributes` (LF) |
| M0 | Vite + TypeScript (strict) + Phaser 4.2.1 in `client/`; placeholder ship on blue water; Vitest with the first real function `normalizeAngle` (5 tests); checked on desktop Chrome and iPhone Safari |
| M1 step 1 | `sim/` module without Phaser: types, `world`, commands (`setRudder`, `setSails`), `stepShip` (inertia, rudder, movement), `Simulation` (fixed 30 Hz step, command queue, interpolation, protection after long pauses). Ship numbers in `data/ships.json`. `SeaScene` only reads input, sends commands and draws |
| M1 step 1b | Temporary touch buttons: `<` `>` rudder (held), `-` `+` sails (25% per tap), multi-touch, no page scroll or zoom |
| M1 step 1c | Zoom (keys Z / X: ×1, ×1.5, ×2, ×3; phones start at ×2), foam wake behind the ship, large HUD for phones (speed number, sail icon with four pips), crisp text on high-resolution screens |

### Tuned values (in `client/src/data/ships.json`, sloop)

| Number | Value | Note |
|---|---|---|
| `maxSpeed` | 8 m/s | about 16 knots; default kept |
| `acceleration` | 1 m/s² | default kept |
| `turnRate` | **0.8** rad/s | you changed it from 0.4 for quicker turning |
| `steerSpeed` | 2 m/s | at this speed the rudder works at full strength |

The wake is a little too visible on the phone: lower the `0.7` in `Wake.ts` (`setAlpha(0.7 * (1 - t))`) to about `0.45`.

### Problems and how they were solved

| # | Problem | Cause | Fix |
|---|---|---|---|
| 1 | `git push` failed: "Password authentication is not supported" | GitHub no longer accepts passwords | Log in with GitHub CLI or a fine-grained personal access token (one repository, Contents: read and write). Never paste a token in chat |
| 2 | `npm create @phaserjs/game` quit with "Canceled" | The installer quits when the recording question is answered "No" | Created the project by hand: `npm create vite@latest client -- --template vanilla-ts`, then `npm install phaser`. Decision D22 |
| 3 | TypeScript errors in Phaser 4 code | `Phaser.Geom.Point` does not exist in Phaser 4; `fillPoints` needs `Phaser.Math.Vector2` | Use `Phaser.Math.Vector2` (notes in plan section 5.9) |
| 4 | `ls src` showed no `sim` folder | My instructions assumed the folder existed | Create folders first: `mkdir -p src/sim`. From now on each step lists the `mkdir` line |
| 5 | `git add .` in the **parent** folder `NavalBattle` staged all folders, including `ext_resources` | `NavalBattle` had its own `.git` (an old `git init` with the same remote). Nothing was committed or pushed | `git rm -r --cached -f .` cleared the index; `.git` renamed to `.git-outer-unused` (delete it later). Real repo checked: `main` equals `origin/main` |
| 6 | No keyboard on the iPhone, so the ship could not be steered | Phones have no keys | Temporary touch buttons (D24); `touch-action: none` in CSS so Safari does not scroll or zoom |
| 7 | On the phone the ship, waves and text were tiny | The 640 × 360 picture is small on a phone; 10 px text is about 2 mm high | Our own scale (pixels per metre × zoom), larger HUD, text with higher resolution, foam wake to show motion (D25). Checked that the water moves at the ship's speed |
| 8 | TypeScript could not import `ships.json` | `resolveJsonModule` was off | Added `"resolveJsonModule": true` to `tsconfig.json` |
| 9 | A scripted key tap did not change the sails | A tap shorter than one frame is missed by `JustDown`; real key presses last longer | Test only; no code change. Automated tests hold a key for about 80 ms |
| 10 | The old project instructions still said "JavaScript" | The instructions panel is a separate copy | Paste the current `docs/project-summary.md` into the Project instructions after each plan change |

### Rules we adopted

- **Git:** run `pwd` and `git rev-parse --show-toplevel` before `git add`. Work only inside `naval-battles`. Add explicit paths (`git add client`), not `git add .`, unless `git status` has been checked.
- **Folders:** every instruction includes `mkdir -p` for new folders.
- **Delivery:** larger changes arrive as a zip that is unpacked into the repository root; the developer runs `npm test`, `npm run dev`, then commits.
- **Python:** for the backend use Python 3.13 through `uv`. Python 3.15 is too new for some libraries. Update `uv` with `winget upgrade astral-sh.uv`.
- **Tests:** every formula in `sim/` has a unit test.

### Next (M1, continued)

1. Step 2: wind in the world state, three polar tables (fore-and-aft, mixed, square) in JSON, speed formula, wind arrow, compass and heading in the HUD (text on desktop, icons on phone).
2. Step 3: one island with collision.
3. Step 4: lil-gui panel for live tuning.
4. Test on the iPad over the local network (not yet done).
