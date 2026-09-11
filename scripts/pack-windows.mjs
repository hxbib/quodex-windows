#!/usr/bin/env node
/**
 * Cross-pack Quodex.exe (win32-x64) from Linux without Wine.
 * Downloads the official Electron binary, drops in the native renderer,
 * patches the PE icon/version with resedit, zips a portable folder.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ELECTRON_VERSION = "32.2.7";
const OUT_DIR = "/tmp/Quodex-windows-x64";
const ZIP_PATH = join(ROOT, "artifacts", "Quodex-windows-x64.zip");
const CACHE_DIR = "/tmp/quodex-electron-cache";
const ZIP_NAME = `electron-v${ELECTRON_VERSION}-win32-x64.zip`;
const ZIP_URLS = [
  `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${ZIP_NAME}`,
  `https://npmmirror.com/mirrors/electron/v${ELECTRON_VERSION}/${ZIP_NAME}`,
];

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else copyFileSync(from, to);
  }
}

function chmodTree(dir) {
  chmodSync(dir, 0o755);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) chmodTree(path);
    else chmodSync(path, 0o644);
  }
}

function removeAllExcept(dir, keep) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    if (!keep.has(file)) rmSync(join(dir, file), { force: true });
  }
}

function run(command, args, cwd = ROOT) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
    child.on("error", reject);
  });
}

async function verifyElectronZip(dest) {
  const sumUrl = `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/SHASUMS256.txt`;
  try {
    const response = await fetch(sumUrl, { headers: { "User-Agent": "Quodex-packager" } });
    if (!response.ok) {
      console.warn(`SHA256 list ${response.status} — skipping checksum`);
      return;
    }
    const line = (await response.text()).split("\n").find((row) => row.includes(ZIP_NAME));
    const expected = line?.trim().split(/\s+/)[0];
    if (!expected) {
      console.warn("SHA256 line missing — skipping checksum");
      return;
    }
    const actual = createHash("sha256");
    await pipeline(createReadStream(dest), actual);
    const digest = actual.digest("hex");
    if (digest !== expected) throw new Error(`Electron SHA256 mismatch for ${ZIP_NAME}`);
    console.log("Electron SHA256 OK");
  } catch (error) {
    if (String(error).includes("mismatch")) throw error;
    console.warn("Checksum skipped:", error);
  }
}

async function download(url, dest) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "Quodex-packager" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`GET ${url} → ${response.status}`);
  }
  await pipeline(response.body, createWriteStream(dest));
}

async function ensureElectronZip() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const dest = join(CACHE_DIR, ZIP_NAME);
  if (existsSync(dest) && statSync(dest).size > 50_000_000) {
    await verifyElectronZip(dest);
    return dest;
  }
  for (const url of ZIP_URLS) {
    console.log(`Downloading ${url}`);
    try {
      await download(url, dest);
      if (statSync(dest).size > 50_000_000) {
        await verifyElectronZip(dest);
        return dest;
      }
    } catch (error) {
      console.warn(String(error));
    }
  }
  throw new Error("Could not download the Electron Windows runtime.");
}

async function extractZip(zipFile, dest) {
  mkdirSync(dest, { recursive: true });
  try {
    await run("python3", ["-m", "zipfile", "-e", zipFile, dest]);
  } catch {
    await run("unzip", ["-o", zipFile, "-d", dest]);
  }
}

async function makeZip() {
  if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH, { force: true });
  mkdirSync(join(ROOT, "artifacts"), { recursive: true });
  const script = `
import os, zipfile, shutil
src = ${JSON.stringify(OUT_DIR)}
dst = ${JSON.stringify(ZIP_PATH)}
parent = os.path.dirname(src)
name = os.path.basename(src)
os.chdir(parent)
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for dirpath, dirnames, filenames in os.walk(name):
        for filename in filenames:
            path = os.path.join(dirpath, filename)
            z.write(path, path.replace(os.sep, "/"))
`;
  await run("python3", ["-c", script]);
}

async function bundleOpenAI() {
  const { build } = await import("vite");
  await build({
    configFile: false,
    root: ROOT,
    publicDir: false,
    logLevel: "info",
    build: {
      ssr: join(ROOT, "src/lib/openai/native-main.ts"),
      outDir: join(ROOT, "electron"),
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      rollupOptions: {
        output: {
          format: "es",
          entryFileNames: "openai.bundle.mjs",
          inlineDynamicImports: true,
        },
      },
    },
  });
}

async function patchExecutable(exePath, icoPath) {
  const requireFromElectron = createRequire(join(ROOT, "electron", "package.json"));
  const ResEdit = requireFromElectron("resedit");
  const { readFileSync } = await import("node:fs");
  const exe = ResEdit.NtExecutable.from(readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);
  const iconFile = ResEdit.Data.IconFile.from(readFileSync(icoPath));
  const icons = iconFile.icons.map((item) => item.data);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  if (groups.length > 0) {
    for (const group of groups) {
      ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, group.id, group.lang, icons);
    }
  } else {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, icons);
  }
  let versions = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  if (versions.length === 0) {
    const created = ResEdit.Resource.VersionInfo.createEmpty();
    versions = [created];
  }
  const version = versions[0];
  version.setFileVersion(1, 0, 1, 0, 1033);
  version.setProductVersion(1, 0, 1, 0, 1033);
  version.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      FileDescription: "Quodex",
      ProductName: "Quodex",
      ProductVersion: "1.0.1",
      FileVersion: "1.0.1",
      OriginalFilename: "Quodex.exe",
      InternalName: "Quodex",
      CompanyName: "Sadman Habib",
      LegalCopyright: "MIT",
    },
  );
  version.outputToResourceEntries(res.entries);
  res.outputResource(exe, false, true);
  writeFileSync(exePath, Buffer.from(exe.generate()));
}

async function main() {
  mkdirSync(join(ROOT, "artifacts"), { recursive: true });
  mkdirSync(join(ROOT, "electron"), { recursive: true });

  console.log("Installing pack tools (resedit, png-to-ico)…");
  await run("npm", [
    "install",
    "resedit@2.0.3",
    "png-to-ico@2.1.8",
    "--no-save",
    "--prefix",
    join(ROOT, "electron"),
  ]);

  console.log("Bundling OpenAI client for the desktop process…");
  await bundleOpenAI();

  console.log("Building native renderer…");
  const viteBin = join(ROOT, "node_modules", "vite", "bin", "vite.js");
  await run(process.execPath, [viteBin, "build", "--config", "vite.native.config.ts"]);
  const builtHtml = join(ROOT, "electron", "renderer", "index.html");
  const namedHtml = join(ROOT, "electron", "renderer", "quodex.html");
  if (!existsSync(builtHtml)) throw new Error("native renderer html missing");
  copyFileSync(builtHtml, namedHtml);

  copyFileSync(join(ROOT, "public", "icon-512.png"), join(ROOT, "electron", "quodex.png"));

  const requireFromElectron = createRequire(join(ROOT, "electron", "package.json"));
  const pngToIco = requireFromElectron("png-to-ico");
  const ico = await pngToIco(join(ROOT, "electron", "quodex.png"));
  writeFileSync(join(ROOT, "electron", "quodex.ico"), ico);

  const zipFile = await ensureElectronZip();
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  console.log("Extracting Electron runtime…");
  await extractZip(zipFile, OUT_DIR);
  try {
    chmodTree(OUT_DIR);
  } catch (error) {
    console.warn("chmod skipped:", error);
  }

  const electronExe = join(OUT_DIR, "electron.exe");
  const quodexExe = join(OUT_DIR, "Quodex.exe");
  if (!existsSync(electronExe)) throw new Error("electron.exe missing from runtime zip");
  renameSync(electronExe, quodexExe);

  const defaultAsar = join(OUT_DIR, "resources", "default_app.asar");
  if (existsSync(defaultAsar)) rmSync(defaultAsar, { force: true });
  removeAllExcept(join(OUT_DIR, "locales"), new Set(["en-US.pak"]));

  const appDir = join(OUT_DIR, "resources", "app");
  mkdirSync(appDir, { recursive: true });
  const appFiles = ["package.json", "main.mjs", "preload.mjs", "openai.bundle.mjs", "quodex.png", "quodex.ico", "README.txt"];
  for (const file of appFiles) {
    copyFileSync(join(ROOT, "electron", file), join(appDir, file));
  }
  copyTree(join(ROOT, "electron", "renderer"), join(appDir, "renderer"));
  const packedHtml = join(appDir, "renderer", "quodex.html");
  if (!existsSync(packedHtml)) {
    copyFileSync(namedHtml, packedHtml);
  }
  if (!existsSync(packedHtml)) throw new Error("renderer HTML failed to copy into the Windows package");
  const electronLicense = join(OUT_DIR, "LICENSE");
  if (existsSync(electronLicense)) renameSync(electronLicense, join(OUT_DIR, "LICENSE.electron.txt"));
  const quodexLicense = join(ROOT, "LICENSE");
  if (existsSync(quodexLicense)) {
    copyFileSync(quodexLicense, join(OUT_DIR, "LICENSE.txt"));
    copyFileSync(quodexLicense, join(appDir, "LICENSE.txt"));
  }
  const notice = join(ROOT, "NOTICE");
  if (existsSync(notice)) copyFileSync(notice, join(OUT_DIR, "NOTICE.txt"));
  copyFileSync(join(ROOT, "electron", "README.txt"), join(OUT_DIR, "README.txt"));
  copyFileSync(join(ROOT, "electron", "quodex.ico"), join(OUT_DIR, "quodex.ico"));

  console.log("Patching Quodex.exe icon and version…");
  try {
    await patchExecutable(quodexExe, join(ROOT, "electron", "quodex.ico"));
  } catch (error) {
    console.warn("Icon/version patch skipped:", error);
  }

  console.log("Zipping portable build…");
  await makeZip();

  const sumsPath = join(ROOT, "artifacts", "SHA256SUMS.txt");
  const digest = createHash("sha256");
  await pipeline(createReadStream(ZIP_PATH), digest);
  writeFileSync(sumsPath, `${digest.digest("hex")}  Quodex-windows-x64.zip\n`);

  console.log(`Quodex.exe ${Math.round(statSync(quodexExe).size / 1024)} KB`);
  console.log(`Zip ${Math.round(statSync(ZIP_PATH).size / 1024 / 1024)} MB → ${ZIP_PATH}`);
  console.log(`SHA256 → ${sumsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
