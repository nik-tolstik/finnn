/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional for local development; production builds enforce it in vite.config.ts. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
