import { describe, expect, test } from "bun:test";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { deriveIdentityFromSeed, type Seed } from "@/lib/crypto";
import { buildAddressSuggestions, getRecentRecipientIdentities, type AddressSuggestionAccount } from "@/lib/address-intelligence";
import type { Contact } from "@/store/persisted";

const alice = deriveIdentityFromSeed("a".repeat(55) as Seed);
const bob = deriveIdentityFromSeed("b".repeat(55) as Seed);
const carol = deriveIdentityFromSeed("c".repeat(55) as Seed);
const [contractAddress, contractName] = Object.entries(KNOWN_CONTRACT_ADDRESSES)[0];

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "contact-1",
    name: "Alice",
    identity: alice,
    note: "Treasury",
    addedAt: 1,
    lastUsedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function account(overrides: Partial<AddressSuggestionAccount> = {}): AddressSuggestionAccount {
  return { name: "Savings", identity: bob, note: "Long term", tags: ["cold"], ...overrides };
}

describe("getRecentRecipientIdentities", () => {
  test("returns nothing without an identity or history", () => {
    expect(getRecentRecipientIdentities(null, [{ source: alice, destination: bob }])).toEqual([]);
    expect(getRecentRecipientIdentities(alice, undefined)).toEqual([]);
  });

  test("collects counterparties in order and dedupes them", () => {
    expect(getRecentRecipientIdentities(alice, [
      { source: alice, destination: bob },
      { source: carol, destination: alice },
      { source: alice, destination: bob },
      { source: bob, destination: carol },
      { source: alice, destination: null },
    ])).toEqual([bob, carol]);
  });
});

describe("buildAddressSuggestions", () => {
  test("ranks contacts above accounts, recents, and contracts", () => {
    const suggestions = buildAddressSuggestions({
      query: "",
      contacts: [contact()],
      accounts: [account()],
      recentIdentities: [carol],
    });
    const kinds = suggestions.map((suggestion) => suggestion.kind);
    expect(kinds.slice(0, 4)).toEqual(["contact", "account", "recent", "contract"]);
    expect(suggestions.length).toBeLessThanOrEqual(6);
    expect(suggestions[0].identity).toBe(alice);
  });

  test("excludes the current account and prefers the best-ranked duplicate", () => {
    const suggestions = buildAddressSuggestions({
      query: "",
      contacts: [contact()],
      accounts: [account({ identity: alice, name: "Same identity" })],
      currentIdentity: bob,
    });
    expect(suggestions.filter((suggestion) => suggestion.identity === alice)).toHaveLength(1);
    expect(suggestions.find((suggestion) => suggestion.identity === alice)?.kind).toBe("contact");
    expect(suggestions.some((suggestion) => suggestion.identity === bob)).toBe(false);
  });

  test("matches labels, notes, tags, and identity substrings case-insensitively", () => {
    const build = (query: string) => buildAddressSuggestions({
      query,
      contacts: [contact()],
      accounts: [account()],
    });

    expect(build("ALI").map((s) => s.identity)).toEqual([alice]);
    expect(build("treasury").map((s) => s.identity)).toEqual([alice]);
    expect(build("#cold").map((s) => s.identity)).toEqual([bob]);
    expect(build(alice.slice(10, 20).toLowerCase()).map((s) => s.identity)).toEqual([alice]);
    expect(build("nobody-matches-this")).toEqual([]);
  });

  test("caps results at six suggestions", () => {
    const contacts = Array.from({ length: 8 }, (_, index) => contact({
      id: `contact-${index}`,
      name: `Person ${index}`,
      identity: deriveIdentityFromSeed(String.fromCharCode(97 + index).repeat(55) as Seed),
      lastUsedAt: 1_700_000_000_000 - index,
    }));
    expect(buildAddressSuggestions({ query: "", contacts, accounts: [] })).toHaveLength(6);
  });

  test("labels known contracts from the shared registry", () => {
    const suggestions = buildAddressSuggestions({
      query: contractName,
      contacts: [],
      accounts: [],
      recentIdentities: [contractAddress],
    });
    expect(suggestions[0]).toMatchObject({ identity: contractAddress, label: contractName, kind: "recent" });
  });
});
