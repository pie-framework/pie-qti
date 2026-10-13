# QTI 3, Accessibility Content and Passages Plan

**Status**: In progress. The slice table below is the record; each slice's PR updates its row
**Last reviewed**: 2026-10-12
**Scope**: `packages/to-pie/`, `packages/qti-common/`, `packages/item-player/`,
`packages/pie-to-qti2/`

Brings QTI→PIE conversion up to the standard the RIACC accommodations work assumes: QTI 3.0
content converts, accessibility content arrives as PIE catalogs or is reported, and passages
arrive as passage entities instead of prompt text. The item player and the PIE→QTI export
follow the same catalog mapping, and the PNP leaves test content. The architecture PRD in
[`../prds/architecture/qti-to-pie.md`](../prds/architecture/qti-to-pie.md) describes current
behavior; this plan covers what changes and in what order.

---

## Slices

| #   | Slice                                             | Branch                              | PR   | State   |
| --- | ------------------------------------------------- | ----------------------------------- | ---- | ------- |
| 0   | This plan                                         | `docs/qti3-a11y-passages-plan`      | #271 | merged  |
| 1   | PNP out of content; AfA PNP 3.0                   | `fix/pnp-out-of-content`            | #273 | open    |
| 2   | Export reports the catalogs it drops              | `feat/pie-to-qti2-catalog-warnings` |      | pending |
| 3   | to-pie: QTI 3.0, accessibility catalogs, passages | `feat/to-pie-qti3-a11y-passages`    |      | pending |
| 4   | APIP in the item player and the export            | `feat/apip-catalog-mapping`         |      | pending |

States: `pending`, `in progress`, `open` (PR up, merge agent running), `merged`, `blocked`
(with a one-line reason under the slice).

---

## Position

Measured on 2026-10-12 against `develop` at `08e6463`.

**QTI 3.0.** `@pie-qti/to-pie` rejects every `qti-assessment-item` with
`QTI_VERSION_UNSUPPORTED` once no vendor transformer claims it.

**QTI 2.2 accessibility.** APIP (`apip:apipAccessibility`, `accessElement`, `spoken`,
`textToSpeechPronunciation`, `keyWordTranslation`) survives only inside
`metadata.qtiSource.xml`. Models carry no `accessibilityCatalogs`, markup carries no
`data-catalog-idref`, and the transform's `warnings` array is empty. Inline `ssml:*` elements
pass through raw into prompts.

**Passages.** Multiple-choice and extended-response split an `<object>` passage reference into
a `passage` model and set the item's `passage` reference. Without package context that model's
text is the placeholder `[External passage: <path>]`. EBSR keeps the `<object>` element in Part
A's prompt. Every transformer folds an inline passage into the prompt.

**PNP.** `assessment-test.ts` reads a non-QTI `personalNeedsProfile` element out of test
content and emits `activateAtInit`, which pie-players has removed. A PNP is per-candidate learner
data (AfA PNP 3.0), and [`../prds/systems/pnp.md`](../prds/systems/pnp.md) describes it as test
content. `item-player`'s `parsePnpXml` reads an invented shape.

**Item player.** `src/catalog/catalogLookup.ts` resolves QTI 3 catalogs; APIP appears only in a
comment. A host previewing source QTI with `item-player` shows none of an APIP item's
accessibility content, while the converted PIE item carries it after slice 3.

**Export.** `pie-to-qti2` has no catalog handling: `accessibilityCatalogs` and
`data-catalog-idref` do not reach the QTI output, and no generator warns.

---

## PIE Readiness

No PIE-side work blocks this plan.

- pie-players' `AccessibilityCatalog` / `CatalogCard` maps 1:1 onto `qti-catalog` /
  `qti-card`. `catalog` is QTI's `@support`, `language` the card entry's `xml:lang`, `content`
  the string form, and `payload` the structured form (`SpokenAudioCardPayload`,
  `SignLanguageCardPayload`). Catalogs attach at model (`PieModel`), item root (`ItemEntity`),
  passage (`PassageEntity`) and assessment level, keyed to content by `data-catalog-idref`,
  which `TTSService` reads.
- Passages are first-class: `ItemEntity.passage` takes an id or a `PassageEntity`, and section
  rubric blocks of class `stimulus` reference one by `passageVId`.
- pie-elements-ng's model sanitizer keeps `data-*` attributes, so idrefs survive rendering.
- Item tool mandates live on `AssessmentItemRef.settings.requiredTools`, the target for QTI 3
  companion materials.

---

## Decisions

