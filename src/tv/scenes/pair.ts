import QRCode from "qrcode";
import type { ButtonId } from "../../shared/protocol";
import { homeSong } from "../../audio/songs";
import { sfx } from "../../audio/sfx";
import { go, playerColor, type Scene } from "../app";
import { C, backdrop, panel, rr, text } from "../draw";
import { pointer } from "../input";
import { netStatus, newRoom, players, remoteUrl, room } from "../net";
import { avatarFor } from "../players";
import { drawAvatar } from "../../shared/avatar";
import { H, W } from "../screen";
import { Hotspots, isDirection, drawButton, hotspot } from "../ui";
import { Menu } from "./menu";

/** Shows the QR code and room code for connecting phones. */
export class Pair implements Scene {
  music = homeSong;
  private spots = new Hotspots();
  private done = hotspot(W - 330, H - 120, 260, 64, () => this.leave());
  private reroll = hotspot(600, 512, 248, 40, () => {
    if (newRoom()) sfx.select();
  });
  private qr: HTMLImageElement | null = null;
  private url = "";
  /** The room code the QR was made for; it's remade if the code changes. */
  private qrRoom = "";
  private t = 0;
  private connectedAt = 0;

  /** `fromBoot` moves on by itself once a phone connects. */
  constructor(private fromBoot = false) {
    this.spots.items = [this.done, this.reroll];
  }

  enter() {
    this.makeQr();
  }

  private makeQr() {
    this.qrRoom = room;
    remoteUrl().then(async (url) => {
      this.url = url;
      const data = await QRCode.toDataURL(url, {
        margin: 1,
        width: 560,
        color: { dark: C.ink, light: "#ffffff" },
      });
      const img = new Image();
      img.src = data;
      this.qr = img;
    });
  }

  private leave() {
    sfx.select();
    go(new Menu());
  }

  update(dt: number) {
    this.t += dt;
    this.reroll.disabled = players.size > 0;
    this.spots.update(dt, pointer(1));
    if (room !== this.qrRoom) this.makeQr();
    if (this.fromBoot && players.size > 0) {
      this.connectedAt ||= this.t;
      if (this.t - this.connectedAt > 1.4) this.leave();
    }
  }

  button(id: ButtonId, down: boolean) {
    if (!down) return;
    if (id === "a") this.spots.press();
    else if (id === "b") this.leave();
    else if (isDirection(id)) this.spots.move(id);
  }

  hovering() {
    return this.spots.hovering;
  }

  draw(ctx: CanvasRenderingContext2D) {
    backdrop(ctx, W, H, this.t);

    panel(ctx, 110, 120, 420, 420, 32);
    if (this.qr?.complete) ctx.drawImage(this.qr, 140, 150, 360, 360);
    else text(ctx, "Making a code…", 320, 330, 20, C.soft, "center", 500);

    text(ctx, "Connect a remote", 600, 160, 40, C.ink, "left");

    // Running locally, the phone loads the page from this computer, so it has
    // to be on the same network. A hosted copy works from anywhere.
    const local = location.hostname === "localhost" || /^[\d.]+$/.test(location.hostname);
    const steps = local
      ? ["Join the same Wi-Fi as this computer.", "Scan the code with your phone camera.", "Tap Connect and make your player."]
      : ["Scan the code with your phone camera.", "Tap Connect and make your player.", "Point at the screen to move your cursor."];
    steps.forEach((s, i) => {
      const y = 235 + i * 56;
      ctx.fillStyle = C.cyanSoft;
      ctx.beginPath();
      ctx.arc(618, y, 18, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, String(i + 1), 618, y + 1, 18, C.cyan);
      text(ctx, s, 650, y + 1, 21, C.ink, "left", 500);
    });

    text(ctx, "Room code", 600, 405, 18, C.soft, "left", 500);
    [...room].forEach((ch, i) => {
      rr(ctx, 600 + i * 62, 430, 52, 64, 14);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(ctx, ch, 626 + i * 62, 464, 34);
    });

    for (let p = 1; p <= 4; p++) {
      const x = 890 + (p - 1) * 88;
      const on = players.has(p);
      rr(ctx, x, 420, 78, 104, 18);
      ctx.fillStyle = on ? C.panel : C.faint;
      ctx.fill();
      ctx.lineWidth = on ? 3 : 1.5;
      ctx.strokeStyle = on ? playerColor(p) : "rgba(0,0,0,0.04)";
      ctx.stroke();
      if (on) {
        const me = avatarFor(p);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + 39, 458, 26, 0, Math.PI * 2);
        ctx.fillStyle = C.cyanSoft;
        ctx.fill();
        ctx.clip();
        drawAvatar(ctx, me, x + 39, 465, 42);
        ctx.restore();
        text(ctx, me.name.length > 8 ? `${me.name.slice(0, 7)}…` : me.name, x + 39, 505, 14, C.ink);
      } else {
        text(ctx, `P${p}`, x + 39, 472, 18, C.soft);
      }
    }

    if (this.url) text(ctx, this.url, 320, 575, 15, C.soft, "center", 500);
    if (netStatus !== "ready") {
      const note = netStatus === "offline" ? "Can't reach the internet. Remotes need it to find this TV." : "Getting ready for remotes…";
      text(ctx, note, 600, 580, 17, netStatus === "offline" ? C.coral : C.soft, "left", 800);
    }
    if (location.protocol === "http:") {
      // Phones won't share motion data with an http:// page.
      text(ctx, "Pointing and swinging only work over HTTPS. Start with npm run dev.", 320, 605, 15, C.coral, "center", 800);
    }

    drawButton(ctx, this.reroll, "New code");
    drawButton(ctx, this.done, players.size ? "Done" : "Use the mouse", players.size > 0);
  }
}
