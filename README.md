# Quodex

Quodex is a lightweight, standalone Windows tray app that lets you see usage limits and banked resets across multiple ChatGPT accounts in one place.

This is the Windows companion to the [macOS original](https://github.com/hxbib/Quodex). Same tracker, same OpenAI device-code login, same rule that expired sessions are never retried. The live Windows 11 landing page lives in a separate repository: [quodex-windows-website](https://github.com/hxbib/quodex-windows-website).

Quodex is an independent project and is not affiliated with or endorsed by OpenAI.

## Features

- Add, reauthenticate, and remove accounts with OpenAI's device-code login. Sign-in opens the system browser, never an embedded ChatGPT page.
- Keep each account's email and subscription plan visible.
- Show every usage lane reported by the service, including 5 hour, weekly, and gpt-reserve lanes when present.
- Show remaining percentages, countdowns, and reset times in the local timezone.
- Show banked resets and their earliest expiry when available.
- Show pooled capacity across accounts.
- Refresh all accounts manually, refresh one account independently, and check every account every 30 minutes from the main process while Quodex is running, including when the window is hidden to the tray.
- Detect early quota resets and newly detected banked resets.
- Optional Windows toast notifications for usage resets; automatic banked-reset notifications do not require enabling an account bell.
- Drag accounts into a custom order, with new free subscription accounts automatically placed at the bottom after paid accounts.
- Refresh and sort accounts once by their soonest reported reset, then keep the resulting manual order stable.
- Open automatically at login so background checks continue without opening the window. Close hides to the tray; quit is a separate action.
- Support up to 100 accounts with smooth scrolling and bounded refresh concurrency.

## How it works

Quodex stores one record per stable ChatGPT account ID. Each successful refresh replaces that account's cached usage snapshot. The interface labels data as live only for a short freshness window; older data is shown with its exact age rather than being presented as current.

Unrecognized or incomplete server responses are shown as unavailable.

## Requirements

- Windows 10 version 1809 or later, or Windows 11, x64.
- A ChatGPT account.

The portable build bundles Chromium. No extra WebView2 runtime is required.

## Install

Download `Quodex-windows-x64.zip` from [GitHub Releases](https://github.com/hxbib/quodex-windows/releases). Unzip it somewhere durable (not a temporary Downloads folder) and double-click `Quodex.exe`.

Windows SmartScreen will likely warn because this community release is not EV-code-signed. Choose **More info → Run anyway**. That prompt is from Windows, not from Quodex. If the file stays blocked: right-click `Quodex.exe` → Properties → Unblock.

Left-click the tray icon for the flyout. Double-click it for the window. **Close (✕)** hides to the tray and drops the taskbar button — tracking and reset toasts keep going. **Minimize (—)** keeps a taskbar peek, or hides to the tray if you turn that on in Settings. **Quit Quodex** is only on the tray right-click menu, in Settings, or Ctrl+Q. The first hide shows a one-time toast so this is obvious.

The interactive landing page is at [quodex.app/windows](https://quodex.app/windows). The macOS product is at [quodex.app](https://quodex.app).

## Build from source

Needs Node.js 22 or later and Python 3 (stdlib `zipfile` only). No Wine and no Visual Studio.

```bash
npm ci
npm run typecheck
npm test
npm run pack:windows
```

The portable folder is packed to `artifacts/Quodex-windows-x64.zip`. The packer downloads the official Electron 32 win32-x64 runtime, copies the tracker UI, patches the PE icon, and zips it.

## Data and privacy

Quodex does not read or modify the official ChatGPT app, Codex app, browser cookies, or another app's credentials.

Access and ID tokens are sealed with Windows DPAPI in:

```text
%APPDATA%\Quodex\oauth-tokens.dpapi
```

If DPAPI is unavailable, Quodex refuses to store the session. There is no plaintext fallback. Refresh tokens returned during device login are discarded. Account labels, stable IDs, plans, and the last successful usage snapshot live in Chromium local storage in the same user data folder; that store does not contain OAuth token values.

Quodex never retries or refreshes an expired or rejected access token out of an abundance of caution to not get accounts banned for simply using this tool. An affected account is marked Login required; its account-specific sign-in action starts a fresh device-code flow.

Quodex does not route or submit chats, redeem banked resets, read browser cookies, expose a local server, or send credentials to redirects or unapproved hosts. Tokens, device codes, account IDs, and email addresses are not written to logs or diagnostics.

## Network behavior

Authentication uses OpenAI's device-code sign-in. Usage and reset information is read through OpenAI services. It does not submit chats, redeem reset credits, or route traffic.

Network calls are allowlisted HTTPS with no redirects:

- `auth.openai.com` `/api/accounts/deviceauth/usercode`, `/api/accounts/deviceauth/token`, `/oauth/token`
- `chatgpt.com` `/backend-api/wham/usage`, `/backend-api/wham/rate-limit-reset-credits`

The only URL the app will open in your browser is `https://auth.openai.com/codex/device`.

## Notifications

The account bell enables Windows toasts at reported reset timestamps and early reset detection for that account. Quodex also automatically reports a newly observed increase in confirmed banked resets for every account, independently of the bell setting. The global check runs every 30 minutes while Quodex is running; Open at Login is offered on first launch from a durable folder and can be changed from the tray or Settings.

## Verification

For a release zip, verify the published checksum:

```bash
certutil -hashfile Quodex-windows-x64.zip SHA256
```

Compare the digest with `SHA256SUMS.txt` from the same GitHub Release.

## Project layout

- `electron/` contains the main process, preload bridge, DPAPI vault, tray, jump lists, and close-to-tray behavior.
- `src/native/` contains the installed-app window and flyout.
- `src/lib/quodex/` contains the account store, lanes, notifications, and usage formatting.
- `src/lib/openai/` contains the allowlisted device-code and usage client. OpenAI traffic stays in the main process.
- `scripts/pack-windows.mjs` cross-packs `Quodex.exe` from Linux using the official Electron release.

The Windows 11 website is not in this repository.

## License

Quodex is released under the MIT License. See [LICENSE](LICENSE). The portable zip also includes Electron and Chromium licenses ([NOTICE](NOTICE)).
