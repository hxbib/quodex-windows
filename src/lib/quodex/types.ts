export type PlanKey =
  | "free"
  | "plus"
  | "pro"
  | "team"
  | "business"
  | "enterprise"
  | "edu"
  | string;

export interface UsageLane {
  group: string;
  name: string;
  usedPercent: number;
  resetAt: number | null;
  windowSeconds: number | null;
  isAssumed?: boolean;
}

export interface BankedResets {
  count: number;
  earliestExpiry: number | null;
}

export interface UsageSnapshot {
  lanes: UsageLane[];
  bankedResets: BankedResets | null;
  fetchedAt: number;
  bankedResetCountConfirmed?: boolean | null;
}

export interface AccountRecord {
  id: string;
  email: string;
  plan: string;
  addedAt: number;
  lastSnapshot: UsageSnapshot | null;
  resetNotificationsEnabled: boolean;
  lastKnownBankedResetCount: number | null;
  isDemo?: boolean;
}

export interface OAuthTokens {
  idToken: string;
  accessToken: string;
}

export type AccountRefreshState =
  | { kind: "idle" }
  | { kind: "cached"; fetchedAt: number }
  | { kind: "refreshing" }
  | { kind: "current"; fetchedAt: number }
  | { kind: "failed"; message: string }
  | { kind: "requiresLogin" };

export type LoginState =
  | { kind: "idle" }
  | { kind: "requestingCode" }
  | {
      kind: "waiting";
      verificationURL: string;
      userCode: string;
      deviceAuthID: string;
      intervalSeconds: number;
    }
  | { kind: "complete"; message: string }
  | { kind: "failed"; message: string };

export type ToastStyle = "success" | "warning" | "info";

export interface QuodexToast {
  id: string;
  message: string;
  style: ToastStyle;
}

export type UsageLaneTone = "critical" | "reserve" | "standard";

export const MAXIMUM_ACCOUNTS = 100;
export const FRESH_WINDOW_MS = 2 * 60 * 1000;
export const AUTO_REFRESH_MS = 30 * 60 * 1000;
export const REFRESH_CONCURRENCY = 4;

export function laneId(lane: Pick<UsageLane, "group" | "name">): string {
  return `${lane.group}|${lane.name}`;
}

export function reportedLanes(snapshot: UsageSnapshot | null): UsageLane[] {
  if (!snapshot) return [];
  return snapshot.lanes.filter((lane) => lane.isAssumed !== true);
}

export function remainingPercent(lane: UsageLane): number {
  return Math.min(100, Math.max(0, 100 - lane.usedPercent));
}

export function displayPlan(plan: string): string {
  const normalized = plan.trim().toLowerCase();
  switch (normalized) {
    case "":
      return "ChatGPT";
    case "free":
      return "Free";
    case "plus":
      return "Plus";
    case "pro":
      return "Pro";
    case "team":
      return "Team";
    case "business":
      return "Business";
    case "enterprise":
      return "Enterprise";
    case "edu":
    case "education":
      return "Education";
    default:
      return plan.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function displayLaneName(group: string, name: string): string {
  if (group === "Standard") return name;
  if (group === "Reserve" && name === "Weekly") return "Reserve";
  return `${group} · ${name}`;
}

export function laneTone(group: string, remaining: number): UsageLaneTone {
  if (remaining < 35) return "critical";
  if (group === "Reserve") return "reserve";
  return "standard";
}

export function hasConfirmedSnapshot(state: AccountRefreshState | undefined): boolean {
  return state?.kind === "current" || state?.kind === "cached";
}

export function isFresh(state: AccountRefreshState | undefined, now: number): boolean {
  return state?.kind === "current" && now - state.fetchedAt < FRESH_WINDOW_MS;
}

export function needsLogin(state: AccountRefreshState | undefined): boolean {
  return state?.kind === "requiresLogin";
}

export function accountInitials(email: string): string {
  const prefix = email.split("@")[0] ?? email;
  const parts = prefix.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length > 1) {
    return parts
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase();
  }
  return prefix.slice(0, 2).toUpperCase();
}

export function avatarHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function laneRank(group: string, name: string): number {
  if (group === "Standard" && name === "5-hour") return 0;
  if (group === "Standard" && name === "Weekly") return 1;
  if (group.toLowerCase().includes("reserve")) return 2;
  if (name === "Free Monthly") return 3;
  return 10;
}

export function sortLanes(lanes: UsageLane[]): UsageLane[] {
  return [...lanes].sort((left, right) => {
    const leftRank = laneRank(left.group, left.name);
    const rightRank = laneRank(right.group, right.name);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return `${left.group} ${left.name}`.localeCompare(`${right.group} ${right.name}`);
  });
}

export function nextResetForAccount(account: AccountRecord, now: number): number | null {
  const resets = reportedLanes(account.lastSnapshot)
    .map((lane) => lane.resetAt)
    .filter((value): value is number => value != null && value > now);
  if (resets.length === 0) return null;
  return Math.min(...resets);
}

export function orderBySoonestReset(accounts: AccountRecord[], now: number): string[] {
  return accounts
    .map((account, index) => ({ account, index, reset: nextResetForAccount(account, now) }))
    .sort((left, right) => {
      if (left.reset != null && right.reset != null && left.reset !== right.reset) {
        return left.reset - right.reset;
      }
      if (left.reset != null && right.reset == null) return -1;
      if (left.reset == null && right.reset != null) return 1;
      return left.index - right.index;
    })
    .map((entry) => entry.account.id);
}

export function moveAccountOrder(
  accountIDs: string[],
  draggedID: string,
  toInsertionIndex: number,
): string[] | null {
  const sourceIndex = accountIDs.indexOf(draggedID);
  if (sourceIndex < 0) return null;
  const reordered = [...accountIDs];
  const [moved] = reordered.splice(sourceIndex, 1);
  if (!moved) return null;
  const adjustedIndex = sourceIndex < toInsertionIndex ? toInsertionIndex - 1 : toInsertionIndex;
  const destination = Math.min(Math.max(0, adjustedIndex), reordered.length);
  reordered.splice(destination, 0, moved);
  return reordered.join() === accountIDs.join() ? null : reordered;
}
