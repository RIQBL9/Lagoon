// Top-down lane physics in metres. x runs across the lane, z down it.
// The foul line is z = 0 and the head pin stands at z = LANE_LEN.

export const LANE_HALF = 0.53;
export const LANE_LEN = 18.29;
export const DECK_END = 19.3;
export const BALL_R = 0.109;
export const PIN_R = 0.06;
export const PIN_H = 0.38;

const BALL_MASS = 6.5;
const PIN_MASS = 1.5;
const HOOK_FROM = 7; // the oil runs out about here, so spin starts to bite

export interface Pin {
  /** Which of the ten spots it started on, 0 = head pin. */
  spot: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  down: boolean;
  /** Fell off the deck or into the gutter. */
  gone: boolean;
  tilt: number;
  /** Direction it's falling, radians, 0 = away from the bowler. */
  fallAngle: number;
}

export interface Ball {
  x: number;
  z: number;
  vx: number;
  vz: number;
  spin: number;
  gutter: boolean;
  rolled: number;
}

export function pinSpots() {
  const spots: { x: number; z: number }[] = [];
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k <= row; k++) spots.push({ x: (k - row / 2) * 0.3048, z: LANE_LEN + row * 0.264 });
  }
  return spots;
}

export function newPins(): Pin[] {
  return pinSpots().map(({ x, z }, spot) => ({ spot, x, z, vx: 0, vz: 0, down: false, gone: false, tilt: 0, fallAngle: 0 }));
}

export function newBall(x: number, angle: number, speed: number, spin: number): Ball {
  return { x, z: 0.3, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, spin, gutter: false, rolled: 0 };
}

function knock(pin: Pin) {
  if (pin.down) return false;
  pin.down = true;
  pin.fallAngle = Math.atan2(pin.vx, pin.vz);
  return true;
}

/** Advances the lane by dt. Returns how many pins were newly knocked down. */
export function step(ball: Ball | null, pins: Pin[], dt: number) {
  let knocked = 0;

  if (ball) {
    if (!ball.gutter && ball.z > HOOK_FROM && ball.z < LANE_LEN) ball.vx += ball.spin * dt;
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    ball.rolled += Math.hypot(ball.vx, ball.vz) * dt;

    if (!ball.gutter && Math.abs(ball.x) > LANE_HALF && ball.z < LANE_LEN - 0.2) {
      ball.gutter = true;
      ball.x = Math.sign(ball.x) * (LANE_HALF + 0.07);
      ball.vx = 0;
    }

    if (!ball.gutter) {
      for (const pin of pins) {
        if (pin.gone) continue;
        const dx = pin.x - ball.x;
        const dz = pin.z - ball.z;
        const dist = Math.hypot(dx, dz);
        const min = BALL_R + PIN_R;
        if (dist >= min || dist === 0) continue;
        const nx = dx / dist;
        const nz = dz / dist;
        const closing = (ball.vx - pin.vx) * nx + (ball.vz - pin.vz) * nz;
        if (closing <= 0) continue;
        const j = (2 * closing) / (1 / BALL_MASS + 1 / PIN_MASS);
        pin.vx += (j / PIN_MASS) * nx;
        pin.vz += (j / PIN_MASS) * nz;
        ball.vx -= (j / BALL_MASS) * nx;
        ball.vz -= (j / BALL_MASS) * nz;
        pin.x = ball.x + nx * min;
        pin.z = ball.z + nz * min;
        if (knock(pin)) knocked++;
      }
    }
  }

  // Pin against pin, equal masses, a bit of energy lost.
  for (let i = 0; i < pins.length; i++) {
    const a = pins[i];
    if (a.gone) continue;
    for (let k = i + 1; k < pins.length; k++) {
      const b = pins[k];
      if (b.gone) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      const min = PIN_R * 2 * (a.down || b.down ? 1.6 : 1);
      if (dist >= min || dist === 0) continue;
      const nx = dx / dist;
      const nz = dz / dist;
      const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (closing <= 0.05) continue;
      const j = closing * 0.9;
      a.vx -= j * nx;
      a.vz -= j * nz;
      b.vx += j * nx;
      b.vz += j * nz;
      if (closing > 0.25) {
        if (knock(a)) knocked++;
        if (knock(b)) knocked++;
      }
    }
  }

  for (const pin of pins) {
    if (pin.gone) continue;
    pin.x += pin.vx * dt;
    pin.z += pin.vz * dt;
    const drag = Math.exp(-(pin.down ? 2.4 : 6) * dt);
    pin.vx *= drag;
    pin.vz *= drag;
    if (pin.down) pin.tilt = Math.min(1, pin.tilt + dt * 4.5);
    if (Math.abs(pin.x) > LANE_HALF + 0.2 || pin.z > DECK_END) {
      pin.gone = true;
      if (knock(pin)) knocked++;
    }
  }

  return knocked;
}

export function settled(ball: Ball | null, pins: Pin[]) {
  const ballDone = !ball || ball.z > DECK_END || Math.hypot(ball.vx, ball.vz) < 0.2;
  return ballDone && pins.every((p) => p.gone || Math.hypot(p.vx, p.vz) < 0.05);
}
