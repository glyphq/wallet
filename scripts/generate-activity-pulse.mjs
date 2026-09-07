import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MONTHS = 12;
const FONT_FAMILY = "Geist, Geist Sans, Inter, ui-sans-serif, system-ui, sans-serif";
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");

function startOfUtcMonth(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`invalid date: ${value}`);
  }

  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(1);
  return date;
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
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

export function monthlyCommitActivity(commits, now = new Date(), months = MONTHS) {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error("months must be a positive integer");
  }

  const currentMonth = startOfUtcMonth(now);
  const firstMonth = new Date(currentMonth);
  firstMonth.setUTCMonth(firstMonth.getUTCMonth() - (months - 1));
  const buckets = Array.from({ length: months }, (_, index) => {
    const start = new Date(firstMonth);
    start.setUTCMonth(start.getUTCMonth() + index);
    return { start, count: 0 };
  });

  for (const commit of commits) {
    const date = new Date(commit?.commit?.author?.date ?? commit?.date ?? "");
    if (Number.isNaN(date.valueOf())) {
      continue;
    }

    const month = startOfUtcMonth(date);
    const index = (month.getUTCFullYear() - firstMonth.getUTCFullYear()) * 12 + month.getUTCMonth() - firstMonth.getUTCMonth();
    if (index >= 0 && index < buckets.length) {
      buckets[index].count += 1;
    }
  }

  return buckets;
}

export function buildActivityPulseSvg(commits, now = new Date()) {
  const buckets = monthlyCommitActivity(commits, now);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const maximum = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const width = 960;
  const height = 220;
  const chartTop = 96;
  const chartHeight = 76;
  const barWidth = 50;
  const chartLeft = 40;
  const chartRight = 32;
  const chartWidth = width - chartLeft - chartRight;
  const gap = (chartWidth - buckets.length * barWidth) / (buckets.length - 1);
  const chartBottom = chartTop + chartHeight;
  const fontFamily = FONT_FAMILY.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const labels = [0, 3, 6, 9, 11]
    .map((index) => {
      const bucket = buckets[index];
      const x = chartLeft + index * (barWidth + gap) + barWidth / 2;
      return `<text x="${x}" y="200" fill="#a3a3a3" font-family="${fontFamily}" font-size="12" text-anchor="middle">${formatMonth(bucket.start)}</text>`;
    })
    .join("\n      ");
  const bars = buckets
    .map((bucket, index) => {
      const barHeight = bucket.count === 0 ? 4 : Math.max(8, Math.round((bucket.count / maximum) * chartHeight));
      const x = chartLeft + index * (barWidth + gap);
      const y = chartBottom - barHeight;
      const fill = index === buckets.length - 1 ? "#ffffff" : "#d4d4d4";
      return `<g>
        <title>${formatMonth(bucket.start)}: ${formatCount(bucket.count, "commit")}</title>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${fill}" />
      </g>`;
    })
    .join("\n      ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Glyph Wallet repository activity</title>
  <desc id="description">${formatCount(total, "commit")} to the main branch over the last 12 months, updated ${formatTimestamp(now)}.</desc>
  <rect width="${width}" height="${height}" rx="12" fill="#171717" />
  <text x="28" y="38" fill="#fafafa" font-family="${fontFamily}" font-size="18" font-weight="700" letter-spacing="-0.25">Repository activity</text>
  <text x="28" y="62" fill="#a3a3a3" font-family="${fontFamily}" font-size="13">${formatCount(total, "commit")} over the last 12 months</text>
  <text x="932" y="38" fill="#a3a3a3" font-family="${fontFamily}" font-size="12" text-anchor="end">Updated ${formatTimestamp(now)}</text>
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
  const firstMonth = monthlyCommitActivity([], now)[0].start;
  const commits = await fetchMainCommits(repository, token, { since: firstMonth, fetchImpl });
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
