---
"@pie-qti/qti-processing": patch
---

Move the Node XML parser to `@xmldom/xmldom` 0.9. Where no native `DOMParser` exists, XML that is not well-formed — a raw `<` in an attribute value, a second XML declaration — now throws a `ParseError` instead of yielding a partial document, matching what browsers already did.
