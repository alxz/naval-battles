# Naval-Battles — Ideas for the World

*17 Nov 2026 · The developer's ideas and the assistant's recommendations · Linked to `naval-game-plan-v0.7-en.md`*

This is **not a work plan** but a store of ideas with an assessment. By rule D37 no idea from here enters a started milestone (now M3). Each idea is split into a small first version and a deeper later one; the end gives a suggested order. When an idea is taken up, it gets a decision number (D41, D42, …) in the plan.

---

## 0. Main conclusions

1. **Almost all ideas are good and historically sound**, and many are already in the plan as "Stage 2" (weather, shallows, guilds, fleets). What is new here is the **links between them**: night changes sight, sight changes flags, flags change whom you may attack, and that changes the economy.
2. **Almost every idea needs one foundation: "perception"** (decided: its own milestone M4b right after M4, D41; detailed plan in section 9) (who sees whom and what he knows about him). Today bots see the whole sea, and fog is a picture only. Until that changes, night, rain, fog and flags change nothing for bots, and the rule "bots do not cheat" is quietly broken. **Recommendation: perception is the first big task after M4**, before day and night.
3. **No time zones.** The whole Caribbean spans about 27° of longitude, under 2 hours of sun time. Even a map of the whole Atlantic gives a few hours that the player would not notice, while trade and ports would get harder. One clock for the whole world.
4. **Length of a day, decided (D42, 17 Nov): 12 real minutes at ×1** (1.5 minutes at ×8) instead of the plan's "2 minutes", with which a night would last 40 s. Provisions and the economy are tuned to it in M5 (see 10.4).
5. **The economy is the main risk of the project** (already in the plan, 6.4). Ideas 6–8 should be built only after the simple M5 economy passes the 1,000-day run. The key to replay value is not complexity but **feedback loops**: pirates hurt a city → the city hires guards → pirating there gets harder → pirates move to other waters.

---

## 1. Day and night

**Developer's idea:** morning → day → evening → night, natural and over the whole map; it affects repair, trade, gunnery and sight.

### 1.1 The clock

| Phase | Share of the day | At 12 min | Picture |
|---|---|---|---|
| Morning (dawn) | 10% | 1.2 min | pink-gold tint, long shadows |
| Day | 45% | 5.4 min | as now |
| Evening (dusk) | 10% | 1.2 min | orange, then blue |
| Night | 35% | 4.2 min | dark blue, lanterns, glints |

Exact hours and numbers: section 10.

- In `sim/`: one number `world.clockSeconds` and a function "phase and light 0…1" (smooth, no jumps). Everything else reads the light, not the phase, so changes are soft. A test for every formula.
- Picture: a see-through layer over the sea coloured by the light; lanterns on ships and port lights as small bright dots. Pixel art looks good at night exactly with point lights.
- Later (Stage 2): moon phase (full moon = see farther).

### 1.2 Repair by time of day

| Where | Morning, day | Evening | Night |
|---|---|---|---|
| Port dock | full rate, normal price | price ×1.5 | closed |
| At sea, by the crew | 100% rate | 80% | 50% (slowest) |

- Prices come only with gold (M5); before that only the rates.
- The evening price is the first place where the time of day becomes a decision: repair now and pay more, or wait for morning in safe water.

### 1.3 Market closed at night; theft

- A closed market at night is cheap and right; the port screen says "closed until morning" with a "wait for morning" button (time acceleration).
- **Theft is a fine idea with a historical basis.** Night **cutting-out expeditions** were a real 17th–18th century tactic: a crew in boats quietly takes a ship lying at anchor. Two simple forms, both through the port law (D40):
  1. **Warehouse raid:** at night in port, the action "raid the warehouse". A roll (crew, morale, port guards). Success: goods into the hold; failure: men lost. Either way you are an **offender** of that port; on failure you are under the shore guns at once.
  2. **Ship theft:** at night, a ship at anchor can be boarded without gunfire (M4 rules) with a surprise bonus. Success: the ship is yours, and you are an offender.
- Needs boarding (M4), market and warehouse (M5), night: **R4 or later**.

### 1.4 Gunnery at night

- Fits straight into the existing spread formula (plan 4.4): at night `σ gun × 1.6`, `σ salvo × 1.3`, the bots' range judgement error × 2; dawn and dusk in between, by the light.
- A nearly free bonus: **muzzle flashes give you away**: at night a ship that fires becomes visible at long range for a few seconds. Night becomes tactical: firing first pays, but is risky.

