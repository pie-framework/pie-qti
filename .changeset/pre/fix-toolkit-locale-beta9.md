---
'@pie-qti/section-player': patch
'@pie-qti/player-elements': patch
---

No section label shows a raw i18n key.

- **A provider that misses a key no longer puts the key in a label.** The passage collapse control composes its name from the passage heading and an action verb. Under a host provider that answers a lookup without a default with the key, it read "Passage — assessment.collapsePassage". The section's labels now go through one helper that falls back to the English phrase whenever a provider hands back the key. That covers the passage, instructions, rubric and test feedback regions, the item heading and loading messages, the split-pane labels and resizer, and the display settings button and dialog. Some of these labels also rendered empty without a provider; they now read the English phrase.
