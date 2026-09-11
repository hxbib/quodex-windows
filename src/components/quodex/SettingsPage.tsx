import { useEffect, useState } from "react";
import { Bell, Eraser, Monitor, Pin, Shield, Sparkles, SquareArrowDown, Power } from "lucide-react";
import { isNativeApp } from "@/lib/openai/api";
import { useDesktopStore } from "@/lib/desktop/store";
import { useQuodexStore } from "@/lib/quodex/store";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const accounts = useQuodexStore((s) => s.accounts);
  const restoreDemo = useQuodexStore((s) => s.restoreDemo);
  const clearDemo = useQuodexStore((s) => s.clearDemo);
  const demoCount = accounts.filter((account) => account.isDemo).length;
  const native = isNativeApp();

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <h1 className="text-[22px] font-semibold">Quodex</h1>
      <p className="mt-1 text-[13px] text-win-subtle">
        {native
          ? "Windows tray companion — DPAPI vault, open at login, and reset toasts."
          : "This live Windows 11 page is the product site. Sample accounts are for exploring. Download the installer to sign in — sessions there are sealed with DPAPI."}
      </p>

      {native ? <NativeAppearanceSection /> : null}
      <WindowLifecycleSection native={native} />

      <section className="quodex-card mt-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold">
          <Bell size={15} /> Notifications
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-win-subtle">
          {native
            ? "The account bell schedules a Windows toast for the next reported reset. Newly observed banked resets notify automatically. Hiding to the tray keeps Quodex running so alerts still fire. Quit is the only way to stop them."
            : "The account bell schedules a local notification for the next reported reset. Newly observed banked resets notify automatically. Hide to the tray to keep tracking. Real ChatGPT sign-in is not available in this browser preview."}
        </p>
      </section>

      {native ? null : (
      <section className="quodex-card mt-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold">
          <Sparkles size={15} /> Sample accounts
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-win-subtle">
          {demoCount > 0
            ? `${demoCount} sample account${demoCount === 1 ? "" : "s"} are included so the desktop is ready. Real OpenAI device-code sign-in lives in the downloaded Windows app, not this website.`
            : "Sample accounts are hidden. Restore them to preview pooled capacity without signing in."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="fluent-btn" onClick={restoreDemo}>
            Restore samples
          </button>
          <button type="button" className="fluent-btn" onClick={clearDemo} disabled={demoCount === 0}>
            <span className="inline-flex items-center gap-1">
              <Eraser size={13} /> Remove samples
            </span>
          </button>
        </div>
      </section>
      )}

      <section className="quodex-card mt-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold">
          <Shield size={15} /> Privacy
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-win-subtle">
          {native
            ? "Access tokens never enter this window. They live in a DPAPI-sealed vault under %APPDATA%\\Quodex, bound to your Windows user the way Keychain is bound to a Mac login. Email and usage snapshots stay local. Quodex does not submit chats, redeem banked resets, or send credentials to unapproved hosts."
            : "This website never stores a ChatGPT session. Download the installer to sign in — access tokens are sealed with Windows DPAPI on your PC. Independent project, not affiliated with OpenAI."}
        </p>
      </section>
    </div>
  );
}

function NativeAppearanceSection() {
  const theme = useDesktopStore((s) => s.theme);
  const setTheme = useDesktopStore((s) => s.setTheme);

  return (
    <section className="quodex-card mt-5">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold">
        <Monitor size={15} /> Appearance
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-win-subtle">
        Caption buttons follow this theme. Windows 11 can also tint the frame with Mica; Windows 10 keeps a solid
        surface.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={cn("fluent-btn", theme === "dark" && "fluent-btn-accent")}
          onClick={() => setTheme("dark")}
        >
          Dark
        </button>
        <button
          type="button"
          className={cn("fluent-btn", theme === "light" && "fluent-btn-accent")}
          onClick={() => setTheme("light")}
        >
          Light
        </button>
      </div>
    </section>
  );
}

