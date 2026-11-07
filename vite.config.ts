import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { resolve } from "node:path";
import { lanAddress } from "./server/lan.ts";

const root = import.meta.dirname;

export default defineConfig(({ command }) => ({
  plugins: [
    // Phones only share motion data over HTTPS, so the local dev server uses a
    // self-signed certificate. `npm run dev:http` skips it for mouse-only testing.
    // Deployed builds get real HTTPS from the host and don't need this.
    command === "serve" && !process.env.LAGOON_HTTP && basicSsl(),
    lanAddress(),
  ],
  build: {
    rollupOptions: {
      input: {
        tv: resolve(root, "index.html"),
        remote: resolve(root, "remote.html"),
      },
    },
  },
}));
