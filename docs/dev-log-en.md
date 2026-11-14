# Naval-Battles — Development Log

Short record of what was done, what went wrong and how it was fixed. Newest entry first. Plan: `naval-game-plan-v0.6-en.md`.

---

## 13 Nov 2026 — External review of plan v0.5; plan v0.6

**Result:** the review (`Project_plan_v.0.5_Review`) was checked point by point. Its main finding was right: at 2 px/m the screen shows 320 × 180 m, but the guns reached 250 m, so in a broadside the enemy was off-screen. Plan v0.6 (EN + RU) answers every finding (Appendix B of the plan). No code changed today.

### What we checked with numbers

| Claim in the review | Our check | Verdict |
|---|---|---|
| Range at 10° with 85 m/s is about 250 m; dR/dθ ≈ 24 m per degree | 252 m; 24.2 m/deg | Correct |
| 10–25% of balls hit at long range | Simulation of the plan formulas (Battle 4, wind 0.5): 0.9 hits per 4-gun salvo at 150 m, 0.8 at 200 m (v0.5 ship sizes) | Correct |
| — (not in the review) | With ships 2× larger, the hit rate roughly doubles (2.0 per salvo at 150 m) | New finding: accuracy must be tuned **after** the scale decision |
| The canvas is scaled by non-whole factors | Phaser `Scale.FIT` on a phone gives factors like 1.37 | Correct, and the review did not mention it; covered by D27 |

### Decisions

- **Adopted:** combat targets and hit table (D28), economy guards (D31), Phaser 4.2.1 pinned (D32), 16 directions for draft art (D33), one angle module with unit names (D34), fun checks with criteria (D35), likely dates and hour logging (D36), corrected determinism wording (D23).
- **Waiting for your answer:** O2 Pirate only in Stage 1; O4 net-gold score and port saves with suspend at sea.
- **Answered by the next step:** O3 world scale and display, by the M1 scale test.
- **Where we did not follow the review:** the 1,000-day economy simulation runs the real TypeScript code (Python only plots the CSV), so the rules exist once; no second sprite size, because the zoomed-out view uses icons.

### New estimate

Stage 1 is likely about 44 weeks (range 38–55), R1 in mid January 2027. From now on, please add your hours to each entry (see the table below).

### Next

M1 step 2: the scale test (lil-gui, integer pixel scaling, ship data in game metres, a moored target with range rings, first combat camera and edge markers), checked on the computer, iPhone and iPad.

### Hours log

| Date | Hours | What |
|---|---|---|
| 12 Nov 2026 | (please fill in) | Planning, repository, M0, M1 steps 1–1c |
| 13 Nov 2026 | (please fill in) | Review, plan v0.6 |

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