function WindowLifecycleSection({ native }: { native: boolean }) {
  const minimizeToTray = useDesktopStore((s) => s.minimizeToTray);
  const setMinimizeToTray = useDesktopStore((s) => s.setMinimizeToTray);
  const quodexPinned = useDesktopStore((s) => s.quodexPinned);
  const setQuodexPinned = useDesktopStore((s) => s.setQuodexPinned);
  const hideQuodexToTray = useDesktopStore((s) => s.hideQuodexToTray);
  const quitQuodex = useDesktopStore((s) => s.quitQuodex);
  const [autoStart, setAutoStart] = useState(false);
  const [vault, setVault] = useState<{ encrypted: boolean; backend: string } | null>(null);
  const [nativeMinimize, setNativeMinimize] = useState(false);

  useEffect(() => {
    const bridge = window.quodexNative;
    if (!bridge) return;
    void bridge.getAutoStart().then(setAutoStart);
    void bridge.getVaultStatus().then((status) => setVault(status));
    void bridge.getWindowPrefs().then((prefs) => {
      if (prefs) setNativeMinimize(Boolean(prefs.minimizeToTray));
    });
  }, []);

  const minimizeOn = native ? nativeMinimize : minimizeToTray;
  const toggleMinimize = () => {
    const next = !minimizeOn;
    if (native) {
      setNativeMinimize(next);
      void window.quodexNative?.setWindowPrefs({ minimizeToTray: next });
    } else {
      setMinimizeToTray(next);
    }
  };

  return (
    <section className={cn("quodex-card", native ? "mt-3" : "mt-5")}>
      <h2 className="flex items-center gap-2 text-[14px] font-semibold">
        <SquareArrowDown size={15} /> Window
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-win-subtle">
        Quodex is a tray companion, like the Mac menu-bar original.{" "}
        <span className="text-win-text">Minimize</span> keeps a taskbar button.{" "}
        <span className="text-win-text">Close</span> hides beside the clock so tracking, toasts, and the 30-minute
        check keep going. <span className="text-win-text">Quit</span> is only this button or the tray’s right-click
        menu.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {native ? (
          <button
            type="button"
            className={cn("fluent-btn", autoStart && "fluent-btn-accent")}
            onClick={() => {
              void window.quodexNative?.setAutoStart(!autoStart).then(setAutoStart);
            }}
          >
            {autoStart ? "Open at login on" : "Open at login off"}
          </button>
        ) : null}
        <button
          type="button"
          className={cn("fluent-btn", minimizeOn && "fluent-btn-accent")}
          onClick={toggleMinimize}
        >
          {minimizeOn ? "Minimize to tray on" : "Minimize to tray off"}
        </button>
        <button
          type="button"
          className={cn("fluent-btn", quodexPinned && "fluent-btn-accent")}
          onClick={() => {
            const next = !quodexPinned;
            setQuodexPinned(next);
            if (next) useDesktopStore.getState().setFlyout("quodex-tray");
            if (window.quodexNative) void window.quodexNative.setFlyoutPinned(next);
          }}
        >
          <span className="inline-flex items-center gap-1">
            <Pin size={13} /> {quodexPinned ? "Flyout pinned" : "Pin flyout"}
          </span>
        </button>
        <button
          type="button"
          className="fluent-btn"
          onClick={() => {
            if (native) void window.quodexNative?.hideToTray();
            else hideQuodexToTray();
          }}
        >
          Hide to tray
        </button>
        <button
          type="button"
          className="fluent-btn text-win-danger"
          onClick={() => {
            if (native) void window.quodexNative?.quitApp();
            else quitQuodex();
          }}
        >
          <span className="inline-flex items-center gap-1">
            <Power size={13} /> Quit Quodex
          </span>
        </button>
      </div>
      {vault ? (
        <p className="mt-3 text-[12px] text-win-subtle">
          Session vault: {vault.encrypted ? "encrypted" : "unavailable"} ·{" "}
          {vault.backend === "dpapi" ? "Windows DPAPI" : vault.backend}
        </p>
      ) : null}
    </section>
  );
}