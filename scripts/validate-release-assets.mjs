import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const [tag, repository] = process.argv.slice(2);
if (!tag || !repository) {
  console.error("usage: node scripts/validate-release-assets.mjs <tag> <owner/repo>");
  process.exit(2);
}
if (!/^v\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error(`invalid release tag: ${tag}`);
}

const version = tag.slice(1);
const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const updaterPublicKey = process.env.TAURI_UPDATER_PUBLIC_KEY ?? tauriConfig.plugins?.updater?.pubkey;
if (!updaterPublicKey) throw new Error("Tauri updater public key is not configured");
const release = JSON.parse(
  execFileSync(
    "gh",
    ["release", "view", tag, "--repo", repository, "--json", "assets,isDraft,tagName"],
    { encoding: "utf8" },
  ),
);
if (release.tagName !== tag) throw new Error(`release tag mismatch: ${release.tagName}`);
if (!release.isDraft) throw new Error(`release ${tag} is already published; refusing to replace public assets`);

const assets = release.assets;
for (const asset of assets) {
  if (!asset.name || asset.size <= 0) throw new Error(`empty or invalid release asset: ${asset.name}`);
}

const expected = [
  ["Linux AppImage", /\.AppImage$/],
  ["Linux updater signature", /\.AppImage\.sig$/],
  ["Debian package", /\.deb$/],
  ["RPM package", /\.rpm$/],
  ["macOS updater archive", /\.app\.tar\.gz$/],
  ["macOS updater signature", /\.app\.tar\.gz\.sig$/],
  ["macOS disk image", /\.dmg$/],
  ["Windows installer", /\.exe$/],
  ["Windows updater signature", /\.exe\.sig$/],
  ["updater manifest", /^latest\.json$/],
  ["Linux checksums", /^SHA256SUMS-linux\.txt$/],
  ["macOS checksums", /^SHA256SUMS-macos\.txt$/],
  ["Windows checksums", /^SHA256SUMS-windows\.txt$/],
];

for (const [description, pattern] of expected) {
  const matches = assets.filter((asset) => pattern.test(asset.name));
  if (matches.length !== 1) {
    throw new Error(`expected one ${description}, found ${matches.length}`);
  }
}

const versionedAssets = assets.filter((asset) =>
  /\.(AppImage|deb|rpm|dmg|exe)$|\.app\.tar\.gz$/.test(asset.name),
);
for (const asset of versionedAssets) {
  if (!asset.name.includes(version)) {
    throw new Error(`release artifact does not include version ${version}: ${asset.name}`);
  }
}

const workdir = mkdtempSync(join(tmpdir(), "glyph-release-assets-"));
try {
  const download = (filename) => {
    execFileSync(
      "gh",
      [
        "release",
        "download",
        tag,
        "--repo",
        repository,
        "--pattern",
        filename,
        "--dir",
        workdir,
        "--clobber",
      ],
      { stdio: "pipe" },
    );
  };

  download("latest.json");
  const manifest = JSON.parse(readFileSync(join(workdir, "latest.json"), "utf8"));
  if (manifest.version !== version) {
    throw new Error(`updater manifest version is ${manifest.version}, expected ${version}`);
  }
  const platforms = ["windows-x86_64", "darwin-x86_64", "darwin-aarch64", "linux-x86_64"];
  for (const platform of platforms) {
    const entry = manifest.platforms?.[platform];
    if (!entry?.signature || !entry?.url) {
      throw new Error(`updater manifest entry is incomplete: ${platform}`);
    }
    const filename = decodeURIComponent(new URL(entry.url).pathname.split("/").at(-1));
    if (!assets.some((asset) => asset.name === filename)) {
      throw new Error(`updater manifest references a missing asset: ${filename}`);
    }
  }

  const signedArtifacts = [
    assets.find((asset) => /\.AppImage$/.test(asset.name)),
    assets.find((asset) => /\.app\.tar\.gz$/.test(asset.name)),
    assets.find((asset) => /\.exe$/.test(asset.name)),
  ];
  const publicKeyPath = join(workdir, "updater.pub");
  writeFileSync(publicKeyPath, Buffer.from(updaterPublicKey, "base64"));
  for (const asset of signedArtifacts) {
    const signatureName = `${asset.name}.sig`;
    for (const filename of [asset.name, signatureName]) {
      download(filename);
    }
    const encodedSignature = readFileSync(join(workdir, signatureName), "utf8").trim();
    const decodedSignature = encodedSignature.startsWith("untrusted comment:")
      ? Buffer.from(encodedSignature)
      : Buffer.from(encodedSignature, "base64");
    if (!decodedSignature.toString("utf8").startsWith("untrusted comment:")) {
      throw new Error(`invalid Tauri updater signature encoding: ${signatureName}`);
    }
    const minisignSignaturePath = join(workdir, `${signatureName}.minisig`);
    writeFileSync(minisignSignaturePath, decodedSignature);
    execFileSync(
      "minisign",
      [
        "-V",
        "-p",
        publicKeyPath,
        "-m",
        join(workdir, asset.name),
        "-x",
        minisignSignaturePath,
      ],
      { stdio: "pipe" },
    );
  }

  const checksumSets = [
    ["SHA256SUMS-linux.txt", 3],
    ["SHA256SUMS-macos.txt", 2],
    ["SHA256SUMS-windows.txt", 1],
  ];
  for (const [checksumName, expectedEntries] of checksumSets) {
    download(checksumName);
    const checksumPath = join(workdir, checksumName);
    const lines = readFileSync(checksumPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim());
    if (lines.length !== expectedEntries) {
      throw new Error(`${checksumName} has ${lines.length} entries, expected ${expectedEntries}`);
    }
    for (const line of lines) {
      const filename = line.replace(/^[0-9a-fA-F]{64}\s+\*?/, "");
      if (!assets.some((asset) => asset.name === filename)) {
        throw new Error(`${checksumName} references a missing asset: ${filename}`);
      }
      download(filename);
    }
    execFileSync("sha256sum", ["-c", checksumName], { cwd: workdir, stdio: "pipe" });
  }
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

console.log(`validated ${assets.length} draft assets and updater signatures for ${tag}`);
