import { describe, expect, test } from "bun:test";
import { upsertNotificationCard } from "./notification-window-state";

type Card = { id: string; txHash: string | null; title: string };

describe("notification window state", () => {
  test("updates a transaction card in place", () => {
    const cards: Card[] = [
      { id: "sent", txHash: "abc", title: "Transfer sent" },
      { id: "other", txHash: "def", title: "Request" },
    ];
    expect(upsertNotificationCard(cards, { id: "confirmed", txHash: "abc", title: "Transaction confirmed" }))
      .toEqual([
        { id: "sent", txHash: "abc", title: "Transaction confirmed" },
        { id: "other", txHash: "def", title: "Request" },
      ]);
  });

  test("keeps unrelated notifications and replaces by id", () => {
    const cards: Card[] = [{ id: "one", txHash: null, title: "One" }];
    expect(upsertNotificationCard(cards, { id: "two", txHash: null, title: "Two" })).toHaveLength(2);
    expect(upsertNotificationCard(cards, { id: "one", txHash: null, title: "Updated" })[0]?.title).toBe("Updated");
  });
});
