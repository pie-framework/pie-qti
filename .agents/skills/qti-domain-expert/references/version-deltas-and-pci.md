# QTI Version Deltas (2.1 / 2.2 / 3.0) & PCI (pie-qti reference)

Distilled, citable reference for reasoning about QTI versions in pie-qti — a QTI **player + scoring engine + QTI↔PIE conversion** library that must consume QTI 2.1, 2.2, and 3.0 and render/score/convert them uniformly. This doc supports two jobs:

1. **DETECT** which QTI version a package/item is.
2. Know the **NORMALIZATION / rename mapping** needed so one code path can handle 2.x and 3.0 (and convert between QTI and PIE).

Sources: the 1EdTech QTI 3.0 Final Release migration guide, overview, ASI info model, shared vocabulary, and PCI v1.0 Candidate Final. Items marked `[inferred]` are not stated outright. Cross-check against the sibling reference players (`../qti3-item-player`, `../qti-components`, `../qti-scoring-engine`) for how each construct is actually handled.

> The migration guide is specifically **APIP → QTI 3.0** (PNP/accessibility) and notes it does not cover changes outside `itemBody`/`apipAccessibility`. It is authoritative for the **naming-convention rule and element sequence**; the full interaction rename table is grounded in the **ASI info model**.

---

## 1. Version detection signals

Detect from the **XML namespace** first (most reliable), then root element / version attribute, then the **manifest resource `type`** string, then filename markers.

### XML namespaces (default `xmlns` on the root element)

| Version | Item/ASI namespace | Notes |
|---|---|---|
| QTI 2.1 | `http://www.imsglobal.org/xsd/imsqti_v2p1` | item & test share this NS |
| QTI 2.2 | `http://www.imsglobal.org/xsd/imsqti_v2p2` | `schemaLocation` often points at `imsqti_v2p2p1.xsd` / `imsqti_v2p2p2.xsd` for 2.2.x dot releases |
| QTI 3.0 | `http://www.imsglobal.org/xsd/imsqtiasi_v3p0` | note the **`asi`** infix (Assessment, Section, Item merged model) |
| PCI v1.0 | `http://www.imsglobal.org/xsd/portableCustomInteraction` | namespace of the `pci:` prefix **inside** a 2.x item (see §5) |
| AfA 3.0 PNP | `http://www.imsglobal.org/xsd/qtiv3p0/imsafa3p0pnp_v1p0` | candidate prefs, not item content |

`schemaLocation` carries a second copy of the same URI plus an `.xsd` filename — useful as a secondary check, but the **default namespace is the canonical signal**.

### Root element

| Version | Item root | Test root |
|---|---|---|
| 2.1 / 2.2 | `assessmentItem` (camelCase) | `assessmentTest` |
| 3.0 | `qti-assessment-item` (kebab, `qti-` prefix) | `qti-assessment-test` |

The **camelCase-vs-`qti-`-prefixed root element alone classifies 2.x vs 3.0** even without the namespace. There is no per-element `version` attribute on items; 2.1 vs 2.2 is distinguished by namespace.

### Manifest (`imsmanifest.xml`) resource `type` strings

Content Packaging manifests still use camelCase (CP standard, not QTI):

| Version | Item resource type | Test resource type | Stimulus resource type |
|---|---|---|---|
| 2.1 | `imsqti_item_xmlv2p1` | `imsqti_test_xmlv2p1` | — |
| 2.2 | `imsqti_item_xmlv2p2` | `imsqti_test_xmlv2p2` | `imsqti_stimulus_xmlv2p2` |
| 3.0 | `imsqti_item_xmlv3p0` | `imsqti_test_xmlv3p0` | `imsqti_stimulus_xmlv3p0` |

> The packaging manifest **keeps camelCase naming** even for 3.0 content (it follows IMS Content Packaging 1.x, not QTI). So a 3.0 package = camelCase `imsmanifest.xml` referencing kebab-case `qti-...` item XML.

### Detection precedence (recommended)

1. Item/test default `xmlns` → version. **Authoritative.**
2. Root element name (`assessment*` vs `qti-assessment-*`) → 2.x vs 3.0 fallback.
3. Manifest resource `type` (`...v2p1` / `v2p2` / `v3p0`).
4. Filename/`schemaLocation` markers (`imsqti_v2p2p1.xsd`, `imsqtiasi_v3p0...`) — weakest, only to disambiguate 2.2 dot releases.

---

## 2. The 3.0 naming change (camelCase → kebab-case with `qti-`) — THE key fact

> **The single most important normalization fact.** QTI 3.0 renamed essentially every QTI-defined element from camelCase to lower-case, dash-separated ("kebab") names with a **`qti-` prefix** (web-components-friendly naming). The migration guide states it directly: non-HTML QTI elements gain the `qti-` prefix (e.g. `<prompt>` → `<qti-prompt>`).

