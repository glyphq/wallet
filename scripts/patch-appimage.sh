#!/usr/bin/env bash
# Locally reproduce the CI AppImage patching pipeline.
# Run from the repo root after `bun tauri build`.
#
# Usage:
#   bash scripts/patch-appimage.sh [path/to/output.AppImage]
#
# Output defaults to the same path as the input (overwrites in place).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ── Locate the Tauri-built AppImage ─────────────────────────────────────────
INPUT=$(find src-tauri/target/release/bundle/appimage -name "*.AppImage" ! -name "*.sig" | head -1)
if [ -z "$INPUT" ]; then
  echo "No AppImage found — run 'bun tauri build' first." >&2
  exit 1
fi
OUTPUT="${1:-$INPUT}"
echo "Input : $INPUT"
echo "Output: $OUTPUT"

# ── Tools ────────────────────────────────────────────────────────────────────
# AppImageKit appimagetool (stable URL, preserves AppRun)
if [ ! -f /tmp/appimagetool.AppImage ]; then
  echo "Downloading AppImageKit appimagetool..."
  wget -q -O /tmp/appimagetool.AppImage \
    "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
  chmod +x /tmp/appimagetool.AppImage
fi

# go-appimage FUSE-free runtime
if [ ! -d /tmp/go-appimagetool-extracted ]; then
  echo "Downloading go-appimage runtime..."
  TMPAI=$(mktemp /tmp/go-appimagetool-XXXXXX.AppImage)
  gh release download continuous \
    --repo probonopd/go-appimage \
    --pattern "appimagetool-*-x86_64.AppImage" \
    --output "$TMPAI"
  chmod +x "$TMPAI"
  cd /tmp
  "$TMPAI" --appimage-extract
  mv squashfs-root go-appimagetool-extracted
  rm "$TMPAI"
  cd "$REPO_ROOT"
fi
RUNTIME="/tmp/go-appimagetool-extracted/usr/bin/runtime-x86_64"

# ── Extract AppImage ─────────────────────────────────────────────────────────
WORKDIR=$(mktemp -d /tmp/sigil-patch-XXXXXX)
trap 'rm -rf "$WORKDIR"' EXIT
cd "$WORKDIR"

echo "Extracting AppImage..."
APPIMAGE_EXTRACT_AND_RUN=1 "$REPO_ROOT/$INPUT" --appimage-extract

# ── Copy WebKit subprocess helpers ───────────────────────────────────────────
WEBKIT_HELPERS="/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1"
mkdir -p squashfs-root/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1
for exe in WebKitNetworkProcess WebKitWebProcess WebKitWebDriver; do
  if [ -f "${WEBKIT_HELPERS}/${exe}" ]; then
    echo "Copying ${exe}..."
    cp "${WEBKIT_HELPERS}/${exe}" squashfs-root/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/
  else
    echo "WARNING: ${WEBKIT_HELPERS}/${exe} not found — install libwebkit2gtk-4.1-dev"
  fi
done

# ── Strip bundled libs ────────────────────────────────────────────────────────
for lib in \
  libgtk-3.so libgdk-3.so libgio-2.0.so libglib-2.0.so libgobject-2.0.so \
  libgmodule-2.0.so libgthread-2.0.so libgdk_pixbuf-2.0.so \
  libpango-1.0.so libpangocairo-1.0.so libpangoft2-1.0.so \
  libcairo.so libcairo-gobject.so libatk-1.0.so libharfbuzz.so \
  libmount.so libblkid.so \
  libEGL.so libEGL_mesa.so libGL.so libGLdispatch.so \
  libGLX.so libGLX_mesa.so libgbm.so libdrm.so; do
  rm -f squashfs-root/usr/lib/${lib}*
done

# ── Custom AppRun ─────────────────────────────────────────────────────────────
cp "$REPO_ROOT/src-tauri/linux/AppRun" squashfs-root/AppRun
chmod +x squashfs-root/AppRun

# ── Repackage ────────────────────────────────────────────────────────────────
echo "Repackaging..."
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 /tmp/appimagetool.AppImage \
  --runtime-file "$RUNTIME" \
  squashfs-root "$REPO_ROOT/$OUTPUT"

echo ""
echo "Done: $REPO_ROOT/$OUTPUT"
echo "Run with: APPIMAGE_EXTRACT_AND_RUN=1 $REPO_ROOT/$OUTPUT"
echo "  or just: $REPO_ROOT/$OUTPUT  (if FUSE is available)"
