#!/usr/bin/env bash
# Validate Linux release bundles before they are uploaded or published.
#
# Usage:
#   scripts/validate-linux-bundles.sh [bundle-dir] [expected-version]
#
# Set REQUIRE_SIGNATURES=1 after updater artifacts are signed.

set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly BUNDLE_DIR="${1:-$REPO_ROOT/src-tauri/target/release/bundle}"
readonly EXPECTED_VERSION="${2:-$(node -p "require('$REPO_ROOT/package.json').version")}"
readonly REQUIRE_SIGNATURES="${REQUIRE_SIGNATURES:-0}"

log() {
  printf '[validate-linux-bundles] %s\n' "$*"
}

die() {
  printf '[validate-linux-bundles] ERROR: %s\n' "$*" >&2
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

  mapfile -t matches < <(find "$directory" -maxdepth 1 -type f -name "$pattern" -print 2>/dev/null | sort)
  [[ ${#matches[@]} -eq 1 ]] \
    || die "expected exactly one $description in $directory, found ${#matches[@]}"
  printf '%s\n' "${matches[0]}"
}

assert_contains() {
  local value="$1"
  local pattern="$2"
  local description="$3"
  grep -Eqi "$pattern" <<<"$value" || die "$description does not match /$pattern/: $value"
}

validate_signature() {
  local artifact="$1"
  if [[ "$REQUIRE_SIGNATURES" == "1" ]]; then
    [[ -s "${artifact}.sig" ]] || die "missing or empty updater signature: ${artifact}.sig"
  fi
}

validate_appstream_source() {
  python3 - "$REPO_ROOT/packaging/linux/com.qubic.glyph.metainfo.xml" <<'PY'
import sys
import xml.etree.ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
if root.tag != "component" or root.attrib.get("type") != "desktop-application":
    raise SystemExit("invalid AppStream component type")
if root.findtext("id") != "com.qubic.glyph":
    raise SystemExit("invalid AppStream component id")
launchable = root.find("launchable")
if launchable is None or launchable.attrib.get("type") != "desktop-id" or launchable.text != "Glyph.desktop":
    raise SystemExit("invalid AppStream desktop launchable")
PY
}

validate_deb() {
  local deb="$1"
  local package version architecture depends workdir binary needed desktop icon_name appstream

  package="$(dpkg-deb -f "$deb" Package)"
  version="$(dpkg-deb -f "$deb" Version)"
  architecture="$(dpkg-deb -f "$deb" Architecture)"
  depends="$(dpkg-deb -f "$deb" Depends)"

  [[ "$package" == "glyph" ]] || die "unexpected deb package name: $package"
  [[ "$version" == "$EXPECTED_VERSION" ]] || die "deb version is $version, expected $EXPECTED_VERSION"
  [[ "$architecture" == "amd64" ]] || die "deb architecture is $architecture, expected amd64"
  assert_contains "$depends" 'libwebkit2gtk-4[.]1-0' "deb dependencies"
  assert_contains "$depends" 'libgtk-3-0' "deb dependencies"
  assert_contains "$depends" '(libappindicator3-1|libayatana-appindicator3-1)' "deb dependencies"
  assert_contains "$depends" 'libdbus-1-3' "deb dependencies"

  workdir="$(mktemp -d)"
  dpkg-deb -x "$deb" "$workdir"
  binary="$workdir/usr/bin/glyph-wallet"
  [[ -x "$binary" ]] || die "deb does not contain an executable glyph-wallet binary"
  needed="$(readelf -d "$binary" | awk '/NEEDED/ { print $NF }')"
  assert_contains "$needed" 'libwebkit2gtk-4[.]1[.]so[.]0' "deb binary linkage"
  assert_contains "$needed" 'libdbus-1[.]so[.]3' "deb binary linkage"
  desktop="$(find_one 'desktop entry' "$workdir/usr/share/applications" '*.desktop')"
  icon_name="$(awk -F= '$1 == "Icon" { print $2; exit }' "$desktop")"
  [[ -n "$icon_name" ]] || die "deb desktop entry has no Icon value"
  find "$workdir/usr/share/icons" -type f -name "${icon_name}.png" -print -quit | grep -q . \
    || die "deb desktop icon does not resolve: $icon_name"
  appstream="$workdir/usr/share/metainfo/com.qubic.glyph.metainfo.xml"
  [[ -f "$appstream" ]] || die "deb is missing AppStream metadata"
  cmp -s "$REPO_ROOT/packaging/linux/com.qubic.glyph.metainfo.xml" "$appstream" \
    || die "deb AppStream metadata differs from the repository source"
  rm -rf "$workdir"

  log "deb metadata and linkage validated: $(basename "$deb")"
}

validate_rpm() {
  local rpm_file="$1"
  local version architecture requires contents

  require_command rpm
  version="$(rpm -qp --queryformat '%{VERSION}' "$rpm_file")"
  architecture="$(rpm -qp --queryformat '%{ARCH}' "$rpm_file")"
  requires="$(rpm -qp --requires "$rpm_file")"
  contents="$(rpm -qpl "$rpm_file")"

  [[ "$version" == "$EXPECTED_VERSION" ]] || die "rpm version is $version, expected $EXPECTED_VERSION"
  [[ "$architecture" == "x86_64" ]] || die "rpm architecture is $architecture, expected x86_64"
  assert_contains "$requires" '(webkit2gtk|libwebkit2gtk)' "rpm requirements"
  assert_contains "$requires" '(gtk3|libgtk-3)' "rpm requirements"
  assert_contains "$contents" '/usr/share/metainfo/com[.]qubic[.]glyph[.]metainfo[.]xml' "rpm contents"

  log "rpm metadata validated: $(basename "$rpm_file")"
}

validate_appimage() {
  local appimage
  local workdir appdir helper library desktop icon_name

  appimage="$(realpath "$1")"

  workdir="$(mktemp -d)"
  (
    cd "$workdir"
    APPIMAGE_EXTRACT_AND_RUN=1 "$appimage" --appimage-extract >/dev/null
  )
  appdir="$workdir/squashfs-root"

  [[ -x "$appdir/AppRun" ]] || die "AppImage AppRun is missing or not executable"
  [[ -x "$appdir/AppRun.wrapped" ]] || die "AppImage AppRun.wrapped is missing"
  [[ -f "$appdir/.DirIcon" ]] || die "AppImage .DirIcon is missing"
  [[ -d "$appdir/apprun-hooks" ]] || die "AppImage linuxdeploy hooks are missing"
  cmp -s "$REPO_ROOT/src-tauri/linux/AppRun" "$appdir/AppRun" \
    || die "AppImage does not contain the repository's canonical AppRun"
  desktop="$(find_one 'desktop entry' "$appdir/usr/share/applications" '*.desktop')"
  icon_name="$(awk -F= '$1 == "Icon" { print $2; exit }' "$desktop")"
  [[ -f "$appdir/${icon_name}.png" ]] || die "AppImage root icon does not resolve: $icon_name"
  [[ -f "$appdir/usr/share/metainfo/com.qubic.glyph.metainfo.xml" ]] \
    || die "AppImage is missing AppStream metadata"
  cmp -s "$REPO_ROOT/packaging/linux/com.qubic.glyph.metainfo.xml" "$appdir/usr/share/metainfo/com.qubic.glyph.metainfo.xml" \
    || die "AppImage AppStream metadata differs from the repository source"

  for helper in WebKitNetworkProcess WebKitWebProcess; do
    find "$appdir/usr/lib" -type f -path "*/webkit2gtk-4.1/$helper" -perm /111 -print -quit | grep -q . \
      || die "AppImage is missing WebKit helper: $helper"
  done

  for library in libwebkit2gtk-4.1.so.0 libjavascriptcoregtk-4.1.so.0 libsoup-3.0.so.0 libgtk-3.so.0; do
    find "$appdir/usr/lib" -type f -name "${library}*" -print -quit | grep -q . \
      || die "AppImage is missing bundled library: $library"
  done

  for library in libEGL.so libEGL_mesa.so libGL.so libGLdispatch.so libGLX.so libGLX_mesa.so libgbm.so libdrm.so; do
    if find "$appdir/usr/lib" -maxdepth 1 \( -type f -o -type l \) -name "${library}*" -print -quit | grep -q .; then
      die "AppImage incorrectly bundles host graphics library: $library"
    fi
  done

  rm -rf "$workdir"
  validate_signature "$appimage"
  log "AppImage contents validated: $(basename "$appimage")"
}

main() {
  local deb rpm_file appimage

  require_command cmp
  require_command dpkg-deb
  require_command find
  require_command node
  require_command python3
  require_command readelf
  require_command realpath

  [[ -d "$BUNDLE_DIR" ]] || die "bundle directory not found: $BUNDLE_DIR"
  validate_appstream_source
  deb="$(find_one 'Debian package' "$BUNDLE_DIR/deb" '*.deb')"
  rpm_file="$(find_one 'RPM package' "$BUNDLE_DIR/rpm" '*.rpm')"
  appimage="$(find_one 'AppImage' "$BUNDLE_DIR/appimage" '*.AppImage')"

  validate_deb "$deb"
  validate_rpm "$rpm_file"
  validate_appimage "$appimage"
  log "all Linux bundles passed validation for version $EXPECTED_VERSION"
}

main "$@"
