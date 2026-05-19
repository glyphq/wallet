// Called by `bun run version` after `changeset version` bumps package.json.
// Propagates the new version to src-tauri/tauri.conf.json and src-tauri/Cargo.toml.
import { readFileSync, writeFileSync } from "fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

// tauri.conf.json
const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
conf.version = version;
writeFileSync("src-tauri/tauri.conf.json", JSON.stringify(conf, null, 2) + "\n");

// Cargo.toml — replace the first `version = "x.y.z"` line in [package]
let cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
cargo = cargo.replace(/^version = ".*"/m, `version = "${version}"`);
writeFileSync("src-tauri/Cargo.toml", cargo);

console.log(`synced version ${version} → tauri.conf.json + Cargo.toml`);
