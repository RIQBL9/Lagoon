import Peer, { type DataConnection } from "peerjs";
import { iceServers } from "../shared/ice";
import { MAX_PLAYERS, readToTv, tvPeerId, type ToPhone, type ToTv } from "../shared/protocol";

// The TV is the hub. It registers a PeerJS id made from the room code, and
// each phone that dials it gets the lowest free player number.

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, they look like 1 and 0

/** Four random letters, fresh every time the TV opens. */
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => LETTERS[b % LETTERS.length]).join("");
}

/** The room code phones type in. It changes on New code, or if another TV somewhere already has it. */
export let room = newCode();

export const players = new Set<number>();

export type NetStatus = "connecting" | "ready" | "offline";
export let netStatus: NetStatus = "connecting";

interface Handlers {
  input(msg: ToTv & { p: number }): void;
  peer(p: number, joined: boolean): void;
}

const phones = new Map<number, DataConnection>();
let current: Peer | null = null;
let handlers: Handlers | null = null;

function send(conn: DataConnection, msg: ToPhone) {
  if (conn.open) void conn.send(msg);
}

function freeSlot() {
  for (let p = 1; p <= MAX_PLAYERS; p++) if (!phones.has(p)) return p;
  return 0;
}

function accept(conn: DataConnection, on: Handlers) {
  conn.on("open", () => {
    const p = freeSlot();
    if (!p) {
      send(conn, { t: "error", reason: "full" });
      setTimeout(() => conn.close(), 500);
      return;
    }
    phones.set(p, conn);
    players.add(p);
    send(conn, { t: "welcome", p });
    on.peer(p, true);

    conn.on("data", (data) => {
      const msg = readToTv(data);
      if (msg) on.input({ ...msg, p });
    });

    const leave = () => {
      if (phones.get(p) !== conn) return;
      phones.delete(p);
      players.delete(p);
      on.peer(p, false);
    };
    conn.on("close", leave);
    conn.on("error", leave);
  });
}

export function connectTv(on: Handlers, attempt = 0) {
  handlers = on;
  netStatus = "connecting";
  const peer = new Peer(tvPeerId(room), { debug: 0, config: { iceServers: iceServers() } });
  current = peer;

  peer.on("open", () => (netStatus = "ready"));
  peer.on("connection", (conn) => accept(conn, on));

  peer.on("error", (err) => {
    if (err.type === "unavailable-id" && attempt < 10) {
      // Someone else has this code. Pick another one.
      peer.destroy();
      room = newCode();
      setTimeout(() => connectTv(on, attempt + 1), 500);
    } else if (err.type === "network" || err.type === "server-error" || err.type === "socket-error") {
      netStatus = "offline";
    }
  });

  peer.on("disconnected", () => {
    // Lost the matchmaking server. Phones already connected keep working.
    netStatus = "offline";
    setTimeout(() => !peer.destroyed && peer.reconnect(), 3000);
  });
}

/** Swaps to a new random room code. Only while no phones are connected, since it would drop them. */
export function newRoom() {
  if (phones.size || !handlers) return false;
  current?.destroy();
  room = newCode();
  connectTv(handlers);
  return true;
}

export function rumble(ms: number, p?: number) {
  const targets = p ? [phones.get(p)] : [...phones.values()];
  for (const conn of targets) if (conn) send(conn, { t: "rumble", ms });
}

/** The address a phone should open. */
export async function remoteUrl() {
  let host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    try {
      const res = await fetch("/api/host");
      const { addresses } = (await res.json()) as { addresses: string[] };
      if (addresses[0]) host = addresses[0];
    } catch {}
  }
  const port = location.port ? `:${location.port}` : "";
  return `${location.protocol}//${host}${port}/remote.html?room=${room}`;
}
