import type { SnapLayout, WindowId, WindowState } from "./types";

export const TASKBAR_H = 48;
export const MIN_W = 380;
export const MIN_H = 280;
export const SNAP_EDGE = 18;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function viewportRect(vw: number, vh: number): Rect {
  return { x: 0, y: 0, w: Math.max(320, vw), h: Math.max(200, vh - TASKBAR_H) };
}

export function snapRect(layout: SnapLayout, vw: number, vh: number): Rect | null {
  if (!layout) return null;
  const { x, y, w, h } = viewportRect(vw, vh);
  const halfW = Math.round(w / 2);
  const halfH = Math.round(h / 2);
  switch (layout) {
    case "maximize":
      return { x, y, w, h };
    case "left":
      return { x, y, w: halfW, h };
    case "right":
      return { x: x + halfW, y, w: w - halfW, h };
    case "top-left":
      return { x, y, w: halfW, h: halfH };
    case "top-right":
      return { x: x + halfW, y, w: w - halfW, h: halfH };
    case "bottom-left":
      return { x, y: y + halfH, w: halfW, h: h - halfH };
    case "bottom-right":
      return { x: x + halfW, y: y + halfH, w: w - halfW, h: h - halfH };
    default:
      return null;
  }
}

export function oppositeSnap(layout: SnapLayout): SnapLayout {
  if (layout === "left") return "right";
  if (layout === "right") return "left";
  return null;
}

export function centeredRect(vw: number, vh: number, w: number, h: number): Rect {
  const bounds = viewportRect(vw, vh);
  const width = Math.min(Math.max(MIN_W, w), bounds.w - 24);
  const height = Math.min(Math.max(MIN_H, h), bounds.h - 24);
  return {
    x: Math.max(12, Math.round((bounds.w - width) / 2)),
    y: Math.max(12, Math.round((bounds.h - height) / 2)),
    w: width,
    h: height,
  };
}

export function clampRect(rect: Rect, vw: number, vh: number): Rect {
  const bounds = viewportRect(vw, vh);
  const w = Math.min(Math.max(MIN_W, rect.w), bounds.w);
  const h = Math.min(Math.max(MIN_H, rect.h), bounds.h);
  const x = Math.min(Math.max(-w + 80, rect.x), bounds.w - 80);
  const y = Math.min(Math.max(0, rect.y), Math.max(0, bounds.h - 32));
  return { x, y, w, h };
}

export function edgeSnap(x: number, y: number, vw: number, vh: number): SnapLayout {
  if (y <= SNAP_EDGE) return "maximize";
  if (x <= SNAP_EDGE) return "left";
  if (x >= vw - SNAP_EDGE) return "right";
  void vh;
  return null;
}

export function windowFrameRect(win: WindowState, vw: number, vh: number): Rect {
  if (win.maximized) return viewportRect(vw, vh);
  const snapped = snapRect(win.snap, vw, vh);
  if (snapped) return snapped;
  return { x: win.x, y: win.y, w: win.w, h: win.h };
}

export const WINDOW_META: Record<WindowId, { title: string; hint: string }> = {
  quodex: { title: "Quodex", hint: "ChatGPT usage tracker" },
  settings: { title: "Settings", hint: "Personalization and system" },
  explorer: { title: "File Explorer", hint: "This PC and Quodex files" },
  taskmgr: { title: "Task Manager", hint: "Efficiency and running apps" },
};
