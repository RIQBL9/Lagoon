import "./remote.css";
import Peer, { type DataConnection } from "peerjs";
import { hasTurn, iceServers } from "../shared/ice";
import { tvPeerId, type ButtonId, type ToPhone, type ToTv } from "../shared/protocol";
import { clamp } from "../shared/math";
import type { Avatar } from "../shared/avatar";
import { screenAngle, screenRight, tilt } from "./motion";
import { closeSetup, openSetup, savedProfile } from "./setup";

// How many degrees of turning sweep the pointer across the whole screen.
const YAW_RANGE = 50;
const PITCH_RANGE = 34;
const SWING_START = 13; // m/s², ignores normal hand movement
const SWING_FULL = 29; // a hard swing; a gentle flick lands near the middle
const SWING_WINDOW = 160;

const gate = document.getElementById("gate")!;
const roomInput = document.getElementById("room") as HTMLInputElement;
const status = document.getElementById("status")!;
const hint = document.getElementById("hint")!;
const leds = [...document.querySelectorAll<HTMLElement>(".leds i")];
const meBtn = document.getElementById("me")!;

roomInput.value = (new URLSearchParams(location.search).get("room") ?? "").toUpperCase();

let peer: Peer | null = null;
let link: DataConnection | null = null;
let player = 0;
let profile = savedProfile();
/** Set once the player has pressed Ready, so reconnects skip the setup screen. */
let setUp = false;

function send(msg: ToTv) {
  if (player && link?.open) void link.send(msg);
}

function setPlayer(p: number) {
  player = p;
  leds.forEach((led, i) => led.classList.toggle("on", i + 1 === p));
  gate.classList.toggle("hidden", p > 0);
  if (!p) closeSetup();
}

function useProfile(a: Avatar) {
  profile = a;
  setUp = true;
  // The player was looking down at the setup screen until now, so take the
  // sideways middle from the next reading instead of that one.
  centre = null;
  meBtn.textContent = a.name;
  send({ t: "profile", avatar: a });
}

meBtn.addEventListener("click", () => openSetup(profile, useProfile));
if (profile) meBtn.textContent = profile.name;

const LINK_TIMEOUT = 15000;

const cantLink = () =>
  hasTurn()
    ? "Couldn't link up with the TV. Check both have internet, then tap Connect again."
    : "Couldn't link up with the TV on this network. Put your phone on the same Wi-Fi as the TV (not mobile data), then tap Connect again.";

function makePeer() {
  const p = new Peer({ debug: 0, config: { iceServers: iceServers() } });
  p.on("error", (err) => {
    if (err.type === "peer-unavailable") {
      clearTimeout(linkTimer);
      status.textContent = "No TV found with that code. The TV makes a new code each time it opens, so check the screen and try again.";
    } else if (["network", "server-error", "socket-error", "browser-incompatible"].includes(err.type)) {
      status.textContent = "Couldn't reach the internet. The remote needs it to find the TV.";
    }
  });
  return p;
}

let linkTimer = 0;

function connect(room: string) {
  link?.close();
  clearTimeout(linkTimer);
  status.textContent = "Reaching the matchmaking server…";
  if (!peer || peer.destroyed) peer = makePeer();
  const p = peer;

  const dial = () => {
    clearTimeout(linkTimer);
    status.textContent = "Linking up with the TV…";
    const conn = p.connect(tvPeerId(room), { reliable: true, serialization: "json" });
    link = conn;

    const giveUp = () => {
      if (link !== conn || player) return;
      status.textContent = cantLink();
      link = null;
      conn.close();
    };
    linkTimer = window.setTimeout(giveUp, LINK_TIMEOUT);
    conn.on("iceStateChanged", (state) => {
      if (state === "failed") giveUp();
    });

    conn.on("data", (data) => onMessage(data as ToPhone));
    conn.on("close", () => {
      if (link !== conn) return;
      const wasPlaying = player > 0;
      setPlayer(0);
      if (wasPlaying) {
        status.textContent = "Lost the TV. Reconnecting…";
        setTimeout(() => link === conn && connect(room), 1500);
      }
    });
  };

  if (p.open) dial();
  else {
    p.once("open", dial);
    if (p.disconnected) p.reconnect();
    linkTimer = window.setTimeout(() => {
      if (!p.open) status.textContent = "Can't reach the matchmaking server. Check your phone's internet, then tap Connect again.";
    }, 10000);
  }
}

function onMessage(msg: ToPhone) {
  switch (msg.t) {
    case "welcome":
      clearTimeout(linkTimer);
      setPlayer(msg.p);
      status.textContent = "";
      navigator.vibrate?.([30, 60, 30]);
      if (setUp && profile) useProfile(profile);
      else openSetup(profile, useProfile);
      break;
    case "rumble":
      navigator.vibrate?.(msg.ms);
      break;
    case "error":
      status.textContent = "That TV already has four players.";
      link?.close();
      link = null;
      break;
  }
}

async function askForSensors() {
  type Gated = { requestPermission?: () => Promise<PermissionState> };
  // iOS only shares sensor data after this. Both requests go out in the same
  // tap, because iOS refuses a request that isn't directly from a tap.
  const asks = [DeviceOrientationEvent, DeviceMotionEvent].map((api) => (api as unknown as Gated).requestPermission?.());
  const answers = await Promise.allSettled(asks);
  if (answers.some((a) => a.status === "rejected" || a.value === "denied")) {
    hint.textContent = "Motion access was blocked. Allow it in your browser's settings, then reload.";
  }
}

if (!window.isSecureContext) {
  // Phones never send motion data to plain http:// pages.
  status.textContent = "This page needs the https:// address for motion controls. Start the TV with npm run dev.";
}

