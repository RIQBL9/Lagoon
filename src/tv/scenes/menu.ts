import type { ButtonId } from "../../shared/protocol";
import { clamp, easeOutCubic, lerp } from "../../shared/math";
import { setMusicEnabled } from "../../audio/music";
import { homeSong } from "../../audio/songs";
import { sfx } from "../../audio/sfx";
import { GAMES, isInstalled } from "../../games/registry";
import { go, playerColor, type Scene } from "../app";
import { drawAvatar, type Avatar } from "../../shared/avatar";
import { C, font, noShadow, rr, softShadow, text } from "../draw";
import { pointer } from "../input";
import { players } from "../net";
import { avatarFor } from "../players";
import { persist, save } from "../save";
import { H, W } from "../screen";
import { Hotspots, chip, hotspot, type Hotspot } from "../ui";
import { Pair } from "./pair";
import { Play } from "./play";
import { Shop, drawShopIcon } from "./shop";
import { Studio } from "./studio";

type Ctx = CanvasRenderingContext2D;

interface Channel {
  title: string;
  icon(ctx: Ctx, w: number, h: number, t: number): void;
  open(): Scene;
}

const COLS = 4;
const SLOTS = 12;
const TILE_W = 250;
const TILE_H = 150;
const GAP = 26;
const GRID_X = (W - (COLS * TILE_W + (COLS - 1) * GAP)) / 2;
const GRID_Y = 92;
const BAR_Y = 612;

// A few fixed faces for the Avatar Studio tile.
const STUDIO_FACES: Avatar[] = [
  { name: "", face: 0, skin: 1, eyes: 4, brows: 1, mouth: 1, hair: 1, hairColor: 1, shirt: 0 },
  { name: "", face: 1, skin: 3, eyes: 2, brows: 0, mouth: 0, hair: 5, hairColor: 0, shirt: 1 },
  { name: "", face: 2, skin: 0, eyes: 0, brows: 2, mouth: 4, hair: 4, hairColor: 4, shirt: 2 },
];

function drawStudioIcon(ctx: Ctx, w: number, h: number, t: number) {
  ctx.fillStyle = "#fdf6ec";
  ctx.fillRect(0, 0, w, h);
  STUDIO_FACES.forEach((a, i) => {
    const bob = Math.sin(t * 2 + i * 1.3) * 3;
    drawAvatar(ctx, a, w * (0.25 + i * 0.25), h * 0.36 + bob, h * 0.34, { body: true, blink: (t + i) % 4 < 0.12 });
  });
  ctx.fillStyle = "#fdf6ec";
  ctx.fillRect(0, h - 34, w, 34);
  text(ctx, "Avatar Studio", w / 2, h - 17, 17, C.ink);
}

function channels(): Channel[] {
  const games = GAMES.filter(isInstalled).map<Channel>((g) => ({
    title: g.title,
    icon: g.icon,
    open: () => new Play(g),
  }));
  const studio: Channel = { title: "Avatar Studio", icon: drawStudioIcon, open: () => new Studio() };
  const shop: Channel = { title: "Lagoon Shop", icon: drawShopIcon, open: () => new Shop() };
  return [...games.slice(0, 1), studio, shop, ...games.slice(1)].slice(0, SLOTS);
}

export class Menu implements Scene {
  music = homeSong;
  private spots = new Hotspots();
  private list = channels();
  private tiles: Hotspot[];
  private musicBtn: Hotspot;
  private remoteBtn: Hotspot;
  private t = 0;
  private opening: { index: number; t: number } | null = null;
  private titleShown = "";
  private titleAlpha = 0;

  constructor() {
    this.tiles = this.list.map((ch, i) => {
      const x = GRID_X + (i % COLS) * (TILE_W + GAP);
      const y = GRID_Y + Math.floor(i / COLS) * (TILE_H + GAP);
      return hotspot(x, y, TILE_W, TILE_H, () => this.open(i, ch));
    });
    this.musicBtn = hotspot(70, 618, 100, 100, () => {
      save.music = !save.music;
      setMusicEnabled(save.music);
      persist();
      sfx.select();
    });
    this.remoteBtn = hotspot(W - 170, 618, 100, 100, () => {
      sfx.select();
      go(new Pair());
    });
    this.spots.items = [...this.tiles, this.musicBtn, this.remoteBtn];
  }

  private open(index: number, ch: Channel) {
    if (this.opening) return;
    sfx.select();
    this.opening = { index, t: 0 };
    setTimeout(() => go(ch.open()), 280);
  }

  update(dt: number) {
    this.t += dt;
    if (this.opening) this.opening.t += dt;
    else this.spots.update(dt, pointer(1));

    const i = this.spots.current ? this.tiles.indexOf(this.spots.current) : -1;
    const title = i >= 0 ? this.list[i].title : "";
    if (title) this.titleShown = title;
    this.titleAlpha = clamp(this.titleAlpha + (title ? dt : -dt) * 6, 0, 1);
  }

  button(id: ButtonId, down: boolean) {
    if (down && id === "a" && !this.opening) this.spots.press();
  }

  hovering() {
    return this.spots.hovering;
  }

  draw(ctx: Ctx) {
    this.drawBackground(ctx);

    this.drawPlayers(ctx);

    chip(ctx, `${save.points}`, W - 40, 28, "right");

    if (this.titleAlpha > 0) {
      ctx.globalAlpha = this.titleAlpha;
      text(ctx, this.titleShown, W / 2, 48, 24, C.ink);
      ctx.globalAlpha = 1;
    }

    for (let i = 0; i < SLOTS; i++) {
      const x = GRID_X + (i % COLS) * (TILE_W + GAP);
      const y = GRID_Y + Math.floor(i / COLS) * (TILE_H + GAP);
      if (i >= this.list.length) {
        rr(ctx, x, y, TILE_W, TILE_H, 22);
        ctx.fillStyle = C.faint;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.04)";
        ctx.lineWidth = 2;
        ctx.stroke();
        continue;
      }
      if (this.opening?.index !== i) this.drawTile(ctx, i, x, y, TILE_W, TILE_H, this.tiles[i].hover);
    }

