#!/usr/bin/env bash
# Naval Battles: set up a Linux server (Ubuntu 24.04 / 26.04) to run, test and serve the game.
# Run once from the repository root:   bash scripts/setup-linux.sh
# Safe to run again: it skips what is already installed.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Repository: $(pwd)"

# 1. Basic tools.
sudo apt-get update
sudo apt-get install -y git curl unzip ca-certificates

# 2. Node.js 22 or newer (Vite and Vitest need it). Use Ubuntu's package if it is new enough,
#    otherwise the NodeSource package for Node 24 (the current long-term version).
node_major() { node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0; }
if [ "$(node_major)" -lt 22 ]; then
  candidate=$(apt-cache policy nodejs | awk '/Candidate:/ {print $2}' | sed 's/^[0-9]*://; s/\..*//')
  if [ -n "$candidate" ] && [ "$candidate" != "(none)" ] && [ "$candidate" -ge 22 ] 2>/dev/null; then
    sudo apt-get install -y nodejs npm
  else
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
fi
echo "== Node $(node -v), npm $(npm -v)"

# 3. uv (runs the Python tools; it fetches Python 3.13 by itself).
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"
echo "== $(uv --version)"

# 4. The game's packages (exactly the versions in package-lock.json).
(cd client && npm ci)

# 5. Island pictures and the port (writes client/src/data/islands*.json and the PNGs).
uv run --with numpy --with pillow tools/make_islands.py

# 6. Check that everything works.
(cd client && npm test && npm run build)

# 7. Open the game ports in the firewall, if ufw is on (5173 = dev server, 4173 = built game).
if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow 5173/tcp
  sudo ufw allow 4173/tcp
fi

echo
echo "== Done. Start the game with:  bash scripts/run-linux.sh dev   (or: preview, test)"
