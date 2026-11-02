// custom/paperdoll/goldHalo.js
//
// THE GOLDEN HALO: a ring of gold pixels with twinkling sparkles, floating over the player's own head in third person.
// A LOCAL extra - drawn on this client only, never sent to the account service, and it touches none of the wardrobe's
// titles, auras or store items. Called from ONE place: player/eyeOfTheBeholder/eotbBody.js draw(), on foot.
// It is drawn as a billboard (its frames uploaded once as textures), the way the paperdoll body is.

import { CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { haloOn } from './paperdollSetting.js';
import { haloFrame, HALO_W, HALO_H, HALO_FRAMES } from './goldHaloFrames.js';

const TEXTURE_SET = 900001;     // beside the paperdoll's 900000
const WORLD_W = 0.62;           // the halo's width, metres
const LIFT = 0.04;              // the gap between the crown of the head and the halo's lowest edge
const FRAME_MS = 110;           // how long each frame stands

let renderer_ = null;
let batches = null;             // one billboard batch per frame
let broken = false;

function release() {
  if (renderer_ && batches) {
    for (const b of batches) renderer_.destroyBillboardBatch?.(b.batch);
    for (let i = 0; i < batches.length; i++) renderer_.releaseTexture?.(TEXTURE_SET, batches[i].key);
  }
  batches = null;
}

/** The frames as bottom-first rows, the order billboards sample in (net/remotePlayers.js writes a peer's the same). */
function bottomFirst(rgba) {
  const out = new Uint8Array(rgba.length);
  const row = HALO_W * 4;
  for (let y = 0; y < HALO_H; y++) out.set(rgba.subarray(y * row, (y + 1) * row), (HALO_H - 1 - y) * row);
  return out;
}

function build(renderer) {
  const list = [];
  const worldH = (WORLD_W * HALO_H) / HALO_W;
  for (let i = 0; i < HALO_FRAMES; i++) {
    const key = `gold_halo_${i}`;
    const px = bottomFirst(haloFrame(i));
    renderer.uploadTexture(TEXTURE_SET, key, { width: HALO_W, height: HALO_H, colors: new Uint32Array(px.buffer) });
    const batch = renderer.createBillboardBatch(TEXTURE_SET, key, { w: WORLD_W, h: worldH }, [[0, 0, 0]]);
    batch.origin = [0, 0, 0];
    list.push({ key, batch });
  }
  return list;
}

/**
 * Draw the halo over the head standing at `feet`, if the player has it on. Never throws: a halo that will not draw
 * is a halo that is not there, never a game that stops.
 *   { renderer, feet, camRight, bbUp, height? }
 */
export function goldHaloDraw({ renderer, feet, camRight, bbUp, height = CAPSULE_HEIGHT }) {
  if (broken) return;
  if (!haloOn()) { if (batches) release(); return; }
  if (!renderer || !feet) return;
  try {
    if (renderer_ !== renderer) { release(); renderer_ = renderer; }
    if (!batches) batches = build(renderer);
    const f = batches[Math.floor(performance.now() / FRAME_MS) % batches.length];
    f.batch.origin[0] = feet[0];
    f.batch.origin[1] = feet[1] + height + LIFT;
    f.batch.origin[2] = feet[2];
    renderer.drawBillboards([f.batch], camRight, bbUp);
  } catch (err) {
    broken = true;   // once: do not retry every frame
    console.warn('[paperdoll] the golden halo would not draw', err?.message ?? err);
  }
}
