# Naval-Battles — Development Log

Short record of what was done, what went wrong and how it was fixed. Newest entry first. Plan: `naval-game-plan-v0.6-en.md`.

---

## 17 Nov 2026 (night) — Your answers on the world ideas: D41, D42, item 10

- **O5 closed → D42:** a game day lasts **12 real minutes** (1 game hour = 30 s at ×1); morning 05:00–07:30, day to 18:00, evening to 20:30, night to 05:00. Plan 4.0 and 4.1 updated; provisions (30 days = 6 hours now) are re-tuned in M5.
- **D41:** perception is its own milestone **M4b "Eyes at Sea"** right after M4; checklist in the plan, detailed design in `world-ideas-en.md` section 9 (contacts with three levels, sight ranges, islands and fog block sight, memory and a `search` mode for bots, the screen shows only what your ship knows, arena switch "what the bot sees", tests).
- **Item 10:** a crew that has lost more than 60% surrenders more easily: added to plan 4.7 and the M4 checklist (M4 has not started, so it may go in); proposed curve in section 8. A hireling who finds no loot breaks the contract and demands a fine; pay or fight, the winner takes the loser's ship: section 5.1, with hiring in R4.
- New in `world-ideas`: section 10, the day-and-night plan for M5 with numbers (clock, light factors for sight, gunnery, repair, market and dock hours, picture).

No code changed. M3 continues: sail and crew damage, 3 ammunition types.

---

## 17 Nov 2026 (late) — Updating the Linux server; ideas for the world

### How to update the Linux server (Brainbox) after new code

`scripts/setup-linux.sh` is the **one-time installer** (system packages, Node, uv, firewall). Do not run it for an update; it is only for a fresh server or if Node or uv was removed (safe to re-run, but slow).

A normal update, from the repository root:

```bash
cd ~/naval-battles                       # the repository folder
git status                               # no local changes? (else: git stash, or commit)
bash scripts/run-linux.sh update         # git pull, npm ci, make_islands.py, npm test
bash scripts/run-linux.sh preview        # build and serve on port 4173 (or: dev, port 5173)
```

- `update` runs `git pull` itself (harmless if you already pulled), reinstalls the game's packages exactly from `package-lock.json` (`npm ci`, quick), regenerates the island pictures and ports (`make_islands.py`) and runs the tests.
- If the game is running (for example in `tmux attach -t naval`), stop it with Ctrl+C first and start it again after the update.
- After `make_islands.py`, check `git status` before committing from the server: `islands.json` is generated and differs between machines.
- In the browser, hard-refresh after a rebuild (Ctrl+Shift+R; on iOS close and reopen the tab).

### Ideas for the world

Your list of 17 Nov (day and night, repair and trade by the clock, night theft, night gunnery, sight / silhouette / flag, weather, hidden reefs and currents, cities that trade and grow rich, caravans, hiring pirate bots, learning from strategy games) is written up with my conclusions in the new document **`world-ideas-en.md`** (and `world-ideas-ru.md`). Main points: one foundation, **perception** (bots see only their contacts), comes first, as its own step after M4; no time zones; the plan's 2-minute game day is too short for night (16 minutes recommended, open decision O5); most parts fit M5 (which brings the clock, ports and market anyway), theft, caravans and hirelings fit R4, storms and false flags Stage 2. Nothing enters M3 (D37). Item 10 of your list was empty.

---

## 17 Nov 2026 — M3 step 3b: no ship on land at the start, and arena log v2

### What you asked

Check that a bot can never appear on an island, and think what else the log should collect.

### What I found (the spawn check)

- The normal ways are safe: `openWaterSpot` (duels, arena respawns) asks `isOpenWater` (60 m of free water, away from the reef). 400 arenas × 6 bots (2400 ships): 0 on land.
- **Three holes**, all in rarely used paths: (1) the arena start had a fixed fallback place (`-2000 + 700·i, 0`) if 40 random tries failed: on my islands 3 of those 24 places (x = 2200, 2900) are land, on yours it can differ; (2) the command `placeShip` had no check, so the test buttons "target abeam / upwind" put the target on land in 15 of 360 trial places; (3) there was no watchdog: nothing would tell us if a ship ever stood on land.

### What changed

- `sim/spawn.ts`: `isOpenWater` (the one question every spawn asks), `nearestOpenWater` (rings of 16 points every 40 m, no random numbers), `gridSpot` (the last resort: the whole sea in a 250 m grid from a seeded start).
- Arena: random tries, then the grid; if there is no room at all the bot is left out (the log header lists who came). **No fixed places any more.**
- `placeShip`: a place on land becomes the nearest open water within 800 m; if there is none the command is ignored.
- `sim/land.ts`: `distanceToLand` (for the log only); `sim/geometry.ts`: `distanceToSegment`.

### Arena log v2 (`view/arenaLog.ts`)

- Header: build label, **fingerprints of the data** (islands, ships, guns, damage, bots, shore, arena, wind, world: if yours differ from mine the hash differs), sea and wind, ports, seed.
- Every bot line and respawn: position, distance to the nearest land (and its name) and port; WARNING if a respawn is closer than 60 m to land.
- Every SUNK line gets a detail line: place, how the loser was sailing (mode, speed, sails, wind angle, aground, offender) and the killer (mode, distance, hull, speed).
- Watchdog, once a game second: **ON LAND** (not aground), aground start / floats free / **STUCK > 20 s**.
- Wind line at the start and at every turn of 15° (or 0.1 strength); flee / port / outlaw lines carry hull % and place.
- Summary table by class (wins, losses, mean life, balls, hits/ball, shore deaths, aground, stuck) and collisions; warning count.
- First findings in a 20-minute run: the merchantman and the frigate ran aground 11–13 times each near Isla Verde's port (the inlet), 126 collisions in 20 minutes (ramming), 0 warnings on land.

### Hull bars over the ships (your request, a small view-only step)

- `view/shipBar.ts` (where the bar goes, how wide, how full; 4 tests) and `scenes/ShipBars.ts` (one Graphics, redrawn every frame, above the ships, below the HUD). Picture only: nothing in `sim/` changed.
- A 3 px bar over every floating ship, centred, placed above the masts or the bow / stern for the current heading, 16–48 px wide by ship size and zoom, on whole pixels. Colours as in the HUD (green above 50%, yellow above 25%, red below; at least 1 px while afloat). Hidden for a sunk ship and, in a duel, for your own ship (it has its panel); in the arena every ship has one.
- Tuning → View → "ship bars" switches them off. Checked in the headless browser (computer; the arena shows the bar under the name label); the phone layout was not checked by eye.

