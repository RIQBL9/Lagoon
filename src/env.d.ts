/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Comma-separated TURN server URLs, e.g. "turn:global.relay.example.com:80,turns:global.relay.example.com:443". */
  readonly VITE_TURN_URLS?: string;
  readonly VITE_TURN_USERNAME?: string;
  readonly VITE_TURN_CREDENTIAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
