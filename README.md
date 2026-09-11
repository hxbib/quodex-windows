# Quodex for Windows

Quodex is a tray app that shows ChatGPT usage limits and banked resets across multiple accounts in one place.

This is the **Windows companion** to the [macOS original](https://github.com/hxbib/Quodex). Same tracker, same OpenAI device-code login, same “never retry an expired session” rule. The window is drawn by the system WebView2 runtime; the vault, tray, and network allowlist run in a small native process.

Quodex is an independent project and is not affiliated with or endorsed by OpenAI.

## Features

- Add, reauthenticate, and remove accounts with OpenAI’s device-code login (system browser, never an embedded ChatGPT page).
- Email and subscription plan per account.
- Every usage lane the service reports (5-hour, weekly, gpt-reserve / Reserve, and others).
- Remaining percent, countdown, and reset time (local timezone in the installed app).
- Banked resets and earliest expiry when the dedicated lookup succeeds.
- Pooled capacity across accounts.
- Refresh all, refresh one, and a 30-minute check from the **native process** (survives close-to-tray).
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
- Microsoft Edge WebView2 (built into Windows 11; present on most Windows 10 PCs via Edge. If the window does not open, install the Evergreen WebView2 Runtime from Microsoft).

## Build from source

Needs Node.js 22+ , Rust (stable), and Python 3 (stdlib `zipfile` only). On Linux/macOS the packer cross-compiles with `cargo-xwin`. On Windows it uses the MSVC toolchain.

```bash
npm install
npm run typecheck
npm run pack:windows
```

The portable folder is packed to `artifacts/Quodex-windows-x64.zip`.

## Data and privacy

Quodex does not read or modify the official ChatGPT app, Codex app, browser cookies, or another app’s credentials.

| | macOS original | Windows `.exe` | In-browser demo |
|---|---|---|---|
| Runtime | Swift | Tauri 2 + system WebView2 | This repo’s live page |
| Tokens | Keychain `com.quodex.Quodex.oauth-tokens` | `%APPDATA%\Quodex\oauth-tokens.dpapi` via Windows **DPAPI** | Never stored. Real sign-in is disabled in the browser. |
| Refresh tokens | Discarded | Discarded | Discarded |
| Metadata | `~/Library/Application Support/Quodex/accounts.json` | WebView2 local storage (emails, snapshots — not tokens) | Sample accounts only |
| Expired sessions | Never retried | Never retried | Never retried |

If DPAPI is unavailable, the exe **refuses to store** the session. There is no plaintext fallback. Vaults written by the previous Electron build are imported on first launch.

Network calls are allowlisted HTTPS with no redirects:

- `auth.openai.com` `/api/accounts/deviceauth/usercode`, `/api/accounts/deviceauth/token`, `/oauth/token`
- `chatgpt.com` `/backend-api/wham/usage`, `/backend-api/wham/rate-limit-reset-credits`

The only URL the exe will open in your browser is `https://auth.openai.com/codex/device`. Tokens, device codes, account IDs, and emails are not written to logs.

See [SECURITY.md](SECURITY.md) for the threat model.

## Notifications

- Account bell: Windows toast at each reported `resetAt`, plus an immediate toast if a lane returns to 100% early.
- Banked resets: immediate toast when a **confirmed** count increases, with or without the bell.
- Global check every 30 minutes while the process is running (tray counts). Open at login is offered on first launch from a durable folder.

## Project layout

- `src-tauri/` — native process: DPAPI vault, tray, flyout, OpenAI allowlist, autostart.
- `src/native/` — installed-app window and flyout UI.
- `src/lib/quodex/` — account store, lanes, notifications, and usage formatting.
- `scripts/pack-windows.mjs` — builds the UI, compiles `Quodex.exe`, and zips it.

The Windows 11 website is not required to build the app.

## License

Quodex source is MIT. See [LICENSE](LICENSE). WebView2 remains Microsoft software ([NOTICE](NOTICE)).
