import { RotateCcw } from "lucide-react";
import { clockWithWeekday, resetCountdown, updateAge } from "@/lib/quodex/format";
import {
  displayLaneName,
  hasConfirmedSnapshot,
  isFresh,
  laneId,
  laneRank,
  reportedLanes,
  remainingPercent,
  type AccountRecord,
  type AccountRefreshState,
} from "@/lib/quodex/types";

interface PoolSummaryProps {
  accounts: AccountRecord[];
  refreshStates: Record<string, AccountRefreshState>;
  now: number;
}

interface PooledLane {
  group: string;
  name: string;
  remaining: number;
  accountCount: number;
  nextReset: number | null;
}

export function PoolSummary({ accounts, refreshStates, now }: PoolSummaryProps) {
  const confirmedCount = accounts.filter((account) => hasConfirmedSnapshot(refreshStates[account.id])).length;
  const liveCount = accounts.filter((account) => isFresh(refreshStates[account.id], now)).length;
  const included =
    confirmedCount > 0
      ? accounts.filter((account) => hasConfirmedSnapshot(refreshStates[account.id]))
      : accounts;

  const laneMap = new Map<string, PooledLane>();
  for (const account of included) {
    for (const lane of reportedLanes(account.lastSnapshot)) {
      const key = laneId(lane);
      const current = laneMap.get(key) ?? {
        group: lane.group,
        name: lane.name,
        remaining: 0,
        accountCount: 0,
        nextReset: null,
      };
      current.remaining += remainingPercent(lane);
      current.accountCount += 1;
      if (lane.resetAt && (current.nextReset == null || lane.resetAt < current.nextReset)) {
        current.nextReset = lane.resetAt;
      }
      laneMap.set(key, current);
    }
  }
  const lanes = [...laneMap.values()].sort((left, right) => {
    const leftRank = laneRank(left.group, left.name);
    const rightRank = laneRank(right.group, right.name);
    return leftRank === rightRank
      ? `${left.group} ${left.name}`.localeCompare(`${right.group} ${right.name}`)
      : leftRank - rightRank;
  });

  const resetCount = accounts.reduce((sum, account) => {
    if (!hasConfirmedSnapshot(refreshStates[account.id])) return sum;
    return sum + (account.lastSnapshot?.bankedResets?.count ?? 0);
  }, 0);
  const resetKnownCount = accounts.filter(
    (account) => hasConfirmedSnapshot(refreshStates[account.id]) && account.lastSnapshot?.bankedResets != null,
  ).length;

  const confirmedDates = accounts
    .map((account) => {
      const state = refreshStates[account.id];
      if (state?.kind === "cached" || state?.kind === "current") return state.fetchedAt;
      return null;
    })
    .filter((value): value is number => value != null);

  let status = `Refreshing ${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`;
  if (liveCount === accounts.length && accounts.length > 0) {
    status = `Live across all ${accounts.length} accounts`;
  } else if (confirmedCount === accounts.length && accounts.length > 0) {
    if (liveCount > 0) status = `${liveCount} live · ${confirmedCount - liveCount} last updated`;
    else if (confirmedDates.length > 0) {
      status = `All updated ${updateAge(Math.min(...confirmedDates), now)} or newer`;
    }
  } else if (confirmedCount > 0) {
    status = `${liveCount} live · ${confirmedCount - liveCount} last updated · ${accounts.length - confirmedCount} unavailable`;
  }

  return (
    <section className="quodex-card pool-card">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold leading-none">Pool capacity</h2>
          <p className="mt-1 text-[11px] leading-none text-win-subtle">{status}</p>
        </div>
        {resetCount > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-win-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-win-reserve">
            <RotateCcw size={10} />
            {resetCount} {resetCount === 1 ? "reset" : "resets"}
          </span>
        ) : null}
      </div>
      {confirmedCount > 0 && resetKnownCount < confirmedCount ? (
        <p className="mt-2 text-[11px] text-win-subtle">
          Reset status available for {resetKnownCount} of {confirmedCount} current accounts
        </p>
      ) : null}
      {lanes.length > 0 && lanes.every((lane) => lane.remaining <= 0) ? (
        <p className="mt-2 text-[12px] font-semibold text-win-critical">All currently reported capacity is depleted</p>
      ) : null}
      {lanes.length === 0 ? (
        <p className="mt-2 text-[12px] text-win-subtle">Usage will appear after the first live refresh.</p>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-2">
          {lanes.map((lane) => {
            const accts = `${lane.accountCount} acct${lane.accountCount === 1 ? "" : "s"}`;
            const reset = lane.nextReset
              ? `next ${resetCountdown(lane.nextReset, now)} · ${clockWithWeekday(lane.nextReset, now)}`
              : "";
            return (
              <li key={`${lane.group}|${lane.name}`} className="pool-lane">
                <div className="pool-lane-meta">
                  <span className="pool-lane-name">
                    {displayLaneName(lane.group, lane.name)}
                    <span className="font-normal text-win-subtle"> · {accts}</span>
                  </span>
                  <span className="pool-lane-pct">{Math.round(lane.remaining)}%</span>
                  {reset ? <span className="pool-lane-reset">{reset}</span> : null}
                </div>
                <div className="usage-track">
                  <div
                    className="usage-fill"
                    style={{
                      width: `${Math.min(100, lane.remaining)}%`,
                      background: lane.remaining <= 0 ? "var(--color-win-critical)" : "var(--color-win-accent)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