document.getElementById("connect")!.addEventListener("click", async () => {
  const room = roomInput.value.trim().toUpperCase();
  if (room.length !== 4) {
    status.textContent = "The code is the four letters on the TV.";
    return;
  }
  await askForSensors();
  connect(room);
  setTimeout(() => {
    if (!hasOrientation) hint.textContent = "No motion data from this phone, so only the buttons will work.";
  }, 3000);
  (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<unknown> } }).wakeLock
    ?.request("screen")
    .catch(() => {});
});

// Pointing

const orient = { alpha: 0, beta: 0, gamma: 0 };
let hasOrientation = false;
/** Some Android phones have no compass heading; they steer by tilting instead. */
let hasHeading = false;
/** Where the phone pointed when it was centred. */
let centre: { alpha: number; tilt: number } | null = null;
/**
 * Up and down is measured from level, not from where the phone was when it
 * connected: pointing the top of the phone straight ahead is the middle of
 * the screen. Centre moves it to wherever the phone points.
 */
let level = 0;
let aimX = 0.5;
let aimY = 0.5;
let lastSent = "";

addEventListener("deviceorientation", (e) => {
  if (e.beta === null && e.alpha === null) return;
  hasHeading = e.alpha !== null;
  orient.alpha = e.alpha ?? 0;
  orient.beta = e.beta ?? 0;
  orient.gamma = e.gamma ?? 0;
  hasOrientation = true;
});

const turn = (deg: number) => ((deg + 540) % 360) - 180;
const currentTilt = () => tilt(orient.beta, orient.gamma, screenAngle());

function takeCentre() {
  centre = { alpha: orient.alpha, tilt: currentTilt() };
}

function recentre() {
  if (!hasOrientation) return;
  takeCentre();
  level = orient.beta;
  aimX = aimY = 0.5;
  navigator.vibrate?.(20);
}

function streamAim() {
  requestAnimationFrame(streamAim);
  if (!player || !hasOrientation) return;
  if (!centre) takeCentre();
  if (!centre) return;

  const sideways = hasHeading ? -turn(orient.alpha - centre.alpha) : currentTilt() - centre.tilt;
  const x = 0.5 + sideways / YAW_RANGE;
  const y = 0.5 - (orient.beta - level) / PITCH_RANGE;
  aimX += (clamp(x, -0.15, 1.15) - aimX) * 0.4;
  aimY += (clamp(y, -0.15, 1.15) - aimY) * 0.4;

  // roll is how far the phone is tipped like a wheel, which Lagoon Kart steers with.
  const msg = { t: "aim", x: +aimX.toFixed(3), y: +aimY.toFixed(3), roll: Math.round(currentTilt()) } as const;
  const key = `${msg.x},${msg.y},${msg.roll}`;
  if (key !== lastSent) {
    lastSent = key;
    send(msg);
  }
}
streamAim();

document.getElementById("centre")!.addEventListener("click", recentre);

// Swings: the phone spots them itself so the TV gets one clean event.

let gravity = { x: 0, y: 0, z: 0 };
let swingEnds = 0;
let swingPeak = 0;
let swingSide = 0;
let quietUntil = 0;

addEventListener("devicemotion", (e) => {
  let a = e.acceleration;
  if (a?.x == null) {
    // Some Android phones only report acceleration with gravity mixed in.
    const g = e.accelerationIncludingGravity;
    if (g?.x == null) return;
    gravity = {
      x: gravity.x * 0.9 + g.x * 0.1,
      y: gravity.y * 0.9 + (g.y ?? 0) * 0.1,
      z: gravity.z * 0.9 + (g.z ?? 0) * 0.1,
    };
    a = { x: g.x - gravity.x, y: (g.y ?? 0) - gravity.y, z: (g.z ?? 0) - gravity.z };
  }

  // Sideways is measured along the screen, so it still means left and right with the phone turned.
  const right = screenRight(screenAngle());
  const x = (a.x ?? 0) * right.x + (a.y ?? 0) * right.y;
  const strength = Math.hypot(x, a.y ?? 0, a.z ?? 0);
  const now = performance.now();

  if (swingEnds) {
    swingPeak = Math.max(swingPeak, strength);
    swingSide += x;
    if (now >= swingEnds) {
      swingEnds = 0;
      quietUntil = now + 550;
      send({
        t: "swing",
        power: +clamp((swingPeak - SWING_START) / (SWING_FULL - SWING_START), 0.05, 1).toFixed(2),
        dir: +clamp(swingSide / 45, -1, 1).toFixed(2),
      });
    }
  } else if (strength > SWING_START && now > quietUntil) {
    swingEnds = now + SWING_WINDOW;
    swingPeak = strength;
    swingSide = x;
  }
});

// Buttons

function press(id: ButtonId, down: boolean) {
  send({ t: "btn", id, down });
}

const releases: (() => void)[] = [];

for (const el of document.querySelectorAll<HTMLElement>("[data-btn]")) {
  const id = el.dataset.btn as ButtonId;
  let held = false;

  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    held = true;
    el.classList.add("is-down");
    navigator.vibrate?.(8);
    press(id, true);
  });

  const release = () => {
    if (!held) return;
    held = false;
    el.classList.remove("is-down");
    press(id, false);
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("lostpointercapture", release);
  releases.push(release);
}

// A notification, the lock button or switching apps can swallow the finger
// lifting, which would leave the kart's gas held down on the TV.
const releaseAll = () => releases.forEach((release) => release());
document.addEventListener("visibilitychange", () => document.hidden && releaseAll());
addEventListener("blur", releaseAll);

document.addEventListener("contextmenu", (e) => e.preventDefault());

