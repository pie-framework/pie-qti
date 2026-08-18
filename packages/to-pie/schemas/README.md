# Vendored QTI XSDs

`qti/` holds the official IMS QTI schemas and their **entire** transitive
import closure — 48 files, 3.6 MiB, spanning four upstream hosts
(`imsglobal.org`, `w3.org`, plus the MathML and SSML trees they pull in).

Regenerate with:

```sh
bun run packages/to-pie/scripts/fetch-qti-schemas.ts packages/to-pie/schemas/qti
```

The committed files are the source of truth; the script exists so the set is
reproducible (it currently reproduces this directory byte-for-byte), not so it
runs at build or validation time.

## Why the files are not verbatim upstream copies

Two transformations are applied at vendoring time, both required for the
schemas to be usable offline:

- **`schemaLocation` is rewritten to a flat local basename.** libxml2 resolves
  `schemaLocation` literally, so upstream's absolute `http://…` locations would
  send it to the network — which fails closed inside the wasm sandbox the gate
  runs in. Rewriting is what makes "no network fetch at validation time" true
  rather than aspirational.
- **Encodings are normalized to UTF-8.** `XInclude.xsd` ships as UTF-16LE with
  no charset header and xmllint reads UTF-8 only; left alone it fails to parse
  and takes the whole schema compile down with it.

Basenames are suffixed on collision (`tokens.xsd` / `tokens-2.xsd`) because
MathML 2 and MathML 3 each ship a distinct schema under the same name.

## Roots

| Root | Namespace | Corpus share |
| --- | --- | --- |
| `imsqti_v2p1.xsd` | `…/xsd/imsqti_v2p1` | 9,023 packages (53%) |
| `imsqti_v2p2.xsd` | `…/xsd/imsqti_v2p2` | 237 packages (1.4%) |

QTI 2.1 is what partner content overwhelmingly declares; 2.2 is rare. There is
deliberately **no QTI 3 root here** — QTI 3.0 content is judged against 2.2
after lexical normalization rather than against QTI 3 schemas. ADR 004
§ "Validity gates" records that decision and why.

## Cost

The compile dominates, and it is **per schema compile, not per document** — so
validation is batched per package, and validating one item costs the same as
validating 200. The two roots are not remotely equal, though:

| Root | Compile | Why |
| --- | --- | --- |
| `imsqti_v2p1` | **~0.58s** | pulls MathML 2 only |
| `imsqti_v2p2` | **~3.07s** | pulls MathML 3 *and* HTML5, SSML and APIP |

Since QTI 2.1 dominates real partner content, the typical package pays the cheap
one. QTI 3.0 pays the 2.2 price, because normalization rewrites it into the 2.2
namespace before it is judged.

`QtiValidator.validateBatch` is the supported entry point for anything more than
a single document; a per-item loop would multiply the compile cost by the item
count.
