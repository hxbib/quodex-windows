import { displayLaneName, laneId, remainingPercent, reportedLanes, type AccountRecord, type UsageSnapshot } from "./types.ts";

export interface QuotaEvent {
  kind: "banked" | "early-reset";
  title: string;
  body: string;
}

export function quotaEvents(input: {
  email: string;
  previous: AccountRecord;
  next: UsageSnapshot;
  bellEnabled: boolean;
}): QuotaEvent[] {
  const events: QuotaEvent[] = [];
  const confirmed = input.next.bankedResetCountConfirmed === true;
  const previousBanked = input.previous.lastKnownBankedResetCount;
  const nextBanked = input.next.bankedResets?.count;
  if (confirmed && previousBanked != null && nextBanked != null && nextBanked > 0 && nextBanked > previousBanked) {
    const increase = nextBanked - previousBanked;
    events.push({
      kind: "banked",
      title: increase === 1 ? "New banked reset" : "New banked resets",
      body: `${increase === 1 ? "1 new banked reset" : `${increase} new banked resets`} detected for ${input.email} (${nextBanked === 1 ? "1 available" : `${nextBanked} available`}).`,
    });
  }

  if (!input.bellEnabled) return events;
  const previousSnapshot = input.previous.lastSnapshot;
  if (!previousSnapshot) return events;
  const previousById = new Map(reportedLanes(previousSnapshot).map((lane) => [laneId(lane), lane]));
  for (const lane of reportedLanes(input.next)) {
    if (remainingPercent(lane) !== 100) continue;
    const prior = previousById.get(laneId(lane));
    if (!prior || remainingPercent(prior) >= 100) continue;
    events.push({
      kind: "early-reset",
      title: "Usage reset detected",
      body: `${displayLaneName(lane.group, lane.name)} is available again for ${input.email}.`,
    });
  }
  return events;
}
