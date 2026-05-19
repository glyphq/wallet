// Called by changesets/action as the `publish` step.
// Creates a git tag for the current package.json version, which triggers release.yml.
import { execSync } from "child_process";
import { readFileSync } from "fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${version}`;

try {
  execSync(`git tag ${tag}`, { stdio: "inherit" });
  execSync(`git push origin ${tag}`, { stdio: "inherit" });
  console.log(`tagged ${tag}`);
} catch {
  // Tag already exists — re-run of the publish step, safe to ignore
  console.log(`tag ${tag} already exists, skipping`);
}
