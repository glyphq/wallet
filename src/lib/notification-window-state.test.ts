import { describe, expect, test } from "bun:test";
import { trimNotificationCards, upsertNotificationCard } from "./notification-window-state";

type Card = { id: string; kind: string; txHash: string | null; title: string };

describe("notification window state", () => {
  test("updates a transaction card in place", () => {
    const cards: Card[] = [
      { id: "sent", kind: "sent", txHash: "abc", title: "Transfer sent" },
      { id: "other", kind: "deep_link", txHash: "def", title: "Request" },
    ];
    expect(upsertNotificationCard(cards, { id: "confirmed", kind: "confirmed", txHash: "abc", title: "Transaction confirmed" }))
      .toEqual([
        { id: "sent", kind: "confirmed", txHash: "abc", title: "Transaction confirmed" },
        { id: "other", kind: "deep_link", txHash: "def", title: "Request" },
      ]);
  });

  test("keeps unrelated notifications and replaces by id", () => {
    const cards: Card[] = [{ id: "one", kind: "system", txHash: null, title: "One" }];
    expect(upsertNotificationCard(cards, { id: "two", kind: "system", txHash: null, title: "Two" })).toHaveLength(2);
    expect(upsertNotificationCard(cards, { id: "one", kind: "system", txHash: null, title: "Updated" })[0]?.title).toBe("Updated");
  });

  test("does not evict an active transaction at the visible limit", () => {
    const cards: Card[] = [
      { id: "active", kind: "sent", txHash: "abc", title: "Transfer sent" },
      { id: "newer", kind: "received", txHash: "def", title: "Received" },
      { id: "newest", kind: "deep_link", txHash: null, title: "Request" },
    ];
    expect(trimNotificationCards(cards, 2).map((card) => card.id)).toEqual(["active", "newest"]);
  });

  test("allows active cards to exceed the limit and resolves normally", () => {
    const cards: Card[] = [
      { id: "active-a", kind: "sent", txHash: "a", title: "A" },
    ];
    expect(trimNotificationCards(cards, 1)).toHaveLength(1);
    const resolved = upsertNotificationCard(cards, { id: "a2", kind: "confirmed", txHash: "a", title: "A confirmed" });
    expect(trimNotificationCards(resolved, 1).map((card) => card.id)).toEqual(["active-a"]);
  });
});
