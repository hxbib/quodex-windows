import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clampRect, centeredRect, fitRect, oppositeSnap, type Rect } from "./geometry";
import type { SnapLayout, WindowId, WindowState } from "./types";

export type { SnapLayout, WindowId, WindowState };

export type FlyoutId =
  | "start"
  | "search"
  | "calendar"
  | "quick"
  | "quodex-tray"
  | "hidden-icons"
  | "power"
  | null;
export type OverlayId = "taskview" | "switcher" | null;
export type AccentId = "sky" | "blue" | "teal" | "sage" | "crimson";
export type PowerState = "lock" | "on" | "sleep" | "off";
export type SettingsSection = "system" | "personalization" | "apps";
export type ExplorerSection = "this-pc" | "quodex" | "recycle";
export type IconSize = "small" | "medium" | "large";
export type JumpListId = WindowId | "tray-quodex" | "github" | "start" | null;

export interface DesktopNotification {
  id: string;
  title: string;
  body: string;
  at: number;
  unread: boolean;
  source: "quodex" | "system";
}

export interface RecycledAccount {
  id: string;
  email: string;
  plan: string;
  removedAt: number;
}

export interface DesktopState {
  hydrated: boolean;
  theme: "dark" | "light";
  accent: AccentId;
  transparency: boolean;
  efficiency: boolean;
  reduceMotion: boolean;
  brightness: number;
  iconSize: IconSize;
  flyout: FlyoutId;
  overlay: OverlayId;
  jumpList: JumpListId;
  jumpListAt: { x: number; y: number } | null;
  contextMenu: { x: number; y: number } | null;
  titleMenu: { id: WindowId; x: number; y: number } | null;
  snapPreview: SnapLayout;
  snapAssist: { filler: SnapLayout; forId: WindowId } | null;
  peeking: boolean;
  showDesktopIds: WindowId[] | null;
  power: PowerState;
  focus: WindowId[];
  windows: Record<WindowId, WindowState>;
  viewport: { w: number; h: number };
  quodexPinned: boolean;
  quodexPage: "home" | "settings";
  quodexAlive: boolean;
  minimizeToTray: boolean;
  trayHintShown: boolean;
  removeTarget: string | null;
  settingsSection: SettingsSection;
  explorerSection: ExplorerSection;
  notifications: DesktopNotification[];
  recycle: RecycledAccount[];
  startAllApps: boolean;
  enteredDesktop: boolean;
  hydrate: () => void;
  setTheme: (theme: "dark" | "light") => void;
  toggleTheme: () => void;
  setAccent: (accent: AccentId) => void;
  setTransparency: (value: boolean) => void;
  setEfficiency: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
  setBrightness: (value: number) => void;
  setIconSize: (size: IconSize) => void;
  setFlyout: (flyout: FlyoutId) => void;
  toggleFlyout: (flyout: Exclude<FlyoutId, null>) => void;
  setOverlay: (overlay: OverlayId) => void;
  toggleOverlay: (overlay: Exclude<OverlayId, null>) => void;
  setJumpList: (id: JumpListId, at?: { x: number; y: number } | null) => void;
  setContextMenu: (menu: { x: number; y: number } | null) => void;
  setTitleMenu: (menu: { id: WindowId; x: number; y: number } | null) => void;
  setSnapPreview: (layout: SnapLayout) => void;
  setViewport: (w: number, h: number) => void;
  setPeeking: (peeking: boolean) => void;
  setPower: (power: PowerState) => void;
  setStartAllApps: (value: boolean) => void;
  openWindow: (id: WindowId) => void;
  closeWindow: (id: WindowId) => void;
  hideQuodexToTray: () => void;
  quitQuodex: () => void;
  setMinimizeToTray: (value: boolean) => void;
  minimizeWindow: (id: WindowId) => void;
  toggleMaximize: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  moveWindow: (id: WindowId, x: number, y: number) => void;
  resizeWindow: (id: WindowId, rect: Rect) => void;
  snapWindow: (id: WindowId, layout: SnapLayout) => void;
  cycleWindows: (delta?: number) => void;
  showDesktop: () => void;
  restartDesktop: () => void;
  shutDown: () => void;
  wake: () => void;
  enterDesktop: () => void;
  lockDesktop: () => void;
  setQuodexPinned: (pinned: boolean) => void;
  setQuodexPage: (page: "home" | "settings") => void;
  setRemoveTarget: (id: string | null) => void;
  setSettingsSection: (section: SettingsSection) => void;
  setExplorerSection: (section: ExplorerSection) => void;
  pushNotification: (input: Omit<DesktopNotification, "id" | "at" | "unread"> & { id?: string }) => void;
  dismissNotification: (id: string) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;
  recycleAccount: (account: RecycledAccount) => void;
  restoreRecycled: (id: string) => RecycledAccount | null;
  emptyRecycle: () => void;
  dismissSnapAssist: () => void;
}

