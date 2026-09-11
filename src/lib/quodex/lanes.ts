import type { BankedResets, UsageLane, UsageSnapshot } from "./types";

interface NativeUsageWindow {
  used_percent?: number | null;
  limit_window_seconds?: number | null;
  reset_at?: number | null;
}

interface NativeUsageLimit {
  allowed?: boolean | null;
  limit_reached?: boolean | null;
  primary_window?: NativeUsageWindow | null;
  secondary_window?: NativeUsageWindow | null;
}

export interface UsageAPIResponse {
  email?: string | null;
  plan_type?: string | null;
  rate_limit?: NativeUsageLimit | null;
  additional_rate_limits?: Array<{
    limit_name?: string | null;
    rate_limit?: NativeUsageLimit | null;
  }> | null;
  rate_limit_reset_credits?: {
    available_count?: number | null;
    applicable_available_count?: number | null;
  } | null;
}

export interface ResetCreditsResponse {
  available_count?: number | null;
  applicable_available_count?: number | null;
  credits?: Array<{
    status?: string | null;
    expires_at?: string | null;
  }> | null;
}

function isValidUsed(usedPercent: number | null | undefined): usedPercent is number {
  return typeof usedPercent === "number" && Number.isFinite(usedPercent) && usedPercent >= 0 && usedPercent <= 100;
}

export function labelForWindow(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "Usage";
  if (seconds === 5 * 60 * 60) return "5-hour";
  if (seconds === 7 * 24 * 60 * 60) return "Weekly";
  if (seconds === 30 * 24 * 60 * 60) return "Free Monthly";
  if (seconds % (7 * 24 * 60 * 60) === 0) {
    const weeks = seconds / (7 * 24 * 60 * 60);
    return weeks === 1 ? "Weekly" : `${weeks}-week`;
  }
  if (seconds % (24 * 60 * 60) === 0) {
    const days = seconds / (24 * 60 * 60);
    return days === 1 ? "Daily" : `${days}-day`;
  }
  if (seconds % (60 * 60) === 0) return `${seconds / (60 * 60)}-hour`;
  return `${Math.max(1, Math.floor(seconds / 60))}-minute`;
}

export function humanizeLimitName(raw: string): string {
  const normalized = raw.trim().toLowerCase().replaceAll("_", "-");
  if (normalized === "gpt-reserve") return "Reserve";
  return raw
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .map((part) => (part.toLowerCase() === "gpt" ? "GPT" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

function laneFromWindow(window: NativeUsageWindow, group: string): UsageLane {
  return {
    group,
    name: labelForWindow(window.limit_window_seconds ?? null),
    usedPercent: window.used_percent ?? 0,
    resetAt: window.reset_at ? window.reset_at * 1000 : null,
    windowSeconds: window.limit_window_seconds ?? null,
  };
}

function appendLimit(limit: NativeUsageLimit | null | undefined, group: string, lanes: UsageLane[]) {
  if (!limit) return;
  if (limit.primary_window && isValidUsed(limit.primary_window.used_percent)) {
    lanes.push(laneFromWindow(limit.primary_window, group));
  }
  if (limit.secondary_window && isValidUsed(limit.secondary_window.used_percent)) {
    lanes.push(laneFromWindow(limit.secondary_window, group));
  }
}

export function snapshotFromUsage(
  usage: UsageAPIResponse,
  resets: ResetCreditsResponse | null,
  resetLookupFailed: boolean,
  fetchedAt = Date.now(),
): UsageSnapshot {
  const lanes: UsageLane[] = [];
  appendLimit(usage.rate_limit, "Standard", lanes);
  for (const additional of usage.additional_rate_limits ?? []) {
    const name = additional.limit_name?.trim();
    if (!name) continue;
    appendLimit(additional.rate_limit, humanizeLimitName(name), lanes);
  }
  if (lanes.length === 0) {
    throw new Error("The current usage format is not recognized.");
  }
  const ids = lanes.map((lane) => `${lane.group}|${lane.name}`);
  if (new Set(ids).size !== ids.length) {
    throw new Error("The current usage format is not recognized.");
  }

  const embeddedRaw =
    usage.rate_limit_reset_credits?.applicable_available_count ??
    usage.rate_limit_reset_credits?.available_count;
  const dedicatedRaw = resets?.applicable_available_count ?? resets?.available_count;
  const embeddedCount = embeddedRaw != null && embeddedRaw >= 0 ? embeddedRaw : null;
  const dedicatedCount = dedicatedRaw != null && dedicatedRaw >= 0 ? dedicatedRaw : null;
  const negative = embeddedRaw != null && embeddedRaw < 0 || dedicatedRaw != null && dedicatedRaw < 0;
  const count = negative
    ? null
    : resetLookupFailed
      ? embeddedCount != null && embeddedCount > 0
        ? embeddedCount
        : null
      : (dedicatedCount ?? embeddedCount);

  const earliestExpiry =
    resets?.credits
      ?.map((credit) => {
        if (credit.status && credit.status !== "" && credit.status !== "available") return null;
        if (!credit.expires_at) return null;
        const parsed = Date.parse(credit.expires_at);
        return Number.isNaN(parsed) ? null : parsed;
      })
      .filter((value): value is number => value != null)
      .sort((a, b) => a - b)[0] ?? null;

  const banked: BankedResets | null = count == null ? null : { count, earliestExpiry };
  return {
    lanes,
    bankedResets: banked,
    fetchedAt,
    bankedResetCountConfirmed: banked == null ? null : !resetLookupFailed && dedicatedCount != null,
  };
}