Tests: 292 (273 + 15 + 4). Not verified: your own `islands.json` (the log header and the WARNING lines will show it).

## 16 Nov 2026 (night, 3) — M3 step 3: port law (D40) and the shore guns

### Before the code

New chat, code taken from GitHub (`2fc0db4`): 242 tests (241 + your angle test), build clean. Your arena log (79 game minutes) read: 42 wins; 37 of the 42 sunk ships had turned for a port less than 2 minutes before; frigate 19 wins, merchantman 1 win / 9 losses; ramming in chains. The "broadsides" column really counted balls. Your answers: a shot from outside at a ship in port = half damage and the shooter is an offender; pardon after a wait beyond 450 m (45 s chosen); the log label and the mode reset go into this step.

### Two new ideas in the code

- **The offender flag** (`ShipState.offender = { port, forgiveLeft }`): a ship that broke a port's peace. It is plain data on the ship, so saves and tests repeat exactly.
- **A gun owner that is not a ship** (`sim/shore.ts`): a port's battery has its own timers in the world (`world.shore`); its balls go into the same `world.balls` list with an owner id below 0 (port 0 = −1), so flight, hits, splashes and pictures need no second copy.

### The rules (`sim/law.ts`)

- Fire rule: a broadside fired in safe water costs the shooter 2% of its full hull (never the last point) and makes it an offender. It is free when an offender of that port is within 450 m (you are helping the port).
- Hit rule: a ball on a law-abiding ship in safe water does half damage and makes the shooter an offender, wherever he fired from. Ramming still does nothing to a law-abiding ship there.
- An offender: full damage in port, no repair (port or sea), a legal target for everybody, fired at by the shore guns within 450 m of the anchorage. Pardon after 45 s beyond 450 m; coming back starts the clock again.
- Shore guns (`data/shore.json`): 3 per port, 105 m/s, −8…18°, reach about 660 m (every place inside the 450 m ring of both ports; a test checks it), reload 10 s, one gun about every 3.3 s, damage 40, spread 1.0° with the same sigma formula as ships, plus the gunners' misjudgement (0.6°). They lead a moving ship. Their balls hurt offenders only.
- Bots: no fire from safe water or at a protected ship; no fire when the balls would come down in safe water (an enemy just slipping into port); an offender is attacked even in port; an offender bot sails straight out (mode `outlaw`) until pardoned.

### Also

