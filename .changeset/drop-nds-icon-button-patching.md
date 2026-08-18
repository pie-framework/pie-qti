---
'@pie-qti/section-player': patch
---

Drop the `nds-icon-button` icon patching, which no longer has anything to patch.

`QtiToolButtonBar` carried ~130 lines that walked open shadow roots, found vendored
`nds-icon-button` elements and FontAwesome `<i class="fa-*">` icons, and injected inline SVG
in their place, driven by a `MutationObserver` plus three timers. It existed because the
toolkit rendered NDS icon buttons whose FontAwesome Pro glyphs 404 against a host that does
not serve `/_fa-pro/`, leaving blank buttons.

Those icons are licensed to Renaissance products only, so PIE-785 made them opt-in behind
`ndsIcons` in 0.3.59 and made plain `<button>` the default. This repo never opts in, so no
`nds-icon-button` is rendered and the patching had no targets — dead since the family moved
to 0.3.67.

The stylesheet suppression stays. `ensureFontAwesomeFallbackMarker()` is independent of the
opt-in: the toolkit injects FontAwesome on import, not on the decision to render vendored
buttons, so removing it brought the `/_fa-pro/` 404s straight back. It is now documented as
load-bearing and the e2e guard that caught it is kept.
