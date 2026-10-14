# Vendored QTI 3.0 XSDs

`qti3/` holds the IMS QTI 3.0 Final Release schemas: the ASI root
(`imsqti_asiv3p0_v1p0.xsd`), the QTI 3 content-packaging profile
(`imsqtiv3p0_imscpv1p2_v1p0.xsd`) and their import closure. They are test
fixtures, not part of the published package: the element-map conformance test
reads the ASI vocabulary from them, and the pie-to-qti2 QTI 3.0 export gate
validates against them.

Regenerate from a checkout of
[1EdTech/qti-documentation](https://github.com/1EdTech/qti-documentation)
(`qti-v3p0/Final Release/xsds`, read at commit `16bf8f3`):

```sh
bun run packages/qti-common/scripts/vendor-qti3-schemas.ts "<qti-documentation>/qti-v3p0/Final Release/xsds"
```

## Transformations

- **Annotations are stripped** except the first in each file, which carries the
  1EdTech IPR and distribution notice. The ASI schema drops from 19 MB to 0.6 MB.
- **`schemaLocation` is a flat local basename**, so libxml2 resolves imports
  from this directory and never reaches for the network.
- **`mathml3.xsd` and `ssmlv1p1-core.xsd` are stubs** declaring `math` and the
  twelve SSML elements the ASI schema references, with skipped content. The
  MathML 3 and SSML copies in `packages/to-pie/schemas/qti` use IMS's modified
  2010 namespaces, which QTI 3 does not import. A deliberate trade: no
  dependency on the W3C trees, at the cost of embedded MathML and SSML going
  unchecked.
- `xml.xsd`, `XInclude.xsd` and `xlink.xsd` (from `xlink-href.xsd`) are copied
  from `packages/to-pie/schemas/qti`; `imsmd_loose_v1p3p2.xsd` (IEEE LOM) from
  the pie-to-qti2 IMS CP fixtures.

The ASI schema compiles in about 150 ms. Its interactions carry
`xs:anyAttribute namespace="##any"`, so a leftover QTI 2 camelCase attribute
validates; the export gate checks attribute names separately.
