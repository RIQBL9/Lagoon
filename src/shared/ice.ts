// Servers that help a phone and the TV find a route to each other.
//
// STUN is free and works when both are on ordinary home Wi-Fi. When a direct
// route isn't possible (mobile data, guest or school Wi-Fi), traffic needs a
// TURN relay. There's no reliable free public one, so add your own through
// environment variables (see "Phones stuck connecting" in the README).

const STUN: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
];

function turn(): RTCIceServer[] {
  const urls = (import.meta.env.VITE_TURN_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (!urls.length) return [];
  return [{ urls, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }];
}

export const iceServers = (): RTCIceServer[] => [...STUN, ...turn()];

export const hasTurn = () => turn().length > 0;
