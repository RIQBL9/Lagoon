import type { ButtonId } from "../../shared/protocol";
import type { LagoonGame, GameHost, GameSession } from "../../games/types";
import { playSong } from "../../audio/music";
import { goHome, toast, type Scene } from "../app";
import { C } from "../draw";
import { isHeld, pointer, type Swing } from "../input";
import { players, rumble } from "../net";
import { avatarFor } from "../players";
import { addPoints, recordBest, save } from "../save";

/** Runs a game inside the console. */
export class Play implements Scene {
  pausable = true;
  music = null;
  private session!: GameSession;

  constructor(private game: LagoonGame) {}

  get hideCursor() {
    return this.session?.hideCursor ?? false;
  }

  enter() {
    const id = this.game.id;
    const host: GameHost = {
      avatar: avatarFor(1),
      avatarFor,
      pointer,
      isHeld,
      players: () => [...players].sort(),
      music: playSong,
      rumble,
      award(score, points, lowerIsBetter = false) {
        if (points > 0) {
          addPoints(points);
          toast(`+${points} points`, C.amber);
        }
        return recordBest(id, score, lowerIsBetter);
      },
      best: () => save.bests[id],
      exit: goHome,
    };
    this.session = this.game.create(host);
  }

  exit() {
    this.session.destroy?.();
  }

  paused(on: boolean) {
    this.session.paused?.(on);
  }

  update(dt: number) {
    this.session.update(dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.session.draw(ctx);
  }

  button(id: ButtonId, down: boolean, p: number) {
    this.session.button?.(id, down, p);
  }

  swing(s: Swing) {
    this.session.swing?.(s);
  }

  hovering() {
    return this.session.hovering?.() ?? false;
  }
}
