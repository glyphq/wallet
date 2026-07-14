#!/usr/bin/env bash
# Build Tauri's latest.json updater manifest from signed draft-release assets.
#
# Usage:
#   scripts/create-updater-manifest.sh <tag> <owner/repo> [output]

set -Eeuo pipefail
IFS=$'\n\t'

readonly TAG="${1:?release tag is required}"
readonly GH_REPO="${2:?GitHub repository (owner/repo) is required}"
readonly OUTPUT="${3:-latest.json}"
MANIFEST_WORKDIR=""

cleanup() {
  if [[ -n "$MANIFEST_WORKDIR" ]]; then
    rm -rf -- "$MANIFEST_WORKDIR"
  fi
}

trap cleanup EXIT

log() {
  printf '[create-updater-manifest] %s\n' "$*"
}

die() {
  printf '[create-updater-manifest] ERROR: %s\n' "$*" >&2
  exit 1
}

find_one() {
  local directory="$1"
  local pattern="$2"
  local description="$3"
  local -a matches=()
  mapfile -t matches < <(find "$directory" -maxdepth 1 -type f -name "$pattern" -print | sort)
  [[ ${#matches[@]} -eq 1 ]] || die "expected one $description, found ${#matches[@]}"
  printf '%s\n' "${matches[0]}"
}

download_signatures() {
  local directory="$1"
  local attempt

  for attempt in 1 2 3 4; do
    rm -f "$directory"/*.sig
    if gh release download "$TAG" --repo "$GH_REPO" --pattern '*.sig' --dir "$directory" --clobber; then
      return
    fi
    [[ $attempt -lt 4 ]] || break
    log "signature download attempt $attempt failed; retrying in 10 seconds"
    sleep 10
  done
  die "could not download updater signatures for $TAG"
}

assert_release_asset() {
  local assets_json="$1"
  local filename="$2"
  jq -e --arg name "$filename" '.[] | select(.name == $name)' <<<"$assets_json" >/dev/null \
    || die "release asset referenced by a signature is missing: $filename"
}

main() {
  local assets_json created_at version base
  local win_sig_file mac_sig_file linux_sig_file
  local win_file mac_file linux_file

  command -v gh >/dev/null 2>&1 || die "gh is required"
  command -v jq >/dev/null 2>&1 || die "jq is required"
  [[ "$TAG" == v* ]] || die "tag must start with v: $TAG"
  version="${TAG#v}"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] \
    || die "tag is not a supported semantic version: $TAG"

  MANIFEST_WORKDIR="$(mktemp -d)"
  download_signatures "$MANIFEST_WORKDIR"

  win_sig_file="$(find_one "$MANIFEST_WORKDIR" '*.exe.sig' 'Windows updater signature')"
  mac_sig_file="$(find_one "$MANIFEST_WORKDIR" '*.app.tar.gz.sig' 'macOS updater signature')"
  linux_sig_file="$(find_one "$MANIFEST_WORKDIR" '*.AppImage.sig' 'Linux updater signature')"
  [[ -s "$win_sig_file" && -s "$mac_sig_file" && -s "$linux_sig_file" ]] \
    || die "one or more updater signatures are empty"

  win_file="$(basename "$win_sig_file" .sig)"
  mac_file="$(basename "$mac_sig_file" .sig)"
  linux_file="$(basename "$linux_sig_file" .sig)"
  assets_json="$(gh release view "$TAG" --repo "$GH_REPO" --json assets --jq '.assets')"
  assert_release_asset "$assets_json" "$win_file"
  assert_release_asset "$assets_json" "$mac_file"
  assert_release_asset "$assets_json" "$linux_file"

  created_at="$(gh release view "$TAG" --repo "$GH_REPO" --json createdAt --jq '.createdAt')"
  base="https://github.com/${GH_REPO}/releases/download/${TAG}"
  jq -n \
    --arg version "$version" \
    --arg pub_date "$created_at" \
    --arg win_sig "$(tr -d '\r\n' < "$win_sig_file")" \
    --arg mac_sig "$(tr -d '\r\n' < "$mac_sig_file")" \
    --arg linux_sig "$(tr -d '\r\n' < "$linux_sig_file")" \
    --arg win_url "${base}/${win_file}" \
    --arg mac_url "${base}/${mac_file}" \
    --arg linux_url "${base}/${linux_file}" \
    '{
      version: $version,
      pub_date: $pub_date,
      platforms: {
        "windows-x86_64": {signature: $win_sig, url: $win_url},
        "darwin-x86_64": {signature: $mac_sig, url: $mac_url},
        "darwin-aarch64": {signature: $mac_sig, url: $mac_url},
        "linux-x86_64": {signature: $linux_sig, url: $linux_url}
      }
    }' > "$OUTPUT"

  jq -e ".version == \"$version\" and (.platforms | length == 4)" "$OUTPUT" >/dev/null
  log "wrote validated updater manifest: $OUTPUT"
}

main
