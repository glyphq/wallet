import { readFileSync } from "fs";

const version = process.argv[2];
const changelogPath = process.argv[3] ?? "CHANGELOG.md";

if (!version || !/^\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("usage: node scripts/extract-changelog.mjs <version> [CHANGELOG.md]");
  process.exit(2);
}

const lines = readFileSync(changelogPath, "utf8").split(/\r?\n/);
const heading = `## ${version}`;
const start = lines.findIndex((line) => line.trim() === heading);
if (start === -1) {
  console.error(`missing changelog heading: ${heading}`);
  process.exit(1);
}

const endOffset = lines.slice(start + 1).findIndex((line) => /^##\s+/.test(line));
const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
const body = lines.slice(start + 1, end).join("\n").trim();
if (!body) {
  console.error(`changelog entry is empty: ${heading}`);
  process.exit(1);
}

process.stdout.write(`${body}\n`);
