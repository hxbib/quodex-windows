import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  Notification,
  shell,
  ipcMain,
  safeStorage,
  powerMonitor,
  session,
  screen,
} from "electron";
import { existsSync, mkdirSync, renameSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const AUMID = "com.quodex.Quodex";
const DEVICE_LOGIN = { host: "auth.openai.com", path: "/codex/device" };
const ACCOUNT_ID = /^[A-Za-z0-9._-]{4,128}$/;
const AUTO_REFRESH_MS = 30 * 60 * 1000;

let mainWindow = null;
let flyoutWindow = null;
let tray = null;
let isQuitting = false;
let flyoutPinned = false;
let openai = null;
let trayClickTimer = null;
let windowPrefs = { minimizeToTray: false, firstHideDone: false, flyoutPinned: false };

function vaultPath() {
  return join(app.getPath("userData"), "oauth-tokens.dpapi");
}

function vaultBackend() {
  try {
    const backend = safeStorage.getSelectedStorageBackend?.();
    if (backend === "dpapi" || backend === "keychain" || backend === "basic_text") return backend;
  } catch {
    /* older Electron */
  }
  return safeStorage.isEncryptionAvailable() ? "dpapi" : "basic_text";
}

function assertSecureVault() {
  if (!safeStorage.isEncryptionAvailable() || vaultBackend() === "basic_text") {
    throw new Error("Windows DPAPI is unavailable. Quodex will not store ChatGPT sessions in plaintext.");
  }
}

function loadVault() {
  const file = vaultPath();
  if (!existsSync(file)) return { ok: true, vault: Object.create(null) };
  try {
    assertSecureVault();
    const json = safeStorage.decryptString(readFileSync(file));
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "The session vault is not a valid object." };
    }
    const vault = Object.create(null);
    for (const [key, value] of Object.entries(parsed)) {
      if (!ACCOUNT_ID.test(key) || !value || typeof value !== "object") continue;
      const record = value;
      if (typeof record.accessToken === "string" && typeof record.idToken === "string") {
        vault[key] = { idToken: record.idToken, accessToken: record.accessToken };
      }
    }
    return { ok: true, vault };
  } catch {
    return { ok: false, error: "The session vault could not be decrypted. Quodex will not overwrite it." };
  }
}

function requireVault() {
  const loaded = loadVault();
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.vault;
}

function saveVault(vault) {
  assertSecureVault();
  mkdirSync(app.getPath("userData"), { recursive: true });
  const file = vaultPath();
  const tmp = `${file}.tmp`;
  const bak = `${file}.bak`;
  writeFileSync(tmp, safeStorage.encryptString(JSON.stringify(vault)));
  if (existsSync(file)) {
    try {
      copyFileSync(file, bak);
    } catch {
      /* best-effort backup */
    }
  }
  renameSync(tmp, file);
}

async function loadOpenAI() {
  if (openai) return openai;
  openai = await import("./openai.bundle.mjs");
  return openai;
}

function iconFile() {
  const ico = join(ROOT, "quodex.ico");
  const png = join(ROOT, "quodex.png");
  if (existsSync(ico)) return ico;
  return png;
}

function trayImage() {
  const image = nativeImage.createFromPath(iconFile());
  if (image.isEmpty()) return nativeImage.createEmpty();
  return image.resize({ width: 16, height: 16 });
}

function asAccountID(value) {
  if (typeof value !== "string" || !ACCOUNT_ID.test(value)) {
    throw new Error("Invalid account.");
  }
  return value;
}

function loginItemOptions(enabled) {
  return {
    openAtLogin: enabled,
    enabled,
    name: "Quodex",
    path: process.execPath,
    args: enabled ? ["--hidden"] : [],
  };
}

function wantsHiddenStart(argv = process.argv) {
  return argv.includes("--hidden") || Boolean(app.getLoginItemSettings().wasOpenedAtLogin);
}

function wantsRefresh(argv = process.argv) {
  return argv.includes("--refresh");
}

let pendingRefresh = false;

function isEphemeralInstall() {
  const path = process.execPath.replace(/\//g, "\\").toLowerCase();
  return (
    path.includes("\\downloads\\") ||
    path.includes("\\temp\\") ||
    path.includes("\\appdata\\local\\temp") ||
    path.includes("\\tmp\\")
  );
}

function queueRefresh() {
  pendingRefresh = true;
  flushRefreshWhenReady();
}

function flushRefreshWhenReady() {
  if (!pendingRefresh) return;
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoading()) return;
  pendingRefresh = false;
  broadcast("refresh");
}

