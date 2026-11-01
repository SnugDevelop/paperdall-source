// custom/paperdoll/paperdollExtensions.js
//
// The LOCAL player's own paperdoll, drawn as a billboard in third person in place of the
// EOTB sprite body. Called from ONE place: player/eyeOfTheBeholder/eotbBody.js draw(), at the
// point where it would draw its own sprite. Toggleable: off means the sprite, untouched.
//
// Needs (in src/): ui/paperDoll.js exporting composeDollTransparent (added), and the one
// call + import in eotbBody.js. No scene, mwView or billboard-pass edits.

import { composeDollTransparent, paperDollPixels } from '../../src/ui/paperDoll.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { drawnEquipTable } from '../../src/systems/capeShown.js';
import { CAPSULE_HEIGHT } from '../../src/player/motor.js';

const TEXTURE_SET = 900000;      // the peers' doll archive id (net/remotePlayers.js PEER_ARCHIVE)
const STORAGE_KEY = 'custom.paperdoll.enabled';
const RETRY_DELAY_MS = 500;      // a failed/empty compose waits this long, not a frame
const POLL_MS = 250;             // how often the worn gear is re-read

let batch = null;
let textureKey = null;
let renderer_ = null;
let dirty = true;
let busy = false;
let sequence = 0;
let retryAt = 0;
let nextPollAt = 0;
let lastSig = '';
let lastDollVersion = -1;

// ---- toggle ---------------------------------------------------------------

export function isEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) !== '0'; } catch { return true; }
}
export function setEnabled(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  dirty = true;
  if (!on) release();
}

// ---- helpers --------------------------------------------------------------

function alphaBounds(rgba, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Rows written bottom-up: the billboard samples GL's bottom-up texel order (see net/remotePlayers.js cropRgba).
function cropBottomUp(rgba, w, r) {
  const out = new Uint8Array(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const src = ((r.y + y) * w + r.x) * 4;
    out.set(rgba.subarray(src, src + r.w * 4), (r.h - 1 - y) * r.w * 4);
  }
  return out;
}

/** A cheap signature of what the player wears: every primitive field of each drawn item. */
function wornSignature(entity) {
  let table = [];
  try { table = drawnEquipTable(entity) ?? []; } catch { /* none */ }
  const parts = [entity.race, entity.gender, entity.faceIndex];
  for (let i = 0; i < table.length; i++) {
    const it = table[i];
    if (!it) continue;
    const row = [i];
    for (const k of Object.keys(it)) { const v = it[k]; if (v == null || typeof v === 'object') continue; row.push(k, v); }
    const ap = it.appearance;
    if (ap && typeof ap === 'object') row.push('ap', ap.t, ap.m, ap.v);
    parts.push(row.join(':'));
  }
  return parts.join('|');
}

function poll(entity) {
  const now = performance.now();
  if (now < nextPollAt) return;
  nextPollAt = now + POLL_MS;
  const v = paperDollPixels()?.version ?? -1;          // the inventory doll recomposed
  if (v !== lastDollVersion) { lastDollVersion = v; dirty = true; }
  const sig = wornSignature(entity);                    // gear / race / face changed
  if (sig !== lastSig) { lastSig = sig; dirty = true; retryAt = 0; }
}

function release() {
  if (renderer_) {
    if (batch) renderer_.destroyBillboardBatch?.(batch);
    if (textureKey) renderer_.releaseTexture?.(TEXTURE_SET, textureKey);
  }
  batch = null; textureKey = null; dirty = true;
}

function swapBatch(renderer, pixels, w, h, height) {
  const rec = `local_doll_${++sequence}`;
  renderer.uploadTexture(TEXTURE_SET, rec, { width: w, height: h, colors: new Uint32Array(pixels.buffer) });
  try {
    const hh = Math.max(0.5, Number(height) || CAPSULE_HEIGHT);
    const made = renderer.createBillboardBatch(TEXTURE_SET, rec, { w: hh * w / h, h: hh }, [[0, 0, 0]]);
    made.origin = [0, 0, 0];
    made.selfCard = true;   // the player's own body casts as drawn, as the sprite's batch does (render/shadowPass.js)
    const oldBatch = batch, oldTexture = textureKey;
    batch = made; textureKey = rec;
    if (oldBatch) renderer.destroyBillboardBatch?.(oldBatch);
    if (oldTexture) renderer.releaseTexture?.(TEXTURE_SET, oldTexture);
  } catch (err) {
    renderer.releaseTexture?.(TEXTURE_SET, rec);
    throw err;
  }
}

function refresh(renderer, entity, height) {
  if (!dirty || busy || performance.now() < retryAt) return;
  dirty = false;
  busy = true;
  const fail = () => { dirty = true; retryAt = performance.now() + RETRY_DELAY_MS; };
  composeDollTransparent(entity)
    .then((px) => {
      if (!px?.rgba) return fail();
      const r = alphaBounds(px.rgba, px.width, px.height);
      if (!r) return fail();
      swapBatch(renderer, cropBottomUp(px.rgba, px.width, r), r.w, r.h, height);
    })
    .catch(fail)
    .finally(() => { busy = false; });
}

// ---- the one call eotbBody.js makes ---------------------------------------

/**
 * Draw the player's paperdoll in place of the sprite. Returns true when it drew (the caller then skips the
 * sprite), false when the sprite should draw: the toggle is off, or the doll is not composed yet.
 *   { renderer, feet, camRight, bbUp, conceal, height? }
 */
export function paperdollDraw({ renderer, feet, camRight, bbUp, conceal = null, height = null }) {
  if (!isEnabled()) { if (batch) release(); return false; }
  if (!renderer || !feet || !playerEntity) return false;
  if (renderer_ !== renderer) { release(); renderer_ = renderer; }

  poll(playerEntity);
  refresh(renderer, playerEntity, height);

  if (!batch) return false;                      // the sprite shows until the doll is ready
  batch.origin[0] = feet[0]; batch.origin[1] = feet[1]; batch.origin[2] = feet[2];
  batch.conceal = conceal;
  renderer.drawBillboards([batch], camRight, bbUp);
  return true;
}
