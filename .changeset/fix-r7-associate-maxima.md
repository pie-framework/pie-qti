---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/i18n': patch
---

Associate and graphic gap-match interactions now enforce the QTI association maxima in the component instead of letting an over-limit response reach a submit that response validation rejects (WCAG 3.3.1/3.3.2):

- **associateInteraction**: a pairing that would pass the interaction's `maxAssociations` or either choice's `matchMax` is refused with a polite live-region announcement ("Association not possible: the limit of {max} is reached." / "Not possible: {label} cannot be in more associations."). Maxed choices carry `aria-disabled` and stay focusable (never `disabled`, so focus cannot fall off the activated control), deselecting the pending choice stays possible at a cap, and the helper text names the interaction cap up front ("You can make up to {count} associations."). Both caps are re-checked when a pair is completed, so a selection arriving through the `selectedForPairing` prop obeys the same rules.
- **graphicGapMatchInteraction**: a placement (pointer drop or keyboard) whose response would exceed `maxAssociations` is refused and announced; the author's `data-max-selections-message` wins over the localized message, and a keyboard-held label stays held on refusal. Replacing a placed label within the cap is still allowed.
- **i18n**: new keys in `interactions.associate` (`maxAssociationsHint`, `choiceLimitReached`, `associationLimitReached`) and `interactions.graphicGapMatch` (`associationLimitReached`) across all 8 locales.
- **Extractor default**: the associate extractor now applies the spec default `maxAssociations = 1` for an absent attribute (QTI 2.1 XSD `default="1"`, QTI 2.2 Table 5.6.2, QTI 3.0 Table 5.8.2). The graphic-gap-match extractor deliberately keeps `0` (= unlimited) for absent attributes — documented divergence from the 2.2/3.0 default of 1 (2.2 Table 5.41.2, 3.0 Table 5.60.2) so items authored without the attribute keep their delivered behaviour; author the attribute explicitly for strict conformance.