### 1.5 Sight, silhouette and flag

The most valuable idea in the list, because it creates decisions. Three levels of knowledge about a ship:

| Level | What you see | Day | Night (lanterns lit) | Night (lanterns out) |
|---|---|---|---|---|
| Contact | "something is there", edge marker | 1,500 m | 700 m | 350 m |
| Silhouette | the ship class (sloop, frigate) | 900 m | 300 m | 200 m |
| Flag | whose ship: nation, pirate, city | 450 m | 150 m | 120 m |

- **Douse the lanterns**: a choice for the player and bots: harder to see, but the night watch works worse (for example slower sail handling and repair).
- **False flag**: a historical pirate trick: sail under another flag and hoist your own before the attack. Rule: firing under a false flag makes you an offender to everyone who saw it (like the port law). Gives pirates a real choice. Needs nations: **Stage 2**.
- The chart and minimap show only what you know (already true for islands).
- **The foundation is perception** (section 0): each ship has a list of known contacts with a level of knowledge and the time last seen. Bots decide only from this list. Then fog, rain and night affect bots automatically, and tests can check "a bot does not attack what it cannot see".

### Assessment of section 1

| Part | Size | When |
|---|---|---|
| Clock, night picture, lanterns | small | with the game clock in M5 |
| Night gunnery, muzzle flashes | small | M5 (after the clock) |
| Perception (contacts, levels) | **medium to large**, touches bots | its own step right after M4 |
| Flags and identification | small on top of perception | M5 |
| Repair and market by the clock | small | M5 (needs gold) |
| Warehouse raid, ship theft | medium | R4 (M7) |
| False flag, moon phase | small | Stage 2 (needs nations) |

---

## 2. Weather, reefs and currents

**Developer's idea:** rain and storms (worse handling, lower speed, waves, slower crew, more drift), rare dangerous hidden reefs and currents near islands.

- **Rain:** sight × 0.6, spread × 1.2. Cheap version: rain bands that drift down the wind, like the fog bands we already have.
- **Storm:** wind 1.1–1.4, leeway (drift downwind), slower reload, **lower gun ports cannot open** (a frigate has fewer guns in a storm: historically true and it evens the classes), a risk to sails under full canvas. A storm should be a **rare event with a warning** (clouds on the horizon), so the player can choose: shelter in port or take the risk.
- **Leeway** is useful even without storms: today a ship goes exactly where it points. A little leeway makes tacking more honest. It changes physics, so it needs a fun check and its own step.
- **Hidden reefs:** shoals near some islands. Touching one damages the hull and grounds the ship. They appear on the chart after the first touch, or if a pilot or a bought chart knows them. They are land without a picture (we already have islands of kind `structure`), so cheap.
- **Currents:** a vector field in a few straits (the water itself moves the ship). Cheap in code, but it changes navigation, interesting in narrow passages.

| Part | Size | When |
|---|---|---|
| Hidden reefs | small | M5 (with the map) |
| Currents in straits | small | M5 |
| Rain bands | small | R4 |
| Leeway | small to code, large to tune | R4, after fun check 2 |
| Storm with a warning | medium | Stage 2 (already in the plan) |

---

## 3. Cities that trade and grow rich

**Developer's idea:** every merchant belongs to a city and works for its wealth; a rich city fields more ships and guards.

A strong idea: it turns the economy from a price table into **a living world with consequences**. The pirate feels his deeds change the sea.

### 3.1 The simple model (first version)

Each port has:

| Value | What it is |
|---|---|
| Stocks of 5 goods | already in the plan (4.9) |
| **Treasury** | the city's gold |
| Production and consumption | already in the plan |
| **City fleet** | merchants and guards the city has bought |

Once a game day:
1. Production and consumption change the stocks (already in the plan).
2. The city's merchants that arrived bring **profit to the treasury** (a tax, for example 20% of the deal's profit).
3. The city spends by simple rules: fewer merchants than its target and enough gold → build a merchant; more than K of its ships sunk in the last N days → hire a guard (patrol bot) or ask for the navy.
4. Each ship costs upkeep per day; a poor city loses ships.

### 3.2 Feedback loops: the heart of replay value

