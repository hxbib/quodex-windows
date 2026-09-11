# Publish Quodex for Windows

This tree is the public Windows companion. It is not the App Builder workspace and not the macOS Swift app.

## 1. Create the GitHub repository

Recommended: a sibling of the Mac original, for example `hxbib/quodex-windows`, public, MIT.

Do not drop these files into the Swift repo’s root — they would collide with the Mac project.

```bash
unzip Quodex-windows-src.zip
cd Quodex-windows-src
git init
git add .
git commit -m "Quodex for Windows 1.0.1"
git branch -M main
git remote add origin https://github.com/YOUR_USER/quodex-windows.git
git push -u origin main
```

Edit `electron/package.json` `homepage` / `repository` if the URL is not `hxbib/Quodex`.

## 2. Verify locally (optional)

```bash
npm ci
npm run typecheck
npm test
npm run pack:windows
```

GitHub Actions (`.github/workflows/windows-release.yml`) runs the same on tag `v*`.

## 3. GitHub Release

```bash
git tag v1.0.1
git push origin v1.0.1
```

Attach `Quodex-windows-x64.zip` as the release asset. Paste `GITHUB-RELEASE.md` as the body. Include `SHA256SUMS.txt`.

The workflow also packs on the tag and attaches the zip if `npm ci` + pack succeed on `ubuntu-latest`.

## 4. What people download

| File | What it is |
|---|---|
| `Quodex-windows-x64.zip` | Portable `Quodex.exe` (unsigned). SmartScreen will warn. |
| This source tree | MIT sources so anyone can audit and rebuild. |

Do not ship `node_modules`, `electron/renderer`, or App Builder / Grok files.
