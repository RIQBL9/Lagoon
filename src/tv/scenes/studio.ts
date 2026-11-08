import type { ButtonId } from "../../shared/protocol";
import { studioSong } from "../../audio/songs";
import { sfx } from "../../audio/sfx";
import { go, type Scene } from "../app";
import {
  HAIR_COLORS,
  OPTION_COUNTS,
  SHIRTS,
  MAX_NAME,
  SKINS,
  drawAvatar,
  randomAvatar,
  type Avatar,
  type Feature,
} from "../../shared/avatar";
import { C, backdrop, noShadow, panel, rr, softShadow, text } from "../draw";
import { captureKeyboard, pointer } from "../input";
import { MAX_AVATARS, activeAvatar, persist, save } from "../save";
import { H, W } from "../screen";
import { Hotspots, isDirection, drawButton, hotspot, type Hotspot } from "../ui";
import { Menu } from "./menu";

type Ctx = CanvasRenderingContext2D;

const TABS: { feature: Feature; label: string }[] = [
  { feature: "face", label: "Face" },
  { feature: "skin", label: "Skin" },
  { feature: "hair", label: "Hair" },
  { feature: "hairColor", label: "Colour" },
  { feature: "eyes", label: "Eyes" },
  { feature: "brows", label: "Brows" },
  { feature: "mouth", label: "Mouth" },
  { feature: "shirt", label: "Shirt" },
];

const SWATCHES: Partial<Record<Feature, string[]>> = { skin: SKINS, hairColor: HAIR_COLORS, shirt: SHIRTS };

const GRID_X = 500;
const GRID_Y = 168;
const CELL_W = 134;
const CELL_H = 118;
const CELL_GAP = 15;

export class Studio implements Scene {
  music = studioSong;
  private spots = new Hotspots();
  private tab = 0;
  private t = 0;
  private editingName = false;
  private nameBox = hotspot(80, 112, 340, 56, () => this.startEditing());
  private surprise = hotspot(110, 540, 280, 60, () => this.randomise());
  private done = hotspot(W - 250, H - 100, 200, 60, () => this.leave());
  private remove = hotspot(GRID_X, H - 100, 200, 60, () => this.deleteAvatar());
  private tabs: Hotspot[] = [];
  private cells: Hotspot[] = [];
  private slots: Hotspot[] = [];

  constructor() {
    this.rebuild();
  }

  private get avatar(): Avatar {
    return activeAvatar();
  }

  private get feature() {
    return TABS[this.tab].feature;
  }

  private rebuild() {
    this.tabs = TABS.map((_, i) =>
      hotspot(GRID_X + i * 92, 100, 86, 44, () => {
        this.tab = i;
        sfx.select();
        this.rebuild();
      }),
    );

    this.cells = Array.from({ length: OPTION_COUNTS[this.feature] }, (_, i) =>
      hotspot(GRID_X + (i % 5) * (CELL_W + CELL_GAP), GRID_Y + Math.floor(i / 5) * (CELL_H + CELL_GAP), CELL_W, CELL_H, () => {
        this.avatar[this.feature] = i;
        persist();
        sfx.select();
      }),
    );

    const count = save.avatars.length + (save.avatars.length < MAX_AVATARS ? 1 : 0);
    this.slots = Array.from({ length: count }, (_, i) =>
      hotspot(W - 60 - (count - i) * 64, 18, 56, 56, () => this.pickSlot(i)),
    );

    this.remove.disabled = save.avatars.length < 2;
    this.spots.items = [this.nameBox, this.surprise, this.done, this.remove, ...this.tabs, ...this.cells, ...this.slots];
  }

  private pickSlot(i: number) {
    if (i === save.avatars.length) {
      save.avatars.push(randomAvatar());
      sfx.coin();
    } else {
      sfx.select();
    }
    save.active = i;
    persist();
    this.rebuild();
  }

  private deleteAvatar() {
    save.avatars.splice(save.active, 1);
    save.active = Math.max(0, save.active - 1);
    persist();
    sfx.back();
    this.rebuild();
  }

  private randomise() {
    const name = this.avatar.name;
    save.avatars[save.active] = { ...randomAvatar(), name };
    persist();
    sfx.coin();
  }