- **Negative (stabilising):** pirates sink merchants → the city loses money but **hires guards** → these waters get dangerous → pirates leave. Without it the economy either dies or grows without limit.
- **Positive (makes stories):** a rich city builds more merchants → richer still. It must be capped (upkeep grows with the fleet, a ship limit per city).
- Each game then differs: which city grows rich depends on whom the player robs. That is replay value.

### 3.3 What to check

- The 1,000-day headless run (already in the plan, M5) **with pirate bots**: no city dies for good, none grows without limit, prices stay within their band.
- `tools/plot_economy.py` charts: each city's treasury, its ship count, prices.

| Part | Size | When |
|---|---|---|
| Merchants belong to a city, profit to its treasury | small on top of M5 | M5 |
| The city buys merchants and guards by rules | medium | M5 or right after (once the 1,000-day run passes) |
| Royal navy, city wars, taxes | large | Stage 2 |

---

## 4. Merchant caravans

**Developer's idea:** merchants join in caravans, which helps against pirates.

- Historically true: escorted convoys were the main protection of trade.
- Needs **group bot logic**: a leader chooses the course, the others keep station relative to it; when attacked, guards turn on the pirate, merchants hold course or scatter.
- A decision for the player: a caravan is richer but more dangerous; you can **cut out a straggler** (a slow merchant at the tail).
- Simple first version: 2–3 merchants of one city on one route plus 1 guard. No real formation, just "stay within 150 m of the leader".

| Part | Size | When |
|---|---|---|
| Caravan of 2–3 plus a guard, "stay close" | medium | R4 (M7) or Stage 2 |
| Formation, signals, scattering | large | Stage 2 (in the plan: "convoys") |

---

## 5. Hiring pirate bots

**Developer's idea:** the player hires a pirate bot for a share of the loot for a short joint raid.

- A good idea and a step towards Stage 2 fleets. The key: **an ally is not a second player**: it has its own character.
- **Price:** an advance plus a share of the loot, depending on its class, skill, the length of the hire and your reputation. Example: a veteran sloop for 10 minutes = 15% of the loot plus 100 gold in advance.
- **Behaviour:** follows you and attacks your target; **may desert** if the fight goes badly (hull < 40%, enemy stronger): the hireling's morale; demands its share after the raid. Not paid → it becomes an enemy and tells other pirates (reputation, Stage 2).
- **Technically:** commands "follow / attack my target", a new relation "ally for a time", loot sharing (needs M4). All through commands, no cheating.

| Part | Size | When |
|---|---|---|
| One hireling for a time, "follow / hit my target", a share | medium | R4 (as a contract type in the M7 contract system) |
| Several hirelings, morale, betrayal, reputation | large | Stage 2 |

### 5.1 Breaking the contract (developer's addition, 17 Nov)

If there is no loot for a long time, the hireling breaks the contract and demands a fine. You pay or fight; the winner takes the loser's ship.

- **The hireling's patience:** the contract breaks after **T minutes without a prize** (for example 4 real minutes at ×1 = 8 game hours; each hireling's patience comes from its character) or **2 lost fights in a row** (the target escaped, you fled, the hireling was nearly sunk).
- **The fine:** usually the advance again (or 10% of your gold, whichever is more). The hireling warns first ("one more hour without loot and I leave"), so the player can still act.
- **The player's choice:**

| Choice | Result |
|---|---|
| Pay | it leaves in peace; you can hire it again later |
| Refuse | a one-to-one fight; the winner takes the loser's ship (you win: a prize by the M4 rules; you lose: the ship-loss rule D10) |
| Talk it round (later, Morale skill) | a smaller fine or a little more time |

- **The hireling thinks too:** much weaker than you, it may not fight but sail off cursing (and tell other pirates: reputation, Stage 2); stronger, it may strike first.
- Technically a small addition to hiring: a timer in the contract, a count of failed fights, one event with a choice. Needs boarding and capture (M4) and the contract system (M7).

---

## 6. What to learn from the best strategy games

The closest genre is not Civilization but trading sea games. What to take from each:

| Game | Take | Avoid |
|---|---|---|
| **Sid Meier's Pirates!** | simplicity: few goods, clear prices, fights first; time passes fast | — (the closest model for the spirit of the game) |
| **Port Royale** (series) | cities with stocks and prosperity, convoys, bot trade routes | huge tables and micromanagement |
| **Patrician / Hanse** | a city grows from supply; shortage shows in the price | city-building screens |
| **Mount & Blade** | caravans of towns and lords, real armies on the map, consequences of raiding | — |
| **Civilization** | a few clear resources, plain numbers ("+3 per turn"), cause and effect the player can see | too many systems |
| **Anno** | production chains | long chains are too heavy for us |
| **EVE Online, X4** | an economy made of real agent actions, not formulas | the scale |

