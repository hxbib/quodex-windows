import { Bell, BellOff, RotateCcw, Trash2 } from "lucide-react";
import { UsageBar } from "./UsageBar";
import { updateAge } from "@/lib/quodex/format";
import { cn } from "@/lib/utils";
import {
  accountInitials,
  avatarHue,
  displayPlan,
  hasConfirmedSnapshot,
  reportedLanes,
  sortLanes,
  type AccountRecord,
  type AccountRefreshState,
} from "@/lib/quodex/types";

interface AccountCardProps {
  account: AccountRecord;
  state: AccountRefreshState;
  now: number;
  isRemoving?: boolean;
  compact?: boolean;
  onCopyEmail: () => void;
  onToggleNotifications: () => void;
  onRefresh: () => void;
  onSignIn: () => void;
  onRemove: () => void;
}

export function AccountCard({
  account,
  state,
  now,
  isRemoving,
  compact,
  onCopyEmail,
  onToggleNotifications,
  onRefresh,
  onSignIn,
  onRemove,
}: AccountCardProps) {
  const hue = avatarHue(account.id);
  const lanes = sortLanes(reportedLanes(account.lastSnapshot));
  const banked = account.lastSnapshot?.bankedResets;
  const confirmed = hasConfirmedSnapshot(state);

  return (
    <article className="quodex-card" draggable={!compact} data-account-id={account.id}>
      <div className="flex items-start gap-2">
        <div
          className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
          style={{
            background: `hsl(${hue} 38% 38%)`,
          }}
        >
          {accountInitials(account.email)}
        </div>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block max-w-full truncate text-left text-[12px] font-semibold leading-tight"
            onClick={onCopyEmail}
            title="Copy email"
          >
            {account.email}
          </button>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-win-muted">
              {displayPlan(account.plan)}
            </span>
            {account.isDemo ? (
              <span className="rounded-full bg-win-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-win-accent">
                Sample
              </span>
            ) : null}
            <Freshness state={state} fetchedAt={account.lastSnapshot?.fetchedAt} now={now} />
          </div>
        </div>
        {confirmed && banked && banked.count > 0 ? (
          <span className="hidden items-center gap-1 rounded-full bg-win-warn/15 px-2 py-1 text-[11px] font-bold text-win-reserve sm:inline-flex">
            <RotateCcw size={11} />
            {banked.count}
          </span>
        ) : null}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn("circle-btn", account.resetNotificationsEnabled && "active")}
            onClick={onToggleNotifications}
            disabled={isRemoving || state.kind === "requiresLogin"}
            aria-label={account.resetNotificationsEnabled ? "Turn off reset alerts" : "Turn on reset alerts"}
            title="Reset alerts"
          >
            {account.resetNotificationsEnabled ? <Bell size={12} /> : <BellOff size={12} />}
          </button>
          <button
            type="button"
            className="circle-btn"
            onClick={onRefresh}
            disabled={isRemoving || state.kind === "refreshing" || state.kind === "requiresLogin"}
            aria-label={`Refresh ${account.email}`}
          >
            <RotateCcw size={12} className={state.kind === "refreshing" ? "animate-spin" : undefined} />
          </button>
          <button
            type="button"
            className="circle-btn danger"
            onClick={onRemove}
            disabled={isRemoving}
            aria-label={`Remove ${account.email}`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-col gap-1.5">
        {lanes.length > 0 ? (
          lanes.map((lane) => <UsageBar key={`${lane.group}|${lane.name}`} lane={lane} now={now} />)
        ) : (
          <p className="py-1 text-[12px] text-win-subtle">
            {state.kind === "failed"
              ? "No current usage snapshot"
              : state.kind === "requiresLogin"
                ? "Login required to load usage"
                : "Loading live usage…"}
          </p>
        )}
        {confirmed && banked && banked.count > 0 ? (
          <p className="flex items-center gap-1.5 text-[12px] font-medium">
            <RotateCcw size={13} className="text-win-reserve" />
            {banked.count} banked reset{banked.count === 1 ? "" : "s"} available
          </p>
        ) : null}
        {confirmed && account.lastSnapshot && account.lastSnapshot.bankedResets == null ? (
          <p className="text-[11px] text-win-subtle">Banked reset status unavailable</p>
        ) : null}
        {state.kind === "failed" ? (
          <div className="flex items-start gap-2 text-[12px] text-win-critical">
            <p className="flex-1">{state.message}</p>
            <button type="button" className="fluent-btn h-7 px-2 text-[11px]" onClick={onRefresh}>
              Retry
            </button>
          </div>
        ) : null}
        {state.kind === "requiresLogin" ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-[12px] font-semibold text-amber-400">Login required</p>
            <button type="button" className="fluent-btn fluent-btn-accent h-7 px-2 text-[11px]" onClick={onSignIn}>
              Sign in
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Freshness({
  state,
  fetchedAt,
  now,
}: {
  state: AccountRefreshState;
  fetchedAt?: number;
  now: number;
}) {
  let label = "Saved";
  let color = "text-win-subtle";
  if (state.kind === "cached") {
    label = `Last updated ${updateAge(state.fetchedAt, now)}`;
    color = "text-win-subtle font-semibold";
  } else if (state.kind === "refreshing") {
    label = "Syncing…";
    color = "text-win-accent";
  } else if (state.kind === "current") {
    const live = now - state.fetchedAt < 2 * 60 * 1000;
    label = live ? "Live" : `Last updated ${updateAge(state.fetchedAt, now)}`;
    color = live ? "text-win-ok font-semibold" : "text-win-subtle font-semibold";
  } else if (state.kind === "failed") {
    label = fetchedAt ? `Last updated ${updateAge(fetchedAt, now)}` : "Update failed";
    color = "text-amber-400 font-semibold";
  } else if (state.kind === "requiresLogin") {
    label = "Login required";
    color = "text-amber-400 font-semibold";
  }
  return <span className={cn("text-[11px]", color)}>{label}</span>;
}
