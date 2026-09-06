#!/usr/bin/env bash
# Run the executable Tauri lock/approval/callback/replay smoke path.
#
# Prerequisites:
#   cargo install tauri-driver --locked
#   A debug wallet and sibling link broker, plus a seeded locked profile.
#
# Required environment:
#   TAURI_E2E_REQUEST_URL  A valid glyph:// URL with dapp name Glyph E2E.
#   TAURI_E2E_PASSWORD     Password for the seeded locked profile.
#
# Optional environment:
#   TAURI_E2E_APP           Wallet executable path.
#   TAURI_E2E_BROKER        Sibling glyph-link-broker path.
#   TAURI_E2E_DRIVER_PORT   WebDriver port, default 4444.
#   TAURI_E2E_EXPECT_LOCKED Set to 0 only for a pre-unlocked profile.

set -Eeuo pipefail
IFS=$'\n\t'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly PORT="${TAURI_E2E_DRIVER_PORT:-4444}"
readonly APP="${TAURI_E2E_APP:-$REPO_ROOT/src-tauri/target/debug/glyph-wallet}"
readonly BROKER="${TAURI_E2E_BROKER:-$REPO_ROOT/src-tauri/target/debug/glyph-link-broker}"

fail() {
  printf '[tauri-e2e] ERROR: %s\n' "$*" >&2
  exit 1
}

command -v tauri-driver >/dev/null 2>&1 || fail "tauri-driver is required (cargo install tauri-driver --locked)"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v node >/dev/null 2>&1 || fail "node is required"
[[ -x "$APP" ]] || fail "wallet executable is missing or not executable: $APP"
[[ -x "$BROKER" ]] || fail "link broker is missing or not executable: $BROKER"
[[ -n "${TAURI_E2E_REQUEST_URL:-}" ]] || fail "TAURI_E2E_REQUEST_URL is required"

cleanup() {
  if [[ -n "${DRIVER_PID:-}" ]]; then
    kill "$DRIVER_PID" 2>/dev/null || true
    wait "$DRIVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

tauri-driver --port "$PORT" >"${TMPDIR:-/tmp}/glyph-tauri-driver.$$.log" 2>&1 &
DRIVER_PID=$!
for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:$PORT/status" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
curl -fsS "http://127.0.0.1:$PORT/status" >/dev/null \
  || fail "tauri-driver did not become ready on port $PORT"

password_args=()
if [[ -n "${TAURI_E2E_PASSWORD:-}" ]]; then
  password_args=(--password "$TAURI_E2E_PASSWORD")
fi

node "$REPO_ROOT/scripts/tauri-e2e-smoke.mjs" \
  --driver-url "http://127.0.0.1:$PORT" \
  --app "$APP" \
  --broker "$BROKER" \
  --request-url "$TAURI_E2E_REQUEST_URL" \
  "${password_args[@]}"
