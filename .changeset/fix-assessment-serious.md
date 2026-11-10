---
'@pie-qti/assessment-player': patch
---

Assessment player fixes:

- **`timeWarningThreshold: 0` turns the default warning off.** It used to fall back to 60 seconds (an `||` fallback); `0` now means no default warning, while `timeWarningThresholds` still fire. Unset keeps the 60-second default.
