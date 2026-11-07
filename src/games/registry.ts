import { save } from "../tv/save";
import { bowling } from "./bowling";
import { darts } from "./darts";
import { kart } from "./kart";
import type { LagoonGame } from "./types";

export const GAMES: LagoonGame[] = [bowling, darts, kart];

export const isInstalled = (g: LagoonGame) => g.price === 0 || save.installed.includes(g.id);
