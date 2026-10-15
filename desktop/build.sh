#!/usr/bin/env bash
# Package ZeroPulse VoiceCraft.
# Windows NSIS is the primary target. This script does not sign the installer.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ bridge dependencies"
(cd "$ROOT/bridge" && npm install --no-audit --no-fund)
echo "→ protocol dependencies"
(cd "$ROOT/packages/protocol" && npm install --no-audit --no-fund)
echo "→ desktop dependencies and renderer"
(cd "$ROOT/desktop" && npm install --no-audit --no-fund && npm run build)

if [[ "${PACKAGE_WIN:-1}" == "1" ]]; then
  (cd "$ROOT/desktop" && npx electron-builder --win nsis --x64)
fi

echo "→ artifacts"
ls -lh "$ROOT/dist-desktop" || true
