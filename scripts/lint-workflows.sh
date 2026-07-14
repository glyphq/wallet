#!/usr/bin/env bash
# Lint release workflows and helper scripts with pinned tooling.

set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly ACTIONLINT_VERSION="1.7.12"
readonly ACTIONLINT_URL="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
readonly ACTIONLINT_SHA256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
readonly CACHE_DIR="${XDG_CACHE_HOME:-${HOME}/.cache}/glyph/actionlint-${ACTIONLINT_VERSION}"
readonly ACTIONLINT="$CACHE_DIR/actionlint"

prepare_actionlint() {
  local archive actual
  if [[ -x "$ACTIONLINT" ]]; then
    return
  fi

  mkdir -p "$CACHE_DIR"
  archive="$(mktemp)"
  curl --fail --location --retry 3 --retry-all-errors --silent --show-error \
    "$ACTIONLINT_URL" --output "$archive"
  actual="$(sha256sum "$archive" | awk '{print $1}')"
  [[ "$actual" == "$ACTIONLINT_SHA256" ]] \
    || { echo "actionlint checksum mismatch" >&2; exit 1; }
  tar -xzf "$archive" -C "$CACHE_DIR" actionlint
  rm -f "$archive"
  chmod +x "$ACTIONLINT"
}

main() {
  cd "$REPO_ROOT"
  prepare_actionlint

  bash -n scripts/*.sh src-tauri/linux/AppRun
  for script in scripts/*.mjs; do
    node --check "$script"
  done

  if command -v shellcheck >/dev/null 2>&1; then
    shellcheck scripts/*.sh src-tauri/linux/AppRun
  else
    echo "[lint-workflows] shellcheck not installed; skipping shell lint" >&2
  fi

  "$ACTIONLINT" -color
}

main "$@"
