// custom/paperdoll/goldHaloFrames.js
//
// The golden halo's pictures, drawn in code: a flattened ring of gold pixels with a dark outline, a bright glint that
// runs round it, and four-point sparkles that swell and fade - HALO_FRAMES pictures that loop. Hard pixels, no soft
// edges, so it keeps the game's pixel-art look and reads on any ground. Pure - no imports - so a test can render it.

export const HALO_W = 96;
export const HALO_H = 48;
export const HALO_FRAMES = 8;

const HI = [255, 244, 168];
const MID = [247, 200, 64];
const LO = [201, 140, 22];
const LINE = [122, 78, 10];
const WHITE = [255, 255, 238];

const CX = 48, CY = 34;          // the ring's centre: low in the picture, so the sparkles have the room above it
const OUT_RX = 38, OUT_RY = 8;   // outer ellipse
const IN_RX = 34, IN_RY = 5.8;   // inner ellipse - the ring is what lies between

/** The sparkles: [x, y, phase 0..1]. Spread over the ring and above it, each out of step with the others. */
const STARS = Object.freeze([
  [8, 31, 0.0], [20, 14, 0.31], [34, 25, 0.62], [48, 6, 0.12], [62, 22, 0.47], [76, 12, 0.78], [89, 30, 0.2],
]);

const inEllipse = (x, y, rx, ry) => ((x + 0.5 - CX) / rx) ** 2 + ((y + 0.5 - CY) / ry) ** 2 <= 1;

/** One frame, `i` of HALO_FRAMES: a top-down RGBA Uint8Array, HALO_W x HALO_H. Pure. */
export function haloFrame(i) {
  const px = new Uint8Array(HALO_W * HALO_H * 4);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= HALO_W || y >= HALO_H) return;
    const o = (y * HALO_W + x) * 4;
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
  };
  const ring = new Uint8Array(HALO_W * HALO_H);
  for (let y = 0; y < HALO_H; y++) {
    for (let x = 0; x < HALO_W; x++) {
      if (inEllipse(x, y, OUT_RX, OUT_RY) && !inEllipse(x, y, IN_RX, IN_RY)) ring[y * HALO_W + x] = 1;
    }
  }
  // the outline first, round every ring pixel, then the ring on top of it
  for (let y = 0; y < HALO_H; y++) {
    for (let x = 0; x < HALO_W; x++) {
      if (ring[y * HALO_W + x]) continue;
      const near = (dx, dy) => x + dx >= 0 && y + dy >= 0 && x + dx < HALO_W && y + dy < HALO_H && ring[(y + dy) * HALO_W + x + dx];
      if (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) put(x, y, LINE);
    }
  }
  for (let y = 0; y < HALO_H; y++) {
    for (let x = 0; x < HALO_W; x++) {
      if (!ring[y * HALO_W + x]) continue;
      const up = (y + 0.5 - CY) / OUT_RY;   // -1 the ring's top edge .. 1 its bottom
      put(x, y, up < -0.45 ? HI : up < 0.25 ? MID : LO);
    }
  }
  // the glint that runs round the ring, once per loop
  const a = (i / HALO_FRAMES) * Math.PI * 2;
  const mx = (OUT_RX + IN_RX) / 2, my = (OUT_RY + IN_RY) / 2;
  const gx = Math.round(CX + mx * Math.cos(a) - 0.5), gy = Math.round(CY + my * Math.sin(a) - 0.5);
  put(gx, gy, WHITE); put(gx + 1, gy, WHITE);
  // the sparkles: each swells and fades on its own phase
  for (const [sx, sy, ph] of STARS) {
    const t = (i / HALO_FRAMES + ph) % 1;
    const v = 1 - Math.abs(2 * t - 1);                 // 0 .. 1 .. 0
    const arm = v < 0.25 ? 0 : v < 0.55 ? 1 : v < 0.85 ? 2 : 3;
    if (!arm) continue;
    put(sx, sy, WHITE);
    for (let k = 1; k <= arm; k++) {
      const c = k === arm && arm > 1 ? MID : HI;
      put(sx + k, sy, c); put(sx - k, sy, c); put(sx, sy + k, c); put(sx, sy - k, c);
    }
  }
  return px;
}
