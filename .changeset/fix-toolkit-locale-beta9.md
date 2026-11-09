---
'@pie-qti/section-player': patch
'@pie-qti/player-elements': patch
---

Section tool bars render in the interface language again, and no label shows a raw i18n key.

- **The tool bar's toolkit stays on `@pie-players` 1.0.0-beta.7.** The move to 1.0.0-beta.9 turned a Dutch interface's tool bar English ("Play reading" instead of "Voorlezen starten"), and with it every other toolkit label: tool names, read-aloud controls and tool panel controls. From 1.0.0-beta.9, `@pie-players/pie-players-shared` bundles only the English catalog and moves every other locale to the optional `@pie-players/pie-i18n-generated` package. The toolkit's own provider falls back to English, while it still stamps the requested `lang` and `dir`. The tool packages (`pie-assessment-toolkit`, `pie-default-tool-loaders`, `pie-tool-tts-inline`, `pie-calculator-desmos`, `tts-client-server` at 1.0.0-beta.7, `pie-tool-calculator-desmos` at 1.0.0-beta.6) are back at the versions that shipped before. Upgrading needs that package and a toolkit `i18n` provider whose catalog loader falls back to it.
- **A provider that misses a key no longer puts the key in a label.** The passage collapse control composes its name from the passage heading and an action verb. Under a host provider that answers a lookup without a default with the key, it read "Passage — assessment.collapsePassage". The section's labels now go through one helper that falls back to the English phrase whenever a provider hands back the key. That covers the passage, instructions, rubric and test feedback regions, the item heading and loading messages, the split-pane labels and resizer, and the display settings button and dialog. Some of these labels also rendered empty without a provider; they now read the English phrase.