    this.drawBar(ctx);

    if (this.opening) {
      const i = this.opening.index;
      const k = easeOutCubic(clamp(this.opening.t / 0.35, 0, 1));
      const tile = this.tiles[i];
      this.drawTile(
        ctx,
        i,
        lerp(tile.x, 0, k),
        lerp(tile.y, 0, k),
        lerp(TILE_W, W, k),
        lerp(TILE_H, H, k),
        1 - k,
      );
    }
  }

  /** A chip for each player in the top left: avatar and name. */
  private drawPlayers(ctx: Ctx) {
    const list = players.size ? [...players].sort() : [1];
    let x = 40;
    for (const p of list) {
      const me = avatarFor(p);
      ctx.font = font(17);
      const w = Math.min(170, ctx.measureText(me.name).width + 64);
      ctx.save();
      softShadow(ctx, 8, 2, 0.08);
      rr(ctx, x, 24, w, 44, 22);
      ctx.fillStyle = C.panel;
      ctx.fill();
      noShadow(ctx);
      ctx.lineWidth = 2;
      ctx.strokeStyle = players.size ? playerColor(p) : C.line;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 24, 46, 17, 0, Math.PI * 2);
      ctx.fillStyle = C.cyanSoft;
      ctx.fill();
      ctx.clip();
      drawAvatar(ctx, me, x + 24, 50, 32);
      ctx.restore();
      text(ctx, me.name, x + 48, 47, 17, C.ink, "left");
      x += w + 10;
    }
  }

  private drawBackground(ctx: Ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#f7f9fa");
    g.addColorStop(1, "#e8edf0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  private drawTile(ctx: Ctx, i: number, x: number, y: number, w: number, h: number, hover: number) {
    const grow = hover * 8;
    ctx.save();
    ctx.translate(x - grow, y - grow * (h / w));
    const tw = w + grow * 2;
    const th = h + grow * 2 * (h / w);

    softShadow(ctx, 12 + hover * 16, 4 + hover * 4, 0.1 + hover * 0.08);
    rr(ctx, 0, 0, tw, th, 22);
    ctx.fillStyle = C.panel;
    ctx.fill();
    noShadow(ctx);

    ctx.save();
    rr(ctx, 0, 0, tw, th, 22);
    ctx.clip();
    ctx.scale(tw / TILE_W, th / TILE_H);
    this.list[i].icon(ctx, TILE_W, TILE_H, this.t);
    ctx.restore();

    rr(ctx, 0, 0, tw, th, 22);
    ctx.lineWidth = hover > 0.05 ? 3 : 1.5;
    ctx.strokeStyle = hover > 0.05 ? C.cyan : C.line;
    ctx.stroke();
    ctx.restore();
  }

  private drawBar(ctx: Ctx) {
    ctx.save();
    softShadow(ctx, 20, -2, 0.08);
    ctx.fillStyle = "#fbfcfd";
    ctx.beginPath();
    ctx.moveTo(0, BAR_Y + 30);
    ctx.quadraticCurveTo(0, BAR_Y, 60, BAR_Y);
    ctx.lineTo(220, BAR_Y);
    ctx.bezierCurveTo(300, BAR_Y, 320, BAR_Y + 36, 420, BAR_Y + 36);
    ctx.lineTo(W - 420, BAR_Y + 36);
    ctx.bezierCurveTo(W - 320, BAR_Y + 36, W - 300, BAR_Y, W - 220, BAR_Y);
    ctx.lineTo(W - 60, BAR_Y);
    ctx.quadraticCurveTo(W, BAR_Y, W, BAR_Y + 30);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    noShadow(ctx);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    const now = new Date();
    const clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const date = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
    text(ctx, clock, W / 2, BAR_Y + 64, 42, C.soft);
    text(ctx, date, W / 2, BAR_Y + 98, 17, C.soft, "center", 500);

    this.roundButton(ctx, this.musicBtn, (cx, cy) => {
      ctx.strokeStyle = ctx.fillStyle = save.music ? C.cyan : C.soft;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy + 12);
      ctx.lineTo(cx + 2, cy - 16);
      ctx.lineTo(cx + 16, cy - 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx - 5, cy + 13, 8, 6, -0.4, 0, Math.PI * 2);
      ctx.fill();
      if (!save.music) {
        ctx.strokeStyle = C.coral;
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy - 18);
        ctx.lineTo(cx + 18, cy + 18);
        ctx.stroke();
      }
    });

    this.roundButton(ctx, this.remoteBtn, (cx, cy) => {
      rr(ctx, cx - 10, cy - 22, 20, 44, 8);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = C.cyan;
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 4, cy + 6, 8, 3);
    });
  }

  private roundButton(ctx: Ctx, h: Hotspot, icon: (cx: number, cy: number) => void) {
    const cx = h.x + h.w / 2;
    const cy = h.y + h.h / 2;
    const r = 42 + h.hover * 4;
    ctx.save();
    softShadow(ctx, 10 + h.hover * 8, 3, 0.1);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = C.panel;
    ctx.fill();
    noShadow(ctx);
    ctx.lineWidth = h.hover > 0.05 ? 3 : 1.5;
    ctx.strokeStyle = h.hover > 0.05 ? C.cyan : C.line;
    ctx.stroke();
    icon(cx, cy);
    ctx.restore();
  }
}
