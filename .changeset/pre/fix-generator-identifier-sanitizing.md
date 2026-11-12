---
'@pie-qti/pie-to-qti2': patch
---

The categorize, match-list, image-cloze-association and drag-in-the-blank generators interpolated raw PIE ids and values into `identifier="…"` attributes and `directedPair` correct responses. An id containing a double quote terminated the attribute early, so the rest of the id re-parsed as arbitrary attributes on the element, and an id containing a space split a `directedPair` value into mismatched identifiers, corrupting the correct response. These generators now run the same identifier sanitizing their siblings use (`prefixedIdentifier`/`generateIdentifier`), applied identically to the item body and the response declaration so the pairs still match. Output for well-formed ids is unchanged, byte for byte.
