---
'@pie-qti/default-components': patch
---

`parseJsonProp` — the reader behind every interaction's `interaction` (and PNP) attribute — returned non-JSON text as-is cast to the data type, contradicting its own contract of a prop whose value is always an object: a truncated attribute (`interaction='{"choices":…'`, what templating that cuts long attributes leaves behind) produced a string masquerading as the interaction data, rendering the interaction empty with no diagnostic. Text that does not parse to a JSON object (truncated attributes, and JSON of another shape — a number, string or array) is now reported once per distinct text on the console and read as no value, so the component renders its no-data state (`alert` with the no-data message) instead; the shells and every component already treat an absent interaction exactly that way. Components tests mount a truncated attribute and pin the no-data state, the one-per-distinct-text warning and an unaffected valid attribute.