**General rules that follow:**
1. Few goods (5 is right), each with a clear role.
2. Stocks, not formulas: the price follows from how much lies in the port.
3. The player must **see the cause**: "sugar is dear because the Bridgetown merchants never arrived".
4. Negative feedback against runaway growth and collapse.
5. Every rule is checked by a headless run and a chart, not by eye.
6. Add one system at a time and check that the player notices it (already in the plan, 6.4).

---

## 7. Suggested order

| When | What | Why then |
|---|---|---|
| **M3 (now)** | nothing from this list | rule D37 |
| **M4 (boarding)** | surrender of a crew that has lost more than 60% (section 8) | M4 has not started; the idea refines it |
| **M4b "Eyes at Sea" (D41)** | contacts, levels of knowledge, bots decide from them; fog and night start to affect bots | the foundation for night, weather and flags; also closes "fog is a picture only" |
| **M5 (world and ports)** | game clock with day and night (16-minute day); night gunnery, muzzle flashes; flags; market and dock hours; merchants belong to cities, treasury, simple ship purchases; hidden reefs and currents | M5 already brings the clock, ports, market and the 1,000-day run |
| **R4 "Living Sea" (M7)** | night warehouse raid and ship theft; caravan of 2–3 plus a guard; hiring one pirate as a contract; rain bands | all of these use boarding, the market and contracts |
| **Stage 2** | storms, leeway, false flags and nations, royal navy and city wars, fleets of hirelings and reputation, moon phase | they need nations and reputation |

**The developer's decisions (17 Nov):**
- **O5 → D42:** a 12-minute day (to start with; tuned by play).
- **D41:** perception is its own milestone M4b right after M4 (section 9).
- **Item 10:** boarding (surrender after 60% losses) goes straight into M4 (section 8); breaking a hireling's contract comes with hiring in R4 (section 5.1).

---

## 8. Boarding and surrender (developer's item 10)

**Developer's idea:** a crew that has lost more than 60% of its men gives up sooner.

Right, and historically accurate: in the Golden Age of Piracy most captures happened almost without a fight. The black flag meant "surrender and you live", the red flag "no quarter". A merchant crew rarely died for somebody else's cargo.

M4 has not started, so the refinement can go straight into it (recorded in the plan, 4.7 and the M4 checklist).

### 8.1 Surrender rule (proposal)

`c` is the share of the crew left (1 = full).

| Crew left | What happens |
|---|---|
| over 40% | does not surrender (unless a badly hurt merchant, as in the plan) |
| 40% → 20% | at each check the chance to surrender grows from 0 to 100% |
| 20% or less | strikes its colours, as in the plan now |

```
chance = clamp((0.4 − c) / 0.2, 0, 1) ^ 1.5 × factor
factor: merchant × 1.5 · low morale × 1.3 · hull > 60% × 0.6 · enemy twice as strong × 1.3
```

- **A check** after every broadside that kills men, and at the start of a boarding. Not every second, or the chance piles up too fast.
- **A broken crew fights worse:** in the boarding roll defence × (0.5 + 0.5 × min(1, c / 0.4)); at 20% crew it fights at half strength.
- **A ship that can still sail runs first** (bots already have `flee`); the one that is caught surrenders.
- Numbers in `data/boarding.json`; a headless test checks the curve: "a merchant bot with 30% crew surrenders in 9 of 10 cases within 3 broadsides".

### 8.2 Later (Stage 2)

- **Black and red flag:** under the red flag the enemy expects no quarter and hardly ever surrenders, so fights are longer and costlier, but weak crews more often flee before a boarding. The black flag keeps the normal rules. Needs flags (perception) and morale.
- **Quarter:** letting a surrendered crew go raises your reputation and future victims surrender more readily; killing them does the opposite. A good link to Stage 2 reputation.

---

## 9. Perception: detailed plan for step M4b (D41, confirmed 17 Nov)

**Goal:** every ship knows only what it sees. The player and the bots under the same rules.

### 9.1 What a ship knows

```
Contact = { shipId, level: 1 | 2 | 3, x, y, headingRad, speed, seenTick }
          level 1 contact, 2 silhouette (class), 3 flag
world.knowledge[observerId] = Contact[]   // plain data, saved and repeatable
```

