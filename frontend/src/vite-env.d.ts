/// <reference types="vite/client" />

// The reference above teaches TypeScript that importing "./styles.css" is
// valid. The interfaces below type the one environment variable the app reads.

interface ImportMetaEnv {
  /** Base URL of the API. Empty or unset means same origin. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
