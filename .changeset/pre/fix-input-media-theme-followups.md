---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/theme-daisyui': patch
'@pie-qti/i18n': patch
---

Follow-ups to the media, extended text and theme fixes: typable negative answers on phones, inline video on iOS, a PNP spell-check grant, validated PNP colours, and state text contrast on tinted DaisyUI themes.

**Text entry and extended text (numeric keyboards)**

- A numeric virtual keyboard (`inputmode="numeric"`/`"decimal"`) is now requested only when the authored `patternMask` provably excludes `-` (for example `^[0-9]+$`): phone number pads have no minus key (nor an exponent), so a candidate with a negative answer could not have typed it. Every other numeric response keeps the default text keyboard, in both the inline text entry and the extended text interaction.
- The candidate's PNP spell-check grant (AfA PNP 3.0 `spell-checker-on-screen`, parsed into `cognitive.spellChecker`) now enables spell check and autocorrect in the extended text interaction, like the `spellcheck` prop does; the item body passes the profile to every interaction as the `pnp` prop.

**Media (`pie-qti-media`)**

- Video is always rendered `playsinline` (plus `webkit-playsinline` for pre-iOS-10 WebViews), so iOS playback stays in the page instead of taking over the display in fullscreen and hiding the question. Under a play limit the component still offers no fullscreen control; without a limit the native controls may offer one, which cannot break `maxPlays` enforcement (play events still fire in the page).

**PNP application**

- Colours in the JSON PNP profile (`display.invertPolarity` foreground/background, `display.textAppearance` `fontColor`/`backgroundColor`) are validated with `CSS.supports('color', …)` before being applied; an invalid colour is ignored with a console warning instead of wiping what the custom property styles (focus outlines, control borders). Environments without a CSS engine apply every value as before.

**DaisyUI bridge (`@pie-qti/theme-daisyui`)**

- Message/state text tokens (`--pie-qti-error-text`, `--pie-qti-warning-text`, `--pie-qti-success-text`, `--pie-qti-info-text`) now clear 4.5:1 against the base surfaces of every stock DaisyUI theme in current browsers: in the relative-colour tier each fixed value is darkened (light themes) or lightened (dark themes) in linear light just far enough, and values that already pass (the amber warning text) are kept. Engines without relative colour syntax keep the fixed values, which hold on neutral surfaces only. The JavaScript mapping mirrors the tier.

**i18n**

- Removed the unused `interactions.extendedText` math-dialog keys left behind by the MathLive rework (`insertMath`, `enterMathExpression`, `latexSource`, `keyboard`, `update`, `insert`) and the unused `interactions.media.remaining`, in all eight locales.
