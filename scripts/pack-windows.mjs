#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = join(tmpdir(), "Quodex-windows-x64");
const ZIP_PATH = join(ROOT, "artifacts", "Quodex-windows-x64.zip");
const TARGET = "x86_64-pc-windows-msvc";

function run(command, args, cwd = ROOT, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", env, shell: process.platform === "win32" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
    child.on("error", reject);
  });
}

function which(bin) {
  const path = process.env.PATH || "";
  const ext = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  for (const dir of path.split(process.platform === "win32" ? ";" : ":")) {
    for (const suffix of ext) {
      const candidate = join(dir, bin + suffix);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function pythonBin() {
  return which("python3") || which("python") || "python3";
}

async function writeIco() {
  const { spawnSync } = await import("node:child_process");
  const script = `
import struct, pathlib, shutil
root = pathlib.Path(${JSON.stringify(ROOT)})
icons = root / "src-tauri" / "icons"
png512 = (root / "public" / "icon-512.png").read_bytes()
header = struct.pack("<HHH", 0, 1, 1)
entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png512), 22)
(icons / "icon.ico").write_bytes(header + entry + png512)
shutil.copyfile(root / "public" / "icon-512.png", icons / "icon.png")
shutil.copyfile(root / "public" / "icon-512.png", icons / "128x128.png")
src32 = icons / "32x32.png"
if not src32.exists():
    shutil.copyfile(root / "public" / "icon-192.png", src32)
`;
  const result = spawnSync(pythonBin(), ["-c", script], { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) throw new Error("icon.ico");
}

async function makeZip() {
  if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH, { force: true });
  mkdirSync(join(ROOT, "artifacts"), { recursive: true });
  const script = `
import os, zipfile
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
  await run(pythonBin(), ["-c", script]);
}

function collectReleaseDir() {
  const candidates = [
    join(ROOT, "src-tauri", "target", TARGET, "release"),
    join(ROOT, "src-tauri", "target", "release"),
  ];
  for (const dir of candidates) {
    for (const name of ["Quodex.exe", "quodex.exe"]) {
      if (existsSync(join(dir, name))) return { dir, exeName: name };
    }
  }
  throw new Error("Quodex.exe was not produced. Install Rust and the Windows target, then retry.");
}

async function main() {
  mkdirSync(join(ROOT, "artifacts"), { recursive: true });
  mkdirSync(join(ROOT, "src-tauri", "icons"), { recursive: true });
  mkdirSync(join(ROOT, "src-tauri", "frontend"), { recursive: true });

  console.log("Icons…");
  await writeIco();

  console.log("Building the tracker UI…");
  const viteBin = join(ROOT, "node_modules", "vite", "bin", "vite.js");
  await run(process.execPath, [viteBin, "build", "--config", "vite.native.config.ts"]);

  const cargo = which("cargo");
  if (!cargo) throw new Error("Rust is required. Install rustup, then cargo.");

  const onWindows = process.platform === "win32";
  if (!onWindows) {
    await run("rustup", ["target", "add", TARGET]);
    if (!which("cargo-xwin")) {
      await run("cargo", ["install", "cargo-xwin", "--locked"]);
    }
  }

  const tauriCli = join(ROOT, "node_modules", "@tauri-apps", "cli", "tauri.js");
  const args = ["build", "--no-bundle"];
  if (!onWindows) {
    args.push("--runner", "cargo-xwin", "--target", TARGET);
  }
  const env = {
    ...process.env,
    CARGO_TARGET_DIR: join(ROOT, "src-tauri", "target"),
  };
  if (!env.XWIN_CACHE_DIR && existsSync("/tmp/xwin")) {
    env.XWIN_CACHE_DIR = "/tmp/xwin";
  }
  const llvmRoot = "/tmp/llvm";
  if (existsSync(llvmRoot)) {
    for (const name of readdirSync(llvmRoot)) {
      const bin = join(llvmRoot, name, "bin");
      if (existsSync(join(bin, "llvm-rc")) || existsSync(join(bin, "llvm-rc.exe"))) {
        const sep = process.platform === "win32" ? ";" : ":";
        env.PATH = `${bin}${sep}${env.PATH || ""}`;
        break;
      }
    }
  }
  console.log("Compiling Quodex.exe…");
  if (existsSync(tauriCli)) {
    await run(process.execPath, [tauriCli, ...args], ROOT, env);
  } else if (which("cargo-tauri") || which("tauri")) {
    await run(which("tauri") || "cargo-tauri", args, join(ROOT, "src-tauri"), env);
  } else {
    await run("cargo", ["install", "tauri-cli", "--locked"]);
    await run("cargo", ["tauri", ...args], join(ROOT, "src-tauri"), env);
  }

  const { dir: releaseDir } = collectReleaseDir();
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const keep = new Set(["Quodex.exe", "quodex.exe", "WebView2Loader.dll", "webview2loader.dll"]);
  for (const file of readdirSync(releaseDir)) {
    const lower = file.toLowerCase();
    if (keep.has(file) || keep.has(lower) || lower.endsWith(".dll")) {
      const destName = lower === "quodex.exe" ? "Quodex.exe" : file;
      copyFileSync(join(releaseDir, file), join(OUT_DIR, destName));
    }
  }
  if (!existsSync(join(OUT_DIR, "Quodex.exe"))) {
    throw new Error("Quodex.exe missing after compile");
  }

  copyFileSync(join(ROOT, "LICENSE"), join(OUT_DIR, "LICENSE.txt"));
  if (existsSync(join(ROOT, "NOTICE"))) copyFileSync(join(ROOT, "NOTICE"), join(OUT_DIR, "NOTICE.txt"));
  copyFileSync(join(ROOT, "src-tauri", "README.txt"), join(OUT_DIR, "README.txt"));
  copyFileSync(join(ROOT, "src-tauri", "icons", "icon.ico"), join(OUT_DIR, "quodex.ico"));

  try {
    chmodSync(join(OUT_DIR, "Quodex.exe"), 0o755);
  } catch {

  }

  console.log("Zipping portable build…");
  await makeZip();

  const sumsPath = join(ROOT, "artifacts", "SHA256SUMS.txt");
  const digest = createHash("sha256");
  await pipeline(createReadStream(ZIP_PATH), digest);
  writeFileSync(sumsPath, `${digest.digest("hex")}  Quodex-windows-x64.zip\n`);
  copyFileSync(ZIP_PATH, join(ROOT, "public", "Quodex-windows-x64.zip"));

  const exeSize = statSync(join(OUT_DIR, "Quodex.exe")).size;
  console.log(`Quodex.exe ${Math.round(exeSize / 1024)} KB`);
  console.log(`Zip ${Math.round(statSync(ZIP_PATH).size / 1024 / 1024)} MB → ${ZIP_PATH}`);
  console.log(`SHA256 → ${sumsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
