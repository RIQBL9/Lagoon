import type { ButtonId } from "../../shared/protocol";
import { clamp, easeOutCubic } from "../../shared/math";
import { shopSong } from "../../audio/songs";
import { sfx } from "../../audio/sfx";
import { GAMES, isInstalled } from "../../games/registry";
import type { LagoonGame } from "../../games/types";
import { go, type Scene } from "../app";
import { C, backdrop, panel, rr, text } from "../draw";
import { pointer } from "../input";
import { rumble } from "../net";
import { persist, save } from "../save";
import { H, W } from "../screen";
import { Hotspots, isDirection, chip, drawButton, hotspot, type Hotspot } from "../ui";
import { Menu } from "./menu";

type Ctx = CanvasRenderingContext2D;

function bag(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.lineWidth = s * 0.07;
  ctx.strokeStyle = C.cyan;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.32, s * 0.2, Math.PI, 0);
  ctx.stroke();
  rr(ctx, cx - s * 0.42, cy - s * 0.32, s * 0.84, s * 0.72, s * 0.12);
  ctx.fillStyle = C.cyan;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.04, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawShopIcon(ctx: Ctx, w: number, h: number, t: number) {
  ctx.fillStyle = "#eef8fc";
  ctx.fillRect(0, 0, w, h);
  // drifting coins
  for (let i = 0; i < 5; i++) {
    const x = ((i * 61 + t * 14) % (w + 40)) - 20;
    const y = 30 + ((i * 37) % 70) + Math.sin(t * 1.5 + i) * 6;
    ctx.fillStyle = "rgba(242, 181, 58, 0.35)";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  bag(ctx, w / 2, h * 0.44, 74);
  text(ctx, "Lagoon Shop", w / 2, h - 18, 17, C.ink);
}

type Modal =
  | { kind: "confirm"; game: LagoonGame }
  | { kind: "installing"; game: LagoonGame; t: number }
  | { kind: "installed"; game: LagoonGame }
  | { kind: "short"; game: LagoonGame };

const CARD_X = 60;
const CARD_W = W - 120;
const CARD_H = 160;

export class Shop implements Scene {
  music = shopSong;
  private spots = new Hotspots();
  private items = GAMES.filter((g) => g.price > 0);
  private buys: Hotspot[] = [];
  private back = hotspot(60, H - 100, 220, 60, () => {
    sfx.back();
    go(new Menu());
  });
  private yes = hotspot(W / 2 + 10, 420, 200, 60, () => this.confirm());
  private no = hotspot(W / 2 - 210, 420, 200, 60, () => this.close());
  private ok = hotspot(W / 2 - 100, 420, 200, 60, () => this.close());
  private modal: Modal | null = null;
  private modalT = 0;
  private t = 0;

  constructor() {
    this.buys = this.items.map((g, i) =>
      hotspot(CARD_X + CARD_W - 240, 150 + i * (CARD_H + 24) + CARD_H / 2 - 30, 210, 60, () => this.ask(g)),
    );
    this.layout();
  }

  private layout() {
    this.buys.forEach((b, i) => (b.disabled = isInstalled(this.items[i])));
    const m = this.modal;
    if (!m) this.spots.items = [this.back, ...this.buys];
    else if (m.kind === "confirm") this.spots.items = [this.no, this.yes];
    else if (m.kind === "installing") this.spots.items = [];
    else this.spots.items = [this.ok];
  }

  private open(m: Modal) {
    this.modal = m;
    this.modalT = 0;
    this.layout();
  }

  private ask(game: LagoonGame) {
    sfx.select();
    this.open(save.points >= game.price ? { kind: "confirm", game } : { kind: "short", game });
  }

  private confirm() {
    if (this.modal?.kind !== "confirm") return;
    const { game } = this.modal;
    save.points -= game.price;
    save.installed.push(game.id);
    persist();
    sfx.coin();
    this.open({ kind: "installing", game, t: 0 });
  }

  private close() {
    sfx.back();
    this.modal = null;
    this.layout();
  }

  update(dt: number) {
    this.t += dt;
    this.modalT += dt;
    this.spots.update(dt, pointer(1));

    const m = this.modal;
    if (m?.kind === "installing") {
      const before = Math.floor(m.t * 4);
      m.t += dt;
      if (Math.floor(m.t * 4) !== before) rumble(20);
      if (m.t > 2.2) {
        sfx.fanfare();
        this.open({ kind: "installed", game: m.game });
      }
    }
  }

  button(id: ButtonId, down: boolean) {
    if (!down) return;
    if (id === "a") this.spots.press();
    else if (isDirection(id)) this.spots.move(id);
    else if (id === "b") {
      if (this.modal && this.modal.kind !== "installing") this.close();
      else if (!this.modal) this.back.press();
    }
  }

  hovering() {
    return this.spots.hovering;
  }

  draw(ctx: Ctx) {
    backdrop(ctx, W, H, this.t);

    bag(ctx, 92, 70, 50);
    text(ctx, "Lagoon Shop", 130, 72, 34, C.ink, "left");
    chip(ctx, `${save.points}`, W - 60, 52, "right");

    this.items.forEach((g, i) => {
      const y = 150 + i * (CARD_H + 24);
      panel(ctx, CARD_X, y, CARD_W, CARD_H, 26);

      ctx.save();
      rr(ctx, CARD_X + 14, y + 14, 234, CARD_H - 28, 18);
      ctx.clip();
      ctx.translate(CARD_X + 14, y + 14);
      ctx.scale(234 / 250, (CARD_H - 28) / 150);
      g.icon(ctx, 250, 150, this.t);
      ctx.restore();

      text(ctx, g.title, CARD_X + 280, y + 50, 28, C.ink, "left");
      text(ctx, g.blurb, CARD_X + 280, y + 90, 19, C.soft, "left", 500);

      const owned = isInstalled(g);
      if (!owned) {
        ctx.fillStyle = C.amber;
        ctx.beginPath();
        ctx.arc(CARD_X + 290, y + 128, 9, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, `${g.price} points`, CARD_X + 306, y + 129, 19, C.ink, "left");
      }
      drawButton(ctx, this.buys[i], owned ? "Installed" : "Buy", !owned);
    });

    if (this.items.length === 0) text(ctx, "Nothing for sale right now. Check back later.", W / 2, 300, 22, C.soft, "center", 500);

    text(ctx, "Earn points by playing games.", W - 60, H - 70, 18, C.soft, "right", 500);
    drawButton(ctx, this.back, "Home Menu");

    if (this.modal) this.drawModal(ctx, this.modal);
  }

  private drawModal(ctx: Ctx, m: Modal) {
    const k = easeOutCubic(clamp(this.modalT / 0.25, 0, 1));
    ctx.save();
    ctx.fillStyle = `rgba(61, 71, 82, ${0.4 * k})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 24);
    panel(ctx, W / 2 - 320, 200, 640, 320, 32);

    switch (m.kind) {
      case "confirm":
        text(ctx, `Buy ${m.game.title}?`, W / 2, 285, 30);
        text(ctx, `This uses ${m.game.price} of your ${save.points} points.`, W / 2, 340, 20, C.soft, "center", 500);
        drawButton(ctx, this.no, "Not now");
        drawButton(ctx, this.yes, "Buy", true);
        break;
      case "short":
        text(ctx, "Not enough points", W / 2, 285, 30);
        text(ctx, `You need ${m.game.price - save.points} more. Play a game to earn some.`, W / 2, 340, 20, C.soft, "center", 500);
        drawButton(ctx, this.ok, "OK");
        break;
      case "installing": {
        text(ctx, `Installing ${m.game.title}`, W / 2, 285, 28);
        const p = clamp(m.t / 2.2, 0, 1);
        rr(ctx, W / 2 - 220, 350, 440, 22, 11);
        ctx.fillStyle = C.faint;
        ctx.fill();
        rr(ctx, W / 2 - 220, 350, 440 * easeOutCubic(p), 22, 11);
        ctx.fillStyle = C.cyan;
        ctx.fill();
        text(ctx, "Keep the console on.", W / 2, 420, 18, C.soft, "center", 500);
        break;
      }
      case "installed":
        text(ctx, "All done!", W / 2, 285, 32);
        text(ctx, `${m.game.title} is on your Home Menu now.`, W / 2, 340, 20, C.soft, "center", 500);
        drawButton(ctx, this.ok, "OK", true);
        break;
    }
    ctx.restore();
  }
}