function watchRenderer(win) {
  win.webContents.on("did-finish-load", () => flushRefreshWhenReady());
  win.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "clean-exit" || win.isDestroyed()) return;
    win.reload();
  });
}

function ensureMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createMainWindow();
  return mainWindow;
}

function ensureFlyoutWindow() {
  if (!flyoutWindow || flyoutWindow.isDestroyed()) flyoutWindow = createFlyoutWindow();
  return flyoutWindow;
}

function showMain() {
  ensureFlyoutWindow()?.hide();
  const win = ensureMainWindow();
  if (!win || win.isDestroyed()) return;
  win.setSkipTaskbar(false);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  rebuildTrayMenu();
}

function hideToTray() {
  flyoutWindow?.hide();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setSkipTaskbar(true);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.hide();
  rebuildTrayMenu();
  maybeFirstHideToast();
}

function minimizeMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (windowPrefs.minimizeToTray) {
    hideToTray();
    return;
  }
  mainWindow.setSkipTaskbar(false);
  mainWindow.minimize();
  rebuildTrayMenu();
}

function maybeFirstHideToast() {
  if (windowPrefs.firstHideDone) return;
  windowPrefs.firstHideDone = true;
  saveWindowPrefs();
  if (!Notification.isSupported()) return;
  const note = new Notification({
    title: "Quodex is still running",
    body: "It's by the clock in the system tray. Click for usage, double-click to reopen, right-click to quit.",
    icon: iconFile(),
  });
  note.on("click", () => showMain());
  note.show();
}

function quitQuodex() {
  isQuitting = true;
  try {
    tray?.destroy();
  } catch {
    /* already gone */
  }
  tray = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners("close");
  }
  app.quit();
}

function broadcast(command) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("quodex:command", command);
  }
  if (command === "refresh") return;
  if (flyoutWindow && !flyoutWindow.isDestroyed()) {
    flyoutWindow.webContents.send("quodex:command", command);
  }
}

function fromApp(event) {
  const id = event.sender.id;
  return id === mainWindow?.webContents.id || id === flyoutWindow?.webContents.id;
}

function enableLoginItemByDefault() {
  if (isEphemeralInstall()) return;
  const marker = join(app.getPath("userData"), "login-item-initialized");
  if (existsSync(marker)) return;
  mkdirSync(app.getPath("userData"), { recursive: true });
  app.setLoginItemSettings(loginItemOptions(true));
  writeFileSync(marker, "1");
}

function prefsPath() {
  return join(app.getPath("userData"), "window-prefs.json");
}

function loadWindowPrefs() {
  try {
    const raw = JSON.parse(readFileSync(prefsPath(), "utf8"));
    return {
      minimizeToTray: Boolean(raw?.minimizeToTray),
      firstHideDone: Boolean(raw?.firstHideDone),
      flyoutPinned: Boolean(raw?.flyoutPinned),
    };
  } catch {
    return { minimizeToTray: false, firstHideDone: false, flyoutPinned: false };
  }
}

function saveWindowPrefs() {
  mkdirSync(app.getPath("userData"), { recursive: true });
  writeFileSync(prefsPath(), JSON.stringify(windowPrefs));
}

function isDeviceLoginUrl(url) {
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.port &&
    url.hostname.toLowerCase() === DEVICE_LOGIN.host &&
    url.pathname === DEVICE_LOGIN.path
  );
}

function applyTitleTheme(theme) {
  /* Custom caption buttons follow the renderer theme; no OS overlay. */
  void theme;
}

function installDesktopShortcut() {
  if (process.platform !== "win32") return;
  const shortcut = join(app.getPath("desktop"), "Quodex.lnk");
  try {
    shell.writeShortcutLink(shortcut, {
      target: process.execPath,
      cwd: dirname(process.execPath),
      appUserModelId: AUMID,
      icon: process.execPath,
      iconIndex: 0,
      description: "ChatGPT usage tracker",
    });
  } catch {
    /* desktop folder may be redirected or read-only */
  }
}

