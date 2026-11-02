Paperfall is a custom DFO client designed to draw in the player's paperdoll sprite in place of the usual animated sprite.

DISCLAIMER: Vibe coded from ChatGPT and Claude, so this is not my own work and may be buggy. 

Features:

- Reuses the existing Daggerfall equipment paperdoll.
- Displays the player's equipped appearance in the outdoor world.
- Replaces the traditional animated player sprite with the paperdoll representation.
- Brings the character's equipment appearance into the multiplayer experience.
- Allows other players to see the paperdoll representation of your character as default.
- Preserves the existing first-person view and combat behavior. The paperdoll feature is intended as an alternative third-person character presentation, not a replacement for the original first-person experience.

Custom changes:

Built on Daggerfall Enhanced (`daggerfall-js-source`, MIT) and Daggerfall Unity. All custom code lives in
`custom/paperdoll/`; the upstream files listed under "Files touched" carry only small hooks, so updates from
upstream merge cleanly.

- **Paperdoll body in third person.** The player's own paperdoll, composed transparently from the equipped gear,
  replaces the Eye of the Beholder sprite when walking on foot. The sprite is kept when riding, transformed, dead,
  in the grown overworld travel view, and until the doll has finished composing. It updates when gear, race,
  gender or face change.
- **"Paperdoll" look option.** Profile → Skin → Look now offers Skins, Layered Gearing and Paperdoll. The choice
  is saved with the game's other settings. Paperdoll is on by default (`DEFAULT_ON` in
  `custom/paperdoll/paperdollSetting.js`).
- **Paperdoll character preview.** With Look set to Paperdoll, the profile (and shop and wardrobe) character
  preview shows the paperdoll in a running game. At the title screen it still shows the sprite.
- **Mod faces in menu icons.** Face icons (menu portrait, save tiles, character-creation face picker) use an
  attached DFMod's replacement faces, such as Paperdoll Enhanced, and fall back to the original icons. Works with
  the mod and with loose textures.
- **Debugging aid.** `__paperdoll.state()` and `__paperdoll.diag` in the browser console report the paperdoll's
  status.

### Files touched

New: `custom/paperdoll/paperdollExtensions.js`, `paperdollSetting.js`, `paperdollImage.js`.
Small edits: `src/ui/paperDoll.js` (transparent compose function), `src/player/eyeOfTheBeholder/eotbBody.js`
(the draw hook), `src/ui/skinCard.js` (Look option), `src/ui/profileBody.js` and `src/render/characterStage.js`
(preview), `src/ui/facePortrait.js` (mod faces).

### Credits

Based on Daggerfall Enhanced by Lattymoy and Daggerfall Unity. Paperdoll art: Paperdoll Enhanced (check its
license before redistributing).
