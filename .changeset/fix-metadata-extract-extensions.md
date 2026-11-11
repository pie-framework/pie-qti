---
'@pie-qti/to-pie': patch
---

`extractExtensions` no longer silently discards a `pie:sourceModel` whose JSON is malformed: it now throws a content error naming the problem, like `extractPieExtension` does. The Priority-1 branch also actually parses CDATA-wrapped source models now (its `textContent` read kept the CDATA wrapper, so `JSON.parse` never succeeded and the old swallow hid that a valid embedded `extensions` object was being dropped in favor of the QTI metadata).

Breaking: `extractExtensions` throws on a present-but-malformed `pie:sourceModel` where it previously fell through to the QTI metadata without a signal.
