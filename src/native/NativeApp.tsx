import { useEffect, useState } from "react";
import { House, Settings } from "lucide-react";
import { Dashboard } from "@/components/quodex/Dashboard";
import { SettingsPage } from "@/components/quodex/SettingsPage";
import { RemoveDialog } from "@/components/quodex/RemoveDialog";
import { CaptionClose, CaptionMax, CaptionMin, CaptionRestore, QuodexAppIcon } from "@/components/icons";
import { useDesktopStore } from "@/lib/desktop/store";
import { displayLaneName, laneId, reportedLanes } from "@/lib/quodex/types";
import { useQuodexStore } from "@/lib/quodex/store";
import { cn } from "@/lib/utils";

const flyout = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("flyout") === "1";

export function NativeApp() {
  const page = useDesktopStore((s) => s.quodexPage);
  const setPage = useDesktopStore((s) => s.setQuodexPage);
  const theme = useDesktopStore((s) => s.theme);
  const removeTarget = useDesktopStore((s) => s.removeTarget);
  const pinned = useDesktopStore((s) => s.quodexPinned);
  const minimizeToTray = useDesktopStore((s) => s.minimizeToTray);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers = new Map<string, number>();

    const rehydrate = async () => {
      await Promise.all([useQuodexStore.persist.rehydrate(), useDesktopStore.persist.rehydrate()]);
      if (cancelled) return;
      useQuodexStore.getState().hydrate();
      useDesktopStore.getState().hydrate();
      const prefs = await window.quodexNative?.getWindowPrefs();
      if (!cancelled && prefs) {
        if (typeof prefs.flyoutPinned === "boolean") {
          useDesktopStore.getState().setQuodexPinned(prefs.flyoutPinned);
        }
        if (typeof prefs.minimizeToTray === "boolean") {
          useDesktopStore.getState().setMinimizeToTray(prefs.minimizeToTray);
        }
      }
      if (!flyout) reconcileAlarms();
    };

    const reconcileAlarms = () => {
      const now = Date.now();
      const keep = new Set<string>();
      for (const account of useQuodexStore.getState().accounts) {
        if (!account.resetNotificationsEnabled || account.isDemo) continue;
        for (const lane of reportedLanes(account.lastSnapshot)) {
          if (!lane.resetAt || lane.resetAt - now <= 5_000) continue;
          const id = `${account.id}:${laneId(lane)}:${lane.resetAt}`;
          keep.add(id);
          if (timers.has(id)) continue;
          const MAX_TIMEOUT = 2_147_000_000;
          const wait = lane.resetAt - now;
          const handle = window.setTimeout(() => {
            timers.delete(id);
            if (wait > MAX_TIMEOUT) {
              reconcileAlarms();
              return;
            }
            void window.quodexNative?.notify({
              title: "Usage reset",
              body: `${displayLaneName(lane.group, lane.name)} reset for ${account.email}.`,
            });
          }, Math.min(wait, MAX_TIMEOUT));
          timers.set(id, handle);
        }
      }
      for (const [id, handle] of timers) {
        if (!keep.has(id)) {
          window.clearTimeout(handle);
          timers.delete(id);
        }
      }
    };

    void rehydrate();

    const onStorage = (event: StorageEvent) => {
      if (event.key === "quodex-win-v1" || event.key === "quodex-desktop-v2") void rehydrate();
    };
    window.addEventListener("storage", onStorage);

    const native = window.quodexNative;
    const stopCommand = native?.onCommand((command) => {
      if (command === "reload") {
        void rehydrate();
        return;
      }
      if (command === "window:maximized") {
        setMaximized(true);
        return;
      }
      if (command === "window:restored") {
        setMaximized(false);
        return;
      }
      if (command === "flyout-pin") {
        void window.quodexNative?.getWindowPrefs().then((prefs) => {
          if (prefs && typeof prefs.flyoutPinned === "boolean") {
            useDesktopStore.getState().setQuodexPinned(prefs.flyoutPinned);
          }
        });
        return;
      }
      if (command === "refresh") {
        if (flyout) {
          void rehydrate();
          return;
        }
        void useQuodexStore.getState().refreshAll("manual").then(() => reconcileAlarms());
      }
    });

    const clock = window.setInterval(() => {
      useQuodexStore.getState().tick();
      if (!flyout) reconcileAlarms();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(clock);
      window.removeEventListener("storage", onStorage);
      stopCommand?.();
      for (const handle of timers.values()) window.clearTimeout(handle);
    };
  }, []);

  useEffect(() => {
    if (!flyout) return;
    void window.quodexNative?.setFlyoutPinned(pinned);
  }, [pinned]);

  useEffect(() => {
    void window.quodexNative?.setTitleTheme(theme);
  }, [theme]);

  const accounts = useQuodexStore((s) => s.accounts);
  useEffect(() => {
    if (flyout) return;
    const live = accounts.filter((account) => !account.isDemo);
    const label =
      live.length === 0
        ? "Quodex"
        : live.length === 1
          ? `Quodex · ${live[0]?.email ?? "1 account"}`
          : `Quodex · ${live.length} accounts`;
    void window.quodexNative?.setTrayTooltip(label);
  }, [accounts]);

  return (
    <div className={cn("native-shell", flyout && "is-flyout")} data-theme={theme} data-effects="on">
      {flyout ? (
        <Dashboard variant="flyout" />
      ) : (
        <>
          <header className="native-titlebar">
            <span className="flex items-center gap-2 text-[12px] font-medium">
              <QuodexAppIcon size={16} />
              Quodex
            </span>
            <span className="native-titlebar-space" />
            <div className="win-caption">
              <button
                type="button"
                title={minimizeToTray ? "Hide to tray" : "Minimize"}
                aria-label={minimizeToTray ? "Hide to tray" : "Minimize"}
                onClick={() => void window.quodexNative?.minimizeWindow()}
              >
                <CaptionMin />
              </button>
              <button
                type="button"
                title={maximized ? "Restore" : "Maximize"}
                aria-label={maximized ? "Restore" : "Maximize"}
                onClick={() => void window.quodexNative?.toggleMaximize()}
              >
                {maximized ? <CaptionRestore /> : <CaptionMax />}
              </button>
              <button
                type="button"
                className="caption-close"
                title="Hide to tray"
                aria-label="Hide to tray"
                onClick={() => void window.quodexNative?.hideToTray()}
              >
                <CaptionClose />
              </button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1">
            <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-win-stroke py-2">
              <button
                type="button"
                className={cn("grid size-10 place-items-center rounded-win text-win-muted", page === "home" && "bg-white/8 text-win-text")}
                aria-label="Home"
                onClick={() => setPage("home")}
              >
                <House size={16} />
              </button>
              <button
                type="button"
                className={cn("grid size-10 place-items-center rounded-win text-win-muted", page === "settings" && "bg-white/8 text-win-text")}
                aria-label="Settings"
                onClick={() => setPage("settings")}
              >
                <Settings size={16} />
              </button>
            </nav>
            <div className="min-w-0 flex-1">{page === "home" ? <Dashboard variant="window" /> : <SettingsPage />}</div>
          </div>
        </>
      )}
      {removeTarget ? <RemoveDialog /> : null}
    </div>
  );
}
