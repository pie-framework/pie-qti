---
'@pie-qti/default-components': patch
---

The hotspot and graphic-gap-match interactions bind the shared image stage's `renderedWidth` without enabling `reportWidth`, so the stage never reported its rendered width and the shared stage image pinned `renderScale` to 1: the markers, zone badges and the 24px touch-target compensation rendered unscaled whenever the image was shown below its natural size — the one situation the compensation exists for. Both interactions now pass `reportWidth`, mirroring graphic-order and position-object, and component tests pin the wiring (a half-scale stage compensates a region's touch target at the rendered scale, the hotspot marker counter-scales, and a full-size stage compensates only the shortfall).
