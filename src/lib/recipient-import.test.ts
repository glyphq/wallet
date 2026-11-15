import { describe, expect, test } from "bun:test";
import { deriveIdentityFromSeed, type Seed } from "@/lib/crypto";
import { parseRecipientImport } from "@/lib/recipient-import";

const alice = deriveIdentityFromSeed("a".repeat(55) as Seed);
const bob = deriveIdentityFromSeed("b".repeat(55) as Seed);

describe("parseRecipientImport", () => {
  test("returns nothing for empty input", () => {
    expect(parseRecipientImport("")).toEqual([]);
    expect(parseRecipientImport("  \n \r\n ")).toEqual([]);
  });

  test("parses arrays of objects with supported field aliases", () => {
    const result = parseRecipientImport(JSON.stringify([
      { address: alice.toLowerCase(), amount: "1000", label: "Alice" },
      { recipient: bob, qu: 250, name: "Bob" },
      { to: alice, value: "42" },
    ]));
    expect(result).toEqual([
      { identity: alice, amount: "1000", label: "Alice" },
      { identity: bob, amount: "250", label: "Bob" },
      { identity: alice, amount: "42" },
    ]);
  });

  test("drops invalid identities and non-positive or non-numeric amounts", () => {
    const result = parseRecipientImport(JSON.stringify([
      { identity: "not-an-identity", amount: "10" },
      { identity: alice, amount: "0" },
      { identity: alice, amount: "-5" },
      { identity: alice, amount: "not-a-number" },
      { identity: alice, amount: 1.5 },
      { identity: bob, amount: "12" },
    ]));
    expect(result).toEqual([
      { identity: alice, amount: "1" },
      { identity: bob, amount: "12" },
    ]);
  });

  test("truncates finite JSON numbers like the import UI promises", () => {
    expect(parseRecipientImport(JSON.stringify([{ identity: alice, amount: 10.9 }]))).toEqual([
      { identity: alice, amount: "10" },
    ]);
  });

  test("parses CSV with a header and quoted labels", () => {
    const csv = [
      "identity,amount,label",
      `${alice},1000,"Alice, Inc."`,
      `${bob},2500,"He said ""hi"""`,
      `bad-identity,10,Ignored`,
    ].join("\r\n");
    expect(parseRecipientImport(csv)).toEqual([
      { identity: alice, amount: "1000", label: "Alice, Inc." },
      { identity: bob, amount: "2500", label: 'He said "hi"' },
    ]);
  });

  test("parses headerless plaintext rows and normalizes case", () => {
    expect(parseRecipientImport(`${alice.toLowerCase()}, 42\n${bob},7`)).toEqual([
      { identity: alice, amount: "42" },
      { identity: bob, amount: "7" },
    ]);
  });

  test("ignores blank rows", () => {
    expect(parseRecipientImport(`\n${alice},5\n\n`)).toEqual([{ identity: alice, amount: "5" }]);
  });
});