- Arena log: "balls" and "hits/ball"; lines "PORT LAW: … an offender …", "… is pardoned …", "sunk by the shore guns of …" (nobody's win).
- Mode reset: `chooseTargets` set every bot with a new target to `chase`. A bot in `port` or `repair` with 30–90% hull then left its repair and went back to fight. Now such a bot only notes the new enemy. Three headless hours: 13–20 wins an hour before and after, so the pace did not drop.
- `maxBallSeconds` 6 → 8: a shore ball at 18° flies 6.7 s.
- `make_islands.py`: three gun platforms per port, drawn without random numbers (island shapes unchanged; checked).

### Measured

Sloop, 8 seeds: lying in port after one broadside = sunk in 43–101 s (7 hits); sailing straight out under full sail = 8 shots, 0–4 hits, pardon 70 s after the broadside. Frigate: sunk in about 1.5–2 min if it stays (18 hits); 2–5 hits if it leaves.

273 tests (31 new: `law.test.ts`, `shore.test.ts`); build clean; headless computer and iPhone 13 landscape: broadside in port → "OFFENDER!", shore guns fire and hit, sailing out → "PARDON 44s" → pardoned; no errors (only the old missing favicon).

**Not checked:** your own `islands.json` (the gun places are computed from your village island; if a place falls in the water the tool moves it inland or leaves it out and says so). An offender bot inside the inlet harbour steers "away from the port", not along the inlet; bots become offenders only by a stray ball, so this waits.

**Next:** sail and crew damage, 3 ammunition types.

---

## 16 Nov 2026 (evening, 2) — M3 step 1b (fixes) and step 2: the auto-bot arena

### Your test of step 1

Ships × 1.5: the frigate is too big; stop at × 1.2 for now. The inlet: hard to get out against the wind, big ships and bots got stuck (screenshot); idea: a port at its end. The solid port works, but a ship can wedge itself between the piers (screenshot). Hull points × 1.5: fine. The combat zoom is now too close: smaller, a button to cancel it on every screen, the spyglass on the computer too, the mouse wheel for zoom and spyglass. New: a damaged ship (< 50%) sails slower, the wind should change now and then, and an auto-bot test mode. Your choices: auto-bot = M3 step 2 (port law → step 3), 6 bots with respawn, time x1–x8, a second port at the end of the inlet.

### Step 1b

- Ships × 1.2 (sprites re-rendered), hull points × 1.2.
- Zoom: combat zoom at most × 1.5 (detail sprites from × 1.5); auto-zoom button (magnifier with "A", crossed when off) on computer and touch; spyglass icon on the computer; wheel = zoom steps 1 / 1.5 / 2 / 3 and auto zoom off; wheel click = spyglass.
- Port: an invisible wall ("berths") over the water between the outer piers.
- Inlet: 150 m wide, bend 40 m, ends in a round harbour (r 85 m) with a quay, houses and the flag; that harbour is the second neutral port. Bots sailing to it follow the inlet's middle line (`portWaypoint`); a test sends a badly hurt bot from outside into the harbour.
- Damage slows: below 50% hull the target speed falls in a line to 60% at hull 0; up to 3 m/s never cut.
- Wind shifts: every 150–300 s the base direction turns 30–90° to a random side; the wind follows at most 6° per drift.

### Step 2: the auto-bot arena

- `sim/arena.ts` (rules) and `view/arenaLog.ts` (the log); screen: `scenes/ArenaHud.ts` and the arena part of `SeaScene`.
- A first 30-minute headless run: 3 wins only. The bots flee at 30% hull and repair in port, so few fights end in a sinking; the frigate won all three. 500 wins will take many hours even at x8 — the log will show where the bots lose their time (chases, ports).

241 tests; build clean; headless computer and iPhone: arena runs at x8, NEXT / drag / log download work, no errors.

**Next:** step 3 — port law (D40).

---

## 16 Nov 2026 (night) — Package C4 and M3 step 1: ships × 1.5

### Your test of C3

Spyglass: good. Wishes: the port's piers and boats must be solid; the inlet looked like a pipe. Go on to M3.

### C4

- Solid port: `make_islands.py` writes the quay, three piers and five boats as polygons (`solids`); `data.ts` turns them into islands of kind `structure` (no picture, not on the chart). `touchesLand` now also checks land corners inside the hull's rectangle and land edges crossing it, so a thin pier between the bow and the middle point counts.
- Winding inlet: S-shaped, swinging 70 m, ragged banks, faces a little south of the middle of the sea; the tool checks that the shore does not cross itself. Tests: a 1.5 × sloop fits along the whole middle line; a ship lying across a pier touches it.

### M3 step 1 (D39)

- `ships.json`: length, beam, hull height, mast height × 1.5; hull points × 1.5 (the bigger target is hit more often; `hit_table.py`: 3.6 / 2.2 / 1.8 / 1.4 hull hits per salvo at 50 / 100 / 150 / 200 m, salvos to sink at 150 m ≈ 7 as before).
- `render_ship.py`: `SIZE = 1.5`, bigger frames; all sheets re-rendered (4 min).
- Bot: when steering clear of an enemy it keeps 40 m from its hull (with 130 m it shied away from its own fighting range).
- HUD: panels fade 26 px round a ship (was 18).

225 tests; build clean; headless computer and iPhone without errors.

**Next:** M3 step 2 — port law (D40).

---

## 16 Nov 2026 (evening) — Your test of C2; package C3: port, inlet, spyglass, Linux server

### Your test

Phone layout, getting off the reef and the fog: fine. Wishes: a bigger port along the shore, an invented flag, 4–5 bigger boats; a river a ship can enter; the touch zoom button seemed to do nothing. Decisions: ships × 1.5 (D39) and the port law (D40) both in M3. Question: running the game on an Ubuntu server.

### Done (C3)

- Port picture: 100 m quay along the shore, three piers, five boats (two sloops, a ketch, two rowing boats), four warehouses, 16 houses, an invented flag. Anchorage now 70 m off the main pier.
- Inlet on Isla Verde: `carve_inlet()` in `make_islands.py` cuts a 110 m wide, 300 m deep channel toward the middle of the sea, with a wide river at its head. A test checks that a sloop, and one 1.5 × bigger, fits all along it.
- Spyglass: the zoom button did change the zoom, but in a fight the automatic combat zoom overrode it. Now it is a spyglass: tap (touch) or V (keyboard) → view x0.5 for 12 s with a dark round ring, the button frame lit; again to put it away. Z / X still zoom on a computer.
- Linux: `scripts/setup-linux.sh` (git, curl, Node 22+ from Ubuntu or NodeSource 24, uv, `npm ci`, islands, tests, build, ufw ports 5173 / 4173) and `scripts/run-linux.sh dev | preview | test | update`.

223 tests (1 new: the inlet); build clean; headless computer and iPhone without errors; `run-linux.sh test` and `preview` checked here (Ubuntu itself not tested).

**Next:** M3 step 1 — ships × 1.5.

---

## 16 Nov 2026 (later) — Your test of package C; package C2

### Your test

Port, safe water, repair and bots waiting outside: all work. Wishes: big islands on the chart from the start; more and longer fog; wider shoals; more rivers to find; L R back where they were; zoom and sound to the top middle; a shorter, lighter target card; a port that looks like a port; ships get stuck on the reef and islands. Wake accepted; the volcano waits for a later stage. New idea: port law with shore guns.

### Done (C2)

- Touch: L R above the rudder again, gun buttons at the right edge again; zoom and sound in the middle of the top edge; target card 112 × 22 in the narrow font, plate at 12%. Distance labels at the edge are not written over buttons.
- Chart: big islands and the port island known from the start (`newChart(ISLANDS)`).
- Fog: 5 bands of 16 puffs, 0.9–1.6 km long, lying along the wind.
- `make_islands.py`: shoal 56 m; rivers 3 per big island, 1 per medium (2–3 px wide), river mouths printed; port: bigger village, two plank piers with posts, a sloop and a rowing boat, a warehouse, a flag; anchorage 70 m off the main pier. Each island picture has its own random numbers (shapes are stable from now on; this time the generated islands moved once).
- Grounding: an aground ship turns at the full turn rate (the crew warps it round), the push-off tries 0.15, 0.45 and 0.9 m.
- Port law with shore guns: recorded as D40 (proposed) in the plan.

222 tests in the sandbox (2 new: aground turning, getting off the reef); build clean; headless computer and iPhone without errors.

---

## 16 Nov 2026 (afternoon) — Fixes after your test of B2; package C: port, fog, shoal water. M2b complete

### Your test of B2

"pixels / metre" 1.5 is too tight; bigger ships in the world are the better way (D39, M3). Speed: 1.5–2.0 felt right; wind 0.8 with slow changes (D38). Phone: better; wishes for the minimap, the target card, a smaller ship panel, L and R at the screen edges. The wake was too heavy at the bow; the volcano looked flat.

### Fixes

- **D38**: `maxSpeed` × 1.75 in `ships.json`; wind starts at 0.8 and drifts between 0.6 and 1.0 (`wind.json`); bots fight at 7.5 m/s and keep 130 m clear of other ships.
- **Touch layout**: L above "<" at the left edge, R above "+" at the right edge, gun up / down in the column beside R, angle and range above R; minimap at the right edge under the gear; target card under my ship, lighter; phone: ship panel 112 × 44 with a small compass and the speed in the 8 px font.
- **Wake**: small foam specks behind the stern (each a little different), bow waves faint and short.
- **Volcano**: `make_islands.py` draws a mountain over the whole island as seen a little from the south (heights lifted up the picture, nearer slopes cover farther ones), gullies, wooded foot, crater with lava and smoke.

### Package C

- **Port** (`sim/port.ts`): the village island. Safe water 300 m round the anchorage: no ship inside can fire, none takes damage. A ship lying still (≤ 2 m/s) within 90 m of the anchorage is repaired to 90% at 2% per second. Bots: under 30% hull and a port within 2500 m → mode `port` (sail there, stop, leave at 90%); an enemy in safe water is not attacked, the bot waits outside (`idle`).
- At sea: a dotted green ring round the safe water, a buoy at the anchorage; the port on the chart and the minimap; HUD "SAFE WATER", a second tick (90%) on the hull bar.
- **Fog** (`scenes/Fog.ts`): six banks drift down the wind. Picture only; "fog" check box.
- **Shoal water**: every island picture now has paler water with wave crests round it and muddy water at river mouths.

### Checks

220 tests (221 with your angle test): 9 new for the port, among them a bot that sails in, is repaired and comes out. Build clean; headless on computer, iPad, iPhone without errors.

**Not checked:** your own `islands.json` (the port's anchorage is computed from your second island; in my copy it lies in open water).

**Next:** M3 — starts with D39 (bigger ships, new sprites) and class balance.

---

## 16 Nov 2026 — Your test of package B; package B2: lighter phone HUD, minimap, wake, island pictures

### Your test results

All of package B works on computer, iPad and iPhone; a battle with three bots is more fun than a duel. Fonts on the real iPhone are right. Wishes: a see-through minimap, smaller on a computer and bottom right on the phone; slower repair; bots closer at the start; too many things on the iPhone screen; the two old islands are bare; ships look small on a computer; a stronger wake; a faster game; a sea shaped like the Caribbean; a port; different water near the shore.

### Done in B2

- **Touch HUD**: the guns panel is gone. The L / R fire buttons are yellow when loaded and count the seconds while reloading; the gun angle and range are two short lines next to the gun buttons. The target card shows only when the enemy is within 400 m. No distance labels on the rings. Plates are lighter.
- **Minimap**: no dark plate (a faint tint and a thin frame); computer 108 × 72 px; touch: bottom right, above the "sails less" button. It is still the chart button.
- Distance labels of far enemies are no longer written over a HUD panel.
- **Numbers**: repair 0.7 → 0.5% of the hull per second; bots start 400–800 m away.
- **Wake** (`scenes/Wake.ts`): every ship leaves two bow waves that spread into a "V" and foam behind the stern; brighter and longer at speed.
- **Hand-made islands**: `tools/make_islands.py` now also paints the islands of `islands.json` (the first a volcano, the second a village with a pier; `"theme"` in the JSON overrides). The zip does not contain `islands.json` (yours differs from mine), so run the tool once.
- Words: "battle" instead of "duel" in the tuning panel.

### Answers

- All three sunk: the VICTORY banner with "All 3 enemies sunk", time and hits, then SAIL AGAIN.
- The old islands were bare because they are polygons from M1 drawn by simple code; the generator painted only its own islands.
- Ramming with bigger ships can be tried with the target class in the tuning panel; real class balance is M3.

### Open (your choice needed)

Ship size on the screen and game speed: see the plan (M2b, open questions). Caribbean-shaped sea: recorded for M5.

211 tests (212 with your angle test); build clean; headless on computer, iPad and iPhone without errors.

**Next:** package C (port on the village island, fog, shoal water).

---

## 15 Nov 2026 (late night) — Package B: collisions, fleeing, repair, three bots; minimap and your UI wishes

### Your test of package A

Computer: all good. Wishes: close the chart with ESC; on iOS the Tuning panel covered the chart button; start the next duel near the place where the last one ended; a minimap that can be switched off. Your iPhone screenshot also showed plain letters instead of the pixel fonts.

### Package B (rules, all in `sim/`)

- **Collisions** (`sim/collide.ts`): a hull is a turned rectangle; two hulls that overlap are pushed apart (the lighter ship moves more; never onto land) and keep 20% of their speed. Damage = closing speed × 6 × the other ship's share of the weight; below 1 m/s nothing; the ship that strikes with its bow takes half. New `mass` in `ships.json` (sloop 100, brigantine 170, merchantman 420, frigate 600). All hull damage now goes through one function (`sim/damage.ts`), so ramming can sink a ship too.
- **Repair at sea** (`sim/repair.ts`): sails at 25% or less, no enemy within 500 m, hull below 75% → +0.7% of the hull per second up to 75%. The same rule for bots. HUD: green "REPAIRING", a tick at 75% on the hull bar.
- **Bot**: new modes `flee` (hull under 30%: sails away from the nearest enemy, still around land) and `repair` (safe → lowers sails and repairs, then comes back). Bots steer around other ships (`avoidShips`).
- **Three bots** ("bots (next duel)" 1–3 in the tuning panel): placed at random open-water spots 600–1200 m away (`sim/spawn.ts`, from the world's seeded RNG). Victory = all enemies sunk. A new duel starts where the last one ended, with a new seed.
- Numbers: `data/damage.json`, `data/bots.json` (`fleeHullShare`, `shipAvoidM`, `shipAvoidTurnDeg`).

### UI

- **Minimap** (`scenes/Minimap.ts`): the whole sea with what you know from the chart. Computer: bottom right (it steps left when the tuning panel is open); touch: in the top row in place of the chart button. A click or tap opens the chart. "minimap" check box in the tuning panel.
- **ESC** closes the chart. **Tuning** on touch screens is a small gear button in the top right corner; opened, it is the usual panel and scrolls.
- **Fonts on iOS**: the game now loads both pixel fonts itself (`FontFace`) and waits for them before Phaser draws any text. Checked only in iPhone emulation, so please check on the real iPhone.

### Checks

211 tests in the sandbox (212 with your angle test); build clean; headless on computer and iPhone: three bots chase, ramming damages both ships and they do not overlap, repair works, C / ESC, restart near the old place, no errors.

**Known, small:** distance labels of far enemies at the screen edge can sit on top of a HUD panel or of each other.

**Next:** package C (neutral port, fog).

---

## 15 Nov 2026 (night) — New plan step "Open Sea" (D37, proposed); package A: sea, islands, chart

**Your answers to the main question:** the approach can be long; there are few decisions in a duel; the bot is strong, and boarding, ammunition types and a stronger wind are missing. Your proposals for the next update: a chart, borders of the sea, fog, ship collisions, fleeing, repair at sea, more islands (bays, mountains, trees, rivers, islets), two more bots, a neutral port.

**Plan:** M2 is closed as R1 "First Duel" (you confirmed you can win and lose on computer and iPhone). New milestone **M2b "Open Sea"** (decision D37, confirmed by you the same evening) in three packages; this is package A.

### Package A

- **The sea** (`data/world.json`): 6 × 4 km, closed by a **reef** 60 m wide along the four edges. For the rules the reef is land, so ships ground on it and bots avoid it with the rules that already exist; the picture is pale water with rocks and foam.
- **Islands by code** (`tools/make_islands.py`, numpy + Pillow, about 3 s): 3 big islands with a mountain (height bands lit from the west), a small river and one or two bays deep enough to sail into; 6 medium islands, some with a bay; 9 small islets with palms. Each island has a shore polygon (40 corners, for collisions) and a picture at 1 px per metre, made from the same numbers, so they always fit. Kept clear of the start, of your islands and of the reef; at least 170 m of water between islands. `docs/art/world-preview.png` shows the whole sea.
- **The chart** (key **C** or the map button next to the sound button): parchment over the screen; the reef, the islands **you have seen** (big names written), a 1 km grid and scale bar, the wind; your ship as a yellow arrow; other ships red while on your screen, pale with "?" at the place you saw them last. A click or tap on the chart closes it; the game goes on behind it.
- New: `sim/types.ts` (`Island.kind`, `Island.picture`, `WorldBounds`), `sim/data.ts` (`WORLD`, `reefs`, all land in `ISLANDS`), `scenes/Islands.ts` (pictures, reef tiles), `view/chart.ts` (what you know: `discover`, `updateSightings`, `chartFit`; 4 tests), `scenes/Chart.ts`, chart icon, `sim/worldData.test.ts` (4 tests: reef on all sides, islands inside and apart, open water at the start, a ship cannot leave the sea).
- 187 tests in the sandbox (188 with your angle test); build clean; headless: islands, reef, chart on computer and iPhone, no errors.

---

## 15 Nov 2026 (evening) — Your test of steps 4–7; UI fixes, pixel fonts, bot closes in

### Your test results

| Area | Result |
|---|---|
| Bot | Closes in to about 160–180 m, turns its side, fires when lined up; tacks upwind; gives up a long chase; turns to keep you off its bow and stern; avoids islands well |
| Problem | With you stuck at an island, the bot stayed to leeward at about 180 m, firing badly, and never closed in |
| Difficulty | The bot feels quite accurate; frigate broadsides are almost always fatal |
| Duels | You can win against a sloop; against a big ship almost never. A duel lasts **about 5 minutes** |
| Banner | Works (button, Enter, restart); **the font looked jagged and the text shook** on the computer (much less on the iPhone) |
| Sound | All events have sounds; hull hits a bit loud, hits on your own ship much too loud; **M mutes but nothing shows it** |
| Effects | Shake, ghost cross, hit flash, sinking: good; **gun smoke drifts too little** |
| Classes | Look fine; most should be even bigger; a merchantman could be frigate-sized, but heavy, few guns, small crew |
| 16 or 32 | 32 looks a little more natural → **D33 decided: 32** |
| iPhone/iPad | Everything works; a mute button on the screen would help; text hard to read on the iPhone; panels sometimes cover a ship |
| Fun check 1 | Your mark: **2 to 3** |
| Hours | Not recorded; this log keeps a short account of the work instead |

### What changed

- **Pixel fonts (the jagged, shaking text).** The game draws in logical pixels and scales the whole picture by a whole number (x3 on your computer, x4 on the iPhone). Text was drawn 4 times larger and squeezed into that grid; at x3 that broke the letters and made them shimmer. Now: two real pixel fonts drawn exactly on the grid (resolution 1): **Press Start 2P** (main, 8/16/24 px) and **Silkscreen** (dense text, 8 px), both SIL Open Font License, in `client/public/assets/fonts` with their licence files; loaded before the game starts (`scenes/text.ts`, `loadFonts`). The game also uses `roundPixels`, so nothing is drawn between two pixels. A browser test found the sizes at which each font has no blurred pixels.
- **Sound button** (a speaker icon; red cross when muted): top left on the computer, next to the zoom button on touch screens; click or tap to switch; M still works.
- **Panels never hide a ship:** when a ship's centre comes within 18 px of a panel, the panel fades to 25% (smoothly). Touch screens use lighter plates (0.42). The target card moved under the zoom and sound buttons on touch screens (the collapsed Tuning panel covered it on the iPhone). Layout tests extended.
- **Banner** shows the duel in numbers: time and hull hits ("3:42 hits: you 9 enemy 4"); this measures fun check 1.
- **Sounds:** hull hits softer (0.6), hits on your own ship about half as loud again.
- **Gun smoke** now leaves the gun port outward and drifts with the wind 8 m/s at full strength, lasts 3.6 s, grows less (it no longer hides the ship).
- **Bot closes in:** the range bend is now smooth (no dead band, which let it sit at the band edge, about 180 m, for ever), and when it is much too far (more than preferred + 60 m) it sails straight at you under full sail, beating if needed. Headless: from 240 m to leeward it reaches its preferred range in about 50 s and stays there (new test).
- **Bot accuracy** a little lower: judgement error 0.5–1.1° and it fires when the aim point is within 16 m of its line of fire. Headless against a ship lying still: about 0.8 hull hits per salvo, the same as your 0.82 by hand. Its edge is the perfect lead; skill tiers (green/regular/veteran) come in M3.
- **Frigate too strong:** by design for now: 12 guns against 4. Class sizes and balance go to M3 (plan updated).
- **32 directions** are the default now.

### Open

- Fun check 1 at 2–3: what made it boring or frustrating? (Long approach? Too few decisions? Bot too strong?) Your answer decides the tuning week before M3.

179 tests in the sandbox (180 with your angle test); build clean; headless on the computer and iPhone: crisp text, mute icon, fading panel, banner with numbers; no errors.

---

## 15 Nov 2026 (later afternoon) — Bot gives up; win/lose; step 6 juice; step 7 ship classes

Built while you test the bot. Your question: *a bot on the same course chases me for ever — how can we add chance and variety?*

### Bot: giving up and personality (part of step 4)

- **Giving up:** in a chase the bot checks its progress. If it has not gained at least 50 m in its *patience* time, it **breaks off** for 90 s (sails away), then may chase again. Within 250 m it always fights. So an equal or faster ship can escape, and that is part of the game. Headless test: two sloops running before the wind on the same course: the bot breaks off and you get away.
- **Personality:** each bot draws its own values once, from the seeded generator: preferred range 115–165 m, patience 45–90 s, aim judgement σ 0.3–0.8°. Bots differ, and the same seed still gives the same game.
- **Your idea of ship variety** (weight, a fouled bottom, a tired or short crew) went into the plan, not into M2 (rule: a new idea never enters a milestone that has started): **M3** small random speed factor (±3–5%) per ship, crew shortage and fatigue slow speed and reloading; **M5** hull fouling over the days, careening or the shipyard in port, cargo weight.

### Win and lose (rest of step 5)

`scenes/Banner.ts`: 1.5 s after a ship sinks, "VICTORY! Enemy sloop sunk" or "YOUR SHIP IS LOST", with **SAIL AGAIN** (tap, click or Enter).

### Step 6: juice

| Effect | How |
|---|---|
| Sound | `tools/make_sounds.py` makes 5 sounds **by code** (noise, filters, falling sine "thump"; no recordings, no licences): cannon, splash, hull hit, sail hit, sinking → `client/public/assets/sounds/*.wav` (about 300 KB). `scenes/Sounds.ts` plays them quieter with distance, left/right by screen position, each shot a little different in pitch. Key **M** or the panel: sound on/off and volume |
| Screen shake | small when you fire, stronger when your hull is hit, a long one when a ship sinks (panel switch) |
| Gun smoke | two grey puffs per gun drift downwind with the real wind and fade |
| Ghost cross | a faint cross stays where your salvo was aimed while the balls fly, so you can see how far the target moved |
| Hit flash | the hit ship flashes white for 0.1 s |
| Sinking | a big ring and bubbles for two seconds |

Effects now live in game metres (before, they stayed put on the screen when the zoom changed).

### Step 7: the other ship classes

`tools/render_ship.py` now draws **brigantine** (40 m: square sails on the foremast, gaff mainsail), **merchantman** (56 m: broad, three masts, high stern, cargo on deck) and **frigate** (70 m: full square rig, a row of 12 gun ports a side, gold on the stern). The sloop code was not touched; its sheets are pixel-for-pixel the same.

- One hull builder (`Hull`, `HullSpec`) and rigging helpers (`square_sail`, `gaff_sail`, `jibs`, `shrouds`).
- **Square sails seen from above:** a flat sail seen edge-on is only a line, so the sails are *filled*: the foot is pushed forward (most in the middle), and the yards are braced 30°. Ships heading away from the camera still show the sails thin (draft art; final art in M8).
- A frame size per class (64/80/96/112 px, in `shipArt.json` `frames`); the downsampling is vectorised with numpy (the whole set renders in about 2.5 min). `python tools/render_ship.py frigate` renders one class.
- Preview: `docs/art/ship-classes-preview.png`. Try them in the game: panel → Target → class.

### Open

- **Your choice: 16 or 32 directions** (panel "Art (test)"), then the M2 "done when" check and fun check 1.

176 tests in the sandbox (177 with your angle test); build clean; headless: sounds load, smoke and ghost cross show, banner and Enter restart work, all classes show; no errors.

---

## 15 Nov 2026 (afternoon) — HUD liked; M2 step 4 built: the bot

**Your feedback on the HUD:** the panels and icons look professional; the enemy hull bar helps; hidden debug text accepted. iPad test running.

### The bot (waiting for your test)

- **`sim/bot.ts`**, a small **state machine**: *chase* (far: sail toward you, beating against the wind if needed), *engage* (within 250 m: turn a broadside to you and keep about 140 m), *idle* (you are sunk: lie still). Gap between 250 and 300 m so the mode does not flip.
- **Fair play:** the bot sees only positions, headings and speeds, and acts only through commands (`setRudder`, `setSails`, `setElevation`, `fire`), like you. Its balls get the same random errors as yours (Battle 4). It raises the guns at 4°/s (your key speed) and misjudges the elevation a little (σ 0.5°, new after each shot).
- **Sails by the wind** (your idea): while fighting it sets the sails so it moves at about 4.5 m/s on any course (`sailsForSpeed`).
- **Tacking:** a course into the wind becomes close-hauled (15° outside the no-go zone); it stays on a tack at least 20 s (hysteresis), then goes about if needed.
- **Aiming:** where you will be after the flight time, using your motion relative to its own (the ball keeps the bot's speed). It fires only when that point lies within 10 m of its line of fire (the guns fire straight abeam).
- **Land:** looks 60 m or 10 s ahead with a "fat" hull (15 m clearance) and turns to the first free heading.
- **Memory** (`BotState`) lives in `world.bots`, so a save or a test repeats exactly. `thinkBots` runs in `Simulation` after your commands, every 3 steps (reaction time 0.1 s). All numbers in `data/bots.json`.
- **Panel → Target:** *behaviour* bot (default) / circle / moored; **restart duel** (fresh world, panel settings kept); **put 400 m upwind**. The game starts with the bot 400 m to windward, so it comes down on you at once. Debug text (H) shows the bot's mode and side.

### Problems found and fixed

| Problem | Cause | Fix |
|---|---|---|
| Headless: the bot scraped an island's corner and stuck there for a minute | It looked for land only straight ahead; the corner was beside the hull | Look ahead with a hull 15 m wider and longer, at three points (near, middle, far) |
| Only 0.1–0.4 hits per salvo | It fired whenever you were within 20° of its beam; the guns fire straight abeam, so 20° off at 150 m is a 55 m miss | Fire only when the aim point is within 10 m of the line of fire → 0.6–1.0 hits per salvo, like a player |
| Few salvos | After each salvo it turned almost round to use the loaded side | Change sides only if the turn is under 90°; now one salvo per reload |

- Headless numbers (you lying still, bot from 400 m to leeward, 5 min): first shot after 90–140 s (it must beat up to you), then one salvo about every 15 s, about 0.6 hull hits per salvo.
- 172 tests in the sandbox (173 with your angle test); build clean; headless browser: the bot closes in, turns its port side, hits you; restart works; no errors.

---

## 15 Nov 2026 — Step 3 tested; new HUD

**Your test of step 3:** at 150 m by hand **0.82 hull hits per salvo** (9 / 44 balls; perfect aim in the script gives 1.2); wind 1.0 makes the ellipse longer, the target sank after 9 hits / 24 balls; the moving target sank in about **2–2.5 min** (target 2–4 min). Gun sigma between 1.2 and 2.0–2.5 feels right; **1.8 stays**. Your idea: the target should set its sails by the wind → the bot (step 4) does that.

### Your UI review → new HUD (part of step 5, built before the bot)

| Your point | What changed |
|---|---|
| Computer: text covers the picture, hard to read at x2 and in motion | Three small panels on dark plates: **my ship** bottom left (compass, speed, sail pips, hull bar, IN IRONS / AGROUND), **target** top centre (class, distance, hull bar), **guns** bottom centre (port / starboard discs: yellow = loaded, a grey pie fills while reloading; elevation gauge, angle, range). All the numbers and keys moved into the **debug text**, hidden until **H** (or "debug text (H)" in the panel) |
| iPad: the compass under the rudder buttons | My ship panel (with the compass) is now top left on touch screens; guns bottom centre between the button groups. A test checks on four screen sizes that no panel lies under a button |
| Elevation buttons: better symbols | Option A: **pixel gun icons** (barrel up + arrow up, barrel down + arrow down), **stacked**: up above down, above "+" |
| Computer: the same icons as a reminder, keys + and - | The gun icons with "+" / "-" are in the guns panel (they can be clicked too). Keys **+ / -** on the main keyboard and on the number pad; R / F still work |

- New: `view/hudLayout.ts` (panel and button places, hull bar colour; 9 tests), `scenes/icons.ts`, new `scenes/Hud.ts`, `TouchControls.ts` by named places, `Compass.place`. Range ring labels moved to the upper left (the target card is at the top centre).
- 157 tests in the sandbox (158 with your angle test); build clean; headless computer, iPad, iPhone: no errors.

---

## 15 Nov 2026 (after midnight) — M2 step 3 built: accuracy and spread; moving target

### What was built (waiting for your test)

- **Two random errors (plan 4.4)** in `sim/accuracy.ts`:
  - *salvo error*: the ship's roll; one number per broadside, in elevation, so the whole salvo lands long or short together; drawn when you fire and kept in each `PendingShot` (`salvoErrorDeg`);
  - *gun error*: each ball, in elevation and in direction.
  - Formulas unchanged from the plan: `σ_gun = 1.8° × (1.4 − 0.06 × Battle) × …`, `σ_salvo = 0.6° × (1 + wind) × (1.2 − 0.04 × Battle)`. Crew shortage, gun wear and ammunition stay neutral (M3). New `ShipState.battleSkill` = 4 for both ships until captains (M6).
  - Random numbers from the seeded generator: `nextGaussian` (normal distribution, "bell curve") in `sim/random.ts`. The same seed gives the same shots.
- **`tools/hit_table.py`**: Monte Carlo in Python (same flight steps and same box test as the game). Perfect aim, Battle 4, wind 0.7: **3.2 / 1.8 / 1.2 / 0.9** hull hits per salvo at 50 / 100 / 150 / 200 m. D28 wants 1–2 at 150 m and 0–1 at 200 m, so base σ is **gun 1.8°, salvo 0.6°** (`guns.json`). Try `python tools/hit_table.py --gun 1.5 --battle 8`.
- **Guard test** `accuracy.test.ts`: 300 salvos with the real TypeScript code at 150 m must give 1–2 hits. Old exact tests (balls land on the cross) run with `withPerfectGuns()` (`sim/testing.ts`).
- **Landing ellipse** around each cross (`LandingMarkers.ts`, `landingSpread` in `sim/guns.ts`): long along the line of fire (elevation error, about ±40 m at 150 m), narrow across it (direction error, about ±5 m). 1 sigma (`view.json` `landingEllipseSigmas`).
- **Moving target** (`sim/circle.ts`): with 30% sails (about 1.3–2.8 m/s) it sails clockwise round a 150 m circle that starts to its starboard. A circle runs into the wind somewhere, so there it tacks and sails close-hauled across the circle, then follows the circle again. It is steered by commands like every ship. lil-gui *Target*: "moving (circle)", "sails %", "circle radius (m)"; "put at …" starts a new circle.
- **Hit count** in the computer HUD: "hits 5 / 24 balls = 0.83 per salvo of 4"; lil-gui *Accuracy*: both σ sliders and "reset hit count".
- 148 tests in the sandbox (149 with your angle test); build clean; headless computer and iPhone, no errors.

### Problem found and fixed

| Problem | Cause | Fix |
|---|---|---|
| First version: the target drifted away and stalled near the wind for over a minute | It turned at speed / radius; close to the wind the speed fell, so the turn became very slow | Fixed circle centre, steer along the tangent; where the circle points into the wind, tack and sail close-hauled |
| Then it flipped between two courses near the wind | The choice "follow the circle or tack" had no memory | `tacking` memory (hysteresis): the tack ends only when the circle can be followed with the wind on the other side |

---

## 14 Nov 2026 (late night) — Touch fire buttons; art settings kept

**Your test on iPhone and iPad:** there was no way to fire the guns. My mistake: touch buttons for the guns were planned for step 5, but the phone could not test steps 1–2 without them. Fixed now.

- **Second button row** (`scenes/TouchControls.ts`): **L** and **R** fire the port / starboard broadside (one tap = one salvo); **v** and **^** lower / raise the guns (held). Button size is now `min(48, 17% of height)` so two rows fit on the 240 px phone screen.
- **Phone panel** (`Hud.ts`): two new lines, e.g. `5 deg 130 m` (elevation and range) and `L 14s  R ok` (reload).
- `SeaScene.ts` sends the same `fire` and `setElevation` commands as the keys. 133 tests in the sandbox; headless iPhone and iPad emulation: a tap on **L** fires, no errors. Checked by you on the devices: all OK.
- **Art decisions:** `HEIGHT_SCALE` stays **0.65** for now (may change later); **16 directions** stay the default. Final choice 16 vs 32 is still part of the art spike (D33).
- Final touch controls with an assisted-aim option remain M8 (D24).

---

## 14 Nov 2026 (evening, later) — M2 step 2 tested; sloop art version 2

**Step 2 tested by you:** hits, damage and sinking work; shots aimed beyond the hull do little or no damage, as designed. The art in the game: you liked it and asked for more detail and a more tilted (less side-on) look when the ship heads east or west.

- **More from above:** new `HEIGHT_SCALE` 0.65 in `tools/render_ship.py` (screen pixels up per metre of height; was 1). The masts are shorter on screen and more deck shows. The number is written to `shipArt.json` (`heightScale`) and `Cannonballs.ts` uses it too, so balls, hit effects and ship pictures still share one projection. The mainsail swings out 28° (was 18°).
- **More detail:** hull side in three strips (dark planks, owner's band, top strake); the **rail in the owner's colour** (yellow = you, red = enemy), visible from every side; deck guns on carriages; gun ports; lit stern windows and a lantern; helm; hatch with grating; barrels; anchors; mast platform; sails made of cloth panels; a bigger black flag.
- **Fine parts only in the double-detail sheet** (`min_detail = 2`): gun barrels, deck plank seams, shrouds and stay. In the small pictures they would only make broken dots.
- Same file names and frame size, so the game code did not change apart from `Cannonballs.ts`. 133 tests in the sandbox.

---

## 14 Nov 2026 (evening) — Art test: pseudo-3D sloop drawn by code

You asked whether I can draw ship sprites. Answer: not by hand, but by code. You chose that path and **accepted the style as draft art**.

- `tools/render_ship.py` (Python, numpy + Pillow): the sloop is a 3D shape of coloured triangles in game metres (hull with a painted band, deck, mast, bowsprit, mainsail, jib, flag, gun ports). For each direction the model is turned and drawn with the **same projection as the cannonballs** (screen y = world y − height), so the hull keeps its true top-down size and a ball that hits the sail on screen hits the rigging in the sim. Brightness comes from the angle to the light in 5 steps; then a dark outline and a shadow on the water.
- Output: 8 sheets in `client/public/assets/ships/` (owner player = yellow band, enemy = red band; 16 and 32 directions; detail 1 and 2 pixels per metre), `client/src/data/shipArt.json`, and `docs/art/ship-art-preview.png`.
- In the game: `scenes/ShipArt.ts` loads the sheets and `showShip` picks the frame for the heading (`view/shipFrame.ts`, 3 tests); the image is not turned. At zoom ×2 the double-detail sheet is used at its own size. Classes without pictures (brigantine, merchantman, frigate) still use the plain boxes. lil-gui "Art (test)": boxes / 16 / 32 directions, "detail at zoom x2".
- Fix found on the way: after a click on a panel **button** ("put at …") the keys did not steer; the panel now releases the focus after clicks on buttons and check boxes too.
- Limits: details are small at 1 px per metre; the sails do not turn with the wind; 16 directions turn in 22.5° steps (compare with 32 in motion).
- 133 tests in the sandbox (134 with your angle test). This is the first half of the M2 art spike (D33); the Blender path stays as the later option for final art.

---

## 14 Nov 2026 (night, 01:00+) — M2 step 1 tested; M2 step 2 built

**Step 1 tested by you:** firing works; at high speed the balls land behind the cross. That is expected: the cross shows where a shot fired *now* would land and moves on with the ship while the balls fly (11 m/s × 2 s ≈ 22 m). Idea for step 6 (juice): leave a faint ghost cross where the salvo was aimed.

### Step 2: hits, damage, sinking (waiting for your test)

- `sim/hits.ts`: `segmentBoxEntry` (slab method), `toShipLocal`, `ballHit`. Each ship is two boxes: hull (water to `hullHeight`) and rigging (`hullHeight` to `mastHeight`). Each step tests the ball's whole segment, so a fast ball cannot jump through a ship; your own balls never hit you.
- `ships.json`: `hullPoints`, `hullHeight`, `mastHeight` (sloop 220 / 5 m / 22 m; frigate 600 / 8 m / 45 m). `guns.json`: `damage` 27 → 9 hull hits sink a sloop (target 6–10, D28).
- At 0 hull points the ship is **sunk**: it stops, cannot fire, takes no hits and fades to a faint wreck; camera, auto zoom and edge markers ignore it. `placeShip` (the "put at" buttons) brings the target back with a full hull.
- Effects: brown splinters for hull hits, a white puff for rigging hits, a big splash when a ship sinks. HUD: target hull ("hull 139/220", "SUNK!").
- Without random errors (step 3) the right elevation hits with every ball; this is why accuracy comes next.
- 130 tests in the sandbox (131 with your angle test); headless: 3 hits with the first salvo, sunk after the third.

---

## 14 Nov 2026 (night, later) — M1 done; stuck-on-the-shore fix; M2 step 1 built

**M1 tested by you, all OK; M1 is done.** You added a second island (x + 600) without changing code.

### Your question: a ship in irons on a lee shore

You found that a sloop that runs aground and then turns into the wind can stay stuck. Real ships feared a lee shore, and sailing physics should stay honest: in irons the sails give no drive. But the game must never leave you without a way out. Two separate things were going on:

| Problem | Cause | Fix |
|---|---|---|
| Fully stuck while turning through the wind with the stern on the sand | The push-off only slid the ship **backward**, and backward was the shore | The push-off now tries back, forward, port and starboard and takes the first free place. A test reproduces the case (fails with the old push-off, passes now) |
| In irons the sails give no drive | Intended: the polar has a no-go zone | Keep turning until the compass needle leaves the red wedge (a reach), then sail away. Rotating on the spot still works at 30% of the turn rate |

Idea for later (Stage 2 backlog): **kedging off**: the crew rows an anchor out and hauls the ship off the shore; slow and costs time. Hull damage from grounding comes with hull points in M3.

### M2 step 1: guns and ballistics (waiting for your test)

- `data/guns.json`: muzzle speed 75 m/s, gravity 9.81, gun height 3 m, elevation 0–10°, ripple 0.4 s, `inheritVelocity` 1.0. `ships.json`: `gunsPerSide` (sloop 4) and `reloadSeconds` (sloop 15).
- `sim/guns.ts`: gun positions along the hull; ball launch (ship velocity + muzzle velocity, raised by the elevation); ball steps with gravity; `predictLanding` runs the same steps, so marker and shot always agree; ripple fire via `pendingShots`; reload timers.
- New world data: `balls`, `pendingShots`, `nextBallId`, `events` (`gunFired`, `splash`); `ShipState.elevationDeg`, `reloadPort`, `reloadStarboard`; commands `fire` and `setElevation`. `Simulation.takeEvents()` hands the events to the screen.
- Screen: balls drawn above their shadow by their height; splashes and muzzle flashes; a landing cross for each side (yellow = loaded, grey = reloading); HUD line with elevation, range and reload. Keys: Q / E fire port / starboard, R / F raise / lower.
- `tools/range_table.py`: your first Python script; it prints range, flight time and highest point for 0–10° with the same steps as the game (10° → 212 m, 2.87 s).
- 117 tests in the sandbox (118 with your angle test). No hits yet: balls fly through ships until step 2.

---

## 14 Nov 2026 (night) — Step 3b tested and pushed; M1 step 4 built

**Step 3b:** tested by you, all OK; committed and pushed.

### Step 4: island and wind drift (waiting for your test)

- **Pelican Cay** (`data/islands.json`): a polygon of 10 corners about 450 m south of the start. Drawn once into a texture (shallow rim, sand, trees) at 1 px per metre and scaled like the ships.
- **Collision** (`sim/geometry.ts`, `sim/land.ts`): point-in-polygon by ray casting; five hull points (bow, stern, middle, both sides). A ship that would touch land goes back to its last position, stops and is **aground** (HUD: "AGROUND"). It keeps a turn that does not touch land; if the turn touches land too, the crew **pushes off** 0.1 m per step (3 m/s). Hull damage comes with hull points in M3.
- **Seeded random generator** (`sim/random.ts`, mulberry32): its state `rngState` lives in the world; the same seed gives the same game. Never `Math.random()` in `sim/`.
- **Wind drift** (`sim/wind.ts`, `data/wind.json`): every 10 s the wind turns by up to ±3° (never more than 25° from its base direction) and its strength changes by up to ±0.05 (limits 0.4–0.9). lil-gui: "drift" checkbox; the direction slider now sets the base direction.
- New types: `WindNow` (what a ship feels) and `Wind` (plus `baseFromRad`); `ShipState.aground`; `World.rngState`; `Tuning.windDrift`.

### Problem found and fixed

| Problem | Cause | Fix |
|---|---|---|
| Headless: after a second aground with sails set, turning to starboard did nothing | The bow creeps right up to the sand; the shore is not square to the bow, so every small turn touched land and was undone | Push-off: if the turn alone touches land, the ship slides back 0.1 m per step while turning. A test reproduces the case (fails without the fix, passes with it) |

107 tests in the sandbox (108 with your angle test).

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
