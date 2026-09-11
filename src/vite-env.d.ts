/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NATIVE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
