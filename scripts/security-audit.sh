#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

command -v bun >/dev/null || { echo "bun is required" >&2; exit 1; }
command -v cargo >/dev/null || { echo "cargo is required" >&2; exit 1; }

echo "[security] auditing JavaScript dependencies"
bun audit --audit-level=high

echo "[security] auditing Rust dependencies"
(
  cd src-tauri
  cargo audit --deny warnings || {
    echo "cargo-audit is required. Install it with:" >&2
    echo "  cargo install cargo-audit --version 0.22.2 --locked" >&2
    exit 1
  }
)

echo "[security] checking the locked Rust dependency graph"
cargo check --manifest-path src-tauri/Cargo.toml --locked

echo "[security] all checks passed"
