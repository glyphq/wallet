import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(repoRoot, "src-tauri");
const profile = process.argv.includes("--debug") ? "debug" : "release";
const target =
  process.env.TAURI_ENV_TARGET_TRIPLE ||
  process.env.CARGO_BUILD_TARGET ||
  execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();

if (!/^[A-Za-z0-9_.-]+$/.test(target)) {
  throw new Error(`invalid Rust target triple: ${target}`);
}

const extension = target.includes("windows") ? ".exe" : "";
const cargoArgs = [
  "build",
  "--manifest-path",
  join(tauriDir, "Cargo.toml"),
  "--bin",
  "glyph-link-broker",
];
if (profile === "release") cargoArgs.push("--release");
if (process.env.TAURI_ENV_TARGET_TRIPLE || process.env.CARGO_BUILD_TARGET) {
  cargoArgs.push("--target", target);
}

execFileSync("cargo", cargoArgs, {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    TAURI_CONFIG: JSON.stringify({ bundle: { externalBin: [] } }),
  },
});

const targetRoot = process.env.CARGO_TARGET_DIR
  ? resolve(repoRoot, process.env.CARGO_TARGET_DIR)
  : join(tauriDir, "target");
const source = join(
  targetRoot,
  process.env.TAURI_ENV_TARGET_TRIPLE || process.env.CARGO_BUILD_TARGET ? target : "",
  profile,
  `glyph-link-broker${extension}`,
);
const destinationDir = join(tauriDir, "binaries");
const destination = join(destinationDir, `glyph-link-broker-${target}${extension}`);

mkdirSync(destinationDir, { recursive: true });
copyFileSync(source, destination);
console.log(`[glyph] prepared ${destination}`);
