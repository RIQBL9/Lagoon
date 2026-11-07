import type { Avatar } from "./avatar.ts";

// Phones talk to the TV directly over a WebRTC data channel. A public PeerJS
// server only introduces them; after that nothing goes through a server.

export type ButtonId =
  | "a" | "b"
  | "up" | "down" | "left" | "right"
  | "plus" | "minus" | "home"
  | "one" | "two";

const BUTTONS: readonly ButtonId[] = ["a", "b", "up", "down", "left", "right", "plus", "minus", "home", "one", "two"];

/** Sent by the phone. x/y are 0..1 across the screen, roll is degrees. */
export type ControlInput =
  | { t: "aim"; x: number; y: number; roll: number }
  | { t: "btn"; id: ButtonId; down: boolean }
  | { t: "swing"; power: number; dir: number };

/** The player's name and look, set up on the phone after connecting. */
export type ProfileMsg = { t: "profile"; avatar: Avatar };

export type ToTv = ControlInput | ProfileMsg;

export type ToPhone =
  | { t: "welcome"; p: number }
  | { t: "rumble"; ms: number }
  | { t: "error"; reason: "full" };

export const MAX_PLAYERS = 4;

/** The PeerJS id a TV registers under. Phones dial it from the room code. */
export const tvPeerId = (room: string) => `lagoon-console-tv-${room.toLowerCase()}`;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Checks a message from a phone. Anything malformed is dropped. */
export function readToTv(data: unknown): ToTv | null {
  if (!data || typeof data !== "object") return null;
  const m = data as Record<string, unknown>;
  switch (m.t) {
    case "aim":
      return num(m.x) && num(m.y) && num(m.roll) ? { t: "aim", x: m.x, y: m.y, roll: m.roll } : null;
    case "btn":
      return BUTTONS.includes(m.id as ButtonId) && typeof m.down === "boolean"
        ? { t: "btn", id: m.id as ButtonId, down: m.down }
        : null;
    case "swing":
      return num(m.power) && num(m.dir) ? { t: "swing", power: m.power, dir: m.dir } : null;
    case "profile":
      // cleaned properly on the TV with cleanAvatar()
      return m.avatar && typeof m.avatar === "object" ? { t: "profile", avatar: m.avatar as Avatar } : null;
    default:
      return null;
  }
}
