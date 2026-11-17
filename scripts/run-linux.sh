#!/usr/bin/env bash
# Naval Battles on a Linux server. From the repository root:
#   bash scripts/run-linux.sh dev       dev server with live reload    -> http://<server>:5173
#   bash scripts/run-linux.sh preview   build, then serve the built game -> http://<server>:4173
#   bash scripts/run-linux.sh test      unit tests and the build only
#   bash scripts/run-linux.sh update    git pull, packages, islands, tests
# Open the address from any computer, iPad or iPhone in the same network.
# To keep it running after you log out, start it inside tmux:  tmux new -s naval
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
mode="${1:-dev}"
address=$(hostname -I 2>/dev/null | awk '{print $1}')

case "$mode" in
  dev)
    echo "== Open http://${address:-<server>}:5173 (Ctrl+C stops)"
    cd client && npx vite --host 0.0.0.0 --port 5173
    ;;
  preview)
    (cd client && npm run build)
    echo "== Open http://${address:-<server>}:4173 (Ctrl+C stops)"
    cd client && npx vite preview --host 0.0.0.0 --port 4173
    ;;
  test)
    cd client && npm test && npm run build
    ;;
  update)
    git pull
    (cd client && npm ci)
    uv run --with numpy --with pillow tools/make_islands.py
    (cd client && npm test)
    ;;
  *)
    echo "Use: bash scripts/run-linux.sh dev | preview | test | update" >&2
    exit 1
    ;;
esac
