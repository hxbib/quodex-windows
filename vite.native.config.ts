import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "src/native",
  base: "./",
  plugins: [tailwindcss(), viteReact()],
  define: {
    "import.meta.env.VITE_NATIVE": JSON.stringify("1"),
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@/lib/openai/functions": resolve(rootDir, "src/lib/openai/functions.native-stub.ts"),
      "@": resolve(rootDir, "src"),
    },
  },
  build: {
    outDir: "../../electron/renderer",
    emptyOutDir: true,
    sourcemap: false,
    cssMinify: true,
    cssCodeSplit: false,
    assetsInlineLimit: 4096,
    modulePreload: false,
  },
});
