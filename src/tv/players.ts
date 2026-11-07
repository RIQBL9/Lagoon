import { cleanAvatar, randomAvatar, type Avatar } from "../shared/avatar";
import { activeAvatar } from "./save";

// Each phone sets up its own player (name and look) after connecting.
// Player 1 falls back to the console's active avatar when their phone hasn't
// sent one, or when they're playing with the mouse.

const profiles = new Map<number, Avatar>();
const standIns = new Map<number, Avatar>();

/** Returns true the first time this player sends a profile. */
export function setProfile(p: number, raw: unknown) {
  const isNew = !profiles.has(p);
  profiles.set(p, cleanAvatar(raw));
  return isNew;
}

export function clearProfile(p: number) {
  profiles.delete(p);
}

export function avatarFor(p: number): Avatar {
  const own = profiles.get(p);
  if (own) return own;
  if (p === 1) return activeAvatar();
  let stand = standIns.get(p);
  if (!stand) {
    stand = { ...randomAvatar(), name: `Player ${p}` };
    standIns.set(p, stand);
  }
  return stand;
}
