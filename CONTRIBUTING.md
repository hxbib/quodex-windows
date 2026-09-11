# Contributing

This Windows port should stay aligned with [hxbib/Quodex](https://github.com/hxbib/Quodex):

- Allowlisted HTTPS only. No extra hosts, no query strings on API URLs, no redirects.
- Never retry or refresh an expired ChatGPT access token.
- Discard refresh tokens.
- Do not log tokens, device codes, account IDs, or emails.
- Banked-reset toasts do not require the account bell. Scheduled reset toasts do.
- Cap refresh concurrency at 4 and accounts at 100.

## Commands

```bash
npm install
npm run typecheck
npm test
npm run pack:windows
```

`npm run pack:windows` is the release command. Do not add a bundled browser runtime. The UI is WebView2; native work stays in `src-tauri/`.

## Do not

- Check in `node_modules`, `src-tauri/target`, `src-tauri/frontend`, `artifacts/`, or unsigned binaries.
- Widen `openExternal` or the OpenAI path allowlist.
- Persist tokens from the renderer.
- Copy unrelated auth, database, or scaffold code into the tracker path.
