import type { ChatGPTIdentity } from "./quodex/jwt";

export interface NativePollComplete {
  status: "complete";
  identity: ChatGPTIdentity;
}

export interface NativePollPending {
  status: "pending";
}

export interface NativeUsageOk {
  ok: true;
  snapshot: import("./quodex/types").UsageSnapshot;
  email: string | null;
  plan: string | null;
}

export interface NativeUsageErr {
  ok: false;
  code: "login_required" | "invalid";
  message: string;
}

export interface NativeVaultStatus {
  encrypted: boolean;
  backend: "dpapi" | "keychain" | "basic_text" | "unknown";
}

export interface NativeWindowPrefs {
  minimizeToTray: boolean;
  flyoutPinned?: boolean;
}

export interface NativeAlarm {
  id: string;
  fireAt: number;
  title: string;
  body: string;
}

export interface QuodexNativeBridge {
  isNative: true;
  platform: "win32" | "linux" | "darwin";
  startDeviceLogin: () => Promise<{
    verificationURL: string;
    userCode: string;
    deviceAuthID: string;
    intervalSeconds: number;
  }>;
  pollDeviceLogin: (input: {
    deviceAuthID: string;
    userCode: string;
  }) => Promise<NativePollComplete | NativePollPending>;
  fetchAccountUsage: (input: { accountID: string }) => Promise<NativeUsageOk | NativeUsageErr>;
  deleteTokens: (accountID: string) => Promise<void>;
  hasToken: (accountID: string) => Promise<boolean>;
  listIdentities: () => Promise<ChatGPTIdentity[]>;
  notify: (input: { title: string; body: string }) => Promise<void>;
  getAutoStart: () => Promise<boolean>;
  setAutoStart: (enabled: boolean) => Promise<boolean>;
  hideToTray: () => Promise<void>;
  showMain: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  toggleMaximize: () => Promise<boolean>;
  quitApp: () => Promise<void>;
  getWindowPrefs: () => Promise<NativeWindowPrefs>;
  setWindowPrefs: (prefs: Partial<NativeWindowPrefs>) => Promise<NativeWindowPrefs>;
  openExternal: (url: string) => Promise<void>;
  setFlyoutPinned: (pinned: boolean) => Promise<void>;
  setTrayTooltip: (text: string) => Promise<void>;
  setTitleTheme: (theme: "dark" | "light") => Promise<void>;
  getVaultStatus: () => Promise<NativeVaultStatus>;
  setAlarms: (alarms: NativeAlarm[]) => Promise<void>;
  onCommand: (callback: (command: string) => void) => () => void;
  vault: "dpapi" | "safeStorage" | "none";
}

declare global {
  interface Window {
    quodexNative?: QuodexNativeBridge;
  }
}

export {};