### Systematic rules

- **Elements:** camelCase → kebab-case **and** prepend `qti-`. `choiceInteraction` → `qti-choice-interaction`, `responseDeclaration` → `qti-response-declaration`.
- **Attributes:** camelCase → kebab-case **but no `qti-` prefix**. `timeDependent` → `time-dependent`, `responseIdentifier` → `response-identifier`, `baseType` → `base-type`, `maxChoices` → `max-choices`.
- **Vocabulary / enumerated attribute *values* stay camelCase.** e.g. `cardinality="single"`, `base-type="point"`, `view="candidate"`, mapping/operator vocab values are unchanged. Only element & attribute *names* change.
- **HTML elements are not prefixed** (`<p>`, `<span>`, `<img>`, `<table>` stay as-is); only QTI-defined elements get `qti-`.

Because the transform is mechanical and reversible, one name map normalizes 3.0 ↔ a canonical camelCase shape (or 2.x → canonical kebab); everything else below is the list of cases where the mapping is *not* purely mechanical.

### Common element mappings (2.x camelCase ↔ 3.0 kebab) — grounded in the ASI info model

Declarations / structure:

| 2.x | 3.0 |
|---|---|
| `assessmentItem` | `qti-assessment-item` |
| `assessmentTest` | `qti-assessment-test` |
| `responseDeclaration` | `qti-response-declaration` |
| `outcomeDeclaration` | `qti-outcome-declaration` |
| `templateDeclaration` | `qti-template-declaration` |
| `correctResponse` | `qti-correct-response` |
| `mapping` / `mapEntry` | `qti-mapping` / `qti-map-entry` |
| `areaMapping` | `qti-area-mapping` |
| `defaultValue` / `value` | `qti-default-value` / `qti-value` |
| `itemBody` | `qti-item-body` |
| `prompt` | `qti-prompt` |
| `stylesheet` | `qti-stylesheet` |
| `rubricBlock` | `qti-rubric-block` |
| _(new in 3.0)_ | `qti-context-declaration` |
| _(new in 3.0)_ | `qti-catalog-info`, `qti-catalog`, `qti-card`, `qti-html-content` |
| _(new in 3.0)_ | `qti-assessment-stimulus-ref`, `qti-companion-materials-info` |

Interactions:

| 2.x | 3.0 |
|---|---|
| `choiceInteraction` / `simpleChoice` | `qti-choice-interaction` / `qti-simple-choice` |
| `orderInteraction` | `qti-order-interaction` |
| `associateInteraction` / `simpleAssociableChoice` | `qti-associate-interaction` / `qti-simple-associable-choice` |
| `matchInteraction` / `simpleMatchSet` | `qti-match-interaction` / `qti-simple-match-set` |
| `inlineChoiceInteraction` | `qti-inline-choice-interaction` |
| `textEntryInteraction` | `qti-text-entry-interaction` |
| `extendedTextInteraction` | `qti-extended-text-interaction` |
| `hottextInteraction` / `hottext` | `qti-hottext-interaction` / `qti-hottext` |
| `gapMatchInteraction` / `gap` / `gapText` | `qti-gap-match-interaction` / `qti-gap` / `qti-gap-text` |
| `hotspotInteraction` / `hotspotChoice` | `qti-hotspot-interaction` / `qti-hotspot-choice` |
| `selectPointInteraction` | `qti-select-point-interaction` |
| `positionObjectInteraction` / `positionObjectStage` | `qti-position-object-interaction` / `qti-position-object-stage` |
| `graphicOrderInteraction` | `qti-graphic-order-interaction` |
| `graphicAssociateInteraction` | `qti-graphic-associate-interaction` |
| `graphicGapMatchInteraction` / `associableHotspot` | `qti-graphic-gap-match-interaction` / `qti-associable-hotspot` |
| `sliderInteraction` | `qti-slider-interaction` |
| `drawingInteraction` | `qti-drawing-interaction` |
| `mediaInteraction` | `qti-media-interaction` |
| `uploadInteraction` | `qti-upload-interaction` |
| `endAttemptInteraction` | `qti-end-attempt-interaction` |
| `customInteraction` | `qti-custom-interaction` / `qti-portable-custom-interaction` (see §5) |

Response / outcome / template processing:

