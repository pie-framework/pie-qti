---
'@pie-qti/i18n': patch
'@pie-qti/item-player': patch
'@pie-qti/assessment-player': patch
---

Locales negotiate by language to catalogs keyed `en`, `ar`, `es`, `fr`, `nl`, `ro`, `th` and `zh-Hans` (the old regional codes stay valid inputs, the `./locales/*` file names follow the new keys), and both players default to an English provider. The package no longer reads a stored locale: hosts relying on the provider restoring its stored locale and reloading the page must now opt in with `persistLocale` and `reloadOnLocaleChange` and read the key at startup.
