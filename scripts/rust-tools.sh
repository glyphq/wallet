#!/usr/bin/env bash
# Local Rust lint/format wrapper. Prefers a rustup-managed cargo so clippy and
# rustfmt match the toolchain pinned in rust-toolchain.toml.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -x "$HOME/.cargo/bin/cargo" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi

case "${1:-lint}" in
  lint)
    exec cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
    ;;
  fix)
    exec cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --fix --allow-dirty
    ;;
  fmt)
    shift || true
    exec cargo fmt --manifest-path src-tauri/Cargo.toml "$@"
    ;;
  *)
    echo "usage: $0 [lint|fix|fmt] [--check]" >&2
    exit 2
    ;;
esac
