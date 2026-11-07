import type { ButtonId } from "../shared/protocol";
import type { Song } from "../audio/music";
import type { Avatar } from "../shared/avatar";
import type { Pointer, Swing } from "../tv/input";

/** What the console gives a running game. */
export interface GameHost {
  /** Player 1's avatar. */
  avatar: Avatar;
  avatarFor(p: number): Avatar;
  pointer(p?: number): Pointer;
  isHeld(id: ButtonId, p?: number): boolean;
  /** Player numbers with a phone connected. Empty means mouse only. */
  players(): number[];
  music(song: Song | null): void;
  rumble(ms: number, p?: number): void;
  /** Adds shop points and records a best score. Returns true for a new best. */
  award(score: number, points: number, lowerIsBetter?: boolean): boolean;
  best(): number | undefined;
  exit(): void;
}

export interface GameSession {
  hideCursor?: boolean;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  button?(id: ButtonId, down: boolean, p: number): void;
  swing?(s: Swing): void;
  hovering?(): boolean;
  paused?(on: boolean): void;
  destroy?(): void;
}

export interface LagoonGame {
  id: string;
  title: string;
  blurb: string;
  /** Shop points. 0 means it comes installed. */
  price: number;
  /** Draws the channel tile, origin at its top-left corner. */
  icon(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void;
  create(host: GameHost): GameSession;
}
