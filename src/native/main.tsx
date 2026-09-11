import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installNativeBridge } from "./bridge";
import { NativeApp } from "./NativeApp";
import "../styles.css";

installNativeBridge();

const root = document.getElementById("app");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <NativeApp />
    </StrictMode>,
  );
}
