#!/usr/bin/env bash
# Patch a Tauri-generated AppImage for portable WebKitGTK startup.
#
# This is the canonical implementation used both locally and in CI. It patches
# one AppImage in place, but writes to a temporary output first so a failed run
# never destroys the original artifact.
#
# Usage:
#   scripts/patch-appimage.sh [path/to/Glyph.AppImage]

set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly TOOL_CACHE_DIR="${XDG_CACHE_HOME:-${HOME}/.cache}/glyph/appimage-tools"

# GitHub release asset IDs are immutable. Checksums provide a second independent
# integrity gate and make every tool update an explicit code review.
readonly APPIMAGETOOL_URL="https://api.github.com/repos/AppImage/AppImageKit/releases/assets/98605504"
readonly APPIMAGETOOL_SHA256="b90f4a8b18967545fda78a445b27680a1642f1ef9488ced28b65398f2be7add2"
readonly GO_APPIMAGETOOL_URL="https://api.github.com/repos/probonopd/go-appimage/releases/assets/440974626"
readonly GO_APPIMAGETOOL_SHA256="376998aba63bb3a35a02ea3196f77268f8543a35a3b6b7db0dc2181365119b62"
PATCH_WORKDIR=""
PATCH_OUTPUT=""

cleanup() {
  if [[ -n "$PATCH_WORKDIR" ]]; then
    rm -rf -- "$PATCH_WORKDIR"
  fi
  if [[ -n "$PATCH_OUTPUT" ]]; then
    rm -f -- "$PATCH_OUTPUT"
  fi
}

trap cleanup EXIT

log() {
  printf '[patch-appimage] %s\n' "$*"
}

