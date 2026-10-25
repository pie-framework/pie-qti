---
"@pie-qti/default-components": patch
"@pie-qti/item-player": patch
"@pie-qti/assessment-player": patch
"@pie-qti/section-player": patch
---

Player chrome and interaction layout use logical CSS properties, so they mirror under `dir="rtl"`, and horizontal order lists move items with the arrow keys in the inline direction. `AssessmentTimer` accepts `top-end`/`top-start`/`bottom-end`/`bottom-start` and defaults to `top-end`; the physical values keep working.