function installStartMenuShortcut() {
  if (process.platform !== "win32") return;
  const shortcut = join(app.getPath("appData"), "Microsoft/Windows/Start Menu/Programs/Quodex.lnk");
  try {
    shell.writeShortcutLink(shortcut, {
      target: process.execPath,
      cwd: dirname(process.execPath),
      appUserModelId: AUMID,
      icon: process.execPath,
      iconIndex: 0,
      description: "ChatGPT usage tracker",
    });
  } catch {
    /* portable folder may be read-only */
  }
}

function rebuildTrayMenu() {
  if (!tray) return;
  const visible = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: visible ? "Hide to tray" : "Open Quodex",
        click: () => {
          if (visible) hideToTray();
          else showMain();
        },
      },
      { label: "Refresh usage", click: () => broadcast("refresh") },
      { type: "separator" },
      {
        label: "Open at login",
        type: "checkbox",
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => {
          app.setLoginItemSettings(loginItemOptions(item.checked));
        },
      },
      {
        label: "Pin flyout",
        type: "checkbox",
        checked: flyoutPinned,
        click: (item) => {
          flyoutPinned = item.checked;
          windowPrefs.flyoutPinned = flyoutPinned;
          saveWindowPrefs();
          broadcast("flyout-pin");
          if (flyoutPinned) showFlyout();
        },
      },
      {
        label: "Minimize to tray",
        type: "checkbox",
        checked: windowPrefs.minimizeToTray,
        click: (item) => {
          windowPrefs.minimizeToTray = item.checked;
          saveWindowPrefs();
        },
      },
      { type: "separator" },
      {
        label: "Quit Quodex",
        click: () => quitQuodex(),
      },
    ]),
  );
}

function showFlyout() {
  if (!tray) return;
  const win = ensureFlyoutWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isVisible()) {
    if (flyoutPinned) {
      win.focus();
      return;
    }
    win.hide();
    return;
  }
  win.webContents.send("quodex:command", "reload");
  const bounds = tray.getBounds();
  const cursor = screen.getCursorScreenPoint();
  const trayOk = Boolean(bounds && bounds.width >= 8 && bounds.height >= 8);
  const point = trayOk
    ? { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2) }
    : cursor;
  const display = screen.getDisplayNearestPoint(point);
  const area = display.workArea;
  const { width, height } = win.getBounds();
  let x = Math.round(point.x - width / 2);
  const taskbarAtTop = trayOk ? bounds.y < area.y + area.height / 2 : cursor.y < area.y + area.height / 2;
  let y = taskbarAtTop
    ? (trayOk ? bounds.y + bounds.height + 8 : cursor.y + 8)
    : (trayOk ? bounds.y - height - 8 : cursor.y - height - 8);
  x = Math.min(Math.max(area.x + 8, x), area.x + area.width - width - 8);
  y = Math.min(Math.max(area.y + 8, y), area.y + area.height - height - 8);
  win.setPosition(x, y, false);
  win.show();
  win.focus();
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 720,
    minWidth: 420,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#202020",
    icon: iconFile(),
    title: "Quodex",
    frame: true,
    roundedCorners: true,
    backgroundMaterial: process.platform === "win32" ? "mica" : undefined,
    titleBarStyle: process.platform === "win32" ? "hidden" : "default",
    webPreferences: {
      preload: join(ROOT, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: Boolean(process.env.QUODEX_DEV),
      backgroundThrottling: false,
      navigateOnDragDrop: false,
    },
  });
  void win.loadFile(join(ROOT, "renderer", "quodex.html"));
  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    hideToTray();
  });
  win.on("minimize", () => {
    if (windowPrefs.minimizeToTray) hideToTray();
    else rebuildTrayMenu();
  });
  win.on("restore", () => {
    win.setSkipTaskbar(false);
    rebuildTrayMenu();
  });
  win.on("show", () => {
    win.setSkipTaskbar(false);
    rebuildTrayMenu();
  });
  win.on("hide", () => rebuildTrayMenu());
  win.on("maximize", () => win.webContents.send("quodex:command", "window:maximized"));
  win.on("unmaximize", () => win.webContents.send("quodex:command", "window:restored"));
  win.on("page-title-updated", (event) => event.preventDefault());
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const key = input.key.toLowerCase();
    if (input.control && key === "w") {
      event.preventDefault();
      hideToTray();
      return;
    }
    if (input.control && key === "q") {
      event.preventDefault();
      quitQuodex();
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => {
    if (event.url !== win.webContents.getURL()) event.preventDefault();
  });
  win.webContents.on("did-finish-load", () => {
    const icon = trayImage();
    if (!icon.isEmpty()) {
      win.setThumbarButtons([
        {
          tooltip: "Refresh usage",
          icon,
          click: () => broadcast("refresh"),
        },
      ]);
    }
    flushRefreshWhenReady();
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "clean-exit" || win.isDestroyed()) return;
    win.reload();
  });
  return win;
}

function createFlyoutWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 640,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: "#202020",
    roundedCorners: true,
    backgroundMaterial: process.platform === "win32" ? "acrylic" : undefined,
    webPreferences: {
      preload: join(ROOT, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: Boolean(process.env.QUODEX_DEV),
      backgroundThrottling: false,
      navigateOnDragDrop: false,
    },
  });
  void win.loadFile(join(ROOT, "renderer", "quodex.html"), { query: { flyout: "1" } });
  win.on("blur", () => {
    if (flyoutPinned || win.webContents.isDevToolsOpened()) return;
    win.hide();
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "Escape") {
      event.preventDefault();
      if (!flyoutPinned) win.hide();
      return;
    }
    if (input.control && input.key.toLowerCase() === "q") {
      event.preventDefault();
      quitQuodex();
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => {
    if (event.url !== win.webContents.getURL()) event.preventDefault();
  });
  watchRenderer(win);
  return win;
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip("Quodex");
  rebuildTrayMenu();
  tray.on("click", () => {
    if (trayClickTimer) return;
    trayClickTimer = setTimeout(() => {
      trayClickTimer = null;
      showFlyout();
    }, 220);
  });
  tray.on("double-click", () => {
    if (trayClickTimer) {
      clearTimeout(trayClickTimer);
      trayClickTimer = null;
    }
    showMain();
  });
  tray.on("middle-click", () => broadcast("refresh"));
}

