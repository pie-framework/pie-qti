---
'@pie-qti/section-player': patch
'@pie-qti/item-player': patch
'@pie-qti/player-elements': patch
'@pie-qti/i18n': patch
---

Accommodations and tools in the section player.

- **Display accommodations cover the whole section.** A section layout (`SectionPlayerSplitPane`, `SectionPlayerVertical` and their custom elements) applies the candidate's PNP display needs — colour scheme, inverted polarity, single-column layout, text appearance, magnification metadata — to its own root, a PNP surface, so passages, stimuli, rubric blocks, tool bars, the Passage/Question tabs, item headers and items all take them. The host page outside the layout is never repainted. Item bodies inside a surface leave their display needs to it, so one profile governs passage and question and an inverting filter applies once. A single-column need stacks the split pane behind its tabs at any width. The layouts apply their `pnp` prop, else the new `ResolvedQtiSectionComposition.pnp`, which `resolveQtiSectionComposition` now carries along with `assessmentId`.
- **Candidates can adjust their display.** A "Display settings" button in the item tool bar opens an accessible native modal on the section surface: text size (Default, Large, Larger, Largest), higher-contrast text and extra text spacing, applied through the PNP mechanisms (`withDisplaySettings`). Settings last for the page session per assessment, also across a split-pane/vertical layout swap, and every change reaches the host as `{ sectionIdentifier, settings, pnp }` through the layouts' `onDisplaySettingsChange` and `QtiSectionRuntimeHostContract.onDisplaySettingsChange`, with the effective profile to persist. `displaySettings={false}` leaves the tool out; `initialDisplaySettings` and `displaySettingsOf()` restore persisted settings.
- **Ruler and protractor render.** The tool bars register the packaged `ruler` and `protractor` tools, so the measurement tools the PNP and an item's companion materials grant are no longer granted but invisible. Companion materials become the item scope's required tools, and section-scoped tools render on the active item's tool bar.
- **Tool bars bind the real assessment, with PNP enforcement on.** The hardcoded `qti-section-demo` id is gone: the toolkit takes the composition's `assessmentId` (else the section identifier) and the candidate's PNP tool supports as its profile, so granted tools are protected and prohibited ones withdrawn.
- `@pie-qti/item-player` exports `applyPnpToSurface`, `clearPnpSurface`, `isWithinPnpSurface` and `PNP_SURFACE_ATTRIBUTE` for hosts that paint a larger surface themselves.
- New catalog keys `sectionPlayer.displaySettings.*` in every locale.
