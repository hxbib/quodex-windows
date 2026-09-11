import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { snapshotFromUsage, type ResetCreditsResponse, type UsageAPIResponse } from "@/lib/quodex/lanes";
import type { QuodexNativeBridge } from "@/lib/native-bridge";

type UsageRaw =
  | {
      ok: true;
      usage: UsageAPIResponse;
      resets: ResetCreditsResponse | null;
      resetLookupFailed: boolean;
    }
  | { ok: false; code: "login_required" | "invalid"; message: string };

export function installNativeBridge() {
  if (typeof window === "undefined" || window.quodexNative) return;
  const listeners = new Set<(command: string) => void>();
  void listen<string>("quodex-command", (event) => {
    if (typeof event.payload === "string") {
      for (const listener of listeners) listener(event.payload);
    }
  });
  const bridge: QuodexNativeBridge = {
    isNative: true,
    platform: "win32",
    vault: "dpapi",
    startDeviceLogin: () => invoke("start_device_login"),
    pollDeviceLogin: (input) =>
      invoke("poll_device_login", { deviceAuthId: input.deviceAuthID, userCode: input.userCode }),
    fetchAccountUsage: async (input) => {
      const raw = await invoke<UsageRaw>("fetch_usage", { accountId: input.accountID });
      if (!raw || raw.ok !== true) {
        return {
          ok: false as const,
          code: raw && "code" in raw ? raw.code : "invalid",
          message: raw && "message" in raw ? raw.message : "The service returned an invalid response.",
        };
      }
      return {
        ok: true as const,
        snapshot: snapshotFromUsage(raw.usage, raw.resets, raw.resetLookupFailed),
        email: raw.usage.email ?? null,
        plan: raw.usage.plan_type ?? null,
      };
    },
    deleteTokens: (accountID) => invoke("delete_tokens", { accountId: accountID }),
    hasToken: (accountID) => invoke("has_token", { accountId: accountID }),
    listIdentities: () => invoke("list_identities"),
    notify: (input) => invoke("show_toast", { title: input.title, body: input.body }),
    getAutoStart: () => invoke("autostart_get"),
    setAutoStart: (enabled) => invoke("autostart_set", { enabled }),
    hideToTray: () => invoke("window_hide"),
    showMain: () => invoke("window_show"),
    minimizeWindow: () => invoke("window_minimize"),
    toggleMaximize: () => invoke("window_maximize"),
    quitApp: () => invoke("app_quit"),
    getWindowPrefs: () => invoke("prefs_get"),
    setWindowPrefs: (prefs) => invoke("prefs_set", { minimizeToTray: prefs.minimizeToTray }),
    openExternal: (url) => invoke("open_external", { url }),
    setFlyoutPinned: (pinned) => invoke("flyout_pin", { pinned }),
    setTrayTooltip: (text) => invoke("tray_tooltip", { text }),
    setTitleTheme: (theme) => invoke("title_theme", { theme }),
    getVaultStatus: () => invoke("vault_status"),
    setAlarms: (alarms) => invoke("set_alarms", { alarms }),
    onCommand: (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
  window.quodexNative = bridge;
}