const defaults: Record<WindowId, WindowState> = {
  quodex: { open: true, minimized: false, maximized: false, snap: null, x: 220, y: 44, w: 560, h: 720 },
  settings: { open: false, minimized: false, maximized: false, snap: null, x: 160, y: 72, w: 860, h: 620 },
  explorer: { open: false, minimized: false, maximized: false, snap: null, x: 120, y: 90, w: 780, h: 540 },
  taskmgr: { open: false, minimized: false, maximized: false, snap: null, x: 280, y: 120, w: 520, h: 420 },
};

function withFocus(focus: WindowId[], id: WindowId): WindowId[] {
  return [...focus.filter((item) => item !== id), id];
}

function pinnedFlyout(state: { quodexPinned: boolean }, requested: FlyoutId): FlyoutId {
  if (requested != null) return requested;
  return state.quodexPinned ? "quodex-tray" : null;
}

let liveUnlocked = false;

export const ACCENTS: Record<
  AccentId,
  { label: string; dark: string; light: string; inkDark: string; inkLight: string }
> = {
  sky: { label: "Sky", dark: "#60cdff", light: "#005fb8", inkDark: "#00354d", inkLight: "#ffffff" },
  blue: { label: "Blue", dark: "#4cc2ff", light: "#0067c0", inkDark: "#00344d", inkLight: "#ffffff" },
  teal: { label: "Teal", dark: "#61d6d6", light: "#038387", inkDark: "#003d3e", inkLight: "#ffffff" },
  sage: { label: "Sage", dark: "#9ad445", light: "#4c7a1f", inkDark: "#1c3300", inkLight: "#ffffff" },
  crimson: { label: "Crimson", dark: "#ff99a4", light: "#c42b1c", inkDark: "#4c0009", inkLight: "#ffffff" },
};