**QTI 3 by normalization at the front door.** to-pie's entry point renames QTI 3 element and
attribute names into the 2.x vocabulary every transformer reads, because a native QTI 3 read
path would double the surface of all seventeen transformers. The attribute map is generated from
the vendored XSDs and lives in `qti-common`, replacing the hand-written QTI 3 mapping. QTI 3 is
validated against QTI 2.2 after normalization, since the normalized shape is what the
transformers convert, so no QTI 3 schemas are vendored.

**Accessibility as catalogs.** Every source accessibility construct becomes a pie-players
`AccessibilityCatalog` plus `data-catalog-idref`, attached at the narrowest level that owns the
referenced node: the model whose markup holds it, the item root for shared markup, the passage
for stimulus content. The QTI 3 catalog is the canonical shape; APIP and inline SSML are
translated into it.

**One APIP mapping.** The APIP ↔ catalog mapping lives in `qti-common`, and to-pie, the item
player and `pie-to-qti2` share it, so import, preview and export cannot disagree about which APIP
construct a catalog card is.

**No silent drop.** to-pie inventories every accessibility construct in the source. Each is
either mapped or reported under `QTI_ACCESSIBILITY_NOT_CARRIED`, naming the construct and its
count. Items also record the supports their content carries (`metadata.accessibility.supports`),
the content-coverage input the RIACC honor model needs.

**Passages as entities.** An item references its passage by a stable id derived from the
stimulus resource identifier. Passage content becomes a `PassageEntity`, converted once per
stimulus document, and the prompt carries the stem only. Inline passages are recognized by
source-profile rule, because QTI 2.2 has no standard inline stimulus marker. Lead-in that no rule
claims stays in the prompt, so nothing regresses to a drop. Paired passages become one
`PassageEntity` whose passage model lists each document in its `passages[]`, the entity's id
derived from the ordered source identifiers, because an item references one passage. A trade:
reusing one half alone needs its own entity.

**PNP out of content.** to-pie stops reading a PNP from test content and warns when the invented
element is present. AfA PNP 3.0 is parsed as a separate per-candidate input.

---

## Slice Detail

Each slice carries its tests, a patch changeset per touched published package, and the doc
updates its change implies, mainly the spec-version and mapping sections of `qti-to-pie.md` and
`docs/certification/public-coverage-matrix.json`.

### 1. PNP out of content; AfA PNP 3.0

- to-pie stops emitting `personalNeedsProfile` from test content, drops `activateAtInit`, and
  warns when the element is present.
- `item-player` parses AfA PNP 3.0
  (`http://www.imsglobal.org/xsd/qtiv3p0/imsafa3p0pnp_v1p0`). The invented shape goes, since
  pre-1.0 needs no deprecation window.
- `pnp.md` is corrected: a PNP is a per-candidate AfA document. Its AfA terms map onto
  pie-players tool ids through pie-players' `TOOL_REGISTRY.md` support-id table.

### 2. Export reports the catalogs it drops

- Every generator warns when the model, item or passage it exports carries
  `accessibilityCatalogs` or `data-catalog-idref`, naming the catalogs.
- Slice 4 turns the warning into APIP output.

### 3. to-pie: QTI 3.0, accessibility catalogs, passages

Inventory:

- An inventory pass finds APIP, inline `ssml:*`, `data-ssml`, `qti-catalog-info`,
  `data-catalog-idref`, `qti-companion-materials-info` and the shared-vocabulary hiding classes,
  plus `alt`/`aria-*` on nodes a transformer rewrites. Everything the output does not carry is
  reported under `QTI_ACCESSIBILITY_NOT_CARRIED`.
- `QTI_PASSAGE_UNRESOLVED` wherever a passage reference cannot be resolved.
- A corpus test: for every fixture, mapped plus reported equals found. A second test asserts
  that every non-whitespace item-body text node appears in the output or in a warning.

QTI 3.0:

- `normalizeQti3ToQti2` runs at to-pie's entry point, with prompt relocation into a sole
  interaction and in-place demotion of prompts inside layout columns.
- `qti-assessment-stimulus-ref` normalizes to QTI 2.2's `assessmentStimulusRef`, which the 2.2
  `assessmentItem` admits.
- Companion materials go to item metadata, and onto `AssessmentItemRef.settings.requiredTools`
  through the test transform where a pie-players tool id exists.
- Content marked `qti-visually-hidden` or `qti-hidden` never becomes visible: the
  shared-vocabulary stylesheet travels as an item stylesheet resource.
- `qti-assessment-test` converts through `assessment-test.ts`. PCI stays rejected under its own
  code: PIE has no PCI element.
