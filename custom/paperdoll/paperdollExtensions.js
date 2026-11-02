// custom/paperdoll/paperdollExtensions.js
//
// The LOCAL player's own paperdoll, drawn as a billboard in third person in place of the
// EOTB sprite body. Called from ONE place: player/eyeOfTheBeholder/eotbBody.js draw(), at the
// point where it would draw its own sprite. Toggleable: off means the sprite, untouched.
//
// Needs (in src/): ui/paperDoll.js exporting composeDollTransparent (added), and the one
// call + import in eotbBody.js. No scene, mwView or billboard-pass edits.

import { composeDollTransparent, paperDollPixels, paperDollArtLoaded } from '../../src/ui/paperDoll.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { drawnEquipTable } from '../../src/systems/capeShown.js';
import { CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { isEnabled, setEnabled, backSpriteOn } from './paperdollSetting.js';
import { alphaBounds, cropBottomUp } from './paperdollImage.js';

/** The wheel positions that show the player's back: 4 is straight behind (the one view EOTB paints its back), 3 and 5 the
 *  two diagonals either side of it. 0 is front on, 2 and 6 the sides. With the back sprite on, these draw the sprite. */
const BACK_ORIENTATIONS = new Set([3, 4, 5]);

const TEXTURE_SET = 900000;      // the peers' doll archive id (net/remotePlayers.js PEER_ARCHIVE)
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

// ---- diagnostics: open the browser console (F12) and look for [paperdoll] lines ----
const diag = { calls: 0, drawn: 0, composes: 0, nulls: 0, noBounds: 0, errors: 0, lastReason: '' };
const seen = new Set();
function note(reason, extra) {
  diag.lastReason = reason;
  if (seen.has(reason)) return;
  seen.add(reason);
  console.warn('[paperdoll] ' + reason, extra ?? '');
}
globalThis.__paperdoll = {
  diag,
  state: () => ({
    enabled: isEnabled(), hasBatch: !!batch, busy, dirty, artLoaded: paperDollArtLoaded(),
    hasPlayerEntity: !!playerEntity, retryInMs: Math.max(0, Math.round(retryAt - performance.now())),
  }),
};

// ---- toggle: see paperdollSetting.js (the Skin card's Look toggle writes it) -----------------

export { isEnabled, setEnabled };

// ---- helpers --------------------------------------------------------------

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
  diag.composes++;
  composeDollTransparent(entity)
    .then((px) => {
      if (!px?.rgba) { diag.nulls++; note(paperDollArtLoaded() ? 'compose returned null (art is loaded)' : 'doll art not loaded yet'); return fail(); }
      const r = alphaBounds(px.rgba, px.width, px.height);
      if (!r) { diag.noBounds++; note('doll composed but fully transparent'); return fail(); }
      swapBatch(renderer, cropBottomUp(px.rgba, px.width, r), r.w, r.h, height);
      note('doll ready (' + r.w + 'x' + r.h + ')');
    })
    .catch((err) => { diag.errors++; note('error: ' + (err?.message ?? err), err); fail(); })
    .finally(() => { busy = false; });
}

// ---- the one call eotbBody.js makes ---------------------------------------

/**
 * Draw the player's paperdoll in place of the sprite. Returns true when it drew (the caller then skips the
 * sprite), false when the sprite should draw: the toggle is off, or the doll is not composed yet.
 *   { renderer, feet, camRight, bbUp, conceal, height?, orientation? }   `orientation`: the sprite's wheel position now (eotbBody's shown.orientation)
 */
export function paperdollDraw({ renderer, feet, camRight, bbUp, conceal = null, height = null, orientation = null }) {
  diag.calls++;
  if (diag.calls === 1) note('hook reached');
  if (!isEnabled()) { if (batch) release(); note('disabled by toggle'); return false; }
  // the animated back sprite, when asked for: seen from behind the sprite draws as it always did, the doll keeps the front
  if (backSpriteOn() && BACK_ORIENTATIONS.has(orientation)) { diag.lastReason = 'back sprite'; return false; }
  if (!renderer || !feet || !playerEntity) { note('missing input: ' + [!renderer && 'renderer', !feet && 'feet', !playerEntity && 'playerEntity'].filter(Boolean).join(',')); return false; }
  if (renderer_ !== renderer) { release(); renderer_ = renderer; }

  poll(playerEntity);
  refresh(renderer, playerEntity, height);

  if (!batch) return false;                      // the sprite shows until the doll is ready
  batch.origin[0] = feet[0]; batch.origin[1] = feet[1]; batch.origin[2] = feet[2];
  batch.conceal = conceal;
  renderer.drawBillboards([batch], camRight, bbUp);
  diag.drawn++;
  return true;
}
