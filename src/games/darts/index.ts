import type { ButtonId } from "../../shared/protocol";
import { clamp, easeOutBack, lerp } from "../../shared/math";
import { sportsSong } from "../../audio/songs";
import { sfx } from "../../audio/sfx";
import { SHIRTS, drawAvatar } from "../../shared/avatar";
import { C, backdrop, panel, text, tileLabel } from "../../tv/draw";
import type { Swing } from "../../tv/input";
import { H, W } from "../../tv/screen";
import { Hotspots, drawButton, hotspot } from "../../tv/ui";
import type { LagoonGame, GameHost, GameSession } from "../types";

type Ctx = CanvasRenderingContext2D;

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
// Ring edges in millimetres from the centre of a regulation board.
const BULL = 6.35;
const OUTER_BULL = 15.9;
const TRIPLE = [99, 107];
const DOUBLE = [162, 170];

const ROUNDS = 5;
const DARTS = 3;
const IDEAL_POWER = 0.55;

interface Hit {
  x: number;
  y: number;
  points: number;
  label: string;
}

function scoreAt(dx: number, dy: number, radius: number): Omit<Hit, "x" | "y"> {
  const mm = (Math.hypot(dx, dy) / radius) * DOUBLE[1];
  if (mm <= BULL) return { points: 50, label: "Bullseye!" };
  if (mm <= OUTER_BULL) return { points: 25, label: "25" };
  if (mm > DOUBLE[1]) return { points: 0, label: "Miss" };
  const a = (Math.atan2(dx, -dy) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);
  const n = ORDER[Math.floor(a / (Math.PI / 10))];
  if (mm >= TRIPLE[0] && mm <= TRIPLE[1]) return { points: n * 3, label: `Triple ${n}` };
  if (mm >= DOUBLE[0]) return { points: n * 2, label: `Double ${n}` };
  return { points: n, label: String(n) };
}

