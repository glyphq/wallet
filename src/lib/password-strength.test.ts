import { describe, expect, test } from "bun:test";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "@/lib/password-strength";

describe("passwordStrength", () => {
  test("rejects passwords shorter than the shared minimum", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
    expect(passwordStrength("a".repeat(MIN_PASSWORD_LENGTH - 1)).level).toBe(0);
    expect(passwordStrength("a".repeat(MIN_PASSWORD_LENGTH - 1)).label).toBe("Too short");
  });

  test("accepts a minimum-length password as Fair", () => {
    const strength = passwordStrength("a".repeat(MIN_PASSWORD_LENGTH));
    expect(strength.level).toBe(1);
    expect(strength.label).toBe("Fair");
  });

  test("scores longer, mixed passwords higher", () => {
    expect(passwordStrength("abcdefghijklm").level).toBe(1);
    expect(passwordStrength("Abcdefghijklmnop1!").level).toBe(3);
  });
});
