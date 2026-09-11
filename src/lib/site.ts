/** Public product URLs for the Windows landing page. */
export const SITE = {
  name: "Quodex",
  product: "Quodex for Windows",
  tagline: "Know your limits. Own your resets.",
  summary:
    "A tray companion for every ChatGPT account — live usage, pooled capacity, countdowns, and banked resets.",
  /** GitHub release of the Windows port — never the macOS DMG repo. */
  download: "https://github.com/hxbib/quodex-windows/releases/latest",
  asset: "/Quodex-windows-x64.zip",
  source: "https://github.com/hxbib/quodex-windows",
  macos: "https://quodex.app",
  macosSource: "https://github.com/hxbib/Quodex",
  author: "Sadman Habib",
  authorUrl: "https://github.com/hxbib",
  requirements: "Windows 10 1809+ or Windows 11 · x64 · MIT",
  downloadLabel: "Download for Windows",
} as const;

export function openProductLink(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function triggerDownload(href: string, filename?: string) {
  const link = document.createElement("a");
  link.href = href;
  link.rel = "noopener";
  if (filename) link.download = filename;
  link.target = filename ? "_self" : "_blank";
  document.body.append(link);
  link.click();
  link.remove();
}

/** Prefer a same-origin zip (this preview). Fall back to the GitHub Windows release. */
export function downloadWindowsApp() {
  const local = SITE.asset;
  void fetch(local, { method: "HEAD" })
    .then((response) => {
      if (response.ok) {
        triggerDownload(local, "Quodex-windows-x64.zip");
        return;
      }
      openProductLink(SITE.download);
    })
    .catch(() => openProductLink(SITE.download));
}