- Updated **3 times a second** (every 10 steps), not every step: cheap, and like a lookout's work.
- While a ship is seen its place and heading are fresh; once lost, the **last known** stays.
- The player's ship works like a bot: the screen reads its `knowledge`.

### 9.2 Sight range

```
range(level) = base[level] × light × weather × fog_on_the_line × target_lanterns × mast_height
```

| Factor | Value (starting) |
|---|---|
| base by day | contact 1,500 m, silhouette 900 m, flag 450 m |
| light (night) | contact × 0.47, silhouette × 0.33, flag × 0.33 (dawn and dusk smoothly in between) |
| target's lanterns out | × 0.5 at night, no effect by day |
| fog | × 0.35 for each fog band the line of sight crosses |
| observer's mast height | × 0.9 (sloop) … × 1.15 (frigate): a high mast sees farther |
| target size | × 0.9 (sloop) … × 1.1 (frigate, merchantman) |
| **island on the line of sight** | not seen at all (except small islets) |
| closer than 120 m | always at least a contact (heard, wake seen) |
| broadside | the shooter is seen as a contact from twice the range for 4 s |

- **Hysteresis:** seen at range `R`, lost only at `1.1 × R`, or marks flicker at the edge.
- An island blocking sight is the key to "slip behind an island". Check: the segment observer → target against island polygons. 15 ships × 14 × 3 per second is affordable with a quick bounding-box reject.
- All numbers in `data/sight.json`. Until night and weather exist, `light = 1` and `weather = 1`: in M4b only islands, fog, masts, size and broadsides work.

### 9.3 Memory and search