| 2.x | 3.0 |
|---|---|
| `responseProcessing` | `qti-response-processing` |
| `responseCondition` / `responseIf` / `responseElseIf` / `responseElse` | `qti-response-condition` / `qti-response-if` / `qti-response-else-if` / `qti-response-else` |
| `responseProcessingFragment` | `qti-response-processing-fragment` |
| `setOutcomeValue` / `lookupOutcomeValue` | `qti-set-outcome-value` / `qti-lookup-outcome-value` |
| `setCorrectResponse` / `setTemplateValue` | `qti-set-correct-response` / `qti-set-template-value` |
| `outcomeProcessing` / `outcomeCondition` / `outcomeIf` | `qti-outcome-processing` / `qti-outcome-condition` / `qti-outcome-if` |
| `templateProcessing` / `templateCondition` / `templateConstraint` | `qti-template-processing` / `qti-template-condition` / `qti-template-constraint` |
| `matchTable` / `matchTableEntry` | `qti-match-table` / `qti-match-table-entry` |
| `match` / `stringMatch` / `patternMatch` | `qti-match` / `qti-string-match` / `qti-pattern-match` |
| `mapResponse` / `mapResponsePoint` | `qti-map-response` / `qti-map-response-point` |
| `correct` / `numberCorrect` / `numberIncorrect` / `numberSelected` | `qti-correct` / `qti-number-correct` / `qti-number-incorrect` / `qti-number-selected` |
| `customOperator` | `qti-custom-operator` |
| `templateInline` / `templateBlock` / `feedbackInline` | `qti-template-inline` / `qti-template-block` / `qti-feedback-inline` |

---

## 3. Other structural/semantic 2.x → 3.0 changes that affect rendering/conversion

- **Element sequence in the item changed.** The 3.0 `qti-assessment-item` child order is: `qti-context-declaration` → `qti-response-declaration` → `qti-outcome-declaration` → `qti-template-declaration` → `qti-template-processing` → `qti-assessment-stimulus-ref` → `qti-companion-materials-info` → `qti-stylesheet` → `qti-item-body` → `qti-catalog-info` → `qti-response-processing` → `qti-modal-feedback`. `qti-context-declaration` and `qti-catalog-info` are **new in 3.0** with no 2.x equivalent.
- **Accessibility model rebuilt (APIP → catalogs).** 2.x APIP `apipAccessibility`/`access` elements with **inclusion orders** are replaced by `qti-catalog-info` → `qti-catalog` → `qti-card`. Direction reverses: the body **points to** catalogs by id, and **inclusion orders are removed** — presentation order is just document (DOM) order. Accessibility variants are re-associated by reference, not by ordered include lists.
- **Stimulus is first-class in 3.0.** `qti-assessment-stimulus-ref` references a separate stimulus object (resource type `imsqti_stimulus_xmlv3p0`). In 2.1 a shared passage was an idiom (shared content / `<object>` references); QTI 2.2 introduces a stimulus object too. Resolve stimulus refs to the actual content before rendering/conversion. _[inferred: exact 2.1 stimulus idiom varies by authoring tool, e.g. ExamView duplicates content]_
- **Shared vocabulary / CSS (new in 3.0).** Presentation hints move into a standardized set of `class="qti-..."` and `data-*` attributes (e.g. `qti-keyword-emphasis`, `qti-visually-hidden`) rather than ad-hoc styling. Treat these as semantic class hints, not arbitrary CSS.
- **Attribute renames (mechanical, kebab, no prefix).** `timeDependent`→`time-dependent`, `responseIdentifier`→`response-identifier`, `baseType`→`base-type`, `maxChoices`/`minChoices`→`max-choices`/`min-choices`, `identifier`/`title` unchanged. **Enumerated values stay camelCase.**
- **HTML5 / web-component content model.** 3.0 explicitly supports "critical HTML5 elements and other web-friendly markup" inside the body; 2.1's content model is the older XHTML subset. Expect a slightly wider set of allowed inline/flow HTML in 3.0.
- **MathML** is carried as embedded MathML markup in both 2.x and 3.0 bodies; no QTI rename applies (MathML is not QTI-namespaced). Treat as pass-through content. _[inferred from the naming rule: only QTI elements are prefixed]_
- **CAT (computer-adaptive testing)** is natively supported in 3.0; flag at test level if encountered.

---

## 4. QTI 2.2 additions over 2.1

QTI 2.2 is a superset of 2.1 (same camelCase model, namespace `imsqti_v2p2`). Practical deltas:

