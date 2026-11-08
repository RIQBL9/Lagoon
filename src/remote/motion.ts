// Maths for turning the phone's sensor readings into something a player means.
// Device axes: x to the right of the screen, y towards the top edge, z out of the screen.

const RAD = Math.PI / 180;

/** Which way is up, in the phone's own axes, from deviceorientation beta and gamma. */
export function upVector(beta: number, gamma: number) {
  const b = beta * RAD;
  const g = gamma * RAD;
  return { x: -Math.sin(g) * Math.cos(b), y: Math.sin(b), z: Math.cos(g) * Math.cos(b) };
}

/** How far the screen is turned from upright: 0, 90, 180 or 270. */
export function screenAngle() {
  const a = screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0;
  return ((a % 360) + 360) % 360;
}

/** The direction "right" on screen, in the phone's x/y axes. */
export function screenRight(angle: number) {
  const a = angle * RAD;
  return { x: Math.cos(a), y: -Math.sin(a) };
}

/**
 * How far the phone is tipped to the right, in degrees, like turning a wheel.
 * Works held flat or upright, and the right way round whichever way the screen faces.
 */
export function tilt(beta: number, gamma: number, angle: number) {
  const up = upVector(beta, gamma);
  const right = screenRight(angle);
  const along = -(up.x * right.x + up.y * right.y);
  return Math.asin(Math.max(-1, Math.min(1, along))) / RAD;
}
