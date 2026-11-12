---
'@pie-qti/default-components': patch
---

Icons and gap targets stay usable in engines that do not blur the Chromium path (found running the e2e suite in Safari/WebKit, Firefox, Chrome, Edge and Opera):

- **Icons render without host CSS**: the shared `Icon` component now carries intrinsic `width`/`height` attributes (24 = 1.5rem). A viewBox-only SVG has no intrinsic size and collapsed to 0×0 in WebKit whenever no CSS reached it; Chromium masked the hole with its own default-size heuristic. Call-site sizing utilities (`w-4 h-4` …) and the end-attempt interaction now carry them too, and the dead parent-scoped `.qti-icon*` rules (Svelte 5 never forwards a parent's scoping class onto a child component's root, so they matched nothing in any engine) are removed from order, graphic-order, graphic-associate, select-point and position-object.
- **Gap-match targets take focus on click**: clicking a blank now focuses it (`event.target.closest('button[data-gap-id]')`), so the focus ring and the next Tab stop follow the pointer in Safari, which never moves focus to buttons on click. The match interaction already did this for its own controls.
