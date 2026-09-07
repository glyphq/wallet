import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildActivityPulseSvg,
  fetchMainCommits,
  monthlyCommitActivity,
} from "./generate-activity-pulse.mjs";

const now = new Date("2026-09-07T12:00:00.000Z");

function commit(date: string) {
  return { commit: { author: { date } } };
}

describe("monthlyCommitActivity", () => {
  test("groups main commits into twelve UTC calendar months", () => {
    const activity = monthlyCommitActivity(
      [
        commit("2025-10-01T00:00:00.000Z"),
        commit("2026-08-31T23:59:59.000Z"),
        commit("2026-09-07T12:00:00.000Z"),
        commit("not-a-date"),
      ],
      now,
    );

    expect(activity).toHaveLength(12);
    expect(activity[0]).toEqual({ start: new Date("2025-10-01T00:00:00.000Z"), count: 1 });
    expect(activity[11]).toEqual({ start: new Date("2026-09-01T00:00:00.000Z"), count: 1 });
    expect(activity[10]).toEqual({ start: new Date("2026-08-01T00:00:00.000Z"), count: 1 });
  });

  test("keeps activity outside the pulse window out of the graph", () => {
    const activity = monthlyCommitActivity([commit("2025-09-30T23:59:59.000Z")], now);

    expect(activity.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

test("buildActivityPulseSvg renders a self-contained accessible chart", () => {
  const svg = buildActivityPulseSvg([commit("2026-09-07T12:00:00.000Z")], now);

  expect(svg).toContain('role="img"');
  expect(svg).toContain("Glyph Wallet repository activity");
  expect(svg).toContain("1 commit over the last 12 months");
  expect(svg).toContain('font-family="Geist, Geist Sans, Inter, ui-sans-serif, system-ui, sans-serif"');
  expect(svg).toContain('width="960"');
  expect(svg).toContain("Updated Sep 7, 2026");
  expect(svg.match(/<rect /g)).toHaveLength(13);
  expect(svg).not.toContain("<script");
});

describe("fetchMainCommits", () => {
  test("uses the main commit endpoint with GitHub API headers", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const pages = [
      Array.from({ length: 100 }, () => commit("2026-09-07T12:00:00.000Z")),
      [commit("2026-09-06T12:00:00.000Z")],
    ];
    const fetchImpl: typeof fetch = async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify(pages.shift()), { status: 200 });
    };

    await expect(
      fetchMainCommits("glyphq/wallet", "test-token", {
        since: new Date("2025-10-01T00:00:00.000Z"),
        fetchImpl,
      }),
    ).resolves.toHaveLength(101);
    expect(requests).toHaveLength(2);
    for (const [index, request] of requests.entries()) {
      expect(request).toEqual({
        url: `https://api.github.com/repos/glyphq/wallet/commits?sha=main&per_page=100&page=${index + 1}&since=2025-10-01T00%3A00%3A00.000Z`,
        init: {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: "Bearer test-token",
            "User-Agent": "glyph-wallet-activity-pulse",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      });
    }
  });

  test("rejects malformed repositories before making a request", async () => {
    await expect(fetchMainCommits("glyphq/wallet?bad", "test-token")).rejects.toThrow(
      "GH_REPO must use the owner/repository format",
    );
  });
});

test("activity refresh publishes only the generated asset branch", async () => {
  const workflow = await readFile(join(import.meta.dir, "../.github/workflows/activity-pulse.yml"), "utf8");
  const readme = await readFile(join(import.meta.dir, "../README.md"), "utf8");

  expect(workflow).not.toContain("pull_request:");
  expect(workflow).not.toContain("push:");
  expect(workflow).toContain("permissions: {}");
  expect(workflow).toContain("contents: write");
  expect(workflow).toContain("PULSE_BRANCH: readme-activity");
  expect(workflow).toContain('git push origin "HEAD:${PULSE_BRANCH}"');
  expect(workflow).toContain("ref: main");
  expect(workflow).toContain('cron: "17 08 1 * *"');
  expect(readme).toContain(
    "https://github.com/glyphq/wallet/raw/refs/heads/readme-activity/docs/assets/activity-pulse.svg",
  );
  expect(readme).toContain("last 12 months");
  expect(readme).toContain("refreshed on the first day of every month");
});
