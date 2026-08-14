import { describe, expect, test } from "bun:test";
import { notify, stripNotificationMarkup } from "@/lib/notifications";

describe("stripNotificationMarkup", () => {
  test("removes angle brackets instead of trying to parse markup", () => {
    expect(stripNotificationMarkup("Hello <b>world</b> <<tag>>")).toBe(
      "Hello bworld/b tag",
    );
  });

  test("strips control and bidi override characters", () => {
    expect(stripNotificationMarkup("safe\u0000 text\u202E now")).toBe("safe text now");
  });
});

describe("notify", () => {
  test("relies on the installed desktop entry instead of passing an invalid web icon name", async () => {
    const originalWindow = globalThis.window;
    const notifications: Array<{ title: string; options: NotificationOptions }> = [];

    class TestNotification {
      static permission: NotificationPermission = "granted";

      constructor(title: string, options: NotificationOptions) {
        notifications.push({ title, options });
      }
    }

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { Notification: TestNotification },
    });

    try {
      await expect(notify("Glyph <test>", "Delivery <check>")).resolves.toEqual({ ok: true, state: "sent" });
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        title: "Glyph test",
        options: { body: "Delivery check", title: "Glyph test" },
      });
      expect(notifications[0]?.options).not.toHaveProperty("icon");
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    }
  });
});
