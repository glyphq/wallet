import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout?.trim() ?? "";
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

const [tag, ...paths] = process.argv.slice(2);
if (!tag || paths.length === 0) {
  console.error("usage: node scripts/upload-release-assets.mjs <tag> <asset> [asset ...]");
  process.exit(2);
}
if (!/^v\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error(`invalid release tag: ${tag}`);
}

const repository = process.env.GITHUB_REPOSITORY;
if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error("GITHUB_REPOSITORY must identify the target owner/repository");
}

const assetJson = run("gh", ["release", "view", tag, "--repo", repository, "--json", "assets,isDraft"]);
const release = JSON.parse(assetJson);
if (!release.isDraft) {
  throw new Error(`release ${tag} is already published; refusing to mutate its assets`);
}
const names = release.assets.map((asset) => asset.name);
if (new Set(names).size !== names.length) {
  throw new Error(`release ${tag} contains duplicate asset names`);
}
const existingNames = new Set(names);
const tempRoot = await mkdtemp(join(tmpdir(), "glyph-release-assets-"));

try {
  for (const path of paths) {
    const name = basename(path);
    if (!existingNames.has(name)) {
      run("gh", ["release", "upload", tag, path, "--repo", repository], { stdio: "inherit" });
      console.log(`[release] uploaded ${name}`);
      continue;
    }

    const downloadDir = join(tempRoot, createHash("sha256").update(name).digest("hex"));
    await mkdir(downloadDir, { recursive: true });
    run("gh", ["release", "download", tag, "--repo", repository, "--pattern", name, "--dir", downloadDir]);
    const remotePath = join(downloadDir, name);
    const [localHash, remoteHash] = await Promise.all([sha256(path), sha256(remotePath)]);
    if (localHash !== remoteHash) {
      throw new Error(`refusing to replace existing draft asset ${name}: local and remote SHA-256 differ`);
    }
    console.log(`[release] existing ${name} is byte-identical; skipping upload`);
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
