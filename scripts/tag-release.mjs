// Called by changesets/action as the `publish` step.
// Creates a git tag for the current package.json version, which triggers release.yml.
import { execSync } from "child_process";
import { readFileSync } from "fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${version}`;

// Check remote first — if the tag already exists there this is a re-run, do nothing.
// Skipping the local tag creation is important: the `Detect release tag` step in CI
// reads `git tag --list` to decide whether to trigger platform builds, so creating a
// local tag on a re-run would incorrectly fire the full build pipeline again.
try {
  execSync(`git ls-remote --exit-code --tags origin refs/tags/${tag}`, { stdio: "pipe" });
  console.log(`tag ${tag} already exists on remote, skipping`);
  process.exit(0);
} catch {
  // Tag doesn't exist on remote — create and push it.
}

execSync(`git tag ${tag}`, { stdio: "inherit" });
execSync(`git push origin ${tag}`, { stdio: "inherit" });
console.log(`tagged ${tag}`);
