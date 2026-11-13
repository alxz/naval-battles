# Naval-Battles

Top-down pixel-art naval game in the Age of Sail (Caribbean, 1650–1720). Phaser 4 + TypeScript in the browser, Python FastAPI backend later, iOS through Capacitor.

**Status:** milestone M0 (setup). See `docs/` for the plan.

## Documents

| File | What it is |
|---|---|
| `docs/naval-game-plan-v0.4-en.md` / `-ru.md` | Full project plan (English / Russian) |
| `docs/art-and-tools-guide-v0.2.md` / `-ru.md` | Sprite specifications, art pipeline, tools |
| `docs/project-summary.md` | Short summary to give to any AI assistant |
| `docs/credits.md` | Asset sources and licences |

## Folders

```
client/   Phaser game (created in M0)
server/   Python FastAPI backend (release R6)
tools/    Python helper scripts
docs/     Plans and notes
```

## Working on a new computer

1. Install Git, Node.js (LTS) and Python 3.12+.
2. `git clone https://github.com/<your-username>/naval-battles.git`
3. Read `docs/project-summary.md`.

## Daily routine

- **Start:** `git pull`
- **During:** commit after every working step: `git add .` then `git commit -m "short message"`
- **End:** `git push`

Never switch computers before pushing. Use the same Node.js LTS version on both machines (`node -v`).
