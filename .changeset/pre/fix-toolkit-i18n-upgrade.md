---
'@pie-qti/section-player': patch
'@pie-qti/player-elements': patch
---

Section tool bars move to `@pie-players` 1.0.0-beta.9 and render in the interface language, with each locale's catalog loaded only when a tool bar needs it.

- **The tool packages are on 1.0.0-beta.9.** `pie-assessment-toolkit`, `pie-default-tool-loaders`, `pie-tool-tts-inline` and `pie-tool-calculator-desmos` move from 1.0.0-beta.6 to 1.0.0-beta.9. The section player also declares `pie-calculator-desmos`, `tts-client-server`, `@pie-players/pie-players-shared` and `@pie-players/pie-i18n-generated` as runtime dependencies, all at 1.0.0-beta.9.
- **The toolkit's chrome follows the interface locale.** In 1.0.0-beta.9 the toolkit's default provider ships English only. The tool bar now gives the toolkit a provider over the two pie-players catalog tiers, composed as pie-players documents: the bundled catalog first, then `@pie-players/pie-i18n-generated`. A Dutch interface reads "Voorlezen starten", and Arabic, Spanish, French, Romanian, Thai, Chinese and the other locales that package ships get their own toolkit chrome. A regional tag reaches its language (`es-MX` → `es`, `nl-BE` → `nl-NL`), and the toolkit's `lang` names the catalog it renders.
- **Catalogs load lazily, one locale at a time.** English is bundled and needs no fetch, so an English page loads nothing extra. The generated package is reached only through a dynamic `import()`, the first time a tool bar needs a non-English locale. Each locale's catalog is a chunk of its own, fetched only for that locale, and every tool bar on the page shares it. The catalog loads before the toolkit renders, so a non-English tool bar does not appear in English first.
- **A locale with no catalog falls back to English.** It renders the toolkit in English under its own tag. The pseudo-locales render English without fetching a catalog: `ar-XB` keeps its own `lang` and right-to-left `dir` instead of resolving to the Arabic catalog. If the generated package fails to load, tool bars render in English and the section player warns once.
