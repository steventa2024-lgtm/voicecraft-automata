#!/usr/bin/env bash
# Build the ZeroPulse Companion desktop app (bundles Node via Electron, so
# players never install Node.js themselves).
#
#   ./desktop/build.sh            # Windows x64 + macOS x64
#   PLATFORMS=darwin ARCH=arm64 ./desktop/build.sh
#
# Output: dist-desktop/ZeroPulseCompanion-<platform>-<arch>[.zip]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORMS="${PLATFORMS:-win32,darwin}"
ARCH="${ARCH:-x64}"
STAGE="$ROOT/.desktop-stage"
OUT="$ROOT/dist-desktop"

echo "→ installing bridge dependencies"
(cd "$ROOT/bridge" && npm install --no-audit --no-fund)

echo "→ staging app payload"
rm -rf "$STAGE"; mkdir -p "$STAGE/bridge"
cp "$ROOT/desktop/main.cjs" "$ROOT/desktop/preload.cjs" "$ROOT/desktop/renderer.html" "$ROOT/desktop/package.json" "$STAGE/"
cp "$ROOT"/bridge/*.js "$ROOT/bridge/package.json" "$STAGE/bridge/"
cp -r "$ROOT/bridge/node_modules" "$STAGE/bridge/node_modules"

# minecraft-data ships every Bedrock version too — the bot only speaks Java.
find "$STAGE/bridge/node_modules/minecraft-data/minecraft-data/data/bedrock" \
  -mindepth 1 -maxdepth 1 ! -name common -exec rm -rf {} + 2>/dev/null || true
find "$STAGE/bridge/node_modules" -name "*.md" -delete

echo "→ packaging electron app ($PLATFORMS/$ARCH)"
npm install --no-save --no-audit --no-fund electron @electron/packager
ELECTRON_VERSION="$(node -p "require('electron/package.json').version")"
npx electron-packager "$STAGE" "ZeroPulseCompanion" \
  --platform="$PLATFORMS" --arch="$ARCH" \
  --electron-version="$ELECTRON_VERSION" \
  --app-version=1.0.0 --overwrite --out="$OUT"

echo "→ zipping"
cd "$OUT"
for d in ZeroPulseCompanion-*; do
  [ -d "$d" ] && zip -qr "$d.zip" "$d"
done
ls -lh "$OUT"/*.zip