export const useDesktopStore = create<DesktopState>()(
  persist(
    (set, get) => ({
      hydrated: true,
      theme: "dark",
      accent: "sky",
      transparency: true,
      efficiency: false,
      reduceMotion: false,
      brightness: 100,
      iconSize: "medium",
      flyout: null,
      overlay: null,
      jumpList: null,
      jumpListAt: null,
      contextMenu: null,
      titleMenu: null,
      snapPreview: null,
      snapAssist: null,
      peeking: false,
      showDesktopIds: null,
      power: "lock",
      focus: ["quodex"],
      windows: defaults,
      viewport: { w: 1280, h: 800 },
      quodexPinned: false,
      quodexPage: "home",
      quodexAlive: true,
      minimizeToTray: false,
      trayHintShown: false,
      removeTarget: null,
      settingsSection: "apps",
      explorerSection: "this-pc",
      notifications: [],
      recycle: [],
      startAllApps: false,
      enteredDesktop: false,

      hydrate: () => {
        if (typeof window !== "undefined" && window.quodexNative?.isNative) {
          set({ hydrated: true, power: "on", enteredDesktop: true });
          return;
        }
        try {
          sessionStorage.removeItem("quodex-session-entered");
        } catch {

        }
        const current = get().windows;
        const view = get().viewport;
        const centered = centeredRect(view.w, view.h, defaults.quodex.w, defaults.quodex.h);
        set({
          hydrated: true,
          windows: {
            quodex: {
              ...defaults.quodex,
              ...current.quodex,
              ...centered,
              snap: liveUnlocked ? current.quodex?.snap ?? null : null,
              maximized: liveUnlocked ? current.quodex?.maximized ?? false : false,
              open: true,
              minimized: false,
            },
            settings: { ...defaults.settings, ...current.settings, snap: current.settings?.snap ?? null },
            explorer: { ...defaults.explorer, ...current.explorer, snap: current.explorer?.snap ?? null },
            taskmgr: { ...defaults.taskmgr, ...current.taskmgr, snap: current.taskmgr?.snap ?? null },
          },
          flyout: liveUnlocked ? pinnedFlyout(get(), null) : null,
          overlay: null,
          jumpList: null,
          jumpListAt: null,
          contextMenu: null,
          titleMenu: null,
          snapPreview: null,
          snapAssist: null,
          peeking: false,
          power: liveUnlocked || get().enteredDesktop ? "on" : "lock",
          enteredDesktop: liveUnlocked || get().enteredDesktop,
          quodexAlive: true,
        });
      },

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      setAccent: (accent) => set({ accent }),
      setTransparency: (value) => {
        set({ transparency: value });
        get().pushNotification({
          title: "Personalization",
          body: value ? "Transparency effects on." : "Transparency effects off — mica is now a solid fill.",
          source: "system",
        });
      },
      setEfficiency: (value) => {
        set({ efficiency: value, transparency: value ? false : get().transparency });
        get().pushNotification({
          title: "Efficiency mode",
          body: value
            ? "Effects reduced, clocks slowed, and auto-refresh stretched to save work."
            : "Efficiency mode off. Full desktop effects restored.",
          source: "system",
        });
      },
      setReduceMotion: (value) => set({ reduceMotion: value }),
      setBrightness: (value) => set({ brightness: Math.min(100, Math.max(20, value)) }),
      setIconSize: (size) => set({ iconSize: size }),
      setFlyout: (flyout) =>
        set({
          flyout: pinnedFlyout(get(), flyout),
          contextMenu: null,
          jumpList: null,
          overlay: flyout ? null : get().overlay,
          startAllApps: flyout === "start" ? get().startAllApps : false,
        }),
      toggleFlyout: (flyout) => {
        const state = get();
        const closing = state.flyout === flyout;
        const next = closing
          ? flyout === "quodex-tray"
            ? state.quodexPinned
              ? "quodex-tray"
              : null
            : pinnedFlyout(state, null)
          : flyout;
        set({
          flyout: next,
          contextMenu: null,
          jumpList: null,
          overlay: null,
          startAllApps: flyout === "start" ? get().startAllApps : false,
        });
      },
      setOverlay: (overlay) =>
        set({
          overlay,
          flyout: overlay ? null : pinnedFlyout(get(), get().flyout),
          jumpList: null,
        }),
      toggleOverlay: (overlay) => {
        const closing = get().overlay === overlay;
        const next = closing ? null : overlay;
        set({
          overlay: next,
          flyout: next ? null : pinnedFlyout(get(), null),
          jumpList: null,
          contextMenu: null,
        });
      },
      setJumpList: (id, at) => {
        const nextId = get().jumpList === id && !at ? null : id;
        set({
          jumpList: nextId,
          jumpListAt: id && (get().jumpList !== id || at) ? at ?? get().jumpListAt : null,
          flyout: nextId ? null : pinnedFlyout(get(), null),
          contextMenu: null,
        });
      },
      setContextMenu: (menu) =>
        set({
          contextMenu: menu,
          flyout: menu ? null : pinnedFlyout(get(), get().flyout),
          jumpList: null,
          titleMenu: null,
        }),
      setTitleMenu: (menu) => set({ titleMenu: menu, contextMenu: null, jumpList: null }),
      setSnapPreview: (layout) => {
        if (get().snapPreview === layout) return;
        set({ snapPreview: layout });
      },
      setViewport: (w, h) => {
        const view = get().viewport;
        if (view.w === w && view.h === h) return;
        const windows = { ...get().windows };
        (Object.keys(windows) as WindowId[]).forEach((id) => {
          const win = windows[id];
          if (win.maximized || win.snap) return;
          windows[id] = { ...win, ...fitRect(win, w, h) };
        });
        set({ viewport: { w, h }, windows });
      },
      setPeeking: (peeking) => set({ peeking }),
      setPower: (power) =>
        set({
          power,
          flyout: power === "on" ? pinnedFlyout(get(), null) : null,
          overlay: null,
          jumpList: null,
        }),
      setStartAllApps: (value) => set({ startAllApps: value }),

      openWindow: (id) => {
        const windows = { ...get().windows };
        windows[id] = { ...windows[id], open: true, minimized: false };
        set({
          windows,
          focus: withFocus(get().focus, id),
          flyout: pinnedFlyout(get(), null),
          overlay: null,
          jumpList: null,
          contextMenu: null,
          showDesktopIds: null,
          power: "on",
          quodexAlive: id === "quodex" ? true : get().quodexAlive,
        });
      },

      hideQuodexToTray: () => {
        const windows = { ...get().windows };
        windows.quodex = { ...windows.quodex, open: false, minimized: false };
        const shownHint = get().trayHintShown;
        set({
          windows,
          quodexAlive: true,
          trayHintShown: true,
          focus: get().focus.filter((item) => item !== "quodex"),
          snapAssist: get().snapAssist?.forId === "quodex" ? null : get().snapAssist,
          titleMenu: get().titleMenu?.id === "quodex" ? null : get().titleMenu,
          jumpList: get().jumpList === "quodex" ? null : get().jumpList,
        });
        if (!shownHint) {
          get().pushNotification({
            title: "Quodex is still running",
            body: "It's by the clock. Click the tray icon for a usage peek, double-click or use the taskbar to reopen. Right-click the tray icon to quit.",
            source: "quodex",
          });
        }
      },

      quitQuodex: () => {
        const windows = { ...get().windows };
        windows.quodex = { ...windows.quodex, open: false, minimized: false, maximized: false, snap: null };
        set({
          windows,
          quodexAlive: false,
          focus: get().focus.filter((item) => item !== "quodex"),
          flyout: get().flyout === "quodex-tray" ? null : get().flyout,
          jumpList: get().jumpList === "quodex" || get().jumpList === "tray-quodex" ? null : get().jumpList,
          snapAssist: get().snapAssist?.forId === "quodex" ? null : get().snapAssist,
          titleMenu: get().titleMenu?.id === "quodex" ? null : get().titleMenu,
        });
      },

      setMinimizeToTray: (value) => set({ minimizeToTray: value }),

      closeWindow: (id) => {
        if (id === "quodex") {
          get().hideQuodexToTray();
          return;
        }
        const windows = { ...get().windows };
        windows[id] = { ...windows[id], open: false, minimized: false, maximized: false, snap: null };
        set({
          windows,
          focus: get().focus.filter((item) => item !== id),
          flyout: get().flyout === "quodex-tray" ? get().flyout : null,
          snapAssist: get().snapAssist?.forId === id ? null : get().snapAssist,
        });
      },

      minimizeWindow: (id) => {
        if (id === "quodex" && get().minimizeToTray) {
          get().hideQuodexToTray();
          return;
        }
        const windows = { ...get().windows };
        windows[id] = { ...windows[id], minimized: true };
        set({ windows, focus: get().focus.filter((item) => item !== id), snapAssist: null });
      },

      toggleMaximize: (id) => {
        const windows = { ...get().windows };
        const nextMax = !windows[id].maximized;
        windows[id] = {
          ...windows[id],
          maximized: nextMax,
          minimized: false,
          snap: nextMax ? null : windows[id].snap,
        };
        set({ windows, focus: withFocus(get().focus, id), snapAssist: null });
      },

      focusWindow: (id) => {
        const state = get();
        const win = state.windows[id];
        if (!win.open) return;
        if (win.minimized) {
          const windows = { ...state.windows };
          windows[id] = { ...windows[id], minimized: false };
          set({ windows, focus: withFocus(state.focus, id), flyout: pinnedFlyout(state, null), overlay: null, showDesktopIds: null });
          return;
        }
        const flyout = pinnedFlyout(state, null);
        if (
          state.focus[state.focus.length - 1] === id &&
          state.flyout === flyout &&
          state.jumpList == null &&
          state.contextMenu == null &&
          state.overlay == null
        ) {
          return;
        }
        set({
          focus: withFocus(state.focus, id),
          flyout,
          jumpList: null,
          contextMenu: null,
          overlay: null,
        });
      },

      moveWindow: (id, x, y) => {
        const { viewport } = get();
        const windows = { ...get().windows };
        const next = clampRect({ x, y, w: windows[id].w, h: windows[id].h }, viewport.w, viewport.h);
        windows[id] = { ...windows[id], x: next.x, y: next.y, maximized: false, snap: null };
        set({ windows, snapPreview: null });
      },

      resizeWindow: (id, rect) => {
        const { viewport } = get();
        const next = clampRect(rect, viewport.w, viewport.h);
        const windows = { ...get().windows };
        windows[id] = { ...windows[id], ...next, maximized: false, snap: null };
        set({ windows });
      },

      snapWindow: (id, layout) => {
        const windows = { ...get().windows };
        if (!layout) {
          windows[id] = { ...windows[id], snap: null, maximized: false, minimized: false };
          set({ windows, focus: withFocus(get().focus, id), snapPreview: null, snapAssist: null });
          return;
        }
        if (layout === "maximize") {
          windows[id] = { ...windows[id], maximized: true, snap: null, minimized: false, open: true };
          set({ windows, focus: withFocus(get().focus, id), snapPreview: null, snapAssist: null, flyout: pinnedFlyout(get(), null) });
          return;
        }
        windows[id] = { ...windows[id], snap: layout, maximized: false, minimized: false, open: true };
        const filler = oppositeSnap(layout);
        const others = (Object.keys(windows) as WindowId[]).filter(
          (item) => item !== id && windows[item].open && !windows[item].minimized,
        );
        set({
          windows,
          focus: withFocus(get().focus, id),
          snapPreview: null,
          flyout: pinnedFlyout(get(), null),
          overlay: null,
          snapAssist: filler && others.length > 0 ? { filler, forId: id } : null,
        });
      },

      cycleWindows: (delta = 1) => {
        const open = (Object.keys(get().windows) as WindowId[]).filter(
          (id) => get().windows[id].open && !get().windows[id].minimized,
        );
        if (open.length === 0) return;
        const focused = get().focus[get().focus.length - 1];
        const index = Math.max(0, open.indexOf(focused));
        const next = open[(index + delta + open.length) % open.length];
        if (next) get().focusWindow(next);
      },

      showDesktop: () => {
        const { windows, showDesktopIds } = get();
        if (showDesktopIds && showDesktopIds.length > 0) {
          const next = { ...windows };
          for (const id of showDesktopIds) {
            if (next[id]) next[id] = { ...next[id], minimized: false, open: true };
          }
          set({ windows: next, showDesktopIds: null, peeking: false, focus: showDesktopIds });
          return;
        }
        const hidden: WindowId[] = [];
        const next = { ...windows };
        for (const id of Object.keys(next) as WindowId[]) {
          if (next[id].open && !next[id].minimized) {
            next[id] = { ...next[id], minimized: true };
            hidden.push(id);
          }
        }
        set({ windows: next, focus: [], flyout: pinnedFlyout(get(), null), overlay: null, showDesktopIds: hidden, peeking: false });
      },

      restartDesktop: () => {
        liveUnlocked = true;
        const view = get().viewport;
        const centered = centeredRect(view.w, view.h, defaults.quodex.w, defaults.quodex.h);
        const windows = { ...defaults, quodex: { ...defaults.quodex, ...centered, open: true, minimized: false } };
        set({
          windows,
          focus: ["quodex"],
          flyout: null,
          overlay: null,
          power: "on",
          peeking: false,
          showDesktopIds: null,
          snapAssist: null,
          quodexPage: "home",
          quodexAlive: true,
          enteredDesktop: true,
        });
        get().pushNotification({
          title: "Windows",
          body: "Desktop restarted. Window layout restored.",
          source: "system",
        });
      },

      shutDown: () => {
        liveUnlocked = false;
        const windows = { ...get().windows };
        for (const id of Object.keys(windows) as WindowId[]) {
          windows[id] = { ...windows[id], open: false, minimized: false };
        }
        set({
          windows,
          focus: [],
          flyout: null,
          overlay: null,
          power: "off",
          peeking: false,
          showDesktopIds: null,
          quodexAlive: false,
        });
      },

      wake: () => {
        if (get().power === "lock") {
          get().enterDesktop();
          return;
        }
        set({ power: "on", flyout: null });
      },

      enterDesktop: () => {
        liveUnlocked = true;
        const view = get().viewport;
        const centered = centeredRect(view.w, view.h, defaults.quodex.w, defaults.quodex.h);
        const windows = { ...get().windows };
        const alive = get().quodexAlive;
        if (alive) {
          windows.quodex = { ...windows.quodex, ...centered, open: true, minimized: false, maximized: false, snap: null };
        }
        set({
          power: "on",
          enteredDesktop: true,
          flyout: get().quodexPinned ? "quodex-tray" : null,
          overlay: null,
          jumpList: null,
          jumpListAt: null,
          windows,
          focus: alive
            ? withFocus(get().focus, "quodex")
            : get().focus.filter((id) => windows[id]?.open && !windows[id]?.minimized),
        });
      },

      lockDesktop: () => {
        liveUnlocked = false;
        set({
          power: "lock",
          flyout: null,
          overlay: null,
          jumpList: null,
          jumpListAt: null,
          contextMenu: null,
          titleMenu: null,
        });
      },

      setQuodexPinned: (pinned) =>
        set({
          quodexPinned: pinned,
          flyout: pinned ? "quodex-tray" : get().flyout,
        }),
      setQuodexPage: (page) => set({ quodexPage: page }),
      setRemoveTarget: (id) => set({ removeTarget: id }),
      setSettingsSection: (section) => set({ settingsSection: section }),
      setExplorerSection: (section) => set({ explorerSection: section }),

      pushNotification: (input) => {
        const note: DesktopNotification = {
          id: input.id ?? crypto.randomUUID(),
          title: input.title,
          body: input.body,
          source: input.source,
          at: Date.now(),
          unread: true,
        };
        set({ notifications: [note, ...get().notifications].slice(0, 24) });
      },

      dismissNotification: (id) =>
        set({ notifications: get().notifications.filter((item) => item.id !== id) }),

      markNotificationsRead: () =>
        set({
          notifications: get().notifications.map((item) => ({ ...item, unread: false })),
        }),

      clearNotifications: () => set({ notifications: [] }),

      recycleAccount: (account) =>
        set({ recycle: [account, ...get().recycle.filter((item) => item.id !== account.id)].slice(0, 20) }),

      restoreRecycled: (id) => {
        const found = get().recycle.find((item) => item.id === id) ?? null;
        if (!found) return null;
        set({ recycle: get().recycle.filter((item) => item.id !== id) });
        return found;
      },

      emptyRecycle: () => set({ recycle: [] }),
      dismissSnapAssist: () => set({ snapAssist: null }),
    }),
    {
      name: "quodex-desktop-v2",
      version: 5,
      partialize: (state) => ({
        theme: state.theme,
        accent: state.accent,
        transparency: state.transparency,
        efficiency: state.efficiency,
        reduceMotion: state.reduceMotion,
        brightness: state.brightness,
        iconSize: state.iconSize,
        settingsSection: state.settingsSection,
        minimizeToTray: state.minimizeToTray,
        trayHintShown: state.trayHintShown,
        quodexPinned: state.quodexPinned,
      }),
      migrate: (persisted) => {
        const data = persisted && typeof persisted === "object" ? (persisted as Record<string, unknown>) : {};
        return {
          theme: data.theme,
          accent: data.accent,
          transparency: data.transparency,
          efficiency: data.efficiency,
          reduceMotion: data.reduceMotion,
          brightness: data.brightness,
          iconSize: data.iconSize,
          settingsSection: data.settingsSection,
          minimizeToTray: data.minimizeToTray,
          trayHintShown: data.trayHintShown,
          quodexPinned: data.quodexPinned,
        };
      },
      skipHydration: true,
    },
  ),
);
