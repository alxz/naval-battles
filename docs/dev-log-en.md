# Naval-Battles — Development Log

Short record of what was done, what went wrong and how it was fixed. Newest entry first. Plan: `naval-game-plan-v0.6-en.md`.

---

## 14 Nov 2026 — Step 3 tested; fixes (step 3b)

**Your test of step 3:** turning into the wind slows the ship and stops it in the no-go zone; the sloop is fastest at 135° to the wind; the wind sliders move the compass and change the speed. The 5 s speed-up feel is not judged yet. **Your tuning:** fore-and-aft polar share at 180° changed from 0.65 to 0.8 (more speed with the wind from astern).

| Problem | Cause | Fix |
|---|---|---|
| The computer started at zoom ×2, too close | The target now starts 150 m to the west, along the wide screen side, so auto combat zoom found that both ships fit at ×2 | New **close-fight range** (120 m, lil-gui slider "close fight (m)"): ×2 only when the enemy is that close; stays ×2 up to 20 m farther (no flip-flop). 2 new tests |
| After changing the target class you could not steer | The drop-down list kept the keyboard focus, and lil-gui keeps those keys from the game | After any panel change, focus goes back to the game; a click or tap on the sea does the same (`releaseFocus`). Checked headless with and without the fix |

89 tests in the sandbox (90 with your angle test).

---

## 13 Nov 2026 (late evening) — Scale test closed (O3); M1 step 3 built

**Scale test result:** step 2b (auto combat zoom) works on the computer, iPad and iPhone; the iPad view is the most comfortable. O3 closed: D26 and D27 confirmed with logical height 400 (computer and tablet) and 240 (phone), ×1 for sailing, ×2 for close fights with auto combat zoom. Plan 4.0, 4.1 and the summary are updated.

### Step 3: wind and sailing (waiting for your test)

- **Wind** in the world state: `wind: { fromRad, strength }`; start: trade wind from the ENE (67.5°), strength 0.7 (`data/wind.json`). `setWind` command; lil-gui "Wind" folder.
- **Polar tables** in `data/polars.json` (fore-and-aft, mixed, square) and `sim/polar.ts` (no-go zone, straight lines between points).
- **Plan 4.3 formulas** in `sim/step.ts`: target speed = maxSpeed × polar(TWA) × sails × (0.4 + 0.6 × wind); speed approaches it exponentially (`speedTimeConstant`, sloop 5 s); a slow ship keeps 30% of its turn rate (`minSteerShare`), full steering from half of top speed. `acceleration` and `steerSpeed` were removed from `ships.json`.
- **Angle module** (D34): `headingRadToBearingDeg`, `bearingDegToHeadingRad`, `twaDeg`, `compassPoint`; `heading` renamed `headingRad` everywhere.
- **Compass**: red no-go wedge, blue wind arrow, white heading needle (red when in irons). HUD text on the computer: heading, wind, wind angle, sail power, "IN IRONS".
- Start course is now south (a beam reach), the target 150 m to starboard (west).
- 87 tests in the sandbox (88 with your angle test); build clean; headless check on computer and iPhone, no errors.

### Next

Your test of step 3. Then step 4: an island with collision and slow wind drift with a seeded random generator.

---

## 13 Nov 2026 (evening) — O2 and O4 confirmed; M1 step 2 (scale test) built

**Decisions:** O2 → **D29 confirmed**: the player is a Pirate in Stage 1; the English captain comes in Stage 2 with Spain. O4 → **D30 confirmed**: score = net gold gained + ships; manual saves in port, autosave on entering port, suspend at sea. Plan v0.6 (EN + RU) and the project summary are updated. No code depends on them before M5/M6.

### What was built (waiting for your device checks)

- **Integer pixel scaling** (`scenes/ScreenFit.ts`, `view/pixelLayout.ts`): every logical pixel is a whole number of device pixels; the logical height is about 360 px on a computer and tablet, about 240 px on a phone; the width follows the screen. Phaser runs in `Scale.NONE` mode; we set the canvas size and CSS zoom ourselves.
- **Ship data in game metres** (`data/ships.json`): all four classes with `length` and `beam`; sloop 30 m, 11.5 m/s, acceleration 1.5, turn 0.8, steerSpeed 3.
- **Moored target** (ship 2) on your starboard beam at 150 m; `placeShip` command (test setup only).
- **Range rings** 100/150/200 m and a light preview of the ±25° broadside arcs.
- **Combat camera** (`view/combatCamera.ts`): pulled toward the nearest ship within 400 m; your ship stays in the middle 80%.
- **Edge markers** (`view/edgeMarker.ts`): red triangle and distance for ships off the screen within 1,500 m.
- **lil-gui panel**: pixels per metre, zoom 1–4, logical height, combat camera, rings, speed scale, target class and distance.
- **Phaser pinned** to exactly 4.2.1; lil-gui 0.21.0.
- 62 tests in the sandbox (63 with your own angle test); build clean; headless check on a computer window and an iPhone 13 landscape emulation, no errors.

### Problem found and fixed

| Problem | Cause | Fix |
|---|---|---|
| In about 1 of 4 frames, the rotated player ship was drawn as half a triangle | In the headless test with Phaser 4.2.1, a Text drawn right after a Graphics broke the next sprite (only in the full scene; a small repro did not show it) | Ring labels moved above the ships (depth 3). Rule: don't put text directly between a Graphics and sprites; watch for it on real devices |

### Your test results (computer and iPhone)

| Check | Computer (Chrome) | iPhone |
|---|---|---|
| Both ships at 150 m visible at x1 | Yes | Yes (logical height 240) |
| Ship size at x1 | Small; wanted 2–3x bigger | Not too small, but details hard to see; wanted 1.5–2x |
| Target at 200 m, x1 | Still on screen | Only part of the hull; red marker shown |
| Logical height | 400 good; 240 too big and close | 240 good; 400 too small for combat, fine for overview |
| 1 px/m vs 2 px/m | 1 for sailing, 2 for combat | Same |
| Combat camera motion | No discomfort | No discomfort |
| Pixel sharpness | — | Fine |

**Conclusion:** 1 px/m is the base (zoom x1 for sailing); combat wants x2. At x2 a 200 m broadside does not fit, so we added step 2b.

### Step 2b: auto combat zoom

- `view/autoZoom.ts` (6 tests): when an enemy is within 400 m, the view takes the **largest whole zoom step that still shows both ships**; zooming in needs extra room (no flip-flop); the change is smoothed over about 0.25 s.
- `view.json`: computer logical height 400; `autoZoom`, `autoZoomMarginPx` 36, `autoZoomSpareInPx` 24, `zoomSmoothing` 0.25. Panel: "auto combat zoom" checkbox and "zoom now".
- Headless: computer (384 px high) x2 at 100 and 150 m, x1 at 200 m. iPhone (234 px high): x1 at 100 m abeam; x2 only below about 70 m abeam, or farther when the enemy lies along the long screen side.
- 68 tests in the sandbox (69 with your angle test).

### Next

Try step 2b on the computer, iPhone and iPad (the iPad is still untested). Then we fix the values in plan section 4.0 and close O3. Then M1 step 3 (wind and polars).

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
- **Confirmed by you the same evening:** O2 → D29, Pirate only in Stage 1; O4 → D30, net-gold score, saves in port and suspend at sea.
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
