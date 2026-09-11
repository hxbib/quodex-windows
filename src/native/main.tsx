import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NativeApp } from "./NativeApp";
import "../styles.css";

const root = document.getElementById("app");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <NativeApp />
    </StrictMode>,
  );
}