die() {
  printf '[patch-appimage] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

verify_sha256() {
  local file="$1"
  local expected="$2"
  local actual
  actual="$(sha256sum "$file" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]]
}

download_verified() {
  local url="$1"
  local expected_sha="$2"
  local destination="$3"
  local temporary

  mkdir -p "$(dirname "$destination")"
  if [[ -f "$destination" ]]; then
    if verify_sha256 "$destination" "$expected_sha" 2>/dev/null; then
      chmod +x "$destination"
      return
    fi
    log "Discarding cached tool with an invalid checksum: $destination"
    rm -f "$destination"
  fi

  temporary="$(mktemp "${destination}.download.XXXXXX")"
  log "Downloading $(basename "$destination")"
  curl --fail --location --retry 3 --retry-all-errors --silent --show-error \
    --header "Accept: application/octet-stream" \
    --header "X-GitHub-Api-Version: 2022-11-28" \
    "$url" --output "$temporary"
  verify_sha256 "$temporary" "$expected_sha" \
    || die "checksum mismatch for downloaded tool: $url"
  chmod +x "$temporary"
  mv -f "$temporary" "$destination"
}

find_single_appimage() {
  local -a matches=()
  mapfile -t matches < <(
    find "$REPO_ROOT/src-tauri/target/release/bundle/appimage" \
      -maxdepth 1 -type f -name '*.AppImage' ! -name '*.sig' -print | sort
  )
  [[ ${#matches[@]} -gt 0 ]] || die "no AppImage found; run 'bun tauri build --bundles appimage' first"
  [[ ${#matches[@]} -eq 1 ]] || die "expected one AppImage, found ${#matches[@]}: ${matches[*]}"
  printf '%s\n' "${matches[0]}"
}

prepare_runtime() {
  local go_tool="$1"
  local runtime_dir="$TOOL_CACHE_DIR/go-appimage-947"
  local runtime="$runtime_dir/usr/bin/runtime-x86_64"
  local extract_dir

  if [[ -x "$runtime" ]]; then
    printf '%s\n' "$runtime"
    return
  fi

  extract_dir="$(mktemp -d)"
  (
    cd "$extract_dir"
    "$go_tool" --appimage-extract >/dev/null
  )
  [[ -x "$extract_dir/squashfs-root/usr/bin/runtime-x86_64" ]] \
    || die "go-appimage archive did not contain runtime-x86_64"
  rm -rf "$runtime_dir"
  mkdir -p "$(dirname "$runtime_dir")"
  mv "$extract_dir/squashfs-root" "$runtime_dir"
  rm -rf "$extract_dir"
  printf '%s\n' "$runtime"
}

copy_webkit_helpers() {
  local appdir="$1"
  local libdir helper_source helper_destination helper

  libdir="$(pkg-config --variable=libdir webkit2gtk-4.1)"
  helper_source="$libdir/webkit2gtk-4.1"
  helper_destination="$appdir/usr/lib/$(basename "$libdir")/webkit2gtk-4.1"
  [[ -d "$helper_source" ]] || die "WebKitGTK helper directory not found: $helper_source"
  mkdir -p "$helper_destination"

  for helper in WebKitNetworkProcess WebKitWebProcess; do
    [[ -x "$helper_source/$helper" ]] || die "required WebKitGTK helper not found: $helper_source/$helper"
    install -m 0755 "$helper_source/$helper" "$helper_destination/$helper"
  done
  if [[ -x "$helper_source/WebKitGPUProcess" ]]; then
    install -m 0755 "$helper_source/WebKitGPUProcess" "$helper_destination/WebKitGPUProcess"
  fi
}

install_dir_icon() {
  local appdir="$1"
  local icon=""

  icon="$(find "$appdir/usr/share/icons" -type f -name '*.png' -path '*/256x256/*' -print -quit 2>/dev/null || true)"
  if [[ -z "$icon" ]]; then
    icon="$(find "$appdir/usr/share/icons" -type f -name '*.png' -path '*/128x128/*' -print -quit 2>/dev/null || true)"
  fi
  [[ -n "$icon" ]] || die "no 128px or 256px application icon found for .DirIcon"
  install -m 0644 "$icon" "$appdir/.DirIcon"
}

install_appstream_metadata() {
  local appdir="$1"
  local desktop metadata_dir

  desktop="$(find "$appdir/usr/share/applications" -maxdepth 1 -type f -name '*.desktop' -print -quit)"
  [[ -n "$desktop" ]] || die "AppImage desktop entry is missing"
  if grep -Eq '^Categories=' "$desktop"; then
    sed -i 's/^Categories=.*/Categories=Office;Finance;/' "$desktop"
  else
    printf '\nCategories=Office;Finance;\n' >> "$desktop"
  fi
  grep -Eq '^Categories=.+;$' "$desktop" || die "AppImage desktop entry has no categories"

  metadata_dir="$appdir/usr/share/metainfo"
  mkdir -p "$metadata_dir"
  find "$metadata_dir" -maxdepth 1 -type f \
    \( -name '*.appdata.xml' -o -name '*.metainfo.xml' \) -delete
  install -m 0644 \
    "$REPO_ROOT/packaging/linux/com.qubic.glyph.metainfo.xml" \
    "$metadata_dir/com.qubic.glyph.metainfo.xml"
}

strip_host_graphics_libraries() {
  local appdir="$1"
  local library
  local -a libraries=(
    libEGL.so libEGL_mesa.so libGL.so libGLdispatch.so libGLX.so
    libGLX_mesa.so libgbm.so libdrm.so
  )

  for library in "${libraries[@]}"; do
    find "$appdir/usr/lib" -maxdepth 1 \( -type f -o -type l \) -name "${library}*" -delete
  done
}

validate_appdir() {
  local appdir="$1"
  local helper library

  [[ -x "$appdir/AppRun" ]] || die "patched AppRun is missing or not executable"
  [[ -x "$appdir/AppRun.wrapped" ]] || die "original AppRun.wrapped is missing"
  [[ -f "$appdir/.DirIcon" ]] || die ".DirIcon is missing"
  [[ -d "$appdir/apprun-hooks" ]] || die "linuxdeploy apprun-hooks are missing"
  cmp -s \
    "$REPO_ROOT/packaging/linux/com.qubic.glyph.metainfo.xml" \
    "$appdir/usr/share/metainfo/com.qubic.glyph.metainfo.xml" \
    || die "AppStream metadata is missing or stale"

  for helper in WebKitNetworkProcess WebKitWebProcess; do
    find "$appdir/usr/lib" -type f -path "*/webkit2gtk-4.1/$helper" -perm /111 -print -quit | grep -q . \
      || die "bundled WebKit helper is missing: $helper"
  done

  for library in libwebkit2gtk-4.1.so.0 libjavascriptcoregtk-4.1.so.0 libsoup-3.0.so.0 libgtk-3.so.0; do
    find "$appdir/usr/lib" -type f -name "${library}*" -print -quit | grep -q . \
      || die "required bundled library is missing: $library"
  done

  for library in libEGL.so libEGL_mesa.so libGL.so libGLdispatch.so libGLX.so libGLX_mesa.so libgbm.so libdrm.so; do
    if find "$appdir/usr/lib" -maxdepth 1 -type f -name "${library}*" -print -quit | grep -q .; then
      die "host graphics library must not be bundled: $library"
    fi
  done
}

main() {
  local input appimagetool go_appimagetool runtime workdir appdir output

  require_command cmp
  require_command curl
  require_command find
  require_command install
  require_command pkg-config
  require_command realpath
  require_command sha256sum

  input="${1:-$(find_single_appimage)}"
  [[ -f "$input" ]] || die "AppImage not found: $input"
  input="$(realpath "$input")"

  appimagetool="$TOOL_CACHE_DIR/appimagetool-b90f4a8b.AppImage"
  go_appimagetool="$TOOL_CACHE_DIR/go-appimagetool-947.AppImage"
  download_verified "$APPIMAGETOOL_URL" "$APPIMAGETOOL_SHA256" "$appimagetool"
  download_verified "$GO_APPIMAGETOOL_URL" "$GO_APPIMAGETOOL_SHA256" "$go_appimagetool"
  runtime="$(prepare_runtime "$go_appimagetool")"

  workdir="$(mktemp -d)"
  output="${input}.patched"
  PATCH_WORKDIR="$workdir"
  PATCH_OUTPUT="$output"

  log "Extracting $(basename "$input")"
  (
    cd "$workdir"
    APPIMAGE_EXTRACT_AND_RUN=1 "$input" --appimage-extract >/dev/null
  )
  appdir="$workdir/squashfs-root"
  [[ -d "$appdir" ]] || die "AppImage extraction did not produce an AppDir"

  install_dir_icon "$appdir"
  install_appstream_metadata "$appdir"
  copy_webkit_helpers "$appdir"
  strip_host_graphics_libraries "$appdir"
  install -m 0755 "$REPO_ROOT/src-tauri/linux/AppRun" "$appdir/AppRun"
  validate_appdir "$appdir"

  rm -f "$output"
  log "Repacking with the pinned FUSE-free runtime"
  ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "$appimagetool" \
    --runtime-file "$runtime" "$appdir" "$output" >/dev/null
  [[ -s "$output" ]] || die "repacked AppImage is empty"
  chmod +x "$output"
  mv -f "$output" "$input"
  PATCH_OUTPUT=""

  log "Patched and validated: $input"
}

main "$@"
