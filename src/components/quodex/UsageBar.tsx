import { displayLaneName, laneTone, remainingPercent, type UsageLane } from "@/lib/quodex/types";
import { clockWithWeekday, resetCountdown } from "@/lib/quodex/format";

export function UsageBar({ lane, now }: { lane: UsageLane; now: number }) {
  const remaining = remainingPercent(lane);
  const tone = laneTone(lane.group, remaining);
  const fill =
    tone === "critical"
      ? "var(--color-win-critical)"
      : tone === "reserve"
        ? "var(--color-win-reserve)"
        : "var(--color-win-accent)";
  const reset = lane.resetAt ? `${resetCountdown(lane.resetAt, now)} · ${clockWithWeekday(lane.resetAt, now)}` : "";

  return (
    <div className="flex flex-col gap-0.5">
      <div className="pool-lane-meta">
        <span className="pool-lane-name">{displayLaneName(lane.group, lane.name)}</span>
        <span className="pool-lane-pct">{Math.round(remaining)}% left</span>
        {reset ? <span className="pool-lane-reset">{reset}</span> : null}
      </div>
      <div className="usage-track">
        <div className="usage-fill" style={{ width: `${remaining}%`, background: fill }} />
      </div>
    </div>
  );
}
