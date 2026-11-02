```text
════════════════════════════════════════════════════════════════════════
██████╗  █████╗ ██████╗ ███████╗██████╗ ██████╗  █████╗ ██╗     ██╗     
██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔══██╗██║     ██║     
██████╔╝███████║██████╔╝█████╗  ██████╔╝██║  ██║███████║██║     ██║     
██╔═══╝ ██╔══██║██╔═══╝ ██╔══╝  ██╔══██╗██║  ██║██╔══██║██║     ██║     
██║     ██║  ██║██║     ███████╗██║  ██║██████╔╝██║  ██║███████╗███████╗
╚═╝     ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝

             ██████╗ ███╗   ██╗██╗     ██╗███╗   ██╗███████╗
            ██╔═══██╗████╗  ██║██║     ██║████╗  ██║██╔════╝
            ██║   ██║██╔██╗ ██║██║     ██║██╔██╗ ██║█████╗  
            ██║   ██║██║╚██╗██║██║     ██║██║╚██╗██║██╔══╝  
            ╚██████╔╝██║ ╚████║███████╗██║██║ ╚████║███████╗
             ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝
════════════════════════════════════════════════════════════════════════
```

**Paperdall Online** is a custom DFO client designed to draw in the player's paperdoll sprite in place of the usual animated sprite.

DISCLAIMER: Vibe coded from ChatGPT and Claude, so this is not my own work and may be buggy.

## Features

- Reuses the existing Daggerfall equipment paperdoll.
- Displays the player's equipped appearance in the outdoor world.
- Replaces the traditional animated player sprite with the paperdoll representation, with an optional animated back sprite when seen from behind.
- Preserves the existing first-person view and combat behavior. The paperdoll feature is intended as an alternative third-person character presentation, not a replacement for the original first-person experience.

## Custom changes

Built on Daggerfall Enhanced (`daggerfall-js-source`, MIT) and Daggerfall Unity. The paperdoll code lives in
`custom/paperdoll/`; the upstream files listed under "Files touched" carry only small hooks, so updates from upstream
merge cleanly.

### Paperdoll

- **Paperdoll body in third person.** The player's own paperdoll, composed transparently from the equipped gear,
  replaces the Eye of the Beholder sprite when walking on foot. The sprite is kept when riding, transformed, dead,
  in the grown overworld travel view, and until the doll has finished composing. The doll updates when gear, race,
  gender or face change.
- **"Paperdoll" look option.** Profile → Skin → Look now offers Skins, Layered Gearing and Paperdoll. The choice is
  saved with the game's other settings. Paperdoll is on by default (`DEFAULT_ON` in
  `custom/paperdoll/paperdollSetting.js`).
- **Animated back sprite (optional).** With Paperdoll selected, a checkbox under it lets the normal animated sprite
  draw when the player is seen from behind, so the paperdoll is the front view only. Off by default
  (`BACK_DEFAULT_ON` in `paperdollSetting.js`). The sprite is used for the straight-behind view and the two back
  diagonals (`BACK_ORIENTATIONS` in `paperdollExtensions.js`).
- **Paperdoll character preview.** With Look set to Paperdoll, the profile (and shop and wardrobe) character
  preview shows the paperdoll in a running game. At the title screen it still shows the sprite.
- **Mod faces in menu icons.** Face icons (menu portrait, save tiles, character-creation face picker) use an
  attached DFMod's replacement faces, such as Paperdoll Enhanced, and fall back to the original icons. Works with
  the mod and with loose textures.
- **Debugging aid.** `__paperdoll.state()` and `__paperdoll.diag` in the browser console report the paperdoll's
  status.

### Branding and menus

- **Renamed to Paperdall Online.** A new gold wordmark replaces the dragon logo in the menu, intro and landing page
  (`src/assets/branding/dfo-online.png`, same size as the original so layouts are unchanged). A matching title
  splash is at `public/logo.png`, and the landing page's title text is updated.
- **Support links removed; About button added.** The Patreon and Ko-fi icons are gone from the in-game main menu
  and from the landing page. A small "i" button takes their place and opens a disclaimer about this build.

### Files touched

New: `custom/paperdoll/paperdollExtensions.js`, `paperdollSetting.js`, `paperdollImage.js`; `public/logo.png`.

Replaced art: `src/assets/branding/dfo-online.png`.

Small edits to upstream files:

| File | Change |
|---|---|
| `src/ui/paperDoll.js` | `composeDollTransparent`, the doll without its backdrop |
| `src/player/eyeOfTheBeholder/eotbBody.js` | the draw hook (one import, one call) |
| `src/ui/skinCard.js` | the Paperdoll look and the back-sprite checkbox |
| `src/ui/profileBody.js`, `src/render/characterStage.js` | the paperdoll preview |
| `src/ui/facePortrait.js` | mod faces in menu icons |
| `src/ui/enhanced/enhancedMenu.js` | the About button replaces the support links; unused import removed |
| `index.html` | landing page: title text, support links replaced by the About button |

### Not changed

The desktop launcher window (`app/launcher`) still shows the original name and logo. The account server's optional
Claude staff feature (`server-account/src/claudeStaff.js`) is left in; it does nothing unless a server enables it.

## Running from source

Daggerfall's game files are not included. You need your own copy of the `arena2` folder.

```
npm install
set ARENA2_PATH=C:\path\to\your\arena2
npm run dev
```

To build: `npm run build`. After changing code, rebuild before testing a built copy.

## Credits

Based on Daggerfall Enhanced by Lattymoy and Daggerfall Unity. Paperdoll art: Paperdoll Enhanced (check its license
before redistributing).
