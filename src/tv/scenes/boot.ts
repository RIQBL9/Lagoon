import type { ButtonId } from "../../shared/protocol";
import { clamp, easeOutBack, easeOutCubic } from "../../shared/math";
import { sfx } from "../../audio/sfx";
import { go, type Scene } from "../app";
import { C, backdrop, drawImage, image, panel, text } from "../draw";
import { players } from "../net";
import { H, W } from "../screen";
import { Menu } from "./menu";
import { Pair } from "./pair";

type Phase = "waiting" | "logo" | "notice";

const MARK = "/brand/lagoon-mark.svg";
const WORD = "/brand/lagoon-wordmark.svg";

export class Boot implements Scene {
  music = null;
  hideCursor = true;
  private phase: Phase = "waiting";
  private t = 0;

  enter() {
    image(MARK);
    image(WORD);
  }

  update(dt: number) {
    this.t += dt;
    if (this.phase === "logo" && this.t > 2.8) this.next();
  }

  button(_id: ButtonId, down: boolean) {
    if (down) this.next();
  }

  private next() {
    if (this.phase === "waiting") {
      this.phase = "logo";
      this.t = 0;
      sfx.chime();
    } else if (this.phase === "logo") {
      this.phase = "notice";
      this.t = 0;
    } else if (this.t > 0.4) {
      sfx.select();
      go(players.size ? new Menu() : new Pair(true));
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    backdrop(ctx, W, H, this.t);

    if (this.phase === "waiting") {
      const pulse = 0.55 + Math.sin(this.t * 3) * 0.35;
      ctx.globalAlpha = 0.35;
      drawImage(ctx, MARK, W / 2 - 50, H / 2 - 110, 100, 100);
      ctx.globalAlpha = pulse;
      text(ctx, "Click anywhere or press a key to start", W / 2, H / 2 + 40, 22, C.soft, "center", 500);
      ctx.globalAlpha = 1;
      return;
    }

    if (this.phase === "logo") {
      const pop = easeOutBack(clamp(this.t / 0.6, 0, 1));
      const slide = easeOutCubic(clamp((this.t - 0.45) / 0.6, 0, 1));
      const out = clamp((this.t - 2.3) / 0.5, 0, 1);
      ctx.save();
      ctx.globalAlpha = 1 - out;
      const size = 150 * pop;
      drawImage(ctx, MARK, W / 2 - 210 - size / 2 + 75, H / 2 - size / 2, size, size);
      ctx.globalAlpha = slide * (1 - out);
      drawImage(ctx, WORD, W / 2 - 40 + (1 - slide) * 30, H / 2 - 50, 286, 96); // 249×84 artwork
      ctx.restore();
      return;
    }

    const show = easeOutCubic(clamp(this.t / 0.4, 0, 1));
    ctx.save();
    ctx.globalAlpha = show;
    ctx.translate(0, (1 - show) * 20);
    panel(ctx, W / 2 - 360, 170, 720, 340, 32);
    text(ctx, "Before you play", W / 2, 240, 34);
    text(ctx, "Hold your phone firmly when you swing,", W / 2, 310, 22, C.ink, "center", 500);
    text(ctx, "and keep some space around you.", W / 2, 345, 22, C.ink, "center", 500);
    ctx.globalAlpha = show * (0.6 + Math.sin(this.t * 3) * 0.4);
    text(ctx, "Press A to continue", W / 2, 440, 22, C.cyan);
    ctx.restore();
  }
}
