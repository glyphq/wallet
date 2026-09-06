#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("usage: node scripts/tauri-e2e-smoke.mjs --app <wallet> --broker <broker> --request-url <glyph-url> [--password <password>]");
  process.exit(0);
}
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};

const driverUrl = option("--driver-url", "http://127.0.0.1:4444").replace(/\/$/, "");
const app = option("--app", process.env.TAURI_E2E_APP);
const broker = option("--broker", process.env.TAURI_E2E_BROKER);
const requestUrl = option("--request-url", process.env.TAURI_E2E_REQUEST_URL);
const password = option("--password", process.env.TAURI_E2E_PASSWORD);
const dappName = option("--dapp-name", process.env.TAURI_E2E_DAPP_NAME ?? "Glyph E2E");
const expectLocked = process.env.TAURI_E2E_EXPECT_LOCKED !== "0";
const timeoutMs = Number(process.env.TAURI_E2E_TIMEOUT_MS ?? 30_000);

if (!app || !broker || !requestUrl) {
  throw new Error("app, broker, and request URL are required; use --help or TAURI_E2E_APP, TAURI_E2E_BROKER, TAURI_E2E_REQUEST_URL");
}

async function request(path, method = "GET", body) {
  const response = await fetch(`${driverUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let value;
  try { value = text ? JSON.parse(text) : null; } catch { value = text; }
  if (!response.ok) throw new Error(`WebDriver ${method} ${path} failed (${response.status}): ${text}`);
  return value;
}

function sessionId(value) {
  return value?.sessionId ?? value?.value?.sessionId;
}

function elementId(value) {
  return value?.["element-6066-11e4-a52e-4f735466cecf"] ?? value?.ELEMENT;
}

async function source(session) {
  const value = await request(`/session/${session}/source`);
  return value?.value ?? value;
}

async function waitFor(session, predicate, description) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    last = await source(session);
    if (predicate(last)) return last;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${description}; last page source length: ${last.length}`);
}

async function execute(session, script, args = []) {
  const value = await request(`/session/${session}/execute/sync`, "POST", { script, args });
  return value?.value;
}

async function clickText(session, label) {
  const clicked = await execute(session, `
    const label = arguments[0];
    const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === label);
    if (!button) return false;
    button.click();
    return true;
  `, [label]);
  if (!clicked) throw new Error(`button not found: ${label}`);
}

async function fillPassword(session, value) {
  const response = await request(`/session/${session}/element`, "POST", {
    using: "css selector",
    value: 'input[type="password"]',
  });
  const id = elementId(response?.value ?? response);
  if (!id) throw new Error("password input was not found");
  await request(`/session/${session}/element/${id}/value`, "POST", { text: value, value: [...value] });
}

function launchDeepLink() {
  const child = spawn(broker, [requestUrl], { stdio: "ignore", detached: true });
  child.unref();
}

const created = await request("/session", "POST", {
  capabilities: { alwaysMatch: { "tauri:options": { application: app } } },
});
const session = sessionId(created);
if (!session) throw new Error(`WebDriver did not return a session: ${JSON.stringify(created)}`);

try {
  let page = await waitFor(session, (html) => html.includes("Glyph") || html.includes("Welcome"), "Glyph Wallet startup");
  const initiallyLocked = page.includes('type="password"');
  if (expectLocked && !initiallyLocked) {
    throw new Error("E2E profile is not locked; use a fresh seeded profile to exercise the lock boundary");
  }

  launchDeepLink();
  if (initiallyLocked) {
    page = await waitFor(session, (html) => html.includes('type="password"') && html.includes("pending request".replace(" ", " ")), "request retained while locked");
    if (!password) throw new Error("TAURI_E2E_PASSWORD is required when the seeded profile starts locked");
    await fillPassword(session, password);
    await clickText(session, "Unlock Vault");
  }

  await waitFor(session, (html) => html.includes(dappName), `approval request from ${dappName}`);
  await clickText(session, "Reject");
  await waitFor(session, (html) => html.includes("Request complete"), "callback completion view");
  await waitFor(session, (html) => html.includes("Callback delivered") || html.includes("Callback failed"), "callback delivery result");

  launchDeepLink();
  await sleep(1_500);
  page = await source(session);
  if (page.includes(dappName)) throw new Error("replayed request was accepted again");
  console.log("[tauri-e2e] lock queue, approval rejection, callback attempt, and replay rejection passed");
} finally {
  await request(`/session/${session}`, "DELETE").catch(() => {});
}
