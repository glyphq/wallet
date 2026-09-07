import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEEKS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");

function startOfUtcWeek(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`invalid date: ${value}`);
  }

  date.setUTCHours(0, 0, 0, 0);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date;
}

function formatWeek(date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatCount(value, noun) {
  return `${value.toLocaleString("en-US")} ${noun}${value === 1 ? "" : "s"}`;
}

export function weeklyCommitActivity(commits, now = new Date(), weeks = WEEKS) {
  if (!Number.isInteger(weeks) || weeks < 1) {
    throw new Error("weeks must be a positive integer");
  }

  const currentWeek = startOfUtcWeek(now);
  const firstWeek = new Date(currentWeek.valueOf() - (weeks - 1) * 7 * DAY_MS);
  const buckets = Array.from({ length: weeks }, (_, index) => {
    const start = new Date(firstWeek.valueOf() + index * 7 * DAY_MS);
    return { start, count: 0 };
  });

  for (const commit of commits) {
    const date = new Date(commit?.commit?.author?.date ?? commit?.date ?? "");
    if (Number.isNaN(date.valueOf())) {
      continue;
    }

    const week = startOfUtcWeek(date);
    const index = Math.round((week.valueOf() - firstWeek.valueOf()) / (7 * DAY_MS));
    if (index >= 0 && index < buckets.length) {
      buckets[index].count += 1;
    }
  }

  return buckets;
}

export function buildActivityPulseSvg(commits, now = new Date()) {
  const buckets = weeklyCommitActivity(commits, now);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const maximum = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const width = 720;
  const height = 196;
  const chartTop = 86;
  const chartHeight = 66;
  const barWidth = 35;
  const gap = 16;
  const chartLeft = 42;
  const chartWidth = buckets.length * barWidth + (buckets.length - 1) * gap;
  const chartBottom = chartTop + chartHeight;
  const labels = [0, 4, 8, 11]
    .map((index) => {
      const bucket = buckets[index];
      const x = chartLeft + index * (barWidth + gap) + barWidth / 2;
      return `<text x="${x}" y="176" fill="#a3a3a3" font-size="11" text-anchor="middle">${formatWeek(bucket.start)}</text>`;
    })
    .join("\n      ");
  const bars = buckets
    .map((bucket, index) => {
      const barHeight = bucket.count === 0 ? 4 : Math.max(8, Math.round((bucket.count / maximum) * chartHeight));
      const x = chartLeft + index * (barWidth + gap);
      const y = chartBottom - barHeight;
      const fill = index === buckets.length - 1 ? "#ffffff" : "#d4d4d4";
      return `<g>
        <title>Week of ${formatWeek(bucket.start)}: ${formatCount(bucket.count, "commit")}</title>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${fill}" />
      </g>`;
    })
    .join("\n      ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Glyph Wallet repository activity</title>
  <desc id="description">${formatCount(total, "commit")} to the main branch over the last 12 weeks, updated ${formatTimestamp(now)}.</desc>
  <rect width="${width}" height="${height}" rx="12" fill="#171717" />
  <text x="28" y="34" fill="#fafafa" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16" font-weight="700">Repository activity</text>
  <text x="28" y="56" fill="#a3a3a3" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12">${formatCount(total, "commit")} over the last 12 weeks</text>
  <text x="692" y="34" fill="#a3a3a3" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" text-anchor="end">Updated ${formatTimestamp(now)}</text>
  <line x1="${chartLeft}" y1="${chartBottom}" x2="${chartLeft + chartWidth}" y2="${chartBottom}" stroke="#404040" stroke-width="1" />
      ${bars}
      ${labels}
</svg>
`;
}

export async function fetchMainCommits(repository, token, { since, fetchImpl = fetch } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error("GH_REPO must use the owner/repository format");
  }
  if (!token) {
    throw new Error("GH_TOKEN is required to fetch repository activity");
  }

  const sinceDate = since === undefined ? undefined : new Date(since);
  if (sinceDate && Number.isNaN(sinceDate.valueOf())) {
    throw new Error("since must be a valid date");
  }

  const commits = [];
  for (let page = 1; page <= 100; page += 1) {
    const query = new URLSearchParams({ sha: "main", per_page: "100", page: String(page) });
    if (sinceDate) {
      query.set("since", sinceDate.toISOString());
    }
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/commits?${query}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "glyph-wallet-activity-pulse",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    const pageCommits = await response.json();
    if (!Array.isArray(pageCommits)) {
      throw new Error("GitHub API returned an unexpected commits response");
    }
    commits.push(...pageCommits);
    if (pageCommits.length < 100) {
      return commits;
    }
  }

  throw new Error("GitHub API returned more than 10,000 commits for the activity window");
}

export async function main({
  repository = process.env.GH_REPO,
  token = process.env.GH_TOKEN,
  output = process.env.ACTIVITY_PULSE_OUTPUT ?? "docs/assets/activity-pulse.svg",
  now = new Date(),
  fetchImpl = fetch,
} = {}) {
  const firstWeek = weeklyCommitActivity([], now)[0].start;
  const commits = await fetchMainCommits(repository, token, { since: firstWeek, fetchImpl });
  const outputPath = resolve(repositoryRoot, output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildActivityPulseSvg(commits, now), "utf8");
  process.stdout.write(`wrote ${outputPath}\n`);
}

if (process.argv[1] === scriptPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
