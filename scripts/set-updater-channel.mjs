import { readFileSync, writeFileSync } from "fs";

const [channel] = process.argv.slice(2);
if (!channel || !["stable", "prerelease"].includes(channel)) {
  console.error("usage: node scripts/set-updater-channel.mjs <stable|prerelease>");
  process.exit(2);
}

const manifestName = channel === "prerelease" ? "latest-prerelease.json" : "latest.json";
const configPath = "src-tauri/tauri.conf.json";
const config = JSON.parse(readFileSync(configPath, "utf8"));
const endpoints = config.plugins?.updater?.endpoints;

if (!Array.isArray(endpoints) || endpoints.length === 0) {
  throw new Error("updater endpoints are not configured in src-tauri/tauri.conf.json");
}

config.plugins.updater.endpoints = endpoints.map((endpoint) =>
  String(endpoint).replace(/latest(?:-prerelease)?\.json$/, manifestName),
);

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`configured updater channel ${channel} -> ${manifestName}`);
