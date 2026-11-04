---
'@pie-qti/default-components': patch
---

Extract the duplicated hotspot rendering into a shared `HotspotShape` component: one place now owns the QTI shape/coords geometry conventions (`circle` cx,cy,r; `ellipse` cx,cy,rx,ry; `rect` left,top,right,bottom; `poly` point pairs), the accessible-button attribute set (role, tabindex, aria-label, aria-pressed), and the activation/drag event wiring for SVG hotspot regions. The hotspot and graphic-gap-match interactions render through it (each keeps its own state→color mapping); the graphic-associate interaction dedupes its four hand-copied hotspot-button blocks into a single snippet parameterized by per-shape geometry. No behavioral change intended; the full component suite passes unchanged, and hotspot coverage now also asserts the rendered shapes are real SVG elements.
