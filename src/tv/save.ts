import { randomAvatar, type Avatar } from "../shared/avatar";

export interface SaveData {
  version: 1;
  points: number;
  installed: string[];
  avatars: Avatar[];
  active: number;
  music: boolean;
  bests: Record<string, number>;
}

const KEY = "lagoon-save";
export const MAX_AVATARS = 6;

function fresh(): SaveData {
  return { version: 1, points: 500, installed: [], avatars: [randomAvatar()], active: 0, music: true, bests: {} };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = { ...fresh(), ...JSON.parse(raw) } as SaveData;
      if (data.avatars.length === 0) data.avatars.push(randomAvatar());
      data.active = Math.min(data.active, data.avatars.length - 1);
      return data;
    }
  } catch {}
  return fresh();
}

export const save = load();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {}
}

export const activeAvatar = () => save.avatars[save.active];

export function addPoints(n: number) {
  save.points += n;
  persist();
}

export function recordBest(game: string, score: number, lowerIsBetter = false) {
  const old = save.bests[game];
  const isBest = old === undefined || (lowerIsBetter ? score < old : score > old);
  if (isBest) {
    save.bests[game] = score;
    persist();
  }
  return isBest;
}
