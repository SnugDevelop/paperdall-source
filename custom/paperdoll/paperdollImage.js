// custom/paperdoll/paperdollImage.js
//
// The two pixel helpers the paperdoll's billboard and the profile's preview share: the box a composed doll's visible
// pixels fill, and a crop of it written bottom-up (GL's texel order, as net/remotePlayers.js cropRgba writes a peer's).
// Pure - no imports, so anything may take them.

/** The box of non-transparent pixels in a top-down RGBA picture: { x, y, w, h }, or null when it is all clear. */
export function alphaBounds(rgba, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The box `r` of a top-down RGBA picture `w` wide, copied out with its rows bottom first. */
export function cropBottomUp(rgba, w, r) {
  const out = new Uint8Array(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const src = ((r.y + y) * w + r.x) * 4;
    out.set(rgba.subarray(src, src + r.w * 4), (r.h - 1 - y) * r.w * 4);
  }
  return out;
}
