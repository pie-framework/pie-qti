---
'@pie-qti/to-pie': patch
---

Two fixes in the QTI → PIE readers:

- `extractPieExtension` no longer reports a legacy `<pie:sourceModel>` holding malformed JSON as "no extension present". The element was present, so the interaction's custom data existed and was silently dropped, indistinguishable from an item with no extension; the extraction logged to the console and returned `{ sourceModel: null, hasExtension: false }`. A present element whose JSON does not parse now throws the package's established content-failure error naming the interaction (`pie:metadata` `elementType`) and the item identifier, with the `JSON.parse` failure and a content excerpt. An absent element and an empty (or `<![CDATA[]]>`-only) element still read as no extension, without an error. **Breaking:** callers of the public `extractPieExtension` util that relied on malformed embedded JSON reading as "no extension" now get a thrown error from that item's content.

- A candidate `rubricBlock`'s `class` attribute is re-emitted escaped into the `<div>` that replaces it. The parsed attribute value is entity-decoded, so a class containing a double quote re-emitted raw broke out into additional attributes on the div; it is now escaped with the package's `escapePieAttribute`, so the value round-trips as one attribute.
