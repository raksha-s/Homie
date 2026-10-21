#!/usr/bin/env bash
# Creates homie-source-<date>.zip in the project folder: all code and setup notes, no secrets,
# no node_modules. Unzip it anywhere and follow README.md to host it from any GitHub account.
set -euo pipefail
cd "$(dirname "$0")/.."
out="homie-source-$(date +%Y-%m-%d).zip"
rm -f "$out"
if git rev-parse --git-dir >/dev/null 2>&1; then
  git archive --format=zip --prefix=homie/ -o "$out" HEAD
else
  zip -r "$out" . -x "node_modules/*" "dist/*" ".env" ".env.*" "*.zip" ".git/*" >/dev/null
fi
echo "Backup written to: $(pwd)/$out"