  private startEditing() {
    if (this.editingName) return;
    this.editingName = true;
    sfx.select();
    captureKeyboard((e) => {
      const a = this.avatar;
      if (e.key === "Enter" || e.key === "Escape") this.stopEditing();
      else if (e.key === "Backspace") a.name = a.name.slice(0, -1);
      else if (e.key.length === 1 && /[\p{L}\p{N} '-]/u.test(e.key) && a.name.length < MAX_NAME) a.name += e.key;
      else return false;
      return true;
    });
  }

  private stopEditing() {
    if (!this.editingName) return;
    this.editingName = false;
    captureKeyboard(null);
    this.avatar.name = this.avatar.name.trim() || "Player";
    persist();
  }

  private leave() {
    this.stopEditing();
    persist();
    sfx.back();
    go(new Menu());
  }

  exit() {
    this.stopEditing();
  }

  update(dt: number) {
    this.t += dt;
    this.spots.update(dt, pointer(1));
  }

  button(id: ButtonId, down: boolean) {
    if (!down) return;
    if (id === "a") {
      if (this.editingName && this.spots.current !== this.nameBox) this.stopEditing();
      this.spots.press();
    } else if (id === "b") {
      this.leave();
    } else if (isDirection(id)) {
      this.spots.move(id);
    } else if (id === "minus" || id === "plus") {
      this.tab = (this.tab + (id === "minus" ? TABS.length - 1 : 1)) % TABS.length;
      sfx.tick();
      this.rebuild();
    }
  }

  hovering() {
    return this.spots.hovering;
  }

  draw(ctx: Ctx) {
    backdrop(ctx, W, H, this.t, "#fbeedd");

    // Preview
    panel(ctx, 40, 90, 420, 540, 32);
    const blink = this.t % 3.7 < 0.13;
    drawAvatar(ctx, this.avatar, 250, 300 + Math.sin(this.t * 1.6) * 4, 190, { body: true, blink });

    const nb = this.nameBox;
    rr(ctx, nb.x, nb.y, nb.w, nb.h, 28);
    ctx.fillStyle = this.editingName ? C.cyanSoft : C.bg;
    ctx.fill();
    ctx.strokeStyle = this.editingName || nb.hover > 0.05 ? C.cyan : C.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    const caret = this.editingName && this.t % 1 < 0.5 ? "|" : "";
    text(ctx, this.avatar.name + caret, nb.x + nb.w / 2, nb.y + nb.h / 2 + 1, 26);
    if (!this.editingName && nb.hover > 0.05) text(ctx, "Click and type a name", nb.x + nb.w / 2, nb.y + nb.h + 18, 14, C.soft, "center", 500);

    drawButton(ctx, this.surprise, "Surprise me");

    // Avatar slots
    this.slots.forEach((s, i) => {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      ctx.save();
      softShadow(ctx, 8, 2, 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, 26 + s.hover * 3, 0, Math.PI * 2);
      ctx.fillStyle = C.panel;
      ctx.fill();
      noShadow(ctx);
      ctx.lineWidth = i === save.active ? 3.5 : 1.5;
      ctx.strokeStyle = i === save.active || s.hover > 0.05 ? C.cyan : C.line;
      ctx.stroke();
      if (i < save.avatars.length) {
        ctx.clip();
        drawAvatar(ctx, save.avatars[i], cx, cy + 6, 40);
      } else {
        text(ctx, "+", cx, cy + 1, 30, C.soft);
      }
      ctx.restore();
    });

    // Tabs
    this.tabs.forEach((tab, i) => {
      const on = i === this.tab;
      rr(ctx, tab.x, tab.y, tab.w, tab.h, 22);
      ctx.fillStyle = on ? C.cyan : C.panel;
      ctx.fill();
      ctx.strokeStyle = on ? C.cyan : tab.hover > 0.05 ? C.cyan : C.line;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(ctx, TABS[i].label, tab.x + tab.w / 2, tab.y + tab.h / 2 + 1, 16, on ? "#fff" : C.ink);
    });

    // Options
    const current = this.avatar[this.feature];
    const swatches = SWATCHES[this.feature];
    this.cells.forEach((cell, i) => {
      const on = i === current;
      const grow = cell.hover * 4;
      ctx.save();
      softShadow(ctx, 8 + cell.hover * 8, 3, 0.08);
      rr(ctx, cell.x - grow, cell.y - grow, cell.w + grow * 2, cell.h + grow * 2, 20);
      ctx.fillStyle = on ? C.cyanSoft : C.panel;
      ctx.fill();
      noShadow(ctx);
      ctx.lineWidth = on ? 3 : 1.5;
      ctx.strokeStyle = on || cell.hover > 0.05 ? C.cyan : C.line;
      ctx.stroke();
      ctx.clip();

      const cx = cell.x + cell.w / 2;
      const cy = cell.y + cell.h / 2;
      if (swatches) {
        ctx.beginPath();
        ctx.arc(cx, cy, 32, 0, Math.PI * 2);
        ctx.fillStyle = swatches[i];
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.1)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        drawAvatar(ctx, { ...this.avatar, [this.feature]: i }, cx, cy + 8, 84);
      }
      ctx.restore();
    });

    drawButton(ctx, this.remove, "Delete");
    drawButton(ctx, this.done, "Done", true);
  }
}