function drawBoard(ctx: Ctx, cx: number, cy: number, r: number) {
  const mm = (v: number) => (v / DOUBLE[1]) * r;
  const wedge = Math.PI / 10;

  ctx.save();
  ctx.fillStyle = "#2f363d";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
  ctx.fill();

  const band = (inner: number, outer: number, colors: [string, string]) => {
    ORDER.forEach((_, i) => {
      const a0 = -Math.PI / 2 - wedge / 2 + i * wedge;
      ctx.beginPath();
      ctx.arc(cx, cy, mm(outer), a0, a0 + wedge);
      ctx.arc(cx, cy, mm(inner), a0 + wedge, a0, true);
      ctx.closePath();
      ctx.fillStyle = colors[i % 2];
      ctx.fill();
    });
  };
  band(OUTER_BULL, DOUBLE[1], ["#2f363d", "#f3ead8"]);
  band(TRIPLE[0], TRIPLE[1], [C.coral, C.green]);
  band(DOUBLE[0], DOUBLE[1], [C.coral, C.green]);

  ctx.fillStyle = C.green;
  ctx.beginPath();
  ctx.arc(cx, cy, mm(OUTER_BULL), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.coral;
  ctx.beginPath();
  ctx.arc(cx, cy, mm(BULL), 0, Math.PI * 2);
  ctx.fill();

  ORDER.forEach((n, i) => {
    const a = -Math.PI / 2 + i * wedge;
    text(ctx, String(n), cx + Math.cos(a) * r * 1.11, cy + Math.sin(a) * r * 1.11 + 1, r * 0.075, "#fff");
  });
  ctx.restore();
}

function drawDart(ctx: Ctx, x: number, y: number, scale: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#9aa3ab";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(3, 7);
  ctx.stroke();
  ctx.strokeStyle = "#5b6670";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(3, 7);
  ctx.lineTo(9, 21);
  ctx.stroke();
  ctx.strokeStyle = "#cfd6dc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(9, 21);
  ctx.lineTo(14, 33);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(13, 30);
  ctx.lineTo(24, 36);
  ctx.lineTo(17, 44);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

type Phase = "title" | "aim" | "flying" | "landed" | "over";

class Darts implements GameSession {
  private phase: Phase = "title";
  private t = 0;
  private phaseT = 0;
  private round = 0;
  private hits: Hit[] = [];
  private total = 0;
  private aim = { x: W / 2, y: H / 2 };
  private flight = { fromX: W / 2, fromY: H + 40, toX: 0, toY: 0 };
  private popup = "";
  private gripping = false;
  private earned = 0;
  private newBest = false;
  private spots = new Hotspots();
  private again = hotspot(W / 2 - 250, 470, 230, 64, () => this.start());
  private leave = hotspot(W / 2 + 20, 470, 230, 64, () => this.host.exit());
  private readonly cx = W / 2 - 120;
  private readonly cy = 375;
  private readonly radius = 235;
  private readonly color: string;

  constructor(private host: GameHost) {
    host.music(sportsSong);
    this.color = SHIRTS[host.avatar.shirt] ?? C.cyan;
  }

  get hideCursor() {
    return this.phase !== "title" && this.phase !== "over";
  }

  hovering() {
    return this.spots.hovering;
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.spots.items = p === "over" ? [this.again, this.leave] : [];
  }

  private start() {
    sfx.select();
    this.round = 0;
    this.hits = [];
    this.total = 0;
    this.host.music(null);
    this.setPhase("aim");
  }

  button(id: ButtonId, down: boolean, p: number) {
    if (p !== 1) return;
    if (id === "b") this.gripping = down;
    if (!down || id !== "a") return;
    if (this.phase === "title") this.start();
    else if (this.phase === "aim") this.throwDart(IDEAL_POWER, 0);
    else if (this.phase === "over") this.spots.press();
  }

  swing(s: Swing) {
    if (s.p === 1 && this.phase === "aim") this.throwDart(s.power, s.dir);
  }

  private throwDart(power: number, dir: number) {
    // Too hard lands high, too soft lands low; a sideways flick pulls it off line.
    const jitter = () => (Math.random() + Math.random() - 1) * 14;
    const toX = this.aim.x + dir * 40 + jitter();
    const toY = this.aim.y - (power - IDEAL_POWER) * 150 + jitter();
    this.flight = { fromX: W / 2 + 260, fromY: H + 60, toX, toY };
    sfx.whoosh(power);
    this.host.rumble(60);
    this.setPhase("flying");
  }

  private land() {
    const { toX, toY } = this.flight;
    const hit = { x: toX, y: toY, ...scoreAt(toX - this.cx, toY - this.cy, this.radius) };
    this.hits.push(hit);
    this.total += hit.points;
    const multiplied = hit.label.startsWith("Triple") || hit.label.startsWith("Double");
    this.popup = multiplied ? `${hit.label}  ${hit.points}` : hit.label;
    if (hit.points) sfx.thud(0.8);
    if (hit.points >= 50 || hit.label.startsWith("Triple")) {
      sfx.fanfare();
      this.host.rumble(250);
    } else {
      this.host.rumble(100);
    }
    this.setPhase("landed");
  }

  update(dt: number) {
    this.t += dt;
    this.phaseT += dt;

    if (this.phase === "aim") {
      const ptr = this.host.pointer(1);
      const steady = this.gripping ? 0.45 : 1;
      const swayX = (Math.sin(this.t * 1.3) * 7 + Math.sin(this.t * 2.9 + 1) * 4) * steady;
      const swayY = (Math.cos(this.t * 1.1) * 6 + Math.sin(this.t * 3.3) * 3) * steady;
      this.aim.x = lerp(this.aim.x, (ptr.visible ? ptr.x : this.cx) + swayX, 0.35);
      this.aim.y = lerp(this.aim.y, (ptr.visible ? ptr.y : this.cy) + swayY, 0.35);
    }

    if (this.phase === "flying" && this.phaseT > 0.32) this.land();

    if (this.phase === "landed" && this.phaseT > 1.1) {
      const thrown = this.hits.length - this.round * DARTS;
      if (thrown < DARTS) return this.setPhase("aim");
      if (this.phaseT < 2.2) return; // let the round total sit for a moment
      this.round++;
      if (this.round >= ROUNDS) return this.finish();
      this.setPhase("aim");
    }

    if (this.phase === "over") this.spots.update(dt, this.host.pointer(1));
  }

  private finish() {
    this.earned = Math.round(this.total / 4);
    this.newBest = this.host.award(this.total, this.earned);
    this.host.music(sportsSong);
    this.setPhase("over");
  }

  draw(ctx: Ctx) {
    backdrop(ctx, W, H, this.t, "#e4eef3");
    drawBoard(ctx, this.cx, this.cy, this.radius);

    const roundHits = this.hits.slice(this.round * DARTS);
    for (const h of roundHits) drawDart(ctx, h.x, h.y, 1, this.color);

    if (this.phase === "flying") {
      const k = clamp(this.phaseT / 0.32, 0, 1);
      const x = lerp(this.flight.fromX, this.flight.toX, k);
      const y = lerp(this.flight.fromY, this.flight.toY, k) - Math.sin(k * Math.PI) * 120;
      drawDart(ctx, x, y, lerp(3, 1, k), this.color);
    }

    if (this.phase === "aim") {
      ctx.strokeStyle = this.gripping ? C.coral : "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.aim.x, this.aim.y, 14, 0, Math.PI * 2);
      ctx.moveTo(this.aim.x - 22, this.aim.y);
      ctx.lineTo(this.aim.x - 8, this.aim.y);
      ctx.moveTo(this.aim.x + 8, this.aim.y);
      ctx.lineTo(this.aim.x + 22, this.aim.y);
      ctx.stroke();
    }

    if (this.phase === "landed") {
      const k = easeOutBack(clamp(this.phaseT / 0.3, 0, 1));
      const last = this.hits[this.hits.length - 1];
      ctx.save();
      ctx.translate(last.x, last.y - 50);
      ctx.scale(k, k);
      ctx.font = '800 34px "M PLUS Rounded 1c", system-ui';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#fff";
      ctx.lineJoin = "round";
      ctx.strokeText(this.popup, 0, 0);
      ctx.fillStyle = last.points ? C.ink : C.soft;
      ctx.fillText(this.popup, 0, 0);
      ctx.restore();
    }

    this.drawSidebar(ctx);

    if (this.phase === "title") this.drawTitle(ctx);
    if (this.phase === "over") this.drawResults(ctx);
  }

  private drawSidebar(ctx: Ctx) {
    const x = W - 380;
    panel(ctx, x, 60, 340, 420, 28);
    text(ctx, `Round ${Math.min(this.round + 1, ROUNDS)} of ${ROUNDS}`, x + 170, 105, 24);
    const roundHits = this.hits.slice(this.round * DARTS, this.round * DARTS + DARTS);
    for (let i = 0; i < DARTS; i++) {
      const h = roundHits[i];
      const y = 165 + i * 56;
      drawDart(ctx, x + 50, y - 18, 0.8, h ? C.line : this.color);
      text(ctx, h ? h.label.replace("!", "") : "–", x + 100, y, 22, h ? C.ink : C.soft, "left", h ? 800 : 500);
      if (h) text(ctx, String(h.points), x + 300, y, 22, C.ink, "right");
    }
    text(ctx, "Total", x + 40, 380, 20, C.soft, "left", 500);
    text(ctx, String(this.total), x + 300, 380, 44, C.ink, "right");
    const best = this.host.best();
    if (best !== undefined) text(ctx, `Best ${best}`, x + 40, 440, 16, C.soft, "left", 500);

    if (this.phase === "aim") {
      const mouse = this.host.players().length === 0;
      panel(ctx, x, 510, 340, 150, 28);
      const lines = mouse
        ? ["Aim with the mouse.", "Hold right-click to steady,", "then flick up to throw.", "A throws at a steady pace."]
        : ["Point to aim.", "Hold B to steady your hand,", "then flick your phone forward.", "Too hard goes high."];
      lines.forEach((l, i) => text(ctx, l, x + 24, 545 + i * 28, 17, i ? C.soft : C.ink, "left", 500));
    }
  }

  private drawTitle(ctx: Ctx) {
    ctx.fillStyle = "rgba(243, 245, 247, 0.85)";
    ctx.fillRect(0, 0, W, H);
    panel(ctx, W / 2 - 360, 140, 720, 450, 36);
    text(ctx, "Lagoon Sports", W / 2, 200, 22, C.cyan);
    text(ctx, "Darts", W / 2, 253, 56);
    drawAvatar(ctx, this.host.avatar, W / 2, 350 + Math.sin(this.t * 2) * 3, 100, { body: true, blink: this.t % 3.5 < 0.12 });
    text(ctx, `${ROUNDS} rounds, ${DARTS} darts each. Highest total wins.`, W / 2, 505, 18, C.soft, "center", 500);
    ctx.globalAlpha = 0.6 + Math.sin(this.t * 3) * 0.4;
    text(ctx, "Press A to start", W / 2, 548, 24, C.cyan);
    ctx.globalAlpha = 1;
  }

  private drawResults(ctx: Ctx) {
    ctx.fillStyle = "rgba(61, 71, 82, 0.35)";
    ctx.fillRect(0, 0, W, H);
    panel(ctx, W / 2 - 320, 170, 640, 400, 32);
    text(ctx, "Final score", W / 2, 230, 22, C.soft, "center", 500);
    text(ctx, String(this.total), W / 2, 305, 86);
    if (this.newBest) text(ctx, "New personal best!", W / 2, 375, 22, C.cyan);
    text(ctx, `You earned ${this.earned} points`, W / 2, 415, 20, C.soft, "center", 500);
    drawButton(ctx, this.again, "Play again");
    drawButton(ctx, this.leave, "Home Menu", true);
  }
}

function icon(ctx: Ctx, w: number, h: number, t: number) {
  ctx.fillStyle = "#e4eef3";
  ctx.fillRect(0, 0, w, h);
  drawBoard(ctx, w * 0.62, h * 0.52, 46);
  const k = (t * 0.6) % 1;
  if (k < 0.6) drawDart(ctx, lerp(w + 20, w * 0.62 + 4, k / 0.6), lerp(h + 30, h * 0.5, k / 0.6), 1, C.cyan);
  else drawDart(ctx, w * 0.62 + 4, h * 0.5, 1, C.cyan);
  tileLabel(ctx, "Darts");
}

export const darts: LagoonGame = {
  id: "darts",
  title: "Lagoon Darts",
  blurb: "Five rounds of three darts. Steady hand, gentle flick.",
  price: 300,
  icon,
  create: (host) => new Darts(host),
};
