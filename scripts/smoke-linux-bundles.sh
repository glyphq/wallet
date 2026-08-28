#!/usr/bin/env bash
# Launch built Linux bundles with a fresh application profile.
#
# Usage:
#   scripts/smoke-linux-bundles.sh [bundle-dir] [expected-version]
#
# Set SMOKE_TMP_ROOT to keep temporary extraction and profile files outside /tmp.

set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly BUNDLE_DIR="${1:-$REPO_ROOT/src-tauri/target/release/bundle}"
readonly EXPECTED_VERSION="${2:-$(node -p "require('$REPO_ROOT/package.json').version")}" 
readonly SMOKE_TMP_ROOT="${SMOKE_TMP_ROOT:-${TMPDIR:-/tmp}}"
readonly SMOKE_DURATION_SECONDS="${SMOKE_DURATION_SECONDS:-15}"

log() {
  printf '[smoke-linux-bundles] %s\n' "$*"
}

die() {
  printf '[smoke-linux-bundles] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

find_one() {
  local description="$1"
  local directory="$2"
  local pattern="$3"
  local -a matches=()

  mapfile -t matches < <(find "$directory" -maxdepth 1 -type f -name "$pattern" -print | sort)
  [[ ${#matches[@]} -eq 1 ]] \
    || die "expected exactly one $description in $directory, found ${#matches[@]}"
  printf '%s\n' "${matches[0]}"
}

run_gui_smoke() {
  local name="$1"
  local profile="$2"
  shift 2
  local log_file="$WORKDIR/${name}.log"
  local status
  local -a launcher=()

  mkdir -p "$profile/config" "$profile/data" "$profile/cache"
  if command -v xvfb-run >/dev/null 2>&1; then
    launcher=(xvfb-run --auto-servernum)
  elif [[ -z "${DISPLAY:-}" ]]; then
    die "DISPLAY is unset and xvfb-run is unavailable"
  fi

  set +e
  timeout --kill-after=3s "${SMOKE_DURATION_SECONDS}s" \
    "${launcher[@]}" \
    dbus-run-session -- env \
      HOME="$profile" \
      XDG_CONFIG_HOME="$profile/config" \
      XDG_DATA_HOME="$profile/data" \
      XDG_CACHE_HOME="$profile/cache" \
      GDK_BACKEND=x11 \
      "$@" >"$log_file" 2>&1
  status=$?
  set -e

  case "$status" in
    124|137)
      log "$name stayed running for ${SMOKE_DURATION_SECONDS}s with an empty application profile"
      ;;
    *)
      printf '[smoke-linux-bundles] ERROR: %s exited unexpectedly with status %s\n' "$name" "$status" >&2
      cat "$log_file" >&2
      return 1
      ;;
  esac
}

main() {
  local appimage deb package version architecture depends deb_root extract_root

  require_command dbus-run-session
  require_command dpkg-deb
  require_command find
  require_command node
  require_command timeout

  [[ -d "$BUNDLE_DIR" ]] || die "bundle directory not found: $BUNDLE_DIR"
  mkdir -p "$SMOKE_TMP_ROOT"
  WORKDIR="$(mktemp -d "$SMOKE_TMP_ROOT/glyph-linux-bundle-smoke.XXXXXX")"
  readonly WORKDIR
  trap 'rm -rf -- "$WORKDIR"' EXIT

  appimage="$(find_one 'AppImage' "$BUNDLE_DIR/appimage" '*.AppImage')"
  deb="$(find_one 'Debian package' "$BUNDLE_DIR/deb" '*.deb')"
  [[ -x "$appimage" ]] || die "AppImage is not executable: $appimage"

  package="$(dpkg-deb -f "$deb" Package)"
  version="$(dpkg-deb -f "$deb" Version)"
  architecture="$(dpkg-deb -f "$deb" Architecture)"
  depends="$(dpkg-deb -f "$deb" Depends)"
  [[ "$package" == "glyph" ]] || die "unexpected Debian package: $package"
  [[ "$version" == "$EXPECTED_VERSION" ]] || die "Debian package version is $version, expected $EXPECTED_VERSION"
  [[ "$architecture" == "amd64" ]] || die "Debian package architecture is $architecture, expected amd64"
  grep -Eqi 'libwebkit2gtk-4[.]1-0' <<<"$depends" || die "Debian package is missing WebKit runtime dependency"
  grep -Eqi '(libappindicator3-1|libayatana-appindicator3-1)' <<<"$depends" || die "Debian package is missing tray runtime dependency"

  deb_root="$WORKDIR/deb-root"
  dpkg-deb -x "$deb" "$deb_root"
  [[ -x "$deb_root/usr/bin/glyph-wallet" ]] || die "Debian package is missing glyph-wallet"
  [[ -x "$deb_root/usr/bin/glyph-link-broker" ]] || die "Debian package is missing glyph-link-broker"

  extract_root="$WORKDIR/appimage-extract"
  mkdir -p "$extract_root"
  (
    cd "$extract_root"
    TMPDIR="$WORKDIR/appimage-tmp" APPIMAGE_EXTRACT_AND_RUN=1 "$appimage" --appimage-extract >/dev/null
  )
  [[ -x "$extract_root/squashfs-root/AppRun" ]] || die "AppImage is missing AppRun"
  [[ -x "$extract_root/squashfs-root/usr/bin/glyph-wallet" ]] || die "AppImage is missing glyph-wallet"
  [[ -x "$extract_root/squashfs-root/usr/bin/glyph-link-broker" ]] || die "AppImage is missing glyph-link-broker"

  run_gui_smoke "appimage" "$WORKDIR/appimage-profile" \
    TMPDIR="$WORKDIR/appimage-tmp" APPIMAGE_EXTRACT_AND_RUN=1 "$appimage"
  run_gui_smoke "deb" "$WORKDIR/deb-profile" "$deb_root/usr/bin/glyph-wallet"
  log "AppImage and extracted Debian payload started successfully from empty application profiles"
}

main "$@"
