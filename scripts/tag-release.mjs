// Called by changesets/action as the `publish` step.
// Creates a git tag for the current package.json version, which triggers release.yml.
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${version}`;

// Check remote first — if the tag already exists this is a re-run, skip.
// We write .tag-created only when we actually publish so the Detect release tag
// step can distinguish a new publish from a re-run (git tag --list includes
// remote tags fetched by actions/checkout fetch-depth:0, so it can't be used).
try {
  execSync(`git ls-remote --exit-code --tags origin refs/tags/${tag}`, { stdio: "pipe" });
  console.log(`tag ${tag} already exists on remote, skipping`);
  process.exit(0);
} catch {
  // Tag doesn't exist on remote — create and push it.
}

execSync(`git tag ${tag}`, { stdio: "inherit" });
execSync(`git push origin ${tag}`, { stdio: "inherit" });
writeFileSync(".tag-created", tag);
console.log(`tagged ${tag}`);
