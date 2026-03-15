# QTI: Comprehensive Technical Implementation Guide

**Question and Test Interoperability Specification**

*Covers QTI 2.1, 2.2, and 3.0*

## Spec snapshots (local)

This repo keeps local, greppable spec snapshots for QTI work. See [SPEC_SNAPSHOTS.md](./SPEC_SNAPSHOTS.md) (QTI **2.2.2** primary reference; supports QTI **2.1–2.2.x** input).

---

## Table of Contents

- [Part I: Specification Overview](#part-i-specification-overview)
  - [1.1 Purpose and Scope](#11-purpose-and-scope)
  - [1.2 Historical Evolution](#12-historical-evolution)
  - [1.3 Version Differences Reference](#13-version-differences-reference)
- [Part II: Assessment Architecture](#part-ii-assessment-architecture)
  - [2.1 Hierarchical Structure](#21-hierarchical-structure)
  - [2.2 Assessment Item Structure](#22-assessment-item-structure)
  - [2.3 Navigation and Submission Modes](#23-navigation-and-submission-modes)
- [Part III: Interaction Types Reference](#part-iii-interaction-types-reference)
  - [3.1 Simple Selection Interactions](#31-simple-selection-interactions)
  - [3.2 Text-Based Interactions](#32-text-based-interactions)
  - [3.3 Graphical Interactions](#33-graphical-interactions)
  - [3.4 Miscellaneous Interactions](#34-miscellaneous-interactions)
- [Part IV: Response Processing and Scoring](#part-iv-response-processing-and-scoring)
  - [4.1 Variable Types](#41-variable-types)
  - [4.2 Standard Response Processing Templates](#42-standard-response-processing-templates)
  - [4.3 Custom Response Processing](#43-custom-response-processing)
- [Part V: XML Schema and Namespaces](#part-v-xml-schema-and-namespaces)
  - [5.1 Namespace Declarations](#51-namespace-declarations)
  - [5.2 Document Structure](#52-document-structure)
- [Part VI: QTI 3.0 Features](#part-vi-qti-30-features)
  - [6.1 Portable Custom Interactions (PCI)](#61-portable-custom-interactions-pci)
  - [6.2 Personal Needs and Preferences (PNP)](#62-personal-needs-and-preferences-pnp)
  - [6.3 Catalog System](#63-catalog-system)
- [Part VII: Implementation Guidance](#part-vii-implementation-guidance)
  - [7.1 Conformance Profiles](#71-conformance-profiles)
  - [7.2 Common Implementation Issues](#72-common-implementation-issues)
  - [7.3 Best Practices](#73-best-practices)
- [Conclusion](#conclusion)

---

# Part I: Specification Overview

## 1.1 Purpose and Scope

The **IMS/1EdTech Question and Test Interoperability (QTI) specification** defines a standardized XML format for representing assessment content, enabling portable exchange of questions and tests between authoring systems, delivery platforms, item banks, and learning management systems.

QTI solves a fundamental problem in educational technology: **vendor lock-in of assessment content**. Organizations investing significant resources in question development can preserve that investment when changing platforms, as content authored in QTI format transfers freely between any certified system.

The specification supports everything from simple multiple-choice quizzes to complex adaptive assessments with multimedia, mathematical notation, and sophisticated scoring logic.

## 1.2 Historical Evolution

| Version | Release Date | Key Developments |
|---------|--------------|------------------|
| 1.0 | February 2000 | First public specification based on QuestionMark's QML |
| 1.2 | January 2002 | Major update; over 6,000 downloads by Feb 2002 |
| 2.0 | January 2005 | Complete redesign focusing on individual assessment items |
| 2.1 | August 2012 | Added tests, sections, results reporting; major adoption milestone |
| 2.2 | September 2015 | HTML5 elements, WAI-ARIA accessibility, MathML v3, CSS3 Speech |
| 2.2.4 | March 2021 | Maintenance update; XSD corrections |
| **3.0** | **May 2022** | **Merged QTI with APIP; NOT backward compatible with 2.x** |

## 1.3 Version Differences Reference

QTI 3.0 is a significant break from 2.x. All element names change from `camelCase` to `qti-kebab-case`, and multi-word attributes change from `camelCase` to `kebab-case`. The core data model, interaction types, and response processing semantics remain consistent across versions.

### Element Name Mapping

| Canonical Concept | QTI 2.x | QTI 3.0 |
|-------------------|---------|---------|
| `assessmentItem` | `<assessmentItem>` | `<qti-assessment-item>` |
| `assessmentTest` | `<assessmentTest>` | `<qti-assessment-test>` |
| `responseDeclaration` | `<responseDeclaration>` | `<qti-response-declaration>` |
| `outcomeDeclaration` | `<outcomeDeclaration>` | `<qti-outcome-declaration>` |
| `itemBody` | `<itemBody>` | `<qti-item-body>` |
| `responseProcessing` | `<responseProcessing>` | `<qti-response-processing>` |
| `choiceInteraction` | `<choiceInteraction>` | `<qti-choice-interaction>` |
| `simpleChoice` | `<simpleChoice>` | `<qti-simple-choice>` |
| `orderInteraction` | `<orderInteraction>` | `<qti-order-interaction>` |
| `associateInteraction` | `<associateInteraction>` | `<qti-associate-interaction>` |
| `matchInteraction` | `<matchInteraction>` | `<qti-match-interaction>` |
| `gapMatchInteraction` | `<gapMatchInteraction>` | `<qti-gap-match-interaction>` |
| `inlineChoiceInteraction` | `<inlineChoiceInteraction>` | `<qti-inline-choice-interaction>` |
| `textEntryInteraction` | `<textEntryInteraction>` | `<qti-text-entry-interaction>` |
| `extendedTextInteraction` | `<extendedTextInteraction>` | `<qti-extended-text-interaction>` |
| `hottextInteraction` | `<hottextInteraction>` | `<qti-hottext-interaction>` |
| `hotspotInteraction` | `<hotspotInteraction>` | `<qti-hotspot-interaction>` |
| `selectPointInteraction` | `<selectPointInteraction>` | `<qti-select-point-interaction>` |
| `graphicOrderInteraction` | `<graphicOrderInteraction>` | `<qti-graphic-order-interaction>` |
| `graphicAssociateInteraction` | `<graphicAssociateInteraction>` | `<qti-graphic-associate-interaction>` |
| `graphicGapMatchInteraction` | `<graphicGapMatchInteraction>` | `<qti-graphic-gap-match-interaction>` |
| `positionObjectInteraction` | `<positionObjectInteraction>` | `<qti-position-object-interaction>` |
| `sliderInteraction` | `<sliderInteraction>` | `<qti-slider-interaction>` |
| `mediaInteraction` | `<mediaInteraction>` | `<qti-media-interaction>` |
| `drawingInteraction` | `<drawingInteraction>` | `<qti-drawing-interaction>` |
| `uploadInteraction` | `<uploadInteraction>` | `<qti-upload-interaction>` |
| `endAttemptInteraction` | `<endAttemptInteraction>` | `<qti-end-attempt-interaction>` |
| `customInteraction` | `<customInteraction>` | `<qti-portable-custom-interaction>` *(see Part VI)* |
| `modalFeedback` | `<modalFeedback>` | `<qti-modal-feedback>` |
| `testPart` | `<testPart>` | `<qti-test-part>` |
| `assessmentSection` | `<assessmentSection>` | `<qti-assessment-section>` |
| `assessmentItemRef` | `<assessmentItemRef>` | `<qti-assessment-item-ref>` |

### Attribute Name Mapping

Single-word attributes are unchanged. Multi-word attributes change from `camelCase` to `kebab-case`:

| Concept | QTI 2.x | QTI 3.0 |
|---------|---------|---------|
| Response binding | `responseIdentifier` | `response-identifier` |
| Cardinality | `cardinality` | `cardinality` *(unchanged)* |
| Base type | `baseType` | `base-type` |
| Max choices | `maxChoices` | `max-choices` |
| Min choices | `minChoices` | `min-choices` |
| Max associations | `maxAssociations` | `max-associations` |
| Navigation mode | `navigationMode` | `navigation-mode` |
| Submission mode | `submissionMode` | `submission-mode` |
| Time dependent | `timeDependent` | `time-dependent` |
| Correct response | `<correctResponse>` | `<qti-correct-response>` |

### QTI 2.1 vs 2.2

The differences between 2.1 and 2.2 are smaller and backward-compatible. QTI 2.2 added:

- **HTML5 elements** in item body: `figure`, `figcaption`, `audio`, `video`, `section`, `article`, `nav`, `aside`, `header`, `footer`
- **WAI-ARIA attributes**: `role`, `aria-label`, `aria-describedby`, `aria-hidden`, and others
- **MathML version 3**: Enhanced mathematical notation with template variable integration
- **CSS3 Speech**: Text-to-speech control attributes for accessibility
- **Bidirectional text**: `dir` attribute for right-to-left language support
- **Ruby markup**: East Asian language annotation
- **`label` element** on `inlineChoiceInteraction`: Default display text before selection
- **`format` attribute** on `textEntryInteraction`: Display format hint
- **Native `audio`/`video` elements** in `mediaInteraction` (alongside `object`)

Items valid in QTI 2.1 are generally valid in QTI 2.2. Namespace URI is the only required change when upgrading.

### Namespace URIs

| Version | Namespace URI |
|---------|--------------|
| QTI 2.1 | `http://www.imsglobal.org/xsd/imsqti_v2p1` |
| QTI 2.2 | `http://www.imsglobal.org/xsd/imsqti_v2p2` |
| QTI 3.0 | `http://www.imsglobal.org/xsd/imsqtiasi_v3p0` |

---

# Part II: Assessment Architecture

## 2.1 Hierarchical Structure

QTI organizes assessments through a well-defined containment hierarchy that separates test structure from individual question content:

```
assessmentTest
├── outcomeDeclaration (test-level variables)
├── timeLimits (overall constraints)
├── testPart (1 or more required)
│   ├── navigationMode: linear | nonlinear
│   ├── submissionMode: individual | simultaneous
│   ├── assessmentSection (1 or more required)
│   │   ├── selection (random item selection)
│   │   ├── ordering (shuffle configuration)
│   │   └── assessmentItemRef (references)
│   └── testFeedback
└── outcomeProcessing (test scoring logic)
```

## 2.2 Assessment Item Structure

The **assessmentItem** represents a single question and contains the complete definition of content, interactions, and scoring:

- **responseDeclaration:** Defines expected response variables with correct answers and scoring mappings
- **outcomeDeclaration:** Declares score and feedback outcome variables
- **templateDeclaration:** Enables dynamic item generation through variable substitution
- **itemBody:** Contains all presentation content using an XHTML subset
- **responseProcessing:** Defines scoring logic through expressions or standard templates
- **modalFeedback:** Provides feedback displayed after response processing

## 2.3 Navigation and Submission Modes

**Navigation modes** control candidate movement through a test:

- **linear:** Enforces sequential progression without revisiting items
- **nonlinear:** Permits free navigation between items

**Submission modes** determine when responses are recorded:

- **individual:** Submits each item immediately upon completion
- **simultaneous:** Batches all responses until the test part concludes

---

# Part III: Interaction Types Reference

QTI supports **21 standard interaction types** organized into four functional categories. Each interaction binds to a response variable through the required `responseIdentifier` attribute (QTI 2.x) / `response-identifier` attribute (QTI 3.0).

Examples in this section use QTI 2.x syntax. For QTI 3.0, apply the naming conventions from the mapping table in Part I.

## 3.1 Simple Selection Interactions

### 3.1.1 choiceInteraction

**Purpose:** Presents a set of choices for the candidate to select one or more options. This is the most common interaction type, used for single-choice (radio button) and multiple-choice (checkbox) questions.

**Response Binding:** Bound to a response variable with baseType `identifier` and cardinality `single` (for maxChoices=1) or `multiple` (for maxChoices>1 or 0).

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `shuffle` | Optional | If true, randomizes choice order on delivery. Default: false |
| `maxChoices` | Optional | Maximum selections allowed. 0=unlimited, 1=single-choice (radio). Default: 1 |
| `minChoices` | Optional | Minimum selections required for valid response. Default: 0 |
| `orientation` | Optional | Visual hint: 'horizontal' or 'vertical' |

**Child Elements:**

- **prompt:** Optional question text displayed above choices
- **simpleChoice:** One or more choice options, each with unique identifier

**simpleChoice Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `identifier` | Required | Unique identifier for this choice within the interaction |
| `fixed` | Optional | If true, choice position is fixed during shuffle. Default: false |
| `templateIdentifier` | Optional | Links to template variable for conditional visibility |
| `showHide` | Optional | 'show' or 'hide' — controls template-based visibility |

**XML Example:**

```xml
<choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
  <prompt>What is the capital of France?</prompt>
  <simpleChoice identifier="A">London</simpleChoice>
  <simpleChoice identifier="B">Paris</simpleChoice>
  <simpleChoice identifier="C">Berlin</simpleChoice>
  <simpleChoice identifier="D" fixed="true">None of the above</simpleChoice>
</choiceInteraction>
```

**Implementation Notes:** When maxChoices=1, render as radio buttons. When maxChoices>1 or 0, render as checkboxes. The `fixed` attribute is commonly used to keep "None of the above" or "All of the above" options at the end. Validate that response contains between minChoices and maxChoices selections.

---

### 3.1.2 orderInteraction

**Purpose:** Requires the candidate to arrange a set of choices in a specific order. Used for ranking, sequencing, and timeline questions.

**Response Binding:** Bound to a response variable with baseType `identifier` and cardinality `ordered`. The response is an ordered list of choice identifiers.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `shuffle` | Optional | Randomizes initial presentation order. Default: false |
| `minChoices` | Optional | Minimum choices to include in ordering. Default: all choices |
| `maxChoices` | Optional | Maximum choices to include. 0 or omitted means all required |
| `orientation` | Optional | Visual hint: 'horizontal' or 'vertical' |

**Implementation Notes:** Typically implemented with drag-and-drop UI. Use the `fixed` attribute on choices to prevent specific items from being shuffled. Response stores identifiers in candidate's chosen order.

---

### 3.1.3 associateInteraction

**Purpose:** Requires the candidate to create associations (pairs) between choices. Unlike matchInteraction, all choices come from a single pool and can be paired with any other choice.

**Response Binding:** Bound to a response variable with baseType `pair` and cardinality `multiple`. Each pair is unordered (A-B equals B-A).

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `shuffle` | Optional | Randomizes choice order. Default: false |
| `maxAssociations` | Optional | Maximum pairs that can be formed. 0=unlimited. Default: 1 |
| `minAssociations` | Optional | Minimum pairs required. Default: 0 |

**simpleAssociableChoice Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `identifier` | Required | Unique identifier for this choice |
| `matchMax` | Required | Maximum times this choice can be used in associations |
| `matchMin` | Optional | Minimum times this choice must be used. Default: 0 |
| `matchGroup` | Optional | Space-separated list of identifiers this choice can pair with |

**Implementation Notes:** The `matchMax` attribute on choices controls reusability. Set matchMax=1 for one-to-one matching. Use `matchGroup` to restrict which choices can be paired together.

---

### 3.1.4 matchInteraction

**Purpose:** Presents two distinct sets of choices for directed pairing. The candidate matches items from the first set to items in the second set. Commonly used for term-definition matching.

**Response Binding:** Bound to a response variable with baseType `directedPair` and cardinality `multiple`. Pairs are ordered (source→target).

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `shuffle` | Optional | Randomizes choice order within each set. Default: false |
| `maxAssociations` | Optional | Maximum total matches allowed. Default: 1 |
| `minAssociations` | Optional | Minimum matches required. Default: 0 |

**Structure:** Contains exactly two `simpleMatchSet` elements, each containing `simpleAssociableChoice` elements with matchMax/matchMin.

**XML Example:**

```xml
<matchInteraction responseIdentifier="RESPONSE" shuffle="true" maxAssociations="4">
  <simpleMatchSet>
    <simpleAssociableChoice identifier="T1" matchMax="1">H2O</simpleAssociableChoice>
    <simpleAssociableChoice identifier="T2" matchMax="1">NaCl</simpleAssociableChoice>
  </simpleMatchSet>
  <simpleMatchSet>
    <simpleAssociableChoice identifier="D1" matchMax="1">Water</simpleAssociableChoice>
    <simpleAssociableChoice identifier="D2" matchMax="1">Salt</simpleAssociableChoice>
  </simpleMatchSet>
</matchInteraction>
```

---

### 3.1.5 gapMatchInteraction

**Purpose:** Creates fill-in-the-blank questions where candidates drag text or images into gaps within a passage. Gaps are embedded inline within block content.

**Response Binding:** Bound to a response variable with baseType `directedPair` and cardinality `multiple`. Each pair maps a gapChoice to a gap.

**Key Child Elements:**

- **gapText:** Text choice that can be dragged into gaps
- **gapImg:** Image choice that can be dragged into gaps
- **gap:** Inline element marking where choices can be dropped (within block content)

**gapText/gapImg Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `identifier` | Required | Unique identifier for this choice |
| `matchMax` | Required | Maximum times this choice can be used |
| `matchMin` | Optional | Minimum times this choice must be used. Default: 0 |
| `matchGroup` | Optional | Restricts which gaps can accept this choice |

**gap Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `identifier` | Required | Unique identifier for this gap |
| `required` | Optional | If true, gap must be filled for valid response |

**XML Example:**

```xml
<gapMatchInteraction responseIdentifier="RESPONSE">
  <gapText identifier="W1" matchMax="1">Paris</gapText>
  <gapText identifier="W2" matchMax="1">London</gapText>
  <gapText identifier="W3" matchMax="1">Berlin</gapText>
  <p>The capital of France is <gap identifier="G1"/>.</p>
</gapMatchInteraction>
```

**Implementation Notes:** Gap elements appear inline within paragraph content. The `matchMax` attribute on gapText/gapImg controls how many times each choice can be used. Ideal for cloze-style reading comprehension tests.

---

## 3.2 Text-Based Interactions

### 3.2.1 inlineChoiceInteraction

**Purpose:** Renders a dropdown selection list within flowing text. Used for cloze-style questions where the candidate selects from a predefined list of options at specific points in a passage.

**Response Binding:** Bound to a response variable with baseType `identifier` and cardinality `single`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `shuffle` | Optional | Randomizes choice order in dropdown. Default: false |
| `required` | Optional | If true, candidate must select an option. Default: false |

**Child Elements:**

- **label:** (QTI 2.2+) Default display text before selection
- **inlineChoice:** One or more selectable options

**inlineChoice Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `identifier` | Required | Unique identifier for this choice |
| `fixed` | Optional | If true, position is fixed during shuffle |
| `templateIdentifier` | Optional | Links to template variable |
| `showHide` | Optional | Controls template-based visibility |

**Implementation Notes:** Render as a dropdown/select element inline with surrounding text. The `label` element provides placeholder text before the candidate makes a selection.

---

### 3.2.2 textEntryInteraction

**Purpose:** Creates a single-line text input field for short-answer responses. Appears inline within flowing text, making it ideal for fill-in-the-blank questions.

**Response Binding:** Bound to a response variable with baseType `string`, `integer`, or `float` and cardinality `single`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `base` | Optional | Numeric base for integer responses (default: 10) |
| `expectedLength` | Optional | Hint for rendering field width (in characters) |
| `patternMask` | Optional | Regular expression for input validation |
| `placeholderText` | Optional | Hint text displayed when field is empty |
| `format` | Optional | (QTI 2.2+) Display format hint |

**Implementation Notes:** Use `stringMatch` or `patternMatch` operators in response processing for text comparison. Set `caseSensitive` attribute as appropriate. The `patternMask` provides client-side validation but should also be validated server-side.

---

### 3.2.3 extendedTextInteraction

**Purpose:** Provides a multi-line text area for essay-style responses. Supports rich text input and can be configured for multiple response strings.

**Response Binding:** Bound to a response variable with baseType `string` and cardinality `single` or `multiple` (for multi-part responses).

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `base` | Optional | Numeric base for integer responses |
| `expectedLength` | Optional | Expected character count (for sizing) |
| `expectedLines` | Optional | Expected line count (for sizing) |
| `minStrings` | Optional | Minimum number of response strings required |
| `maxStrings` | Optional | Maximum number of response strings allowed |
| `format` | Optional | 'plain', 'preFormatted', or 'xhtml' — indicates expected content type |
| `patternMask` | Optional | Regular expression for validation |
| `placeholderText` | Optional | Hint text displayed when empty |

**Implementation Notes:** Essays typically require human scoring. Set `externalScored='human'` on the outcomeDeclaration. The `format` attribute guides whether to provide plain text, preserve formatting, or enable XHTML editing.

---

### 3.2.4 hottextInteraction

**Purpose:** Presents a passage of text with selectable 'hot' words or phrases. The candidate clicks to select specific text segments. Used for identifying errors, key terms, or specific elements within context.

**Response Binding:** Bound to a response variable with baseType `identifier` and cardinality `single` or `multiple`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `maxChoices` | Optional | Maximum hot texts selectable. 0=unlimited. Default: 1 |
| `minChoices` | Optional | Minimum selections required. Default: 0 |

**hottext Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `identifier` | Required | Unique identifier for this hottext |
| `templateIdentifier` | Optional | Links to template variable |
| `showHide` | Optional | Controls template-based visibility |

**XML Example:**

```xml
<hottextInteraction responseIdentifier="RESPONSE" maxChoices="2">
  <p>The <hottext identifier="H1">quick</hottext> brown
     <hottext identifier="H2">fox</hottext> jumps over the
     <hottext identifier="H3">lazy</hottext> dog.</p>
</hottextInteraction>
```

**Implementation Notes:** Visually distinguish selectable hottext from surrounding text (e.g., subtle highlighting or underlining). Clearly indicate selected state. Unlike choiceInteraction, choices appear embedded in context rather than as a separate list.

---

## 3.3 Graphical Interactions

Graphical interactions involve a background image with defined regions (hotspots) or coordinate-based responses. All graphical interactions include an `object` element specifying the background image.

### 3.3.1 hotspotInteraction

**Purpose:** Presents a graphic image with defined clickable regions (hotspots). The candidate selects one or more hotspots. Used for image-based questions where spatial relationships matter.

**Response Binding:** Bound to a response variable with baseType `identifier` and cardinality `single` or `multiple`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `maxChoices` | Optional | Maximum hotspots selectable. 0=unlimited. Default: 1 |
| `minChoices` | Optional | Minimum selections required. Default: 0 |

**hotspotChoice Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `identifier` | Required | Unique identifier for this hotspot |
| `shape` | Required | 'circle', 'rect', 'poly', or 'ellipse' |
| `coords` | Required | Coordinates defining the shape (format varies by shape type) |
| `hotspotLabel` | Optional | Label for accessibility purposes |

**Shape Coordinate Formats:**

- **circle:** `centerX,centerY,radius` (e.g., "100,100,25")
- **rect:** `left,top,right,bottom` (e.g., "50,50,150,100")
- **poly:** `x1,y1,x2,y2,...,xn,yn` (e.g., "0,0,100,0,50,100")
- **ellipse:** `centerX,centerY,radiusX,radiusY`

**XML Example:**

```xml
<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
  <prompt>Click on France:</prompt>
  <object type="image/png" data="europe_map.png" width="400" height="300"/>
  <hotspotChoice identifier="FR" shape="poly" coords="150,120,180,100,200,130,170,160"/>
  <hotspotChoice identifier="DE" shape="rect" coords="200,80,280,150"/>
</hotspotInteraction>
```

**Implementation Notes:** The delivery engine must clearly indicate selected hotspots. Coordinates are relative to the image's natural dimensions.

---

### 3.3.2 selectPointInteraction

**Purpose:** Allows the candidate to click one or more points on an image. Unlike hotspotInteraction, the valid regions are NOT shown to the candidate — this creates "hidden hotspot" questions.

**Response Binding:** Bound to a response variable with baseType `point` (format: "x y") and cardinality `single` or `multiple`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `maxChoices` | Optional | Maximum points selectable. 0=unlimited. Default: 1 |
| `minChoices` | Optional | Minimum points required. Default: 0 |

**Scoring with areaMapping:**

```xml
<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="point">
  <areaMapping defaultValue="0">
    <areaMapEntry shape="circle" coords="145,85,20" mappedValue="1"/>
  </areaMapping>
</responseDeclaration>
```

**Implementation Notes:** Use `areaMapping` in the responseDeclaration to score point responses. Show only the clicked point(s), never the scoring regions.

---

### 3.3.3 graphicOrderInteraction

**Purpose:** Requires candidates to select hotspots on an image in a specific order. Combines spatial selection with sequencing.

**Response Binding:** Bound to a response variable with baseType `identifier` and cardinality `ordered`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `maxChoices` | Optional | Maximum hotspots to order. 0=all required |
| `minChoices` | Optional | Minimum hotspots to order |

**Implementation Notes:** Display numbers or other indicators showing the selection order. Allow candidates to reset and reorder their selections.

---

### 3.3.4 graphicAssociateInteraction

**Purpose:** Allows candidates to create associations between hotspots on an image. Used for connecting related elements within a diagram.

**Response Binding:** Bound to a response variable with baseType `pair` and cardinality `multiple`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `maxAssociations` | Optional | Maximum pairs that can be formed. Default: 1 |
| `minAssociations` | Optional | Minimum pairs required. Default: 0 |

**associableHotspot Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `identifier` | Required | Unique identifier for this hotspot |
| `shape` | Required | Shape type (circle, rect, poly, ellipse) |
| `coords` | Required | Coordinates defining the shape |
| `matchMax` | Required | Maximum times this hotspot can be associated |
| `matchMin` | Optional | Minimum associations required |

**Implementation Notes:** Typically rendered by drawing lines between associated hotspots. `matchMax` controls how many times each hotspot can participate in an association.

---

### 3.3.5 graphicGapMatchInteraction

**Purpose:** Enables drag-and-drop of text or images onto target hotspots within a larger background image. The graphical equivalent of gapMatchInteraction.

**Response Binding:** Bound to a response variable with baseType `directedPair` and cardinality `multiple`.

**Structure:**

- **gapImg/gapText:** Draggable choices (images or text)
- **associableHotspot:** Target drop zones on the background image

**gapImg Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `identifier` | Required | Unique identifier |
| `matchMax` | Required | Maximum times this image can be used |
| `matchMin` | Optional | Minimum uses required |
| `objectLabel` | Optional | Accessibility label |

**Implementation Notes:** Implement with drag-and-drop interface. Dropped items should snap to hotspot positions. Provide visual feedback for valid drop targets.

---

### 3.3.6 positionObjectInteraction

**Purpose:** Allows candidates to position a moveable image at specific locations on a background image. Used for placement tasks where exact positioning matters.

**Response Binding:** Bound to a response variable with baseType `point` and cardinality `single` or `multiple`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `centerPoint` | Optional | Reference point on moveable object (default: center) |
| `maxChoices` | Optional | Maximum placements allowed |
| `minChoices` | Optional | Minimum placements required |

**Structure:** Must be contained within a `positionObjectStage` element which provides the background. Multiple positionObjectInteractions can share the same stage. Use `areaMapping` for scoring based on placement regions.

---

## 3.4 Miscellaneous Interactions

### 3.4.1 sliderInteraction

**Purpose:** Presents a slider control for selecting a numeric value within a defined range. Ideal for rating scales, percentage estimates, and continuous value selection.

**Response Binding:** Bound to a response variable with baseType `integer` or `float` and cardinality `single`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `lowerBound` | Required | Minimum selectable value |
| `upperBound` | Required | Maximum selectable value |
| `step` | Optional | Increment between valid values. Default: 1 |
| `stepLabel` | Optional | If true, display labels at step intervals |
| `orientation` | Optional | 'horizontal' or 'vertical' |
| `reverse` | Optional | If true, reverses the slider direction |

**Implementation Notes:** Ensure keyboard navigation works for accessibility. The `step` attribute constrains valid values (e.g., step=5 means only 0, 5, 10, 15... are valid).

---

### 3.4.2 mediaInteraction

**Purpose:** Wraps audio or video content and can track play events. Used to ensure candidates engage with media content before proceeding.

**Response Binding:** Bound to a response variable with baseType `integer` tracking the number of plays, and cardinality `single`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `autostart` | Optional | If true, media plays automatically. Default: false |
| `minPlays` | Optional | Minimum times candidate must play media |
| `maxPlays` | Optional | Maximum times candidate can play media. 0=unlimited |
| `loop` | Optional | If true, media loops continuously |

**Implementation Notes:** QTI 2.2 and 3.0 support native `audio`/`video` elements alongside the traditional `object` element. Use `minPlays` to enforce listening/viewing requirements. The response variable tracks play count for validation.

---

### 3.4.3 drawingInteraction

**Purpose:** Provides a freehand drawing canvas where candidates can sketch responses. The drawing occurs on a provided background image which determines output dimensions and format.

**Response Binding:** Bound to a response variable with baseType `file` and cardinality `single`. The response is the drawing as image data.

**Implementation Notes:** Requires a canvas-capable rendering environment. Typically requires human scoring. Provide basic drawing tools (pen, eraser, color selection). Consider touch device support.

---

### 3.4.4 uploadInteraction

**Purpose:** Allows candidates to upload a file as their response. Used for submitting documents, spreadsheets, code files, or other artifacts.

**Response Binding:** Bound to a response variable with baseType `file` and cardinality `single`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `type` | Optional | MIME type constraint for accepted files (e.g., 'application/pdf') |

**Implementation Notes:** Files usually require human review or external processing. Implement file size limits and security scanning.

---

### 3.4.5 endAttemptInteraction

**Purpose:** Renders a button that terminates the current attempt. Essential for adaptive items providing hints, "give up" functionality, or multi-stage questions.

**Response Binding:** Bound to a response variable with baseType `boolean` and cardinality `single`. Set to true when the button is clicked.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `title` | Required | Button label text (e.g., 'Give Up', 'Show Hint') |
| `countAttempt` | Optional | If false, clicking doesn't increment numAttempts. Default: true |

**Implementation Notes:** Combine with `adaptive='true'` on the item and responseProcessing logic that checks the button's response variable. Use `countAttempt='false'` for hint requests that shouldn't penalize the candidate.

---

### 3.4.6 customInteraction / portableCustomInteraction

In QTI 2.x, `customInteraction` is an extension point for proprietary interaction types. In QTI 3.0, this is replaced by the fully standardized **Portable Custom Interaction (PCI)** mechanism — see [Part VI, Section 6.1](#61-portable-custom-interactions-pci) for a complete treatment.

**QTI 2.x customInteraction:**

```xml
<customInteraction responseIdentifier="RESPONSE" class="myPlatform.chemEditor">
  <!-- Platform-specific content -->
  <extension>
    <!-- Custom configuration data -->
  </extension>
</customInteraction>
```

**Implementation Notes:** Using `customInteraction` in QTI 2.x trades interoperability for capability. Content using custom interactions may not transfer between platforms. QTI 3.0 PCI provides a standards-based alternative with much better portability guarantees.

---

# Part IV: Response Processing and Scoring

## 4.1 Variable Types

QTI defines strict typing for all variables through **cardinality** (how many values) and **baseType** (what kind of values):

### Cardinality Options

| Cardinality | Description |
|-------------|-------------|
| `single` | Exactly one value |
| `multiple` | Unordered set of values (like a mathematical set) |
| `ordered` | Ordered list of values (sequence matters) |
| `record` | Key-value pairs (rarely used) |

### Base Types

| Type | Description | Common Use |
|------|-------------|------------|
| `identifier` | NCName token | Choice selections |
| `string` | Text | Text entry responses |
| `integer` | Whole number | Slider, numeric answers |
| `float` | Decimal number | Scores, precise numbers |
| `boolean` | true/false | End attempt buttons |
| `point` | "x y" coordinates | Select point interactions |
| `pair` | Two unordered identifiers | Associate interactions |
| `directedPair` | Two ordered identifiers | Match interactions |
| `file` | File reference | Upload, drawing |
| `duration` | Time interval | Built-in duration tracking |
| `uri` | URI reference | External resources |

### Built-in Variables

These variables are automatically available in every item session:

- **numAttempts** (integer): Number of attempts made
- **duration** (float): Time spent on item in seconds
- **completionStatus** (identifier): not_attempted, unknown, incomplete, completed

## 4.2 Standard Response Processing Templates

QTI provides three standard templates that cover most scoring needs while maximizing interoperability:

### match_correct

Awards 1 point if the response exactly matches the declared `correctResponse`, 0 otherwise.

```xml
<responseProcessing
    template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
```

### map_response

Uses a `mapping` element to assign point values to each possible response value, supporting partial credit:

```xml
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
  <correctResponse>
    <value>A</value>
    <value>D</value>
  </correctResponse>
  <mapping defaultValue="0" lowerBound="0" upperBound="1">
    <mapEntry mapKey="A" mappedValue="0.5"/>
    <mapEntry mapKey="D" mappedValue="0.5"/>
    <mapEntry mapKey="B" mappedValue="-0.25"/>
    <mapEntry mapKey="C" mappedValue="-0.25"/>
  </mapping>
</responseDeclaration>

<responseProcessing
    template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
```

### map_response_point

Uses `areaMapping` for coordinate-based responses, defining scoring regions with shapes:

```xml
<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="point">
  <areaMapping defaultValue="0">
    <areaMapEntry shape="circle" coords="100,150,25" mappedValue="1"/>
    <areaMapEntry shape="circle" coords="100,150,50" mappedValue="0.5"/>
  </areaMapping>
</responseDeclaration>

<responseProcessing
    template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response_point"/>
```

## 4.3 Custom Response Processing

For custom scoring logic, use `responseCondition` with expressions:

```xml
<responseProcessing>
  <responseCondition>
    <responseIf>
      <match>
        <variable identifier="RESPONSE"/>
        <correct identifier="RESPONSE"/>
      </match>
      <setOutcomeValue identifier="SCORE">
        <baseValue baseType="float">1</baseValue>
      </setOutcomeValue>
      <setOutcomeValue identifier="FEEDBACK">
        <baseValue baseType="identifier">correct</baseValue>
      </setOutcomeValue>
    </responseIf>
    <responseElse>
      <setOutcomeValue identifier="SCORE">
        <baseValue baseType="float">0</baseValue>
      </setOutcomeValue>
      <setOutcomeValue identifier="FEEDBACK">
        <baseValue baseType="identifier">incorrect</baseValue>
      </setOutcomeValue>
    </responseElse>
  </responseCondition>
</responseProcessing>
```

### Key Operators

| Category | Operators |
|----------|-----------|
| Comparison | `match`, `equal`, `lt`, `gt`, `lte`, `gte` |
| Logic | `and`, `or`, `not` |
| Arithmetic | `sum`, `product`, `divide`, `subtract` |
| Container | `contains`, `member`, `containerSize` |
| String | `stringMatch`, `patternMatch`, `substring` |
| Null handling | `isNull`, `null` |

---

# Part V: XML Schema and Namespaces

## 5.1 Namespace Declarations

| Namespace URI | Version | Purpose |
|--------------|---------|---------|
| `http://www.imsglobal.org/xsd/imsqti_v2p1` | QTI 2.1 | Core QTI ASI content |
| `http://www.imsglobal.org/xsd/imsqti_v2p2` | QTI 2.2 | Core QTI ASI content |
| `http://www.imsglobal.org/xsd/imsqtiasi_v3p0` | QTI 3.0 | Core QTI ASI content |
| `http://www.imsglobal.org/xsd/imsqti_result_v2p2` | QTI 2.x | Results reporting |
| `http://www.imsglobal.org/xsd/imsqti_metadata_v2p2` | QTI 2.x | QTI-specific metadata |
| `http://www.w3.org/1998/Math/MathML` | All | Mathematical content |
| `http://www.imsglobal.org/xsd/imscp_v1p1` | All | Content packaging manifest |

## 5.2 Document Structure

### Assessment Item — QTI 2.x

```xml
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2
        http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2p2.xsd"
    identifier="item001"
    title="Sample Question"
    adaptive="false"
    timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>B</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <!-- Interactions and content here -->
  </itemBody>

  <responseProcessing
      template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>

</assessmentItem>
```

### Assessment Item — QTI 3.0

```xml
<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    identifier="item001"
    title="Sample Question"
    adaptive="false"
    time-dependent="false">

  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>B</qti-value>
    </qti-correct-response>
  </qti-response-declaration>

  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-item-body>
    <!-- Interactions and content here -->
  </qti-item-body>

  <qti-response-processing
      template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>

</qti-assessment-item>
```

### Assessment Test Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
    identifier="test001" title="Sample Test">

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>

  <testPart identifier="part1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section1" title="Section 1" visible="true">
      <assessmentItemRef identifier="item1" href="items/item001.xml"/>
      <assessmentItemRef identifier="item2" href="items/item002.xml"/>
    </assessmentSection>
  </testPart>

  <outcomeProcessing>
    <setOutcomeValue identifier="SCORE">
      <sum>
        <testVariables variableIdentifier="SCORE"/>
      </sum>
    </setOutcomeValue>
  </outcomeProcessing>

</assessmentTest>
```

### Content Package Manifest

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="PACKAGE-001"
          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
  <metadata>
    <schema>IMS QTI</schema>
    <schemaversion>2.2</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    <resource identifier="item1" type="imsqti_item_xmlv2p2" href="items/q1.xml">
      <file href="items/q1.xml"/>
      <file href="images/diagram.png"/>
    </resource>
  </resources>
</manifest>
```

---

# Part VI: QTI 3.0 Features

QTI 3.0 merges the QTI specification with the Accessible Portable Item Protocol (APIP), bringing first-class accessibility support into the core standard. The three major new capabilities introduced in QTI 3.0 — Portable Custom Interactions, Personal Needs and Preferences, and the Catalog system — are documented in detail here.

## 6.1 Portable Custom Interactions (PCI)

### Overview

Portable Custom Interactions replace the QTI 2.x `customInteraction` extension point with a fully standardized mechanism for delivering arbitrary interaction types across platforms. A PCI is a self-contained JavaScript module that implements a defined interface, enabling it to run in any conformant QTI 3.0 player without platform-specific integration.

The key advance over `customInteraction` is **portability**: a PCI carries its runtime code, dependencies, and configuration within a well-defined container, so the item can move between authoring systems and delivery platforms while the interaction remains fully functional.

### XML Structure

```xml
<qti-portable-custom-interaction
  response-identifier="RESPONSE"
  custom-interaction-type-identifier="org.example.chemistry-editor"
  module="./pci-modules/chem-editor/index.js">

  <qti-interaction-markup>
    <!-- HTML/SVG used as the initial DOM scaffold for the PCI -->
    <div id="chem-canvas" style="width:400px;height:300px;"></div>
  </qti-interaction-markup>

  <qti-interaction-modules>
    <qti-interaction-module id="chem-editor"
      primary-path="./pci-modules/chem-editor/index.js"
      fallback-path="./pci-modules/chem-editor/index-legacy.js"/>
  </qti-interaction-modules>

  <qti-pci-properties>
    <!-- Static configuration passed to the module at init -->
    <qti-pci-property name="allowedElements" value="C,H,O,N"/>
    <qti-pci-property name="displayMode" value="structural"/>
  </qti-pci-properties>

</qti-portable-custom-interaction>
```

### Module Interface

Every PCI module must implement the `IMSGLOBAL.PCI` interface:

```javascript
// pci-modules/chem-editor/index.js
export default {
  /**
   * Called once after the DOM scaffold is ready.
   * @param {HTMLElement} dom - The element matching qti-interaction-markup
   * @param {Object} config - Properties from qti-pci-properties
   * @param {Object} boundTo - Map of response variable identifiers to initial values
   */
  initialize(dom, config, boundTo) {
    // Set up the interaction UI
    this._editor = new ChemEditor(dom, config);
    if (boundTo.RESPONSE) {
      this._editor.loadState(boundTo.RESPONSE);
    }
  },

  /**
   * Called by the player when it needs the current response value.
   * Must return a value compatible with the responseDeclaration baseType/cardinality.
   * @returns {*} The current response
   */
  getResponse() {
    return this._editor.getState();
  },

  /**
   * Called by the player to restore a previously saved response.
   * @param {*} response - Previously returned getResponse() value
   */
  setResponse(response) {
    this._editor.loadState(response);
  },

  /**
   * Called when the item enters a state where interaction is not allowed
   * (e.g., after submission, review mode).
   */
  disable() {
    this._editor.setReadOnly(true);
  },

  /**
   * Called when the interaction should resume accepting input.
   */
  enable() {
    this._editor.setReadOnly(false);
  },

  /**
   * Optional. Called when the player destroys the item.
   * Clean up event listeners, timers, etc.
   */
  destroy() {
    this._editor.teardown();
  }
};
```

### Response Declaration

The response variable for a PCI is declared like any other, with the baseType and cardinality appropriate to the interaction's output:

```xml
<!-- Example: PCI returns a structured JSON string -->
<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string">
  <qti-correct-response>
    <qti-value>{"bonds":[{"from":"C1","to":"O1","type":"double"}]}</qti-value>
  </qti-correct-response>
</qti-response-declaration>
```

### Scoring PCI Responses

PCI responses can be scored using standard response processing if the value can be compared with standard operators:

```xml
<qti-response-processing>
  <qti-response-condition>
    <qti-response-if>
      <match>
        <variable identifier="RESPONSE"/>
        <correct identifier="RESPONSE"/>
      </match>
      <set-outcome-value identifier="SCORE">
        <base-value base-type="float">1</base-value>
      </set-outcome-value>
    </qti-response-if>
  </qti-response-condition>
</qti-response-processing>
```

For complex responses that require domain-specific evaluation (e.g., checking chemical structural equivalence rather than string equality), set `externalScored="externalMachine"` on the outcomeDeclaration and handle scoring outside the QTI runtime.

### Packaging and Distribution

PCI modules are packaged within the standard QTI content package. All module files referenced in `qti-interaction-modules` must be listed as resources in the package manifest:

```xml
<resource identifier="item-pci-chem" type="imsqti_item_xmlv3p0" href="items/chem-item.xml">
  <file href="items/chem-item.xml"/>
  <file href="pci-modules/chem-editor/index.js"/>
  <file href="pci-modules/chem-editor/index-legacy.js"/>
  <file href="pci-modules/chem-editor/chem-editor.css"/>
</resource>
```

### Key Differences from QTI 2.x customInteraction

| Aspect | QTI 2.x customInteraction | QTI 3.0 PCI |
|--------|--------------------------|------------|
| Module delivery | Platform-specific, external | Self-contained, in-package |
| Interface contract | None (platform defines) | Standardized IMSGLOBAL.PCI interface |
| Portability | None — platform coupling required | Full — runs in any conformant player |
| State management | Platform-specific | Standardized getResponse/setResponse |
| Fallback support | None | `fallback-path` on module element |
| Discovery | Out-of-band | `custom-interaction-type-identifier` |

---

## 6.2 Personal Needs and Preferences (PNP)

### Overview

Personal Needs and Preferences (PNP) is the APIP accessibility framework integrated into QTI 3.0. PNP allows a candidate's accessibility requirements to be expressed as a profile that drives delivery-time adaptation of content presentation. Rather than creating separate accessible versions of items, a single item can be rendered appropriately for many different needs based on the active PNP profile.

PNP profiles are typically stored at the platform level (associated with a student account), delivered to the player at session initialization, and applied dynamically during rendering.

### PNP Profile Structure

A PNP profile is a structured document (typically delivered as JSON or XML) describing the candidate's needs. The profile is organized into categories:

```json
{
  "pnp": {
    "accessForAllUser": {
      "userId": "student-12345",
      "userIdType": "platform"
    },
    "display": {
      "increaseDefaultFontSize": false,
      "colorOverlay": {
        "active": true,
        "colorScheme": "blackwhite"
      },
      "reverseContrast": false,
      "magnification": false
    },
    "content": {
      "glossaryOnScreen": true,
      "keywordTranslation": {
        "active": true,
        "languageCode": "es"
      },
      "extendedTime": {
        "active": true,
        "multiplier": 1.5
      }
    },
    "inputMethods": {
      "keyboardNavigation": true,
      "switchAccess": false
    },
    "cognitive": {
      "structuredLabelSupport": true,
      "eliminationTool": true
    }
  }
}
```

### Color Schemes

QTI 3.0 defines a standard set of named color schemes that players must support:

| Scheme Identifier | Description |
|-------------------|-------------|
| `default` | Platform default styling |
| `blackwhite` | Black text on white background |
| `whitenav` | White text on dark/navy background |
| `blackcream` | Black text on cream/off-white background |
| `yellowblue` | Yellow text on dark blue background |
| `medgray` | Dark text on medium gray background |

Players apply color schemes via CSS class or custom property injection:

```css
/* Example: blackwhite scheme */
.qti-pnp-colorscheme-blackwhite {
  --qti-bg-color: #ffffff;
  --qti-text-color: #000000;
  --qti-border-color: #000000;
  --qti-highlight-color: #000000;
  background-color: var(--qti-bg-color);
  color: var(--qti-text-color);
}
```

### Accessibility Tool Features

PNP controls which accessibility tools are available during item delivery:

**Elimination Tool:** Allows candidates to mark and hide choices they've ruled out.

```html
<!-- Player renders an elimination button per choice when eliminationTool is active -->
<div class="qti-choice" data-identifier="A">
  <span class="qti-choice-content">London</span>
  <button class="qti-eliminate-btn" aria-label="Eliminate this choice">✕</button>
</div>
```

**Structured Labels:** Augments interaction prompts and choice labels with additional structural markup for screen reader clarity.

**Keyword Translation:** When `keywordTranslation` is active, terms linked to catalog entries (see Section 6.3) are automatically presented with translations in the specified language.

### Extended Time

When `extendedTime` is present in the PNP profile, the delivery platform multiplies all declared time limits by the specified multiplier:

```
effective_time_limit = declared_time_limit × pnp.content.extendedTime.multiplier
```

This applies to both item-level `timeLimits` and test/section-level `timeLimits`.

### Item Authoring for PNP

Item authors should write items to be PNP-compatible from the start:

- Use the Catalog system (Section 6.3) to provide glossary definitions and keyword translations
- Use `aria-label` and `aria-describedby` consistently on interactive elements
- Avoid relying solely on color to convey meaning (contrast-scheme compatibility)
- Test items with multiple active color schemes
- Provide text alternatives for all media content

### PNP and the Player API

```typescript
// Pass a PNP profile at session initialization
const player = new Player(itemXml, {
  pnp: {
    colorScheme: 'blackwhite',
    glossaryOnScreen: true,
    keywordTranslation: { active: true, languageCode: 'es' },
    eliminationTool: true,
    extendedTime: { active: true, multiplier: 1.5 }
  }
});

// PNP profile can also be updated dynamically (e.g., mid-session adjustments)
player.updatePnp({ colorScheme: 'yellowblue' });
```

---

## 6.3 Catalog System

### Overview

The Catalog system provides a structured mechanism for attaching supplementary information to content within an item — most commonly glossary definitions, translations, and reading-level adaptations. Unlike inline annotations, catalog content is decoupled from the item body text and only surfaced based on the active PNP profile or explicit candidate request.

The catalog is particularly powerful in combination with PNP: when `glossaryOnScreen` is active in the candidate's PNP profile, catalog entries are automatically surfaced for linked terms without any author intervention beyond the initial linking.

### Linking Content to Catalog Entries

Text in the item body is linked to catalog entries using the `data-catalog-idref` attribute:

```xml
<qti-item-body>
  <p>
    The process of <span data-catalog-idref="cat-photosynthesis">photosynthesis</span>
    converts light energy into <span data-catalog-idref="cat-glucose">glucose</span>.
  </p>
</qti-item-body>
```

### Catalog Structure

The `qti-catalog` element lives at the item level, parallel to `qti-item-body`:

```xml
<qti-catalog id="item-catalog">

  <qti-card identifier="cat-photosynthesis">

    <!-- Default text definition (shown when no language-specific match) -->
    <qti-card-entry catalog-idref="cat-photosynthesis" usage="glossary-on-screen">
      <qti-html-content>
        <p>The process by which green plants use sunlight, water, and carbon dioxide
        to produce oxygen and energy in the form of glucose.</p>
      </qti-html-content>
    </qti-card-entry>

    <!-- Spanish translation -->
    <qti-card-entry catalog-idref="cat-photosynthesis" usage="keyword-translation" xml:lang="es">
      <qti-html-content>
        <p>El proceso mediante el cual las plantas verdes usan la luz solar, el agua
        y el dióxido de carbono para producir oxígeno y glucosa.</p>
      </qti-html-content>
    </qti-card-entry>

    <!-- Text-to-speech phonetic hint -->
    <qti-card-entry catalog-idref="cat-photosynthesis" usage="tts-pronunciation">
      <qti-html-content>foh-toh-SIN-thuh-sis</qti-html-content>
    </qti-card-entry>

  </qti-card>

  <qti-card identifier="cat-glucose">
    <qti-card-entry catalog-idref="cat-glucose" usage="glossary-on-screen">
      <qti-html-content>
        <p>A simple sugar that is an important energy source in living organisms.</p>
      </qti-html-content>
    </qti-card-entry>
  </qti-card>

</qti-catalog>
```

### Card Entry Usage Values

| Usage | Description |
|-------|-------------|
| `glossary-on-screen` | Displayed when `glossaryOnScreen` is true in PNP, or when candidate explicitly requests definition |
| `keyword-translation` | Displayed when `keywordTranslation` is active in PNP for the matching `xml:lang` |
| `tts-pronunciation` | Read by the TTS engine instead of the standard text pronunciation |
| `illustrated-glossary` | Image-based definition (can contain `<img>` or SVG) |
| `signing-definition` | Sign-language video for the term |
| `braille-text` | Braille-optimized text for refreshable braille displays |

### Rendering Catalog Entries

Players surface catalog content in several ways depending on PNP configuration and candidate action:

**Tooltip/Popup (most common):** When `glossaryOnScreen` is active, linked terms gain a visual indicator. Hovering or tapping opens a popup showing the matching `glossary-on-screen` entry.

**Inline expansion:** Some players inject the definition inline, toggled by a button.

**Keyword translation panel:** When `keywordTranslation` is active, a side panel or overlay shows the translated definitions for all visible linked terms.

```typescript
// Player surfaces catalog entries based on PNP
const player = new Player(itemXml, {
  pnp: {
    glossaryOnScreen: true,
    keywordTranslation: { active: true, languageCode: 'es' }
  }
});

// The player will automatically:
// 1. Identify all elements with data-catalog-idref in the item body
// 2. For glossaryOnScreen: add tooltip triggers to linked terms
// 3. For keywordTranslation: find qti-card-entry elements with usage="keyword-translation"
//    and the matching xml:lang, and surface those
```

### Shared Catalogs (External Catalog References)

For large item banks where many items share the same glossary terms, QTI 3.0 supports referencing an external catalog file rather than embedding per-item catalogs. The external catalog file follows the same `qti-catalog` structure and is referenced from the content package manifest.

This reduces content duplication significantly for standardized term sets (subject-area vocabulary, accessibility terms, etc.).

---

# Part VII: Implementation Guidance

## 7.1 Conformance Profiles

1EdTech defines certification through profiles constraining the full specification:

| Profile | Description |
|---------|-------------|
| **Entry Level** | Basic interactions (choice, text entry, extended text), standard response templates |
| **Core Level** | Additional interactions, custom response processing, test sections |
| **Full Level** | All 21 interactions, adaptive items, templates, complete feature set |

**Four certification categories exist:**

1. **Authoring Systems** — Create QTI content
2. **Delivery Systems** — Present and score QTI content
3. **Item Bank Systems** — Store and manage QTI content (must preserve unchanged)
4. **Content Packages** — Bundled QTI content for exchange

The **CC QTI Package** profile represents the most widely supported minimal subset — validated as importable across multiple QTI 2.x implementations during interoperability testing. Targeting this profile maximizes portability.

QTI 3.0 introduces its own certification program with additional conformance levels covering PCI hosting, PNP support, and catalog rendering.

## 7.2 Common Implementation Issues

- **Version incompatibility** between 1.x and 2.x (fundamentally different models)
- **Incomplete implementations** claiming QTI support with low actual compliance
- **Custom interactions and operators** reducing portability
- **Inconsistent rendering** of complex graphical interactions
- **Namespace declaration errors** in exported content
- **Identifier case sensitivity** (QTI 2.x identifiers are case-sensitive, unlike 1.x)
- **Missing or incorrect schema locations** causing validation failures
- **Floating-point comparison** issues in scoring (use tolerance)
- **QTI 3.0 attribute casing** — Multi-word attributes must be kebab-case; mixed conventions cause parse failures in strict players
- **PCI module loading failures** — Ensure all module paths listed in `qti-interaction-modules` are included in the content package manifest

## 7.3 Best Practices

### Content Authoring

- Target the **CC QTI Package profile** for maximum portability across QTI 2.x systems
- Use **standard response processing templates** whenever possible
- **Validate content against official XSDs** before export
- Limit identifiers to **32 characters** for compatibility
- Use meaningful, descriptive identifiers (not just "A", "B", "C")
- Include `correctResponse` even when using custom processing
- For QTI 3.0 content, add catalog entries for domain-specific vocabulary from the start

### Scoring Implementation

- Handle **NULL vs default values** for empty responses
- Implement **lowerBound enforcement** to prevent negative scores
- Use **tolerance** in floating-point comparisons
- Cache compiled response processing rules for performance

### Delivery Implementation

- Disable external entity processing in XML parsing
- Handle namespace declarations strictly
- Provide graceful degradation for unsupported interactions
- Implement proper time tracking for `timeDependent` items
- Apply PNP profiles before rendering — not after — to avoid layout reflow

### Validation Resources

- **1EdTech online validator** (members only) — Official certification testing
- **QTIWorks validator** — Public alternative validation for QTI 2.x
- **Official XSD schemas** — Available at imsglobal.org

---

# Conclusion

QTI defines the standard for assessment interoperability across the educational technology ecosystem. The 2.x series (2.1 and 2.2) provides a stable, broadly adopted foundation with strong tooling and certification programs. QTI 3.0 modernizes the specification by merging with APIP to bring first-class accessibility features — PCI, PNP, and the Catalog system — into the core standard, at the cost of a non-backward-compatible syntax change.

For maximum interoperability with today's installed base, target QTI 2.2. For new authoring infrastructure where accessibility and extensibility are priorities, QTI 3.0 is the forward path.

Key implementation principles apply across all versions:

1. **Use standard response processing templates** when possible
2. **Validate content rigorously** against official schemas before export
3. **Treat identifiers as case-sensitive** throughout
4. **Design for portability** — custom interactions and operators reduce the range of systems that can consume content

---

## References

- **Local snapshot (preferred)**: [SPEC_SNAPSHOTS.md](./SPEC_SNAPSHOTS.md)
- **QTI 2.2 canonical source**: [`https://www.imsglobal.org/content/question-and-test-interoperability-v222-final`](https://www.imsglobal.org/content/question-and-test-interoperability-v222-final)
- **QTI 3.0 specification**: [`https://www.imsglobal.org/spec/qti/v3p0/`](https://www.imsglobal.org/spec/qti/v3p0/)
- **1EdTech standards landing**: [`https://www.1edtech.org/standards/qti/index`](https://www.1edtech.org/standards/qti/index)

---

*Document Version: 2.0 | Updated: March 2026*
