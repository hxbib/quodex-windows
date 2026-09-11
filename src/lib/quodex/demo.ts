import type { AccountRecord } from "./types";

/** Stable instant so SSR HTML matches the first client render. */
export const DEMO_NOW = Date.UTC(2026, 8, 8, 0, 27, 0);

/** Landing-page samples are Plus/Pro only — never Free Monthly. */
export function isLandingFreeSample(account: {
  id?: string;
  plan?: string;
  isDemo?: boolean;
  lastSnapshot?: { lanes?: Array<{ name: string }> | null } | null;
}): boolean {
  const demo = account.isDemo === true || String(account.id ?? "").startsWith("demo-");
  if (!demo) return false;
  if ((account.plan ?? "").trim().toLowerCase() === "free") return true;
  return (account.lastSnapshot?.lanes ?? []).some((lane) => lane.name === "Free Monthly");
}

export const LANDING_EMAIL_DOMAIN = "quodex.app";

export function landingEmail(email: string): string {
  const local = (email.split("@")[0] ?? "account").trim() || "account";
  return `${local}@${LANDING_EMAIL_DOMAIN}`;
}

export function withLandingEmail<T extends { email?: string }>(account: T): T {
  if (typeof account.email !== "string" || !account.email) return account;
  return { ...account, email: landingEmail(account.email) };
}

export function createDemoAccounts(now = DEMO_NOW): AccountRecord[] {
  const hours = (value: number) => now + value * 3600 * 1000;
  const days = (value: number) => now + value * 24 * 3600 * 1000;

  return [
    {
      id: "demo-plus-maya",
      email: "maya.chen@quodex.app",
      plan: "plus",
      addedAt: now - 12 * 86400000,
      isDemo: true,
      resetNotificationsEnabled: true,
      lastKnownBankedResetCount: 2,
      lastSnapshot: {
        fetchedAt: now - 4 * 60 * 1000,
        bankedResetCountConfirmed: true,
        bankedResets: { count: 2, earliestExpiry: days(11) },
        lanes: [
          {
            group: "Standard",
            name: "5-hour",
            usedPercent: 38,
            resetAt: hours(2.4),
            windowSeconds: 5 * 3600,
          },
          {
            group: "Standard",
            name: "Weekly",
            usedPercent: 19,
            resetAt: days(3.2),
            windowSeconds: 7 * 86400,
          },
        ],
      },
    },
    {
      id: "demo-pro-julian",
      email: "julian.okonkwo@quodex.app",
      plan: "pro",
      addedAt: now - 40 * 86400000,
      isDemo: true,
      resetNotificationsEnabled: true,
      lastKnownBankedResetCount: 1,
      lastSnapshot: {
        fetchedAt: now - 90 * 1000,
        bankedResetCountConfirmed: true,
        bankedResets: { count: 1, earliestExpiry: days(6) },
        lanes: [
          {
            group: "Standard",
            name: "Weekly",
            usedPercent: 46,
            resetAt: days(1.6),
            windowSeconds: 7 * 86400,
          },
          {
            group: "Reserve",
            name: "Weekly",
            usedPercent: 12,
            resetAt: days(4.8),
            windowSeconds: 7 * 86400,
          },
        ],
      },
    },
    {
      id: "demo-plus-sofia",
      email: "sofia.martinez@quodex.app",
      plan: "plus",
      addedAt: now - 6 * 86400000,
      isDemo: true,
      resetNotificationsEnabled: false,
      lastKnownBankedResetCount: 0,
      lastSnapshot: {
        fetchedAt: now - 16 * 60 * 1000,
        bankedResetCountConfirmed: true,
        bankedResets: { count: 0, earliestExpiry: null },
        lanes: [
          {
            group: "Standard",
            name: "5-hour",
            usedPercent: 6,
            resetAt: hours(4.6),
            windowSeconds: 5 * 3600,
          },
          {
            group: "Standard",
            name: "Weekly",
            usedPercent: 8,
            resetAt: days(5.4),
            windowSeconds: 7 * 86400,
          },
        ],
      },
    },
  ];
}

export function refreshDemoSnapshot(account: AccountRecord, now = Date.now()): AccountRecord {
  if (!account.lastSnapshot) {
    return { ...account, lastSnapshot: { lanes: [], bankedResets: null, fetchedAt: now } };
  }
  return {
    ...account,
    lastSnapshot: {
      ...account.lastSnapshot,
      fetchedAt: now,
      lanes: account.lastSnapshot.lanes.map((lane) => ({
        ...lane,
        usedPercent: Math.min(96, Math.max(4, lane.usedPercent + (Math.random() * 6 - 3))),
      })),
    },
  };
}
