#!/usr/bin/env bash
# Preseed every Linux helper that Tauri would otherwise download from mutable URLs.

set -Eeuo pipefail
IFS=$'\n\t'

readonly TOOL_DIR="${XDG_CACHE_HOME:-${HOME}/.cache}/tauri"

log() {
  printf '[prepare-tauri-linux-tools] %s\n' "$*"
}

die() {
  printf '[prepare-tauri-linux-tools] ERROR: %s\n' "$*" >&2
  exit 1
}

install_verified() {
  local name="$1"
  local url="$2"
  local expected_sha="$3"
  local destination="$TOOL_DIR/$name"
  local temporary actual_sha

  if [[ -f "$destination" ]]; then
    actual_sha="$(sha256sum "$destination" | awk '{print $1}')"
    if [[ "$actual_sha" == "$expected_sha" ]]; then
      chmod +x "$destination"
      log "verified cached $name"
      return
    fi
  fi

  temporary="$(mktemp "$TOOL_DIR/.${name}.XXXXXX")"
  curl --fail --location --retry 3 --retry-all-errors --silent --show-error \
    --header "Accept: application/octet-stream" \
    --header "X-GitHub-Api-Version: 2022-11-28" \
    "$url" --output "$temporary"
  actual_sha="$(sha256sum "$temporary" | awk '{print $1}')"
  [[ "$actual_sha" == "$expected_sha" ]] \
    || die "checksum mismatch for $name: expected $expected_sha, got $actual_sha"
  chmod +x "$temporary"
  mv -f "$temporary" "$destination"
  log "installed verified $name"
}

main() {
  command -v curl >/dev/null 2>&1 || die "curl is required"
  command -v sha256sum >/dev/null 2>&1 || die "sha256sum is required"
  mkdir -p "$TOOL_DIR"

  install_verified \
    "AppRun-x86_64" \
    "https://api.github.com/repos/tauri-apps/binary-releases/releases/assets/274691722" \
    "f30140a43a0a59e46db21bdefdf749b9e9f2c6946e92afabbacf98b8ae73fb4f"
  install_verified \
    "linuxdeploy-x86_64.AppImage" \
    "https://api.github.com/repos/tauri-apps/binary-releases/releases/assets/182515537" \
    "e762bea85c8eb0d4b3508d46e5c1f037f717d0f9303ae3b4aafc8b04991fa1ef"
  install_verified \
    "linuxdeploy-plugin-gtk.sh" \
    "https://raw.githubusercontent.com/tauri-apps/linuxdeploy-plugin-gtk/b5eb8d05b4c0ed40107fe2158c5d8527f94568ef/linuxdeploy-plugin-gtk.sh" \
    "cb379f9b0733e9ad9f8bd78f8c2fa038aef2478523bb7d4c8e64ff6a1ea3501a"
  install_verified \
    "linuxdeploy-plugin-gstreamer.sh" \
    "https://raw.githubusercontent.com/tauri-apps/linuxdeploy-plugin-gstreamer/2a2e67491c32995a3f279ad0ecbe77abd512b42a/linuxdeploy-plugin-gstreamer.sh" \
    "c107b49d84edbffc6ab226ed1007e0626a4f7aa2c3a36b7782bef62351d49e94"
  install_verified \
    "linuxdeploy-plugin-appimage.AppImage" \
    "https://api.github.com/repos/linuxdeploy/linuxdeploy-plugin-appimage/releases/assets/462804774" \
    "1da16a46fa5e058ae740e7c35ed0d36d86cb869ac9cc8a5fd9a1847d7978d99a"
}

main "$@"
