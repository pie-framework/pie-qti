---
'@pie-qti/qti-processing': patch
'@pie-qti/ims-cp-core': patch
'@pie-qti/item-player': patch
'@pie-qti/assessment-player': patch
---

Resolve external QTI processing fragments during packaged assessment delivery.

`xi:include` fragments referenced by an item's `responseProcessing`, `templateProcessing`, or `outcomeProcessing` are now preloaded from the content package during reference-mode assessment parsing and executed through a package-contained resolver, so packaged fragments work without host wiring. Nested includes resolve relative to the fragment that references them, and authored `xi:fallback` content runs when a fragment file is missing. The processing engine now requires the XInclude namespace for `include` and `fallback` elements and fails loudly when another vocabulary uses those local names. Test-scope (`scope: 'test'`) fragments still require a host-supplied resolver and fail closed, unchanged.
