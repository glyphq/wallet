#!/usr/bin/env bash
set -euo pipefail

if [[ -f .changeset/pre.json ]]; then
  mode="$(node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(".changeset/pre.json", "utf8")); process.stdout.write(String(data.mode ?? ""));')"
  tag="$(node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(".changeset/pre.json", "utf8")); process.stdout.write(String(data.tag ?? ""));')"

  if [[ "$mode" != "pre" || "$tag" != "prerelease" ]]; then
    echo "Unexpected Changesets pre state: mode=$mode tag=$tag" >&2
    exit 1
  fi
else
  bun run changeset -- pre enter prerelease
fi

bun run changeset -- version
node scripts/sync-version.mjs
