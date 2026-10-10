---
"@pie-qti/to-pie": patch
"@pie-qti/pie-to-qti2": patch
"@pie-qti/transform-types": patch
---

pie-to-qti2 output now validates against the QTI 2.2 XSD and is scorable: generators match tag-named models through `config.elements`, place `prompt` inside the interaction, declare `SCORE` and `MAXSCORE` with response processing, export every interaction of a multi-interaction item, write rubrics as a `rubricBlock`, and re-serialize authored HTML as XML.

Breaking for pie-to-qti2: the PIE item travels in a `.pie.json` sidecar listed under the item's package resource, in place of the embedded `pie:sourceModel` and `qti-metadata`, and the `pie-extension-embedder` exports are removed.

Embedded sources are used only while the content beside them is unchanged: to-pie checks the sidecar's `qtiDigest` and warns `PIE_SOURCE_STALE` on a mismatch, and pie-to-qti2 regenerates QTI once a config no longer has the `configDigest` to-pie recorded. Sources written by earlier releases carry no digest and are treated as stale.

to-pie keeps both the stem before an interaction and the interaction's `<prompt>`, and EBSR Part B gets the content between its two interactions. It removes QTI feedback it does not map, which rendered inside choice labels and prompts, and reports it as `QTI_FEEDBACK_DROPPED`. `validateQti` rejects XML that is not well-formed as a fatal error, also with `xsd: false`.

Item `baseId` and `searchMetaData` are also written as IEEE LOM on the item's manifest resource, which to-pie reads back when no fresh sidecar is present. The manifest's `imsmd` prefix moves from `imsmd_v1p2` to the IEEE LOM namespace the QTI 2.2 packaging profile admits, and resource metadata keys other than `title`, `description` and `language` are no longer written.

The to-pie README no longer lists QTI 3.0 input, which is rejected.
