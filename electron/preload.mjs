import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("quodexNative", {
  isNative: true,
  platform: process.platform,
  vault: "dpapi",
  startDeviceLogin: () => ipcRenderer.invoke("quodex:login:start"),
  pollDeviceLogin: (input) => ipcRenderer.invoke("quodex:login:poll", input),
  fetchAccountUsage: (input) => ipcRenderer.invoke("quodex:usage:fetch", input),
  deleteTokens: (accountID) => ipcRenderer.invoke("quodex:tokens:delete", accountID),
  hasToken: (accountID) => ipcRenderer.invoke("quodex:tokens:has", accountID),
  notify: (input) => ipcRenderer.invoke("quodex:notify", input),
  getAutoStart: () => ipcRenderer.invoke("quodex:autostart:get"),
  setAutoStart: (enabled) => ipcRenderer.invoke("quodex:autostart:set", enabled),
  hideToTray: () => ipcRenderer.invoke("quodex:window:hide"),
  showMain: () => ipcRenderer.invoke("quodex:window:show"),
  minimizeWindow: () => ipcRenderer.invoke("quodex:window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("quodex:window:maximize"),
  quitApp: () => ipcRenderer.invoke("quodex:app:quit"),
  getWindowPrefs: () => ipcRenderer.invoke("quodex:window:prefs:get"),
  setWindowPrefs: (prefs) => ipcRenderer.invoke("quodex:window:prefs:set", prefs),
  openExternal: (url) => ipcRenderer.invoke("quodex:open", url),
  setFlyoutPinned: (pinned) => ipcRenderer.invoke("quodex:flyout:pin", pinned),
  setTrayTooltip: (text) => ipcRenderer.invoke("quodex:tray:tooltip", text),
  setTitleTheme: (theme) => ipcRenderer.invoke("quodex:theme", theme),
  getVaultStatus: () => ipcRenderer.invoke("quodex:vault:status"),
  onCommand: (callback) => {
    const listener = (_event, command) => {
      if (typeof command === "string") callback(command);
    };
    ipcRenderer.on("quodex:command", listener);
    return () => ipcRenderer.removeListener("quodex:command", listener);
  },
});
