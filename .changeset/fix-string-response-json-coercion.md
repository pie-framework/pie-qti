---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
---

String answers that look like JSON are no longer rewritten. The interactions JSON-parsed every string `response` and `correctResponse` the host set, so an extended text field rewrote a typed `1.50` to `1.5` and `1e5` to `100000` while the candidate typed, dropped the quotes of `"quoted"`, turned `[1]` into `1`, and lost the answer `null`; a choice, hottext or hotspot region identified `true`, `false` or `null` lost its selection, and a portable custom interaction got its JSON-text response back as an object. Responses are now values: a string response is kept exactly as given, and only `null` means no response. The identifier-list interactions (order, match, associate, gap match, the graphic interactions, a multiple-selection hotspot) still read the JSON array an HTML attribute carries as that list. The interaction data and the PNP profile still accept their JSON text, as an HTML attribute carries it. Upload and drawing no longer type their `response` prop as `| string`.

Extended text interaction data whose `base` is absent or not an integer from 2 through 36 is now read in base 10: showing a numeric response no longer throws (it crashed the field, and the text entry's string companion), and a typed number is no longer dropped.
