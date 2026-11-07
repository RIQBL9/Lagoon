import type { Connect, Plugin } from "vite";
import { networkInterfaces } from "node:os";

// When the TV page is opened at localhost, the QR code needs this computer's
// Wi-Fi address instead, so phones on the same network can reach it.
// Only used by the local dev server; a deployed site uses its own address.

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n!.address);
}

const hostInfo: Connect.NextHandleFunction = (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ addresses: lanAddresses() }));
};

export function lanAddress(): Plugin {
  return {
    name: "lagoon-lan-address",
    configureServer(server) {
      server.middlewares.use("/api/host", hostInfo);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/host", hostInfo);
    },
  };
}
