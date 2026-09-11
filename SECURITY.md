# Security

Quodex is a local usage tracker. It is not a vault that claims to survive an attacker already running as you.

## What it protects against

- Tokens sitting in the usage window or in a git-tracked file (installed app).
- Sending credentials to an unexpected host (path-exact HTTPS allowlist, redirects refused).
- Silently refreshing an expired ChatGPT session (never retried — you sign in again).
- Opening arbitrary URLs from the renderer (`https://auth.openai.com/codex/device` only).
- Storing sessions in plaintext if Windows DPAPI is down (the app errors instead).

## What it does not protect against

- **Same-user malware.** DPAPI decrypts for the logged-in Windows user. Anything running as you can call the same APIs.
- **Unsigned binary.** Releases are not EV-signed. SmartScreen will warn. Verify the zip came from this GitHub account.
- **JWT signatures.** ID tokens are decoded, not signature-checked — same as the macOS original. Account IDs are then restricted to `[A-Za-z0-9._-]{4,128}`.
- **The in-browser demo.** Sign-in is disabled. The page never stores ChatGPT tokens and the website refuses to proxy OpenAI device login or usage fetches. Download the Windows app for real accounts.
- **WebView2.** The window is an Edge WebView. Keep the install folder writeable only by you. Tokens never enter that document; they stay in the native DPAPI vault.

## Vault

`%APPDATA%\Quodex\oauth-tokens.dpapi` is a DPAPI blob of `{ [accountID]: { idToken, accessToken } }`. A `.bak` copy is written before each successful replace. If the file cannot be decrypted, Quodex will **not** overwrite it.

The public OpenAI device-code client id `app_EMoamEEZ73f0CkXaXp7hrann` is the same id the macOS app uses. It is a public client, not a secret.

## Reporting

Open a GitHub issue on this repository. Do not attach vault files, tokens, or device codes.