- **`assessmentStimulus` as a shared, referenceable object** (precursor to 3.0's first-class stimulus) — shared reading passages may arrive as separate stimulus files (`imsqti_stimulus_xmlv2p2`) rather than inline.
- **Stronger HTML5 + MathML 3 alignment** vs 2.1's older XHTML subset.
- **CSS/styling and shared `stylesheet` usage** expanded.
- **PCI (Portable Custom Interactions)** are commonly delivered in 2.2 items via the `pci:` extension (see §5) — 2.1 packages also use it but 2.2 is the typical home.
- **`catalogInfo`/catalog accessibility hooks** begin appearing (full catalog model is a 3.0 feature).

> Bottom line: 2.1 and 2.2 share the same element vocabulary, so **one code path handles both**; the difference is which optional features (stimulus refs, PCI, richer HTML/MathML) appear.

---

## 5. PCI — Portable Custom Interactions

PCI lets authors ship a **custom JavaScript interaction** inside an otherwise-standard QTI item. In QTI 2.x it is a namespaced extension nested inside the standard `customInteraction` element; in QTI 3.0 it is **natively supported** as `qti-portable-custom-interaction` (with `qti-interaction-modules` / `qti-interaction-module` and `qti-interaction-markup`).

### Structure (PCI v1.0 inside a 2.2 item — grounded in `pci_examplev1.xml` + xsd)

```xml
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:pci="http://www.imsglobal.org/xsd/portableCustomInteraction" ...>
  <responseDeclaration baseType="point" cardinality="single" identifier="RESPONSE"/>
  <templateDeclaration baseType="integer" cardinality="single" identifier="X">...</templateDeclaration>
  <itemBody>
    <customInteraction responseIdentifier="RESPONSE" id="graph1">   <!-- standard QTI wrapper -->
      <pci:portableCustomInteraction customInteractionIdentifierType="IW30MX6U48JF9120GJS">
        <pci:templateVariableMapping templateIdentifier="X" configurationProperty="areaX"/>
        <pci:instance>
          <script type="text/javascript" src="js/graph.js"/>     <!-- module / hook -->
          <script type="text/javascript"><![CDATA[
              qtiCustomInteractionContext.setConfiguration('graph1', { ... }) ]]></script>
          <div id="graph1_box" class="graph" .../>                <!-- markup the script renders into -->
        </pci:instance>
      </pci:portableCustomInteraction>
    </customInteraction>
  </itemBody>
</assessmentItem>
```

Key parts (from the PCI v1.0 xsd):

- **`customInteraction`** — the standard QTI wrapper; carries `responseIdentifier` so the response binds to a normal `responseDeclaration`/`qti-response-declaration`.
- **`pci:portableCustomInteraction`** — required attr `customInteractionIdentifierType` (the PCI's type id); selects which registered JS interaction loads.
- **`pci:templateVariableMapping`** — maps QTI `templateDeclaration` values to the PCI's `configurationProperty` keys.
- **`pci:instance`** — the runtime payload: `<script>` hooks (a module `src` + an inline `setConfiguration(...)` CDATA config) plus the **markup `<div>`** the script renders into. In v3.0 this maps onto `qti-interaction-modules` (module resolution) + `qti-interaction-markup` (rendered markup). _[inferred mapping; names confirmed present in the v3.0 ASI info model]_

### Why PCI is hard to render/score/convert

- The interaction's **behavior, response format, and rendering live in opaque JavaScript**, not declarative QTI; the structure alone does not reveal semantics.
- The **response value shape** is defined by the JS, so scoring/response binding is only as portable as the PCI author made it.
- It depends on a **runtime context object** (`qtiCustomInteractionContext`) and external module files; those assets must travel with the package and be hostable.
- There is **no canonical PIE equivalent** for an arbitrary PCI — at best it maps to a PIE custom/embedded element, at worst it cannot be auto-converted. Treat PCI items as needing an explicit mapping or manual handling rather than silently dropping/guessing their semantics.

---

## 6. Normalization checklist for mixed-version QTI

So one rendering/scoring/conversion path sees a canonical shape:

1. **Classify version** (§1): namespace → root element → manifest type → filename. Tag each item/test with its detected version.
2. **Normalize element & attribute names to one canonical casing** (§2): apply the `qti-`/kebab ↔ camelCase map so 2.1, 2.2, and 3.0 reduce to one vocabulary. **Do not touch enumerated attribute *values*** (keep camelCase) or **HTML/MathML elements** (pass through).
3. **Resolve references to concrete content**: inline or attach shared **stimulus** (`assessmentStimulus` / `qti-assessment-stimulus-ref` → `imsqti_stimulus_xml*` resource), stylesheets, companion-materials refs.
4. **Normalize accessibility**: collapse APIP `access`/inclusion-order content and 3.0 `qti-catalog-info`/`qti-card` into one internal representation keyed by support type; drop inclusion orders (use DOM order).
5. **Preserve shared-vocabulary hints**: keep `qti-*` `class`/`data-*` attributes as semantic flags rather than discarding or inlining them as raw CSS.
6. **Detect PCI** (§5): identify `customInteraction`/`pci:portableCustomInteraction` and 3.0 `qti-portable-custom-interaction`; collect their JS modules and markup and route to a PCI-specific path — never silently drop or guess their semantics.
7. **Validate against the detected version's schema** before rendering/scoring/converting.
