import type { ButtonId } from "../../shared/protocol";
import { approach, clamp, easeOutBack } from "../../shared/math";
import { sportsSong } from "../../audio/songs";
import { rollingSound, sfx } from "../../audio/sfx";
import { SHIRTS, drawAvatar } from "../../shared/avatar";
import { C, panel, rr, text } from "../../tv/draw";
import type { Swing } from "../../tv/input";
import { H, W } from "../../tv/screen";
import { Hotspots, isDirection, drawButton, hotspot } from "../../tv/ui";
import type { GameHost, GameSession } from "../types";
import { frameMarks, frameTotals } from "./score";
import {
  BALL_R,
  DECK_END,
  LANE_HALF,
  LANE_LEN,
  PIN_H,
  PIN_R,
  newBall,
  newPins,
  pinSpots,
  settled,
  step,
  type Ball,
  type Pin,
} from "./sim";

type Ctx = CanvasRenderingContext2D;
type Phase = "title" | "aim" | "rolling" | "result" | "over";

const FOCAL = 900;
const CAM_Y = 1.1;
const HORIZON = 230;
const CAM_START = -2.6;
const MAX_ANGLE = 0.07;

export class Bowling implements GameSession {
  private phase: Phase = "title";
  private t = 0;
  private phaseT = 0;
  private pins: Pin[] = newPins();
  private ball: Ball | null = null;
  private rolls: number[] = [];
  private frame = 0;
  private roll = 0;
  private standingBefore = 10;
  private aimX = 0;
  private angle = 0;
  private gripping = false;
  private camZ = CAM_START;
  private message = "";
  private messageColor = C.ink;
  private afterResult: "next" | "reset" | "over" = "next";
  private rolling: ReturnType<typeof rollingSound> | null = null;
  private lastKnockSound = 0;
  private bestBefore: number | undefined;
  private newBest = false;
  private earned = 0;

  private spots = new Hotspots();
  private again = hotspot(W / 2 - 250, 470, 230, 64, () => this.restart());
  private leave = hotspot(W / 2 + 20, 470, 230, 64, () => this.host.exit());

  constructor(private host: GameHost) {
    host.music(sportsSong);
    this.bestBefore = host.best();
  }

  get hideCursor() {
    return this.phase !== "title" && this.phase !== "over";
  }

  private get mouseOnly() {
    return this.host.players().length === 0;
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.spots.items = p === "over" ? [this.again, this.leave] : [];
  }

  private restart() {
    sfx.select();
    this.pins = newPins();
    this.rolls = [];
    this.frame = 0;
    this.roll = 0;
    this.standingBefore = 10;
    this.bestBefore = this.host.best();
    this.host.music(null);
    this.setPhase("aim");
  }

  destroy() {
    this.rolling?.stop();
  }

  hovering() {
    return this.spots.hovering;
  }

  button(id: ButtonId, down: boolean, p: number) {
    if (p !== 1) return;
    switch (this.phase) {
      case "title":
        if (down && id === "a") this.restart();
        break;
      case "aim":
        if (id === "b") this.gripping = down;
        // The easy roll gets a little wobble so it isn't a guaranteed strike.
        if (down && id === "a") this.throwBall(0.5 + Math.random() * 0.1, (Math.random() - 0.5) * 0.5);
        if (down && (id === "left" || id === "right")) {
          this.angle = clamp(this.angle + (id === "left" ? -0.01 : 0.01), -MAX_ANGLE, MAX_ANGLE);
          sfx.tick();
        }
        break;
      case "over":
        if (down && id === "a") this.spots.press();
        else if (down && isDirection(id)) this.spots.move(id);
        break;
    }
  }

  swing(s: Swing) {
    if (s.p !== 1 || this.phase !== "aim") return;
    if (!this.gripping && !this.mouseOnly) {
      this.message = "Hold B while you swing";
      this.messageColor = C.soft;
      this.phaseT = 0;
      return;
    }
    this.throwBall(s.power, s.dir);
  }

  private throwBall(power: number, dir: number) {
    this.ball = newBall(this.aimX, this.angle, 6 + power * 4.2, dir * 1.4);
    this.standingBefore = this.pins.filter((p) => !p.down).length;
    this.gripping = false;
    this.message = "";
    sfx.whoosh(power);
    this.host.rumble(90);
    this.rolling = rollingSound();
    this.setPhase("rolling");
  }

