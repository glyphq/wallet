#!/usr/bin/env bash
set -euo pipefail

if [[ "${GITHUB_REF_NAME:-}" == "prerelease" ]]; then
  bun run version:prerelease
else
  bun run version
fi
