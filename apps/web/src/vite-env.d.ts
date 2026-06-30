/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_WS_URL?: string;
  readonly VITE_MONITOR_TARGET?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
