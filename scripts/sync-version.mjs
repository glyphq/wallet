// Called by `bun run version` after `changeset version` bumps package.json.
// Propagates the new version to every Rust/Tauri source of version truth.
import { readFileSync, writeFileSync } from "fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const checkOnly = process.argv.includes("--check");
const mismatches = [];

// tauri.conf.json
const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
if (conf.version !== version) {
  mismatches.push(`src-tauri/tauri.conf.json (${conf.version})`);
  conf.version = version;
  if (!checkOnly) {
    writeFileSync("src-tauri/tauri.conf.json", JSON.stringify(conf, null, 2) + "\n");
  }
}

// Cargo.toml — replace the first `version = "x.y.z"` line in [package]
let cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoVersion = cargo.match(/^version = "([^"]+)"/m)?.[1];
if (cargoVersion !== version) {
  mismatches.push(`src-tauri/Cargo.toml (${cargoVersion ?? "missing"})`);
  cargo = cargo.replace(/^version = ".*"/m, `version = "${version}"`);
  if (!checkOnly) {
    writeFileSync("src-tauri/Cargo.toml", cargo);
  }
}

// Cargo.lock — keep the root package version committed with the release PR.
let lock = readFileSync("src-tauri/Cargo.lock", "utf8");
const lockPattern = /(\[\[package\]\]\nname = "glyph-wallet"\nversion = ")([^"]+)(")/;
const lockVersion = lock.match(lockPattern)?.[2];
if (lockVersion !== version) {
  mismatches.push(`src-tauri/Cargo.lock (${lockVersion ?? "missing"})`);
  lock = lock.replace(lockPattern, `$1${version}$3`);
  if (!checkOnly) {
    writeFileSync("src-tauri/Cargo.lock", lock);
  }
}

if (checkOnly) {
  if (mismatches.length > 0) {
    console.error(`version ${version} is not synchronized:\n- ${mismatches.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`version ${version} is synchronized across package.json and Tauri/Rust files`);
} else {
  console.log(`synced version ${version} → tauri.conf.json + Cargo.toml + Cargo.lock`);
}
