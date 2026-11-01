// custom/paperdoll/paperdollExtensions.js
//
// Paperdoll extensions: readable, source-level port of the v6 patcher helper, plus an
// on/off toggle. Lives in custom/ so upstream merges never touch it.
//
// HOOKS (the only edits needed in upstream files; see notes in chat):
//   1. paperDoll module : export composeTransparent(), call markDirty() after
//                         the paperdoll texture refreshes.
//   2. eotbBody module  : in the third-person branch, bail out early when
//                         shouldSuppressNative() is true (call noteNativeSkipped()).
//   3. arena / world / exterior : wrap the player-body draw call in drawBody(),
//                         and append getBatch() to the billboard pass when
//                         isVisible() is true.

// TODO: adjust this path to wherever paperDoll lives in src/
import { composeTransparent } from '../../src/PATH/TO/paperDoll.js';

const TEXTURE_SET = 900000;       // pseudo texture-set id used by the original patch
const STORAGE_KEY = 'custom.paperdoll.enabled';
const RETRY_DELAY_MS = 500;       // fix: don't recompose every frame after a failure

let batch = null;
let textureKey = null;
let dirty = true;
let busy = false;
let visible = false;
let suppressNative = false;
let nativeSkipped = false;
let sequence = 0;
let lastSignature = '';
let retryAt = 0;

// ---- toggle ---------------------------------------------------------------

export function isEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) !== '0'; } catch { return true; }
}

export function setEnabled(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  dirty = true;
}

// ---- hook 1 / hook 2 API --------------------------------------------------

/** Call after the paperdoll texture is refreshed (replaces globalThis.__DFO_PAPERDOLL_DIRTY). */
export function markDirty() { dirty = true; }

/** eotbBody asks: should I skip drawing the native third-person body this frame? */
export function shouldSuppressNative() { return suppressNative && isEnabled(); }

/** eotbBody tells us it skipped, so the billboard may be shown. */
export function noteNativeSkipped() { nativeSkipped = true; }

// ---- internals ------------------------------------------------------------

function cropAndFlip(p) {
  // Find bounding box of non-transparent pixels.
  let x0 = p.width, y0 = p.height, x1 = -1, y1 = -1;
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      if (p.rgba[(y * p.width + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0 || y1 < y0) return null;

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = new Uint8Array(w * h * 4);
  // Copy rows bottom-to-top (GL texture orientation).
  for (let y = 0; y < h; y++) {
    const src = ((y0 + y) * p.width + x0) * 4;
    out.set(p.rgba.subarray(src, src + w * 4), (h - 1 - y) * w * 4);
  }
  return { w, h, out };
}

function frame(appearance, renderer, feet, height) {
  if (!appearance || !renderer) return;

  let signature = '';
  try { signature = JSON.stringify(appearance); } catch { /* ignore */ }
  if (signature && signature !== lastSignature) {
    lastSignature = signature;
    dirty = true;
    retryAt = 0;
  }

  if (batch && feet) {
    batch.origin[0] = feet[0];
    batch.origin[1] = feet[1];
    batch.origin[2] = feet[2];
  }

  if (!dirty || busy || performance.now() < retryAt) return;
  dirty = false;
  busy = true;

  const fail = () => { dirty = true; retryAt = performance.now() + RETRY_DELAY_MS; };

  composeTransparent(appearance)
    .then((p) => {
      if (!p?.rgba) return fail();
      const img = cropAndFlip(p);
      if (!img) return fail();

      const key = `local_doll_${++sequence}`;
      renderer.uploadTexture(TEXTURE_SET, key, {
        width: img.w,
        height: img.h,
        colors: new Uint32Array(img.out.buffer),
      });

      try {
        const worldHeight = Math.max(0.5, Number(height) || 1.8);
        const made = renderer.createBillboardBatch(
          TEXTURE_SET, key,
          { w: worldHeight * img.w / img.h, h: worldHeight },
          [[0, 0, 0]],
        );
        if (feet) made.origin = [feet[0], feet[1], feet[2]];

        const oldBatch = batch;
        const oldTexture = textureKey;
        batch = made;
        textureKey = key;
        if (oldBatch) renderer.destroyBillboardBatch?.(oldBatch);
        if (oldTexture) renderer.releaseTexture?.(TEXTURE_SET, oldTexture);
      } catch (err) {
        renderer.releaseTexture?.(TEXTURE_SET, key);
        throw err;
      }
    })
    .catch(fail)
    .finally(() => { busy = false; });
}

// ---- hook 3 API -----------------------------------------------------------

/**
 * Wraps the existing player-body draw call.
 *   before: drawEotbBody(canvas, opts)
 *   after : drawBody(drawEotbBody, canvas, opts, appearance, renderer, feet, height)
 */
export function drawBody(draw, canvas, opts, appearance, renderer, feet, height) {
  if (!isEnabled()) {
    visible = false;
    return draw(canvas, opts);          // untouched native behaviour
  }

  visible = false;
  frame(appearance, renderer, feet, height);

  suppressNative = !!batch;
  nativeSkipped = false;
  let result;
  try {
    result = draw(canvas, opts);
  } finally {
    suppressNative = false;
  }
  visible = nativeSkipped;
  return result;
}

/** Billboard to append to the billboard pass, or null. */
export function getBatch() { return batch; }
export function isVisible() { return visible; }

/** Convenience: returns the list with the paperdoll appended when it should show. */
export function withPaperdoll(batches) {
  return visible && batch ? [...batches, batch] : batches;
}