  update(dt: number) {
    this.t += dt;
    this.phaseT += dt;

    if (this.phase === "aim") {
      const ptr = this.host.pointer(1);
      if (ptr.visible) this.aimX = approach(this.aimX, clamp(((ptr.x - W / 2) / 560) * 0.42, -0.42, 0.42), 0.2, dt);
    }

    if (this.phase === "rolling" || this.phase === "result") {
      const sub = Math.ceil(dt / (1 / 240));
      let knocked = 0;
      for (let i = 0; i < sub; i++) knocked += step(this.ball, this.pins, dt / sub);
      if (knocked && this.t - this.lastKnockSound > 0.08) {
        sfx.pins(knocked, Math.min(1, (this.ball ? Math.hypot(this.ball.vx, this.ball.vz) : 4) / 8));
        this.host.rumble(knocked > 3 ? 220 : 80);
        this.lastKnockSound = this.t;
      }
      if (this.ball) {
        const speed = this.ball.z < DECK_END ? Math.hypot(this.ball.vx, this.ball.vz) : 0;
        this.rolling?.set(speed / 10);
      }
    }

    if (this.phase === "rolling") {
      const past = this.ball && this.ball.z > LANE_LEN - 0.5;
      if ((past && settled(this.ball, this.pins)) || this.phaseT > 6.5) this.finishRoll();
    }

    if (this.phase === "result" && this.phaseT > 1.9) this.nextRoll();

    const target = this.ball ? clamp(this.ball.z - 3.4, CAM_START, LANE_LEN - 5.2) : CAM_START;
    this.camZ = approach(this.camZ, target, this.phase === "rolling" ? 0.12 : 0.06, dt);

    if (this.phase === "over") this.spots.update(dt, this.host.pointer(1));
  }

  private finishRoll() {
    this.rolling?.stop();
    this.rolling = null;
    const standing = this.pins.filter((p) => !p.down).length;
    const knocked = this.standingBefore - standing;
    this.rolls.push(knocked);

    const tenth = this.frame === 9;
    const allDown = standing === 0;
    const strike = allDown && this.standingBefore === 10;

    if (strike) this.say("Strike!", C.cyan, true);
    else if (allDown) this.say("Spare!", C.green, true);
    else if (knocked === 0) this.say(this.ball?.gutter ? "Gutter ball" : "No pins", C.soft, false);
    else this.say(knocked === 1 ? "1 pin" : `${knocked} pins`, C.ink, false);

    if (!tenth) {
      if (allDown || this.roll === 1) this.afterResult = "reset";
      else this.afterResult = "next";
    } else {
      const firstTwo = (this.rolls.at(-2) ?? 0) + knocked;
      const earnedBonus = this.roll === 1 && (this.rolls.at(-2) === 10 || firstTwo === 10);
      if (this.roll === 2 || (this.roll === 1 && !earnedBonus)) this.afterResult = "over";
      else this.afterResult = allDown ? "reset" : "next";
    }
    this.setPhase("result");
  }

  private say(text: string, color: string, big: boolean) {
    this.message = text;
    this.messageColor = color;
    if (big) {
      sfx.fanfare();
      sfx.cheer();
      this.host.rumble(300);
    }
  }

  private nextRoll() {
    this.ball = null;
    this.message = "";

    if (this.afterResult === "over") return this.endGame();

    const tenth = this.frame === 9;
    if (this.afterResult === "reset") {
      this.pins = newPins();
      if (tenth) this.roll++;
      else {
        this.frame++;
        this.roll = 0;
      }
    } else {
      // clear the fallen pins and go again
      this.pins = this.pins.filter((p) => !p.down);
      this.roll++;
    }
    this.angle = 0;
    this.setPhase("aim");
  }

  private endGame() {
    const score = frameTotals(this.rolls)[9] ?? 0;
    this.earned = Math.round(score / 2);
    this.newBest = this.host.award(score, this.earned);
    if (this.newBest) sfx.fanfare();
    this.host.music(sportsSong);
    this.setPhase("over");
  }

  // Drawing

  private project(x: number, y: number, z: number) {
    const s = FOCAL / Math.max(0.05, z - this.camZ);
    return { x: W / 2 + x * s, y: HORIZON + (CAM_Y - y) * s, s };
  }