- A lost contact is kept **90 s** (bots differ by their character's patience).
- A new bot mode **`search`**: sail to the last place plus where the enemy could have gone (heading × speed, up to 30 s), look around, then give up and return to the old task.
- Player: a pale "seen here" mark on the chart and at the screen edge (the chart already has `sightings`).

### 9.4 What changes for bots

| Where | Now | After M4b |
|---|---|---|
| choosing a target (arena, battle) | all ships at sea | contacts only |
| aiming | exact places | the contact's place (exact while in sight) |
| steering clear of ships | all | contacts plus everything within 120 m |
| port-law offender | known to all | known to all within 450 m of the port (the port's bell) |

### 9.5 Screen

- Ships your ship does not see are **not drawn** (fade out over 0.5 s); hull bars, edge markers and the target card only for contacts.
- Level 1 (contact): no hull bar and no class, a "?" on the marker. Level 2: the class. Level 3: the flag (for now one "pirate" flag for all, coloured by owner).
- Arena: a switch **"what the bot sees" / "everything"**, much needed for debugging.

### 9.6 Log and tests

- Arena log: `sighted`, `lost sight`, `searching`, `gives up search`, with time and distance.
- Headless tests:
  1. a bot neither fires at nor chases a ship behind an island;
  2. a ship in a fog band is spotted later than in clear water;
  3. having lost its target, a bot sails to the last place and gives up after 90 s;
  4. a broadside gives the shooter away;
  5. the same seed gives the same game;
  6. the arena pace (wins per hour) drops by at most half, otherwise the ranges are tuned.

### 9.7 Steps inside M4b

| Step | What | About |
|---|---|---|
| a | `perception.ts`: contacts, ranges, islands on the line, tests | 3–4 sessions |
| b | bots read contacts only; `search` mode | 3–4 sessions |
| c | screen: hidden ships, "seen here" marks, arena switch | 2 sessions |
| d | fog for the rules, broadside flashes, log | 2 sessions |

**Risk:** bots get "dumber" (they lose targets) and the arena slows down. The log shows it (wins per hour), and `sight.json` fixes it.

---

## 10. Day and night: detailed plan for M5 (D42: a 12-minute day)

### 10.1 The clock

24 game hours in 12 real minutes: **1 game hour = 30 real seconds** at ×1 (under 4 seconds at ×8).

| Phase | Game hours | Real time at ×1 |
|---|---|---|
| Morning | 05:00–07:30 | 1 min 15 s |
| Day | 07:30–18:00 | 5 min 15 s |
| Evening | 18:00–20:30 | 1 min 15 s |
| Night | 20:30–05:00 | 4 min 15 s |

- A new game starts at 08:00. `data/time.json`: `dayMinutes: 12`, phase limits, `startHour`.
- `sim/clock.ts`: `hourOf(world)`, `phaseOf(world)`, `lightOf(world)` (0 at night … 1 by day, smooth cosine ramps). A test for each function.
- HUD: a small sun or moon and the time "08:40" by the compass.

### 10.2 What depends on the light

| What | Day | Night | Where in the code |
|---|---|---|---|
| sight | table 9.2 | × light | `perception.ts` |
| gun spread | × 1 | × 1.6 | σ formula (plan 4.4) |
| salvo spread | × 1 | × 1.3 | σ formula |
| a bot's range error | × 1 | × 2 | `bot.ts` |
| repair at sea | 100% | 50% (evening 80%) | `repair.ts` |
| port market | open | closed 20:30–07:30 | port screen (M5) |
| port dock | normal price | evening × 1.5, closed at night | port screen (M5) |

### 10.3 Picture

- A colour layer over the sea and islands: morning pink-gold, day none, evening orange → blue, night dark blue at 60%.
- Lanterns: 1–2 bright dots per ship (unless doused), port lights, a glint on the water. A broadside flash is brighter at night.
- Fog bands darker at night.

### 10.4 Provisions and the day

With a 12-minute day, a "30-day" store is 6 real hours. Proposal for M5: a ship carries at most **10 days** (2 hours at ×1, 15 minutes at ×8), checked in fun check 2: provisions must create decisions, not chores.

---

## 11. Ideas from the test of 18 Nov (after M3 step 4)

What went into step 4b at once (fixes of step 4): controls lock when sunk, damage slows more, bar icons, ball colours, a bigger touch minimap with a view box. The rest, with recommendations:

| Idea | Recommendation | When |
|---|---|---|
| **Finishing shot in safe water.** A chaser may follow a nearly sunk enemy into a port's safe water | **Built 19 Nov (M3 step 5).** Decide by numbers plus a roll: can one or two broadsides sink it (hull left against expected damage of the loaded shot, both sides)? Then a personal chance (bold bots more often; "irrational" now and then) — and right after, leave the 450 m law range and keep away about 45 s. The price (2% hull, shore guns) stays, so it is a gamble, not a free kill | Next M3 bot step |
| **Port capacity.** Bots get stuck at the berths | **Built 19 Nov (M3 step 5).** A number of berths per port (small port fewer). A bot that sees them full waits in the port's safe water where it is open and deep, then takes its turn. Fewer piles, fewer groundings (the log showed 2-minute pushes at Empty Barrel Land) | Next M3 bot step |
| **Detail by distance.** Up to 200 m hull, sails and crew; 200–450 m one bar; beyond, nothing | Fits perception (section 9) exactly: the 200 m level = "silhouette+", 450 m = "contact". Bots read the same levels, so it stays honest | M4b |
| **National flags** next to the bar, up to 400 m; random nations for bots now | A flag is contact level 3 (section 9.1). Random nations are cheap and add colour; what nations mean (wars, allies, letters of marque) needs M5 ports and Stage 2 | Flag picture M4b, meaning M5+ |
| **Damage on the ship picture** (torn sails, battered hull) | 2–3 damage levels as extra frames from `render_ship.py`; picked by sail and hull share. More frames = bigger sheets, so first test on the iPhone | M5 (or an art step) |
| **Random island placement** (small at random, large moved a little) | Must keep: open water around ports, no closed passages, every place reachable, the reef free; check with the seed and a headless "reach every port" test | M5 world generation |

---

## 12. Ideas of 19 Nov: traders, fear, squadrons, skills (D52–D54)

What is in M3 now: the fluyt and the caravel (7a), crew spirit and running (7b), bot skills drawn at birth (7c), bars and flags in battle (7d). The rest waits here, by milestone:

- **M4b, with sight:** default routes chosen at birth (island to island, port to port, not always the shortest); renegades who hunt over the whole map; false flags (a pirate comes under another flag and hoists the black one late; a trader's fear check at that moment).
- **M4:** striking the colours: a frightened trader heaves to and surrenders, and the boarding takes the prize; high sides make boarding harder (the caravel).
- **Squadrons (new milestone after M4b):** pairs and packs; loners chosen at birth; escorts that take a trader and guard her along her route.
- **M5:** the value of the cargo: thrown over the side to run faster, it is gold lost for the pirate; a Spanish silver galleon as a rare, rich, well-armed prize.
- **M6:** skills that grow with time, for bots as for you.
- History notes behind D52: Atlantic merchant ships of the late 17th century were mostly small; pirates carried 2–3 times more men per ton than merchants; a fluyt could be sailed by 10–12 men; caravels had mostly gone out of use by our period (we keep one as an old-fashioned trader); merchant crews often surrendered without a fight, and an English law of 1721 punished those who did not defend their ship.

## 13. Ideas of 19 Nov (late): fire, islands

- **Setting a ship on fire** (developer's idea). History: heated shot (balls heated red in a furnace, mostly from shore batteries), fire pots and fireships (an old ship filled with tar and powder, sailed into an enemy fleet). First version, simple: a hit has a small chance to start a fire (more for heated shot from shore guns); a fire burns hull and sails each second until the crew puts it out (the more men, the faster); a fire near the powder can blow the ship up. Bots fear a burning ship nearby. Later: fireships as a tactic; fire spreads to ships alongside. Suggested: after M4 (it needs crew work and morale), a small step of its own.
- **Islands with more objects** (developer's idea): rocks, cliffs, forts, villages, wrecks on the shore, lighthouses, palm groves; tall ones (cliffs, forts, a church) as terrain heights that stop balls (D56). Suggested: with the new map in M3b, where islands are drawn from the mockup.

## 14. Idea of 23 Nov: your route on the chart (D73, M3b step 1)

Set up to 4 points on the chart; the ship follows them by itself. **First version:** straight legs from the ship to point 1, 2, 3, 4; a fifth point wipes the oldest; the autopilot steers only (sails are yours) and stops when you touch the rudder; against a headwind it beats in tacks at any moment of the route (the wind shifts) and says so on the screen (`HEADWIND - TACKING` next to `AUTO`); no avoidance: land and shoals stop the ship by the usual rules. **Later:** a way round islands and shoals on the M3b navigation grid; stop when an enemy is sighted; time acceleration on long passages (M5); routes in saves (M6).

## 15. Ideas of 24 Nov: goals in Solo, sail colours, renegades and false flags

- **A goal in Solo** (D77): each battle gets a random goal: sink the pirate <name>, or sink 3 ships; a banner when done. Later (after M3b, more ports): carry cargo or a passenger from port A to port B without losing it.
- **Sail colours** (D78): history: sails were undyed linen or hemp, cream when new, grey-brown when old, often patched; navies showed who they were by flags, the long pennant and the hull's paint, not by sail colour; tanned red-brown sails on fishing and small coastal craft; black pirate sails are mostly legend (a pirate wanted to look like a merchant until the last moment). Plan: sails as a separate white sheet from `render_ship.py`, coloured in the game (`setTint`): one more picture per ship, any number of colours; 2-3 patterned sheets per class later. Rare black sails only as a game mark of a "legend" pirate (the developer's choice). Better hulls (a pear-shaped fluyt, a high caravel) in M8; the galleon in Stage 2.
- **Renegades and false flags** (the developer's answers, for step 5b-2): a renegade (hunts anyone, across the map) is (1) an offender of a port's law, (2) the bot with the most rams; at least one bot of a battle or arena is a pirate by lot. A bot that has sunk nobody in 10 minutes (alive) may, by chance, change its flag (and at a rebirth). The player sees a renegade by its flag and black sails. **Confirmed 24 Nov (night):** black sails give a false flag away, so: a pirate under a false flag keeps ordinary sails and hoists the black flag at about 300 m; black sails only for renegades who no longer hide.

## History

| Date | What |
|---|---|
| 17 Nov 2026 | First version: the developer's ideas 1–9 and 11, conclusions and order |
| 17 Nov 2026 (late) | The developer's answers: a 12-minute day (D42), perception as M4b (D41), item 10 (surrender, breaking a contract); detailed plans for M4b and day and night (sections 8–10) |
| 18 Nov 2026 | Ideas from the test of step 4 (section 11): finishing shot, port capacity, detail by distance, flags, damage pictures, island placement |
| 19 Nov 2026 | Section 12: traders, fear, squadrons, skills; staged by D52–D54 |
| 19 Nov 2026 (late) | Section 13: fire, island objects |
| 23 Nov 2026 | Section 14: your route on the chart (D73) |
| 24 Nov 2026 | Section 15: goal in Solo, sail colours, renegades and false flags (D77, D78, step 5b-2) |
