---
'@pie-qti/item-player': patch
---

Security fix in the catalog entry lookup: an entry that merely ends in a filename-looking token (for example `<img src=x onerror=…>see photo.png`) took the URL branch of `catalogEntryOf` and reached the fallback catalog popup's `body.innerHTML` and the `qti-catalog-lookup` event unsanitized, because the URL sniff tested only the string's end and the default URL policy passes scheme-less values through. The new exported `isCatalogUrl` predicate routes an entry through the URL branch only when it is markup-free and matches a URL shape; everything else crosses `sanitizeHtml` like any HTML entry, and a blocked URL yields null per the sanitizer contract. The fallback popup now reuses the same predicate for its img-vs-HTML decision instead of its own divergent regex, so the `qti-catalog-lookup` event only ever carries `sanitizeHtml` output or a `sanitizeResourceUrl` result.
