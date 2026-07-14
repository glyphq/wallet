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

// A matching existing tag is a safe workflow retry. An existing tag at any
// other commit is immutable and must never be moved by automation.
const remoteTag = spawnSync(
  "git",
  ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`],
  { encoding: "utf8" },
);
if (remoteTag.status === 0) {
  execFileSync("git", ["fetch", "--force", "origin", `+refs/tags/${tag}:refs/tags/${tag}`], {
    stdio: "pipe",
  });
  const taggedCommit = execFileSync("git", ["rev-list", "-n", "1", tag], {
    encoding: "utf8",
  }).trim();
  const headCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (taggedCommit !== headCommit) {
    throw new Error(`remote tag ${tag} points to ${taggedCommit}, not HEAD ${headCommit}`);
  }
  writeFileSync(".release-requested", `${tag}\n`);
  console.log(`tag ${tag} already exists at HEAD; release can be safely retried`);
  process.exit(0);
}
if (remoteTag.status !== 2) {
  throw new Error(
    `could not determine whether remote tag ${tag} exists: ${remoteTag.stderr.trim() || `git exited ${remoteTag.status}`}`,
  );
}

execFileSync("git", ["tag", "--annotate", tag, "--message", `Glyph ${version}`], {
  stdio: "inherit",
});
execFileSync("git", ["push", "origin", tag], { stdio: "inherit" });
writeFileSync(".release-requested", `${tag}\n`);
console.log(`tagged ${tag}`);
