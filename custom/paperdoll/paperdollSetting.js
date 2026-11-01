// custom/paperdoll/paperdollSetting.js
//
// The Paperdoll look's on/off switch, kept apart from paperdollExtensions.js so the Skin card (ui/skinCard.js)
// can import it without pulling in the compose stack. Stored through appStorage - the one storage seam, as
// systems/modSettings.js does - and read every frame from memory.

import { appStorage } from '../../src/systems/appStorage.js';

const STORAGE_KEY = 'custom.paperdoll.enabled';
/** What a player who never touched the switch gets: true draws the paperdoll in third person, false the sprite. */
const DEFAULT_ON = true;

let cache = null;

export function isEnabled() {
  if (cache === null) {
    let v = null;
    try { v = appStorage()?.getItem(STORAGE_KEY); } catch { /* no storage */ }
    cache = v == null ? DEFAULT_ON : v !== '0';
  }
  return cache;
}

export function setEnabled(on) {
  cache = !!on;
  try { appStorage()?.setItem(STORAGE_KEY, cache ? '1' : '0'); } catch { /* no storage */ }
  return cache;
}
