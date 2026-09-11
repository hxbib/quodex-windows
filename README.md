# Quodex for Windows

Quodex is a tray app that shows ChatGPT usage limits and banked resets across multiple accounts in one place.

This is the **Windows companion** to the [macOS original](https://github.com/hxbib/Quodex). Same tracker, same OpenAI device-code login, same “never retry an expired session” rule. Different runtime: a portable `Quodex.exe` (Electron 32) so it runs on Windows 10 1809+ and Windows 11 without WebView2.

Quodex is an independent project and is not affiliated with or endorsed by OpenAI.

## Features

- Add, reauthenticate, and remove accounts with OpenAI’s device-code login (system browser, never an embedded ChatGPT page).
- Email and subscription plan per account.
- Every usage lane the service reports (5-hour, weekly, gpt-reserve / Reserve, and others).
- Remaining percent, countdown, and reset time (local timezone in the installed app).
- Banked resets and earliest expiry when the dedicated lookup succeeds.
- Pooled capacity across accounts.
- Refresh all, refresh one, and a 30-minute check from the **main process** (survives close-to-tray).
- Early quota-reset toasts when the account bell is on; **newly observed banked resets notify even with the bell off**.
- Drag to reorder; new free accounts sit under paid ones.
- Sort once by soonest reset, then keep that order.
- Open at login on first run from a durable folder (skipped if you launch from Downloads/Temp), hidden start, close hides to the tray.
- Up to 100 accounts, refresh concurrency capped at 4.

## Install

Download `Quodex-windows-x64.zip` from [Releases](https://github.com/hxbib/quodex-windows/releases). Unzip somewhere durable (not a temp Downloads folder). Double-click `Quodex.exe`.

Windows SmartScreen will likely warn because this community build is **not EV-code-signed**. Choose **More info → Run anyway**. That prompt is from Windows, not from Quodex. If the file stays blocked: right-click → Properties → Unblock.

Left-click the tray icon for the flyout. Double-click it (or the taskbar button) for the window. **Close (✕)** hides to the tray and drops the taskbar button — tracking and reset toasts keep going. **Minimize (—)** keeps a taskbar peek (or hides to the tray if you turn that on). **Quit Quodex** is only on the tray’s right-click menu and in Settings. The first hide shows a one-time toast so this is obvious.

### Requirements

- Windows 10 version 1809 or later, or Windows 11 (x64).
- A ChatGPT account.
- No extra WebView2 runtime. Chromium is bundled.

## Build from source

Needs Node.js 22+ and Python 3 (stdlib `zipfile` only). No Wine, no Visual Studio.

```bash
npm install
npm run typecheck
npm run pack:windows
```

The portable folder is packed to `artifacts/Quodex-windows-x64.zip`. The packer downloads the official Electron win32-x64 runtime, copies the tracker UI, patches the PE icon with `resedit`, and zips it.

## Data and privacy

Quodex does not read or modify the official ChatGPT app, Codex app, browser cookies, or another app’s credentials.

| | macOS original | Windows `.exe` | In-browser demo |
|---|---|---|---|
| Runtime | Swift, no Electron | Electron 32 (Chromium) | This repo’s live page |
| Tokens | Keychain `com.quodex.Quodex.oauth-tokens` | `%APPDATA%\Quodex\oauth-tokens.dpapi` via Windows **DPAPI** | Never stored. Real sign-in is disabled in the browser. |
| Refresh tokens | Discarded | Discarded | Discarded |
| Metadata | `~/Library/Application Support/Quodex/accounts.json` | Chromium local storage in the same userData folder (emails, snapshots — not tokens) | Sample accounts only |
| Expired sessions | Never retried | Never retried | Never retried |

If DPAPI is unavailable, the exe **refuses to store** the session. There is no plaintext fallback.

Network calls are allowlisted HTTPS with no redirects:

- `auth.openai.com` `/api/accounts/deviceauth/usercode`, `/api/accounts/deviceauth/token`, `/oauth/token`
- `chatgpt.com` `/backend-api/wham/usage`, `/backend-api/wham/rate-limit-reset-credits`

The only URL the exe will open in your browser is `https://auth.openai.com/codex/device`. Tokens, device codes, account IDs, and emails are not written to logs.

See [SECURITY.md](SECURITY.md) for the threat model.

## Notifications

- Account bell: Windows toast at each reported `resetAt`, plus an immediate toast if a lane returns to 100% early.
- Banked resets: immediate toast when a **confirmed** count increases, with or without the bell.
- Global check every 30 minutes while the process is running (tray counts). Open at login is offered on first launch from a durable folder.

## What this repository also contains

The live page in this tree is an **optional Windows 11 desktop simulation** for trying the tracker in a browser. It is not the installed app. Sample accounts only — this website never stores a ChatGPT session. Treat it as a demo.

The Mac product’s “no Electron” rule still applies to [hxbib/Quodex](https://github.com/hxbib/Quodex). This Windows port uses Electron because a Win32 binary can be assembled from Linux using official Electron releases; a Tauri/WinUI 3 build would need a Windows sysroot.

## Project layout

- `electron/` — main process, preload, DPAPI vault, tray, packager inputs.
- `src/native/` — installed-app shell (window + flyout).
- `src/lib/quodex/` — account store, lanes, notifications, demo samples.
- `src/lib/openai/` — allowlisted device-code + usage client (main process in the exe).
- `scripts/pack-windows.mjs` — cross-pack `Quodex.exe` without Wine.
- `src/components/desktop/` — in-browser Win11 demo only.

## License

Quodex source is MIT. See [LICENSE](LICENSE). The portable zip also includes Electron and Chromium licenses ([NOTICE](NOTICE)).

## Publishing

See [PUBLISH.md](PUBLISH.md) for the GitHub repo, tag, and release-asset steps.
