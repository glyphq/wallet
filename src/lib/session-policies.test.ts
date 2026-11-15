import { describe, expect, test } from "bun:test";
import { exceedsHighValueThreshold, requiresBiometricSeedReveal } from "@/lib/session-policies";

describe("requiresBiometricSeedReveal", () => {
  test("requires biometrics only when enabled for the selected vault", () => {
    expect(requiresBiometricSeedReveal(true, ["vault-a"], "vault-a")).toBe(true);
  });

  test("falls back to password when the preference is off", () => {
    expect(requiresBiometricSeedReveal(false, ["vault-a"], "vault-a")).toBe(false);
  });

  test("falls back to password when the vault is not enrolled", () => {
    expect(requiresBiometricSeedReveal(true, ["vault-a"], "vault-b")).toBe(false);
    expect(requiresBiometricSeedReveal(true, [], "vault-a")).toBe(false);
    expect(requiresBiometricSeedReveal(true, ["vault-a"], null)).toBe(false);
  });
});

describe("exceedsHighValueThreshold", () => {
  test("parses whole-number thresholds exactly", () => {
    expect(exceedsHighValueThreshold(1_000n, "1000")).toBe(true);
    expect(exceedsHighValueThreshold(999n, "1000")).toBe(false);
  });

  test("ignores missing or malformed thresholds", () => {
    expect(exceedsHighValueThreshold(1_000n, "")).toBe(false);
    expect(exceedsHighValueThreshold(1_000n, "1,000")).toBe(false);
    expect(exceedsHighValueThreshold(1_000n, "1e3")).toBe(false);
  });
});
