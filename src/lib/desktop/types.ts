export type WindowId = "quodex" | "settings" | "explorer" | "taskmgr";
export type SnapLayout =
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "maximize"
  | null;

export interface WindowState {
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  snap: SnapLayout;
  x: number;
  y: number;
  w: number;
  h: number;
}
