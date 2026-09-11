# Publish Quodex for Windows

Two public trees. Do not mix them, and do not drop either into the macOS Swift repo.

| Tree | GitHub | What it is |
|---|---|---|
| Windows app | [hxbib/quodex-windows](https://github.com/hxbib/quodex-windows) | Tauri 2 + WebView2 portable `Quodex.exe` |
| Windows landing | [hxbib/quodex-windows-website](https://github.com/hxbib/quodex-windows-website) | Interactive Windows 11 page for quodex.app/windows |
| macOS app | [hxbib/Quodex](https://github.com/hxbib/Quodex) | Swift original |
| macOS landing | [hxbib/quodex-website](https://github.com/hxbib/quodex-website) | quodex.app |

## 1. Windows app repository

```bash
unzip Quodex-windows-src.zip
cd Quodex-windows-src
git init
git add .
git commit -m "Quodex for Windows 1.1.0"
git branch -M main
git remote add origin https://github.com/hxbib/quodex-windows.git
git push -u origin main
```

```bash
npm ci
npm run typecheck
npm test
npm run pack:windows
```

Needs Rust stable. On Windows, MSVC Build Tools. On Linux/macOS, `cargo-xwin`. GitHub Actions packs on `windows-latest`.

```bash
git tag v1.1.0
git push origin v1.1.0
```

Attach `Quodex-windows-x64.zip` and `SHA256SUMS.txt`. Paste `GITHUB-RELEASE.md` as the body.

## 2. Windows landing on quodex.app/windows

```bash
unzip quodex-windows-website.zip
cd quodex-windows-website
npm ci
npm test
npm run build
npx wrangler deploy
```

`dist/` is static with base `/windows/`. The Worker in this repo maps `/windows` onto that folder. Leave the macOS page at `/` (hxbib/quodex-website) alone.

## 3. What people download

| File | What it is |
|---|---|
| `Quodex-windows-x64.zip` | Portable `Quodex.exe` (unsigned). SmartScreen will warn. Uses system WebView2. |
| App source tree | MIT sources so anyone can audit and rebuild the exe. |
| Website source tree | MIT sources for the Windows 11 landing. |

Do not ship `node_modules`, `src-tauri/target`, or leftover bundled runtimes.
