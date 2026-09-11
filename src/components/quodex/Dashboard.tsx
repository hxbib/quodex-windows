import { useState } from "react";
import { ArrowDownUp, Pin, Plus, RotateCw, AppWindow } from "lucide-react";
import { AccountCard } from "./AccountCard";
import { LoginView } from "./LoginView";
import { PoolSummary } from "./PoolSummary";
import { useDesktopStore } from "@/lib/desktop/store";
import { emptyFootnote } from "@/lib/quodex/copy";
import { MAXIMUM_ACCOUNTS } from "@/lib/quodex/types";
import { useQuodexStore } from "@/lib/quodex/store";
import { cn } from "@/lib/utils";

function pinFlyout(next: boolean) {
  const desktop = useDesktopStore.getState();
  desktop.setQuodexPinned(next);
  if (next) desktop.setFlyout("quodex-tray");
  if (window.quodexNative) void window.quodexNative.setFlyoutPinned(next);
}

export function Dashboard({ variant }: { variant: "window" | "flyout" }) {
  const accounts = useQuodexStore((s) => s.accounts);
  const refreshStates = useQuodexStore((s) => s.refreshStates);
  const now = useQuodexStore((s) => s.now);
  const isRefreshing = useQuodexStore((s) => s.isRefreshing);
  const isSorting = useQuodexStore((s) => s.isSorting);
  const loginPresented = useQuodexStore((s) => s.loginPresented);
  const toast = useQuodexStore((s) => s.toast);
  const presentLogin = useQuodexStore((s) => s.presentLogin);
  const refreshAll = useQuodexStore((s) => s.refreshAll);
  const sortBySoonestReset = useQuodexStore((s) => s.sortBySoonestReset);
  const copyEmail = useQuodexStore((s) => s.copyEmail);
  const toggleNotifications = useQuodexStore((s) => s.toggleNotifications);
  const refreshOne = useQuodexStore((s) => s.refreshOne);
  const reorder = useQuodexStore((s) => s.reorder);
  const pinned = useDesktopStore((s) => s.quodexPinned);
  const setRemoveTarget = useDesktopStore((s) => s.setRemoveTarget);
  const [dragId, setDragId] = useState<string | null>(null);

  if (loginPresented) return <LoginView />;

  return (
    <div className="relative flex h-full flex-col">
      {toast ? (
        <div className="pointer-events-none absolute inset-x-3 top-2 z-10">
          <div className="toast-card mica">
            <p>{toast.message}</p>
          </div>
        </div>
      ) : null}

      <header className="flex items-center gap-2 px-3 pb-1 pt-2">
        <div className="grid size-6 place-items-center rounded-md bg-quodex text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_28%)]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4.4 8.2a7.6 7.6 0 1 1 0 7.6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M8.6 12a3.4 3.4 0 1 1 1 2.4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[13px] font-semibold leading-none">Quodex</h1>
          <p className="mt-0.5 text-[11px] leading-none text-win-subtle">
            {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          {variant === "flyout" ? (
            <button
              type="button"
              className="circle-btn"
              onClick={() => {
                if (window.quodexNative) {
                  void window.quodexNative.showMain();
                  return;
                }
                useDesktopStore.getState().openWindow("quodex");
              }}
              aria-label="Open window"
            >
              <AppWindow size={12} />
            </button>
          ) : null}
          <button
            type="button"
            className={cn("circle-btn", pinned && "active")}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              pinFlyout(!useDesktopStore.getState().quodexPinned);
            }}
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin flyout" : "Pin flyout open"}
          >
            <Pin size={12} fill={pinned ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            className="circle-btn"
            onClick={() => void sortBySoonestReset()}
            disabled={isSorting || accounts.length === 0}
            aria-label="Sort accounts by soonest reset"
          >
            <ArrowDownUp size={12} className={isSorting ? "animate-pulse" : undefined} />
          </button>
          <button
            type="button"
            className="circle-btn"
            onClick={() => void refreshAll("manual")}
            disabled={isRefreshing || accounts.length === 0}
            aria-label="Refresh usage"
          >
            <RotateCw size={12} className={isRefreshing ? "animate-spin" : undefined} />
          </button>
          <button
            type="button"
            className="circle-btn accent"
            onClick={() => presentLogin()}
            disabled={accounts.length >= MAXIMUM_ACCOUNTS}
            aria-label="Add ChatGPT account"
          >
            <Plus size={14} />
          </button>
        </div>
      </header>

      {accounts.length === 0 ? (
        <EmptyState onAdd={() => presentLogin()} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
          <PoolSummary accounts={accounts} refreshStates={refreshStates} now={now} />
          <div className="grid grid-cols-1 gap-1.5">
            {accounts.map((account, index) => (
              <div
                key={account.id}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragId) reorder(dragId, index);
                  setDragId(null);
                }}
              >
                <div
                  onDragStart={() => setDragId(account.id)}
                  onDragEnd={() => setDragId(null)}
                  className={cn(dragId === account.id && "opacity-55")}
                >
                  <AccountCard
                    account={account}
                    state={refreshStates[account.id] ?? { kind: "idle" }}
                    now={now}
                    compact={variant === "flyout"}
                    onCopyEmail={() => void copyEmail(account.email)}
                    onToggleNotifications={() => void toggleNotifications(account.id)}
                    onRefresh={() => void refreshOne(account.id)}
                    onSignIn={() => presentLogin(account.id)}
                    onRemove={() => setRemoveTarget(account.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="grid size-14 place-items-center rounded-xl bg-quodex/15 text-quodex">
        <Plus size={24} />
      </div>
      <h2 className="text-[16px] font-semibold">This desktop is a preview</h2>
      <p className="max-w-sm text-[12px] text-win-muted">
        Restore the sample accounts to keep exploring, or download the installer to sign in on your PC.
      </p>
      <button type="button" className="fluent-btn fluent-btn-accent" onClick={onAdd}>
        Add an account
      </button>
      <p className="max-w-sm pt-4 text-[11px] leading-relaxed text-win-subtle">{emptyFootnote()}</p>
    </div>
  );
}
