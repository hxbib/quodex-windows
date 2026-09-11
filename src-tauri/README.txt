Quodex for Windows 1.1.0
========================

Tray companion to https://github.com/hxbib/Quodex (macOS). Track ChatGPT
usage, banked resets, and pooled capacity. Independent project — not
affiliated with OpenAI.

Run
---
1. Unzip this folder somewhere durable (not a temp download directory).
2. Double-click Quodex.exe.
3. Windows SmartScreen may warn because this build is not EV-code-signed.
   Choose More info → Run anyway.

If Windows still blocks the file, right-click Quodex.exe → Properties →
Unblock → Apply.

Windows 11 already includes WebView2. Windows 10 usually has it through
Edge; if the window does not open, install Microsoft Edge WebView2
Runtime (Evergreen) from Microsoft.

What it does
------------
- Notification-area tray. Left-click: flyout. Double-click: window.
  Middle-click: refresh. Close (X) hides to the tray and drops the
  taskbar button; it does not quit. Minimize keeps a taskbar peek (or
  hides to the tray if you enable that). Quit is only tray menu → Quit
  Quodex, Settings → Quit Quodex, or Ctrl+Q.
- Device-code sign-in opens only https://auth.openai.com/codex/device
  in your system browser. Expired ChatGPT sessions are never retried.
- Access tokens are sealed with Windows DPAPI under %APPDATA%\Quodex.
  They never enter the usage window. Refresh tokens are discarded.
- Open at login is enabled on first run from a durable folder
  (hidden start). Launching from Downloads or Temp leaves it off
  until you move the folder and turn it on from the tray or Settings.
- Reset toasts fire at the reported reset time when the account bell is
  on. Newly observed banked resets notify even with the bell off.
- Usage is rechecked every 30 minutes from the background process, and
  again when the PC wakes.
- The UI runs in the system WebView2. The tracker, vault, and network
  allowlist run in a native process — Chromium is not bundled.
- Taskbar jump list includes Refresh usage.

Quit
----
Tray right-click → Quit Quodex, Settings → Quit Quodex, or Ctrl+Q.
Close does not quit.

Licenses
--------
Quodex source: LICENSE.txt (MIT).
WebView2 is part of Windows / Edge and keeps Microsoft's terms.