  draw(ctx: Ctx) {
    this.drawLane(ctx);

    const things: { z: number; draw: () => void }[] = this.pins
      .filter((p) => !p.gone)
      .map((p) => ({ z: p.z, draw: () => this.drawPin(ctx, p) }));
    const ball = this.ball ?? (this.phase === "aim" ? newBall(this.aimX, this.angle, 0, 0) : null);
    if (ball && ball.z < DECK_END + 0.3) things.push({ z: ball.z, draw: () => this.drawBall(ctx, ball) });
    things.sort((a, b) => b.z - a.z).forEach((t) => t.draw());

    if (this.phase === "aim") this.drawAimArrow(ctx);

    this.drawScoreboard(ctx);
    this.drawPinMap(ctx);
    if (this.phase === "aim" || this.phase === "rolling" || this.phase === "result") this.drawFrameLabel(ctx);

    if (this.phase === "aim") this.drawHelp(ctx);
    if (this.message) this.drawMessage(ctx);
    if (this.phase === "title") this.drawTitle(ctx);
    if (this.phase === "over") this.drawResults(ctx);
  }

  private drawLane(ctx: Ctx) {
    const wall = ctx.createLinearGradient(0, 0, 0, HORIZON);
    wall.addColorStop(0, "#d9e2e8");
    wall.addColorStop(1, "#c3ced6");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, HORIZON + 1);
    ctx.fillStyle = "#b2bec7";
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    const near = this.camZ + 0.4;
    const quad = (x0: number, x1: number, z0: number, z1: number, color: string) => {
      const a = this.project(x0, 0, z0);
      const b = this.project(x1, 0, z0);
      const c = this.project(x1, 0, z1);
      const d = this.project(x0, 0, z1);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.fill();
    };

    // Pit curtain and the panel above the pins
    const pit = this.project(0, 0, DECK_END);
    const top = this.project(0, 1.3, DECK_END);
    const half = (LANE_HALF + 0.3) * pit.s;
    ctx.fillStyle = "#2f363d";
    ctx.fillRect(pit.x - half, top.y, half * 2, pit.y - top.y);
    const panelTop = this.project(0, 1.3, DECK_END).y;
    const panelBottom = this.project(0, 0.62, DECK_END).y;
    ctx.fillStyle = C.cyan;
    ctx.fillRect(pit.x - half, panelTop, half * 2, panelBottom - panelTop);
    text(ctx, "LAGOON LANES", pit.x, (panelTop + panelBottom) / 2, Math.max(6, (panelBottom - panelTop) * 0.36), "#fff");

    quad(-LANE_HALF - 0.32, LANE_HALF + 0.32, near, DECK_END, "#c8d1d8");
    quad(-LANE_HALF - 0.12, -LANE_HALF, near, DECK_END, "#8f9ba5");
    quad(LANE_HALF, LANE_HALF + 0.12, near, DECK_END, "#8f9ba5");
    quad(-LANE_HALF, LANE_HALF, near, LANE_LEN - 0.4, "#e8c896");
    quad(-LANE_HALF, LANE_HALF, LANE_LEN - 0.4, DECK_END, "#f0d6aa");

    // boards
    ctx.strokeStyle = "rgba(120, 80, 30, 0.12)";
    ctx.lineWidth = 1;
    for (let b = 1; b < 39; b++) {
      const x = -LANE_HALF + (b * 2 * LANE_HALF) / 39;
      const a = this.project(x, 0, Math.max(near, 0));
      const c = this.project(x, 0, LANE_LEN - 0.4);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }

