import { refuseWebOpenAI } from "./web-guard";

const NATIVE_BUILD = import.meta.env.VITE_NATIVE === "1";

export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.quodexNative?.isNative);
}

export async function startDeviceLogin() {
  if (isNativeApp() && window.quodexNative) {
    return window.quodexNative.startDeviceLogin();
  }
  if (NATIVE_BUILD) throw new Error("Native bridge missing");
  refuseWebOpenAI();
}

export async function pollDeviceLogin(input: { deviceAuthID: string; userCode: string }) {
  if (isNativeApp() && window.quodexNative) {
    return window.quodexNative.pollDeviceLogin(input);
  }
  if (NATIVE_BUILD) throw new Error("Native bridge missing");
  void input;
  refuseWebOpenAI();
}

export async function fetchAccountUsage(input: { accessToken?: string; accountID: string }) {
  if (isNativeApp() && window.quodexNative) {
    return window.quodexNative.fetchAccountUsage({ accountID: input.accountID });
  }
  if (NATIVE_BUILD) throw new Error("Native bridge missing");
  void input;
  refuseWebOpenAI();
}

export async function nativeDeleteTokens(accountID: string) {
  if (!isNativeApp() || !window.quodexNative) return;
  await window.quodexNative.deleteTokens(accountID);
}

export async function nativeHasToken(accountID: string): Promise<boolean> {
  if (!isNativeApp() || !window.quodexNative) return false;
  return window.quodexNative.hasToken(accountID);
}

export async function nativeNotify(title: string, body: string) {
  if (isNativeApp() && window.quodexNative) {
    await window.quodexNative.notify({ title, body });
    return;
  }
  try {
    const { useDesktopStore } = await import("@/lib/desktop/store");
    useDesktopStore.getState().pushNotification({ title, body, source: "quodex" });
  } catch {
    /* desktop chrome not mounted */
  }
}
