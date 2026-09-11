# Quodex for Windows 1.0.1

Portable tray companion to the [macOS original](https://github.com/hxbib/Quodex). Independent project — not affiliated with OpenAI.

## Download

Unzip `Quodex-windows-x64.zip` somewhere durable (not a temp Downloads folder). Double-click `Quodex.exe`.

Windows SmartScreen will likely warn because this build is **not EV-code-signed**. Choose **More info → Run anyway**. If the file stays blocked: right-click → Properties → Unblock.

Verify the zip against `SHA256SUMS.txt` from this release.

## Window contract

- **Close (✕)** / Alt+F4 hides to the tray. Tracking and reset toasts continue.
- **Minimize (—)** keeps a taskbar peek. Optional *Minimize to tray* in Settings.
- **Quit Quodex** is only the tray right-click menu, Settings, or Ctrl+Q.
- Left-click tray: usage flyout. Double-click: window. Middle-click: refresh.
- First hide shows a one-time “still running” toast.

## Also in this release

- DPAPI vault for ChatGPT sessions (`%APPDATA%\Quodex`). No plaintext fallback.
- Open at login on first run (hidden start).
- Device-code login in the system browser. Expired sessions are never retried.
- Banked-reset toasts without the bell; scheduled reset toasts with the bell.
- 30-minute refresh from the main process (survives close-to-tray).

## Requirements

Windows 10 1809+ or Windows 11, x64. No extra WebView2 runtime.

Source and rebuild instructions are in this repository (`npm ci && npm run pack:windows`).
