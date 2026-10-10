# IMS Content Packaging and LOM XSDs

Test fixtures for the manifest schema test. `imscp_v1p1.xsd` (with its imports `imsmd_v1p2p4.xsd` and
`xml.xsd`) and `imsmd_loose_v1p3p2.xsd` are the IMS Global schemas as distributed in
[oat-sa/qti-sdk](https://github.com/oat-sa/qti-sdk/tree/be6ea2d4b5bac5954202e1d97b3edf557cbb9af4/src/qtism/data/storage/xml/schemes),
with each `schemaLocation` rewritten to a local basename so validation never reaches the network.
`manifest-root.xsd` imports CP and IEEE LOM together.

The QTI 2.2 packaging profile a generated manifest names, `qtiv2p2_imscpv1p2_v1p0.xsd`, admits IEEE
LOM as a resource's metadata; these schemas check the CP structure and the LOM content.
