// Called by changesets/action as the `publish` step.
// Creates and pushes the current package.json version tag.
import { execFileSync, spawnSync } from "child_process";
import { readFileSync, rmSync, writeFileSync } from "fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (!/^\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`refusing to tag invalid semantic version: ${version}`);
}
const tag = `v${version}`;
writeFileSync(".release-tag", `${tag}\n`);
rmSync(".release-requested", { force: true });

const releaseState = () => {
  const release = spawnSync(
    "gh",
    ["release", "view", tag, "--json", "isDraft", "--jq", ".isDraft"],
    {
      encoding: "utf8",
    }
  );
  if (release.status === 0)
    return release.stdout.trim() === "true" ? "draft" : "published";

  const message = `${release.stdout}\n${release.stderr}`;
  if (/not found|HTTP 404|could not find/i.test(message)) return "missing";
  const detail =
    release.stderr?.trim() ||
    release.error?.message ||
    `gh exited ${release.status}`;
  throw new Error(
    `could not determine whether release ${tag} exists: ${detail}`
  );
};

const requestReleaseIfMutable = (reason) => {
  const state = releaseState();
  if (state === "published") {
    console.log(
      `${reason}; release ${tag} is already published, skipping release dispatch`
    );
    return;
  }
  writeFileSync(".release-requested", `${tag}\n`);
  console.log(
    `${reason}; release ${tag} is ${state}, release can be safely retried`
  );
};

// Existing tags are immutable and must never be moved by automation. If the
// corresponding release is missing or still draft, request a release retry.
// If the release is already published, the current version is already done.
const remoteTag = spawnSync(
  "git",
  ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`],
  { encoding: "utf8" }
);
if (remoteTag.status === 0) {
  execFileSync(
    "git",
    ["fetch", "--force", "origin", `+refs/tags/${tag}:refs/tags/${tag}`],
    {
      stdio: "pipe",
    }
  );
  const taggedCommit = execFileSync("git", ["rev-list", "-n", "1", tag], {
    encoding: "utf8",
  }).trim();
  const headCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (taggedCommit !== headCommit) {
    requestReleaseIfMutable(
      `tag ${tag} already exists at ${taggedCommit}, not HEAD ${headCommit}`
    );
    process.exit(0);
  }
  requestReleaseIfMutable(`tag ${tag} already exists at HEAD`);
  process.exit(0);
}
if (remoteTag.status !== 2) {
  throw new Error(
    `could not determine whether remote tag ${tag} exists: ${
      remoteTag.stderr.trim() || `git exited ${remoteTag.status}`
    }`
  );
}

execFileSync(
  "git",
  ["tag", "--annotate", tag, "--message", `Glyph ${version}`],
  {
    stdio: "inherit",
  }
);
execFileSync("git", ["push", "origin", tag], { stdio: "inherit" });
writeFileSync(".release-requested", `${tag}\n`);
console.log(`tagged ${tag}`);
