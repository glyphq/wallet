import { describe, expect, test } from "bun:test";
import type { ApprovedDapp } from "@/store/persisted-types";
import {
  evaluateDappPermission,
  makeDappExpiresAt,
  sanitizeApprovedDapp,
  sanitizeTransferLimitQu,
} from "./dapp-permissions";

const now = 1_000_000;
const baseDapp: ApprovedDapp = {
  origin: "https://demo.app",
  name: "Demo",
  approvedAt: now - 10_000,
  permissions: ["transfer", "sign_message"],
  allowedIdentities: ["IDENTITY_A"],
  transferLimitQu: "1000",
  expiryDurationMs: 60_000,
  expiresAt: now + 60_000,
};

describe("dApp permission policy", () => {
  test("sanitizes persisted policy fields without inventing broader authority", () => {
    const sanitized = sanitizeApprovedDapp({
      ...baseDapp,
      permissions: ["transfer", "transfer", "unknown"],
      allowedIdentities: ["IDENTITY_A", "IDENTITY_A", 3],
      transferLimitQu: "1,234 qu",
      expiryDurationMs: 60_000,
      expiresAt: "bad",
    });

    expect(sanitized?.permissions).toEqual(["transfer"]);
    expect(sanitized?.allowedIdentities).toEqual(["IDENTITY_A"]);
    expect(sanitized?.transferLimitQu).toBe("1234");
    expect(sanitized?.expiresAt).toBe(baseDapp.approvedAt + 60_000);
  });

  test("blocks missing, ungranted, expired, unshared, and over-limit approvals", () => {
    expect(evaluateDappPermission({ approvedDapps: [], origin: baseDapp.origin, permission: "transfer", identity: "IDENTITY_A", amountQu: 1n, now }).allowed).toBe(false);
    expect(evaluateDappPermission({ approvedDapps: [baseDapp], origin: baseDapp.origin, permission: "sc_call", identity: "IDENTITY_A", amountQu: 1n, now }).reason).toBe("Permission not granted for this dApp.");
    expect(evaluateDappPermission({ approvedDapps: [{ ...baseDapp, expiresAt: now }], origin: baseDapp.origin, permission: "transfer", identity: "IDENTITY_A", amountQu: 1n, now }).reason).toBe("Connection expired. Reconnect to continue.");
    expect(evaluateDappPermission({ approvedDapps: [baseDapp], origin: baseDapp.origin, permission: "transfer", identity: "IDENTITY_B", amountQu: 1n, now }).reason).toBe("This account is not shared with this dApp.");
    expect(evaluateDappPermission({ approvedDapps: [baseDapp], origin: baseDapp.origin, permission: "transfer", identity: "IDENTITY_A", amountQu: 1001n, now }).reason).toContain("exceeds dApp limit");
  });

  test("allows granted in-scope approvals at or under the transfer limit", () => {
    expect(evaluateDappPermission({ approvedDapps: [baseDapp], origin: baseDapp.origin, permission: "transfer", identity: "IDENTITY_A", amountQu: 1000n, now }).allowed).toBe(true);
    expect(evaluateDappPermission({ approvedDapps: [baseDapp], origin: baseDapp.origin, permission: "sign_message", identity: "IDENTITY_A", now }).allowed).toBe(true);
  });

  test("sanitizes limits and creates expiry timestamps", () => {
    expect(sanitizeTransferLimitQu("0")).toBeUndefined();
    expect(sanitizeTransferLimitQu("18_446_744_073_709_551_615")).toBe("18446744073709551615");
    expect(sanitizeTransferLimitQu("18_446_744_073_709_551_616")).toBeUndefined();
    expect(makeDappExpiresAt(60_000, now)).toBe(now + 60_000);
    expect(makeDappExpiresAt(undefined, now)).toBeUndefined();
  });
});
