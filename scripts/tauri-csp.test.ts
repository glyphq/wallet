import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

interface TauriConfig {
  app?: {
    security?: {
      csp?: string;
      devCsp?: string;
    };
  };
  plugins?: {
    updater?: {
      endpoints?: string[];
    };
  };
}

const config = JSON.parse(
  readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8")
) as TauriConfig;

function sourcesFor(policy: string | undefined, directiveName: string): string[] {
  const directive = policy
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${directiveName} `));
  return directive?.split(/\s+/).slice(1) ?? [];
}

describe("Tauri CSP configuration", () => {
  test("uses an explicit production connect-src allowlist", () => {
    const sources = sourcesFor(config.app?.security?.csp, "connect-src");

    expect(sources).toEqual([
      "'self'",
      "ipc:",
      "http://ipc.localhost",
      "https://wallet.glyphq.org",
      "https://rpc.qubic.org",
      "https://relay.glyphq.org",
      "https://api.coinbase.com",
      "https://github.com",
    ]);
    expect(sources).not.toContain("https:");
    expect(sources).not.toContain("*");
    expect(sources.some((source) => source.startsWith("http://localhost:"))).toBe(false);
    expect(sources.some((source) => source.startsWith("ws://"))).toBe(false);
  });

  test("keeps development-only Vite origins out of production CSP", () => {
    const production = sourcesFor(config.app?.security?.csp, "connect-src");
    const development = sourcesFor(config.app?.security?.devCsp, "connect-src");

    expect(development).toContain("http://localhost:1420");
    expect(development).toContain("ws://localhost:1420");
    expect(development).toEqual(expect.arrayContaining(production));
  });

  test("keeps the configured updater origin in the production allowlist", () => {
    const production = sourcesFor(config.app?.security?.csp, "connect-src");
    const updaterEndpoints = config.plugins?.updater?.endpoints ?? [];

    for (const endpoint of updaterEndpoints) {
      expect(production).toContain(new URL(endpoint).origin);
    }
  });
});