- The QTI 3 rejection test in `plugin.test.ts` inverts; the vendor-claim test keeps vendor
  precedence.

Catalogs:

- QTI 3: `qti-catalog@id` → `identifier`, `qti-card@support` → `catalog`,
  `qti-card-entry@xml:lang` → `language`, `qti-html-content` → `content`, and `qti-file-href` →
  `payload`, resolved through the package asset map. `data-ssml` becomes a `spoken` card under a
  generated idref. An unrecognized `support` value is carried as-is and listed in
  `metadata.accessibility.supports`.
- APIP: each `apip:accessElement` becomes one catalog, and `contentLinkInfo@qtiLinkIdentifierRef`
  puts `data-catalog-idref` on the element with that `id`. `relatedElementInfo` children become
  cards under the support names QTI 3 uses: `spoken` (`textToSpeechPronunciation` preferred over
  `spokenText`, `audioFileInfo` as payload), `brailleText`, `signing`, `keyWordTranslation` (one
  card per language) and the remaining types the APIP XSD defines. A `textLink` to a word or
  character range wraps that range in a span carrying the idref. `inclusionOrder` has no
  pie-players counterpart and stays reported.
- Inline `ssml:*` leaves visible markup with its text kept, and becomes a `spoken` card on the
  enclosing block, in the shape pie-players' `SSMLExtractor` produces from `<speak>`.
- The test transform's non-QTI `accessibilityCatalog` / `catalogCard` reader is removed.

Passages:

- One `partitionItemBody`, used by every transformer and by the composite planner, splits the
  item body into passage regions, the stem, interactions and trailing content. Passage rules, in
  order: an `<object>` whose `data` resolves to a stimulus or passage resource,
  `assessmentStimulusRef`, then source-profile inline rules.
- Every transformer keeps only the stem in its prompt and sets the item's `passage`. The
  placeholder passage model goes.
- The package transform converts each stimulus document once, through
  `convertQtiPassageDocument`, and emits `PassageEntity` output beside the items, with model ids
  derived from the stimulus identifier so a re-import is stable. QTI 3 `qti-assessment-stimulus`
  catalogs land on `PassageEntity.accessibilityCatalogs`.
- The test transform's stimulus references reconcile with pie-players' section rubric blocks of
  class `stimulus`.

Done when every interaction fixture converts identically from its QTI 2.2 and QTI 3.0 forms, and
the inventory reports nothing on the APIP fixtures beyond `inclusionOrder`. Then cut a release.

### 4. APIP in the item player and the export

- `catalogLookup` resolves APIP access elements through the shared mapping, so a source preview
  shows the accessibility content the converted item carries.
- `pie-to-qti2` emits `apip:apipAccessibility` from catalogs whose supports APIP defines, with
  `contentLinkInfo` for each idref. Supports APIP lacks stay warned.

---

## Working Method

Slices run sequentially in the main checkout. There are no worktrees and no implementation
subagents; parallel branches over the same transformers would spend the time saved on conflict
resolution.

Per slice:

1. `git fetch origin`. Branch from `origin/develop`, or from the previous slice's branch while
   its PR is still open, so the new work builds on it.
2. Implement. Run `bun run lint:fix`, `bunx tsc --noEmit` and the affected tests, and add a
   patch changeset per touched published package.
3. Update this plan's slice row in the same PR, so the table on `develop` stays the record.
4. Push and open a PR against `develop`. The title and body are brief, per the repo's
   Conventional Commits convention.
5. Spawn a background merge agent for the PR (brief below), then start the next slice at once.
6. When the agent reports a merge, rebase the current branch onto `origin/develop`, and only
   then open its PR, so every PR's diff is its own slice. When the agent reports a failure,
   switch back, fix, push, and spawn a new agent.

Merge-agent brief:

- Wait for checks with `gh pr checks <n> --watch`. `All Checks Passed` is the aggregate gate.
- Merge with `gh pr merge <n> --merge --delete-branch`. Merge commits keep a stacked branch's
  base SHAs intact; a squash would turn every rebase onto `develop` into a conflict.
- On a red check, a conflict, or a requested change, do not merge. Report the failing check
  and the tail of its log.
- Use `gh` only and never touch the local checkout, so the agent cannot collide with the slice
  in progress.
- Report the merge commit SHA.

Releases: after slice 3 merges, cut a release per the repo's release process (`develop` →
`master`, changesets publish). Other slices ride the next regular release.

A session resumes from this table and `gh pr list --author @me --state open`.