    // foul line, dots and target arrows
    if (near < 0) {
      const l = this.project(-LANE_HALF, 0, 0);
      const r = this.project(LANE_HALF, 0, 0);
      ctx.strokeStyle = "#3d4752";
      ctx.lineWidth = Math.max(1, 0.02 * l.s);
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
    }
    ctx.fillStyle = "#7a5a33";
    for (let i = -3; i <= 3; i++) {
      const x = (i * 5 * 2 * LANE_HALF) / 39;
      const z = 4.6 + Math.abs(i) * 0.3;
      if (z < near) continue;
      const tip = this.project(x, 0, z + 0.16);
      const l = this.project(x - 0.025, 0, z);
      const r = this.project(x + 0.025, 0, z);
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(l.x, l.y);
      ctx.lineTo(r.x, r.y);
      ctx.fill();
    }
  }

  private drawPin(ctx: Ctx, pin: Pin) {
    const p = this.project(pin.x, 0, pin.z);
    const h = PIN_H * p.s;
    const w = PIN_R * 2 * p.s;

    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.fillStyle = "rgba(60, 40, 20, 0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.6, w * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    if (pin.tilt > 0) {
      ctx.rotate(Math.sin(pin.fallAngle) * pin.tilt * 1.45);
      ctx.scale(1, 1 - pin.tilt * 0.6 * Math.abs(Math.cos(pin.fallAngle)));
    }

    ctx.beginPath();
    ctx.moveTo(-w * 0.3, 0);
    ctx.bezierCurveTo(-w * 0.62, -h * 0.16, -w * 0.56, -h * 0.44, -w * 0.22, -h * 0.62);
    ctx.bezierCurveTo(-w * 0.14, -h * 0.7, -w * 0.32, -h * 0.82, -w * 0.27, -h * 0.9);
    ctx.bezierCurveTo(-w * 0.22, -h * 1.02, w * 0.22, -h * 1.02, w * 0.27, -h * 0.9);
    ctx.bezierCurveTo(w * 0.32, -h * 0.82, w * 0.14, -h * 0.7, w * 0.22, -h * 0.62);
    ctx.bezierCurveTo(w * 0.56, -h * 0.44, w * 0.62, -h * 0.16, w * 0.3, 0);
    ctx.closePath();
    const shade = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    shade.addColorStop(0, "#ffffff");
    shade.addColorStop(1, "#dde3e8");
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = Math.max(0.5, w * 0.03);
    ctx.stroke();

    ctx.fillStyle = C.coral;
    ctx.fillRect(-w * 0.2, -h * 0.69, w * 0.4, h * 0.025);
    ctx.fillRect(-w * 0.21, -h * 0.735, w * 0.42, h * 0.025);
    ctx.restore();
  }

  private drawBall(ctx: Ctx, ball: Ball) {
    const p = this.project(ball.x, 0, ball.z);
    const r = BALL_R * p.s;
    const cy = p.y - r;
    const color = SHIRTS[this.host.avatar.shirt] ?? C.cyan;

    ctx.fillStyle = "rgba(40, 30, 20, 0.22)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 0.9, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createRadialGradient(p.x - r * 0.35, cy - r * 0.4, r * 0.1, p.x, cy, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, color);
    g.addColorStop(1, shadeColor(color));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // finger holes roll over the top
    const turn = ball.rolled / BALL_R;
    const face = Math.cos(turn);
    if (face > 0) {
      ctx.fillStyle = "rgba(20, 25, 30, 0.7)";
      const hy = cy - Math.sin(turn) * r * 0.55 - r * 0.15;
      for (const [dx, dy] of [
        [-0.2, 0],
        [0.2, 0],
        [0, 0.3],
      ]) {
        ctx.beginPath();
        ctx.ellipse(p.x + dx * r, hy + dy * r * face, r * 0.09, r * 0.09 * face, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawAimArrow(ctx: Ctx) {
    const bob = (Math.sin(this.t * 4) + 1) * 0.15;
    const from = 1.2 + bob;
    const len = 1.6;
    const a = this.project(this.aimX + Math.sin(this.angle) * from, 0, Math.cos(this.angle) * from);
    const b = this.project(this.aimX + Math.sin(this.angle) * (from + len), 0, Math.cos(this.angle) * (from + len));
    ctx.save();
    ctx.strokeStyle = this.gripping ? C.coral : "rgba(255,255,255,0.9)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(ang - 0.5) * 18, b.y - Math.sin(ang - 0.5) * 18);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(ang + 0.5) * 18, b.y - Math.sin(ang + 0.5) * 18);
    ctx.stroke();
    ctx.restore();
  }

  private drawScoreboard(ctx: Ctx) {
    const marks = frameMarks(this.rolls);
    const totals = frameTotals(this.rolls);
    const x0 = 40;
    const y0 = 16;
    panel(ctx, x0, y0, W - 80, 92, 20);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x0 + 46, y0 + 46, 30, 0, Math.PI * 2);
    ctx.fillStyle = C.cyanSoft;
    ctx.fill();
    ctx.clip();
    drawAvatar(ctx, this.host.avatar, x0 + 46, y0 + 52, 52);
    ctx.restore();

    let x = x0 + 92;
    for (let f = 0; f < 10; f++) {
      const w = f === 9 ? 126 : 92;
      const current = f === this.frame && this.phase !== "over" && this.phase !== "title";
      rr(ctx, x, y0 + 10, w - 6, 72, 10);
      ctx.fillStyle = current ? C.cyanSoft : C.bg;
      ctx.fill();
      text(ctx, String(f + 1), x + 12, y0 + 22, 12, C.soft, "center", 500);
      const boxes = f === 9 ? 3 : 2;
      for (let b = 0; b < boxes; b++) {
        const bx = x + w - 6 - (boxes - b) * 28;
        rr(ctx, bx, y0 + 12, 26, 26, 6);
        ctx.fillStyle = C.panel;
        ctx.fill();
        const m = marks[f]?.[b];
        if (m) text(ctx, m, bx + 13, y0 + 26, 16, m === "X" || m === "/" ? C.cyan : C.ink);
      }
      const total = totals[f];
      if (total !== null) text(ctx, String(total), x + (w - 6) / 2, y0 + 62, 22);
      x += w;
    }
    const final = totals.filter((t) => t !== null).at(-1) ?? 0;
    text(ctx, "Total", x + 52, y0 + 30, 13, C.soft, "center", 500);
    text(ctx, String(final), x + 52, y0 + 60, 28, C.ink);
  }

  private drawPinMap(ctx: Ctx) {
    const cx = W - 110;
    const cy = H - 120;
    panel(ctx, cx - 80, cy - 70, 160, 130, 20);
    const spots = pinSpots();
    spots.forEach((s, i) => {
      const standing = this.pins.some((p) => p.spot === i && !p.down);
      const x = cx + s.x * 120;
      const y = cy + 40 - (s.z - LANE_LEN) * 120;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = standing ? C.ink : C.panel;
      ctx.fill();
      ctx.strokeStyle = standing ? C.ink : C.line;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  private drawHelp(ctx: Ctx) {
    const lines = this.mouseOnly
      ? ["Move the mouse to line up.", "Hold right-click and flick up to bowl, or press A for an easy roll."]
      : ["Point to line up. Left and Right turn.", "Hold B and swing your phone to bowl."];
    panel(ctx, 40, H - 110, 640, 80, 20);
    text(ctx, lines[0], 64, H - 84, 18, C.ink, "left", 500);
    text(ctx, lines[1], 64, H - 56, 18, C.soft, "left", 500);
  }

  /** Which frame and ball this is, just under the scoreboard. */
  private drawFrameLabel(ctx: Ctx) {
    const label = `Frame ${this.frame + 1}  ·  Ball ${this.roll + 1}`;
    panel(ctx, 40, 122, 220, 44, 22);
    text(ctx, label, 150, 145, 18, C.ink);
  }

  private drawMessage(ctx: Ctx) {
    const k = easeOutBack(clamp(this.phaseT / 0.35, 0, 1));
    ctx.save();
    ctx.translate(W / 2, 330);
    ctx.scale(k, k);
    ctx.lineWidth = 10;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#fff";
    const size = this.message.endsWith("!") ? 84 : 52;
    ctx.font = `800 ${size}px "M PLUS Rounded 1c", system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(this.message, 0, 0);
    ctx.fillStyle = this.messageColor;
    ctx.fillText(this.message, 0, 0);
    ctx.restore();
  }

  private drawTitle(ctx: Ctx) {
    ctx.fillStyle = "rgba(243, 245, 247, 0.85)";
    ctx.fillRect(0, 0, W, H);
    panel(ctx, W / 2 - 360, 150, 720, 420, 36);
    text(ctx, "Lagoon Sports", W / 2, 215, 22, C.cyan);
    text(ctx, "Bowling", W / 2, 268, 56);
    drawAvatar(ctx, this.host.avatar, W / 2, 370 + Math.sin(this.t * 2) * 3, 100, { body: true, blink: this.t % 3.5 < 0.12 });
    if (this.bestBefore !== undefined) text(ctx, `Best: ${this.bestBefore}`, W / 2 - 250, 520, 18, C.soft, "left", 500);
    ctx.globalAlpha = 0.6 + Math.sin(this.t * 3) * 0.4;
    text(ctx, "Press A to start", W / 2, 520, 24, C.cyan);
    ctx.globalAlpha = 1;
  }

  private drawResults(ctx: Ctx) {
    ctx.fillStyle = "rgba(61, 71, 82, 0.35)";
    ctx.fillRect(0, 0, W, H);
    panel(ctx, W / 2 - 320, 170, 640, 400, 32);
    const score = frameTotals(this.rolls)[9] ?? 0;
    text(ctx, "Final score", W / 2, 230, 22, C.soft, "center", 500);
    text(ctx, String(score), W / 2, 305, 86);
    if (this.newBest) text(ctx, "New personal best!", W / 2, 375, 22, C.cyan);
    text(ctx, `You earned ${this.earned} points`, W / 2, 415, 20, C.soft, "center", 500);
    drawButton(ctx, this.again, "Play again");
    drawButton(ctx, this.leave, "Home Menu", true);
  }
}

/** Darker version of a hex colour, for the shadow side of the ball. */
function shadeColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(c * 0.55);
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
