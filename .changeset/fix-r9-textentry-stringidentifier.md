---
'@pie-qti/item-player': patch
'@pie-qti/qti-processing': patch
---

- **textEntryInteraction@stringIdentifier is implemented** (QTI 2.1/2.2 ASI §5.122.3; `string-identifier` in QTI 3.0). A text entry bound to a numeric response can also capture the text as entered in a companion string response: typing "3.50" sets the float response to 3.5 and the named string response to "3.50" (with `base="2"`, "101" where the integer response is 5); an empty field gives NULL. Response processing can score that text with `stringMatch`, and a restored session shows it in the field instead of the coerced number. Completion and validation still read the main response only, and a `stringIdentifier` that repeats `responseIdentifier` or names no declared response is ignored, as extendedTextInteraction already does.
- **`<inside shape="default">` compiles.** The `default` shape is the entire area of the image and takes no coordinates, so `coords=""` or absent no longer throws "<inside> requires coords attribute"; every point evaluates inside it. Every other shape still requires its coords.