function bindIpc() {
  const handle = (channel, fn) => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!fromApp(event)) throw new Error("Rejected.");
      return fn(event, ...args);
    });
  };
  handle("quodex:login:start", async () => {
    const api = await loadOpenAI();
    return api.startDeviceLoginRequest();
  });
  handle("quodex:login:poll", async (_event, input) => {
    const api = await loadOpenAI();
    const deviceAuthID = typeof input?.deviceAuthID === "string" ? input.deviceAuthID : "";
    const userCode = typeof input?.userCode === "string" ? input.userCode : "";
    if (!deviceAuthID || !userCode) throw new Error("Invalid sign-in request.");
    const result = await api.pollDeviceLoginRequest({ deviceAuthID, userCode });
    if (result.status !== "complete") return result;
    const identity = api.identityFromIdToken(result.idToken);
    asAccountID(identity.accountID);
    const vault = requireVault();
    vault[identity.accountID] = { idToken: result.idToken, accessToken: result.accessToken };
    saveVault(vault);
    return { status: "complete", identity };
  });
  handle("quodex:usage:fetch", async (_event, input) => {
    const api = await loadOpenAI();
    const accountID = asAccountID(input?.accountID);
    const vault = requireVault();
    const tokens = vault[accountID];
    if (!tokens?.accessToken) {
      return {
        ok: false,
        code: "login_required",
        message: "This session expired or was rejected. Sign in again; Quodex never retries expired tokens.",
      };
    }
    const expiration = api.expirationFromToken(tokens.accessToken);
    if (expiration && expiration <= Date.now()) {
      return {
        ok: false,
        code: "login_required",
        message: "This session expired or was rejected. Sign in again; Quodex never retries expired tokens.",
      };
    }
    return api.fetchAccountUsageRequest({ accessToken: tokens.accessToken, accountID });
  });
  handle("quodex:tokens:delete", async (_event, accountID) => {
    const vault = requireVault();
    delete vault[asAccountID(accountID)];
    saveVault(vault);
  });
  handle("quodex:tokens:has", async (_event, accountID) => {
    const vault = requireVault();
    return Boolean(vault[asAccountID(accountID)]?.accessToken);
  });
  handle("quodex:notify", async (_event, input) => {
    if (!Notification.isSupported()) return;
    const title = typeof input?.title === "string" ? input.title.slice(0, 120) : "Quodex";
    const body = typeof input?.body === "string" ? input.body.slice(0, 280) : "";
    const note = new Notification({ title, body, icon: iconFile() });
    note.on("click", () => showMain());
    note.show();
  });
  handle("quodex:autostart:get", async () => app.getLoginItemSettings().openAtLogin);
  handle("quodex:autostart:set", async (_event, enabled) => {
    app.setLoginItemSettings(loginItemOptions(Boolean(enabled)));
    rebuildTrayMenu();
    return app.getLoginItemSettings().openAtLogin;
  });
  handle("quodex:window:hide", async () => {
    hideToTray();
  });
  handle("quodex:window:show", async () => {
    showMain();
  });
  handle("quodex:window:minimize", async () => {
    minimizeMain();
  });
  handle("quodex:window:maximize", async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  handle("quodex:window:prefs:get", async () => ({
    minimizeToTray: windowPrefs.minimizeToTray,
    flyoutPinned,
  }));
  handle("quodex:window:prefs:set", async (_event, input) => {
    if (input && typeof input === "object" && "minimizeToTray" in input) {
      windowPrefs.minimizeToTray = Boolean(input.minimizeToTray);
      saveWindowPrefs();
      rebuildTrayMenu();
    }
    return { minimizeToTray: windowPrefs.minimizeToTray };
  });
  handle("quodex:app:quit", async () => {
    quitQuodex();
  });
  handle("quodex:flyout:pin", async (_event, pinned) => {
    flyoutPinned = Boolean(pinned);
    windowPrefs.flyoutPinned = flyoutPinned;
    saveWindowPrefs();
    rebuildTrayMenu();
  });
  handle("quodex:tray:tooltip", async (_event, text) => {
    if (tray && typeof text === "string") tray.setToolTip(text.slice(0, 120));
  });
  handle("quodex:theme", async (_event, theme) => {
    applyTitleTheme(theme === "light" ? "light" : "dark");
  });
  handle("quodex:vault:status", async () => ({
    encrypted: safeStorage.isEncryptionAvailable() && vaultBackend() !== "basic_text",
    backend: vaultBackend() === "basic_text" ? "basic_text" : vaultBackend() === "keychain" ? "keychain" : "dpapi",
  }));
  handle("quodex:open", async (_event, url) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (!isDeviceLoginUrl(parsed)) return;
    await shell.openExternal(`https://${DEVICE_LOGIN.host}${DEVICE_LOGIN.path}`);
  });
}

Menu.setApplicationMenu(null);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setName("Quodex");
  if (process.platform === "win32") {
    app.setAppUserModelId(AUMID);
  }
  app.on("second-instance", (_event, argv) => {
    if (wantsRefresh(argv)) {
      queueRefresh();
      return;
    }
    if (!wantsHiddenStart(argv)) showMain();
  });
  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });
  app.whenReady().then(() => {
    windowPrefs = loadWindowPrefs();
    flyoutPinned = Boolean(windowPrefs.flyoutPinned);
    enableLoginItemByDefault();
    installStartMenuShortcut();
    installDesktopShortcut();
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === "notifications");
    });
    app.setUserTasks([
      {
        program: process.execPath,
        arguments: "--refresh",
        iconPath: process.execPath,
        iconIndex: 0,
        title: "Refresh usage",
        description: "Refresh ChatGPT usage for every saved account",
      },
    ]);
    bindIpc();
    mainWindow = createMainWindow();
    flyoutWindow = createFlyoutWindow();
    createTray();
    if (wantsRefresh(process.argv)) queueRefresh();
    if (wantsHiddenStart()) {
      mainWindow.setSkipTaskbar(true);
      windowPrefs.firstHideDone = true;
      saveWindowPrefs();
    } else {
      showMain();
    }
    setInterval(() => broadcast("refresh"), AUTO_REFRESH_MS);
    powerMonitor.on("resume", () => broadcast("refresh"));
    powerMonitor.on("unlock-screen", () => broadcast("refresh"));
  });
  app.on("before-quit", () => {
    isQuitting = true;
    try {
      tray?.destroy();
    } catch {
      /* already gone */
    }
    tray = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeAllListeners("close");
    }
  });
  app.on("window-all-closed", () => {
    /* Close-to-tray: hidden windows still exist. If they don't, stay resident. */
  });
}
