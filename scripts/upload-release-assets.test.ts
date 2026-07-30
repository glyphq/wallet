import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "glyph-upload-test-"));
  roots.push(root);
  const bin = join(root, "bin");
  const remote = join(root, "remote");
  await mkdir(bin);
  await mkdir(remote);
  const gh = join(bin, "gh");
  await writeFile(gh, `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const remote = process.env.FAKE_REMOTE_DIR;
const names = fs.readdirSync(remote);
if (args[0] === "release" && args[1] === "view") {
  process.stdout.write(JSON.stringify({ assets: names.map((name) => ({ name })) }));
} else if (args[0] === "release" && args[1] === "download") {
  const name = args[args.indexOf("--pattern") + 1];
  const dir = args[args.indexOf("--dir") + 1];
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(remote, name), path.join(dir, name));
} else if (args[0] === "release" && args[1] === "upload") {
  const source = args[3];
  fs.copyFileSync(source, path.join(remote, path.basename(source)));
  fs.appendFileSync(process.env.FAKE_UPLOAD_LOG, path.basename(source) + "\\n");
} else {
  process.exit(9);
}
`);
  await chmod(gh, 0o755);
  return { root, bin, remote, uploadLog: join(root, "uploads.log") };
}

async function runUploader(bin: string, remote: string, uploadLog: string, asset: string) {
  return Bun.spawn(["node", "scripts/upload-release-assets.mjs", "v1.2.3", asset], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      FAKE_REMOTE_DIR: remote,
      FAKE_UPLOAD_LOG: uploadLog,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("immutable release asset uploads", () => {
  test("skips a byte-identical existing asset", async () => {
    const { root, bin, remote, uploadLog } = await fixture();
    const asset = join(root, "artifact.bin");
    await writeFile(asset, "same bytes");
    await writeFile(join(remote, "artifact.bin"), "same bytes");

    const process = await runUploader(bin, remote, uploadLog, asset);
    expect(await process.exited).toBe(0);
    expect(await new Response(process.stdout).text()).toContain("byte-identical");
    expect(await readFile(uploadLog, "utf8").catch(() => "")).toBe("");
  });

  test("refuses to replace an existing asset with different bytes", async () => {
    const { root, bin, remote, uploadLog } = await fixture();
    const asset = join(root, "artifact.bin");
    await writeFile(asset, "new bytes");
    await writeFile(join(remote, "artifact.bin"), "published draft bytes");

    const process = await runUploader(bin, remote, uploadLog, asset);
    expect(await process.exited).not.toBe(0);
    expect(await new Response(process.stderr).text()).toContain("refusing to replace");
    expect(await readFile(join(remote, "artifact.bin"), "utf8")).toBe("published draft bytes");
  });

  test("uploads an asset that does not exist yet", async () => {
    const { root, bin, remote, uploadLog } = await fixture();
    const asset = join(root, "artifact.bin");
    await writeFile(asset, "new bytes");

    const process = await runUploader(bin, remote, uploadLog, asset);
    expect(await process.exited).toBe(0);
    expect(await readFile(join(remote, "artifact.bin"), "utf8")).toBe("new bytes");
    expect(await readFile(uploadLog, "utf8")).toBe("artifact.bin\n");
  });
});
