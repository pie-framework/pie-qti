---
'@pie-qti/qti-processing': patch
---

- **`<inside shape="default">` compiles.** The `default` shape is the entire area of the image and takes no coordinates, so `coords=""` or absent no longer throws "<inside> requires coords attribute"; every point evaluates inside it. Every other shape still requires its coords.
