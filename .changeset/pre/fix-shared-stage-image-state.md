---
'@pie-qti/default-components': patch
---

The six graphic interactions (hotspot, select-point, graphic-order, graphic-associate, graphic-gap-match, position-object) share one module for the ImageStage sizing handshake (`createStageImage`): the stage's pixel space, the refusal to draw in an unknown space, the once-only author warning, and the frame/scale derivations. Each component keeps its own gate, which legitimately differ: the hotspot's image is mandatory, so it gates on the parsed interaction, while the others gate on their image data. Behaviour is unchanged except:

- **graphic-associate**'s stage frame no longer clamps to 4px wide while the image size is unknown (a drifted `?? 0` in its `max-width` style); like the other graphic interactions it just does not constrain the frame until the size arrives.
- **position-object**'s drag-image scale now reads the stage's reactive reported width (ImageStage `reportWidth`) instead of measuring the container at drag start — the same measurement, so drag images keep their size.
