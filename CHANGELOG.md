# Changelog

## 1.0.1

Window chrome that matches a real tray companion:

- Close (✕) / Alt+F4 hides to the tray and removes the taskbar button. Tracking continues.
- Minimize (—) peeks on the taskbar by default; optional **Minimize to tray**.
- Quit is only the tray’s right-click **Quit Quodex** (or Settings). Ctrl+Q also quits the installed app (main window and flyout).
- First hide shows a one-time “still running” toast. Caption tooltip on Close is “Hide to tray”.
- Left-click tray: flyout (debounced so double-click can open the window). Middle-click: refresh. A pinned flyout stays put on tray click.
- Jump-list “Refresh usage” waits until the window has loaded, including cold start.
- Open at login is skipped when `Quodex.exe` is still sitting in Downloads/Temp.
- Renderer crash reloads the window instead of leaving a dead tray icon.
- Website Download points at the Windows repo (`hxbib/quodex-windows`), not the macOS DMGs.

## 1.0.0

First public Windows companion to [hxbib/Quodex](https://github.com/hxbib/Quodex).

- Portable `Quodex.exe` (Electron 32, Windows 10 1809+ / Windows 11 x64).
- DPAPI vault for access/id tokens; refresh tokens discarded.
- Tray flyout, close-to-tray, open at login on first run, jump list, wake refresh.
- Device-code login in the system browser; expired sessions never retried.
- Banked-reset toasts without the bell; early lane-reset toasts with the bell.
- 30-minute refresh from the main process (not a hidden renderer timer).
