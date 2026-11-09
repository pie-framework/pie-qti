---
'@pie-qti/default-components': patch
---

- **sliderInteraction**: a vertical slider (`orientation="vertical"`) now tells assistive technology it is vertical (`aria-orientation="vertical"` on the range input). It was turned only through CSS, so screen readers announced it as horizontal (WCAG 4.1.2).
