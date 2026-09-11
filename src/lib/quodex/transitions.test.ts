import assert from "node:assert/strict";
import test from "node:test";
import { quotaEvents } from "./transitions.ts";
import type { AccountRecord, UsageSnapshot } from "./types.ts";

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: "acct",
    email: "user@example.com",
    plan: "plus",
    addedAt: 1,
    lastSnapshot: null,
    resetNotificationsEnabled: false,
    lastKnownBankedResetCount: 1,
    ...overrides,
  };
}

function snapshot(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    lanes: [
      {
        group: "Standard",
        name: "5-hour",
        usedPercent: 0,
        resetAt: 9_000_000,
        windowSeconds: 5 * 3600,
      },
    ],
    bankedResets: { count: 2, earliestExpiry: null },
    fetchedAt: 2,
    bankedResetCountConfirmed: true,
    ...overrides,
  };
}

test("banked-reset increase notifies without the bell", () => {
  const events = quotaEvents({
    email: "user@example.com",
    previous: account(),
    next: snapshot(),
    bellEnabled: false,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.kind, "banked");
  assert.match(events[0]?.body ?? "", /user@example.com/);
});

test("unconfirmed banked counts do not notify", () => {
  const events = quotaEvents({
    email: "user@example.com",
    previous: account(),
    next: snapshot({ bankedResetCountConfirmed: false }),
    bellEnabled: false,
  });
  assert.equal(events.length, 0);
});

test("early lane reset notifies only when the bell is on", () => {
  const previous = account({
    resetNotificationsEnabled: true,
    lastSnapshot: snapshot({
      lanes: [
        {
          group: "Standard",
          name: "5-hour",
          usedPercent: 80,
          resetAt: 9_000_000,
          windowSeconds: 5 * 3600,
        },
      ],
      bankedResets: { count: 1, earliestExpiry: null },
      bankedResetCountConfirmed: true,
    }),
  });
  const withBell = quotaEvents({
    email: "user@example.com",
    previous,
    next: snapshot({ bankedResets: { count: 1, earliestExpiry: null } }),
    bellEnabled: true,
  });
  assert.equal(withBell.some((event) => event.kind === "early-reset"), true);
  const withoutBell = quotaEvents({
    email: "user@example.com",
    previous,
    next: snapshot({ bankedResets: { count: 1, earliestExpiry: null } }),
    bellEnabled: false,
  });
  assert.equal(withoutBell.some((event) => event.kind === "early-reset"), false);
});
