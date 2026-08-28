#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "$1 is required" >&2; exit 1; }
}

require_command bun
require_command cargo

echo "[security] auditing JavaScript dependencies"
bun audit --audit-level=high

echo "[security] auditing Rust dependencies"
(
  cd src-tauri
  if ! cargo audit --version >/dev/null 2>&1; then
    echo "cargo-audit is required. Install it with:" >&2
    echo "  cargo install cargo-audit --version 0.22.2 --locked" >&2
    exit 1
  fi
  cargo audit --deny warnings
)

echo "[security] checking the locked Rust dependency graph"
cargo check --manifest-path src-tauri/Cargo.toml --locked

echo "[security] all checks passed"
