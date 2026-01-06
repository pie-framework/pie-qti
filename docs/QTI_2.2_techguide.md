# IMS QTI 2.2: Comprehensive Technical Implementation Guide

**Question and Test Interoperability Specification**

*Version 2.2 Final Release | September 2015*

## Spec snapshots (local)

This repo keeps local, greppable spec snapshots for QTI work. See [SPEC_SNAPSHOTS.md](./SPEC_SNAPSHOTS.md) (QTI **2.2.2** primary reference; supports QTI **2.1–2.2.x** input).

---

## Table of Contents

- [Part I: Specification Overview](#part-i-specification-overview)
  - [1.1 Purpose and Scope](#11-purpose-and-scope)
  - [1.2 Historical Evolution](#12-historical-evolution)
  - [1.3 QTI 2.2 Key Enhancements](#13-qti-22-key-enhancements)
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
- [Part VI: Implementation Guidance](#part-vi-implementation-guidance)
  - [6.1 Conformance Profiles](#61-conformance-profiles)
  - [6.2 Common Implementation Issues](#62-common-implementation-issues)
  - [6.3 Best Practices](#63-best-practices)
  - [6.4 Available Libraries and Tools](#64-available-libraries-and-tools)
- [Conclusion](#conclusion)

---

# Part I: Specification Overview

## 1.1 Purpose and Scope

The **IMS Question and Test Interoperability (QTI) 2.2 specification** defines a standardized XML format for representing assessment content, enabling portable exchange of questions and tests between authoring systems, delivery platforms, item banks, and learning management systems. Released September 1, 2015 by the IMS Global Learning Consortium (now 1EdTech), QTI 2.2 represents the mature evolution of assessment interoperability standards.

QTI solves a fundamental problem in educational technology: **vendor lock-in of assessment content**. Organizations investing significant resources in question development can preserve that investment when changing platforms, as content authored in QTI format transfers freely between any certified system.

The specification supports everything from simple multiple-choice quizzes to complex adaptive assessments with multimedia, mathematical notation, and sophisticated scoring logic.

## 1.2 Historical Evolution

| Version | Release Date | Key Developments |
|---------|--------------|------------------|
| 1.0 | February 2000 | First public specification based on QuestionMark's QML |
| 1.2 | January 2002 | Major update; over 6,000 downloads by Feb 2002 |
| 2.0 | January 2005 | Complete redesign focusing on individual assessment items |
| 2.1 | August 2012 | Added tests, sections, results reporting; major adoption milestone |
| **2.2** | **September 2015** | **HTML5 elements, WAI-ARIA accessibility, MathML v3, CSS3 Speech** |
| 3.0 | May 2022 | Merged QTI with APIP; NOT backward compatible with 2.x |

QTI 2.2 continues receiving maintenance updates, with version 2.2.4 released in March 2021 containing XSD corrections.

## 1.3 QTI 2.2 Key Enhancements

QTI 2.2's key enhancements over version 2.1 centered on web standards modernization:

- **HTML5 elements:** `figure`, `figcaption`, `audio`, `video`, `section`, `article`, `nav`, `aside`, `header`, `footer`
- **WAI-ARIA accessibility attributes:** `role`, `aria-label`, `aria-describedby`, `aria-hidden`, and more
- **MathML version 3:** Enhanced mathematical notation support with template variable integration
- **CSS3 Speech integration:** Text-to-speech control for accessibility
- **Bidirectional text support:** `dir` attribute for right-to-left languages
- **Ruby markup:** East Asian language annotation support

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

QTI 2.2 supports **21 interaction types** organized into four functional categories. Each interaction binds to a response variable through the required `responseIdentifier` attribute.

## 3.1 Simple Selection Interactions

### 3.1.1 choiceInteraction

**Purpose:** Presents a set of choices for the candidate to select one or more options. This is the most common interaction type, used for single-choice (radio button) and multiple-choice (checkbox) questions.

**Response Binding:** Bound to a response variable with baseType `identifier` and cardinality `single` (for maxChoices=1) or `multiple` (for maxChoices>1 or 0).

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `shuffle` | Optional | Boolean. If true, randomizes choice order on delivery. Default: false |
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
| `showHide` | Optional | 'show' or 'hide' - controls template-based visibility |

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

**XML Example:**

```xml
<orderInteraction responseIdentifier="RESPONSE" shuffle="true">
  <prompt>Arrange these events in chronological order:</prompt>
  <simpleChoice identifier="A">World War I begins</simpleChoice>
  <simpleChoice identifier="B">Moon landing</simpleChoice>
  <simpleChoice identifier="C">Fall of Berlin Wall</simpleChoice>
</orderInteraction>
```

**Implementation Notes:** Typically implemented with drag-and-drop UI. Use the `fixed` attribute on choices to prevent specific items from being shuffled (e.g., ensure the initial presentation never shows the correct answer). Response stores identifiers in candidate's chosen order.

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

**Structure:**

- Contains exactly two `simpleMatchSet` elements
- Each simpleMatchSet contains `simpleAssociableChoice` elements with matchMax/matchMin

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

**Implementation Notes:** Gap elements appear inline within paragraph content. The `matchMax` attribute on gapText/gapImg controls how many times each choice can be used. This is ideal for cloze-style reading comprehension tests.

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

**XML Example:**

```xml
<p>The chemical formula for water is 
  <inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false">
    <inlineChoice identifier="A">CO2</inlineChoice>
    <inlineChoice identifier="B">H2O</inlineChoice>
    <inlineChoice identifier="C">NaCl</inlineChoice>
  </inlineChoiceInteraction>.
</p>
```

**Implementation Notes:** Render as a dropdown/select element inline with surrounding text. The `label` element (QTI 2.2+) can provide placeholder text before the candidate makes a selection.

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

**XML Example:**

```xml
<p>The year World War II ended was 
  <textEntryInteraction responseIdentifier="RESPONSE" 
      expectedLength="4" patternMask="[0-9]{4}"/>.
</p>
```

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
| `format` | Optional | 'plain', 'preFormatted', or 'xhtml' - indicates expected content type |
| `patternMask` | Optional | Regular expression for validation |
| `placeholderText` | Optional | Hint text displayed when empty |

**XML Example:**

```xml
<extendedTextInteraction responseIdentifier="RESPONSE" 
    expectedLines="10" format="plain">
  <prompt>Discuss the causes of World War I in 500 words or less.</prompt>
</extendedTextInteraction>
```

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
  <hotspotChoice identifier="ES" shape="poly" coords="80,180,120,160,140,200,90,220"/>
</hotspotInteraction>
```

**Implementation Notes:** The delivery engine must clearly indicate selected hotspots. Hotspots may or may not be visually indicated before selection depending on item design. Coordinates are relative to the image's natural dimensions.

---

### 3.3.2 selectPointInteraction

**Purpose:** Allows the candidate to click one or more points on an image. Unlike hotspotInteraction, the valid regions are NOT shown to the candidate—this creates "hidden hotspot" questions.

**Response Binding:** Bound to a response variable with baseType `point` (format: "x y") and cardinality `single` or `multiple`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `maxChoices` | Optional | Maximum points selectable. 0=unlimited. Default: 1 |
| `minChoices` | Optional | Minimum points required. Default: 0 |

**XML Example:**

```xml
<selectPointInteraction responseIdentifier="RESPONSE" maxChoices="1">
  <prompt>Click on Edinburgh on the map:</prompt>
  <object type="image/png" data="uk_map.png" width="300" height="400"/>
</selectPointInteraction>
```

**Scoring with areaMapping:**

```xml
<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="point">
  <areaMapping defaultValue="0">
    <areaMapEntry shape="circle" coords="145,85,20" mappedValue="1"/>
  </areaMapping>
</responseDeclaration>
```

**Implementation Notes:** Use `areaMapping` in the responseDeclaration to score point responses. The areaMapping defines regions with associated scores—candidates receive points based on where they click without seeing the target zones. Show only the clicked point(s), never the scoring regions.

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

**Implementation Notes:** Display numbers or other indicators showing the order in which hotspots were selected. Allow candidates to reset and reorder their selections.

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

**Implementation Notes:** Uses `associableHotspot` elements with `matchMax` controlling how many times each hotspot can be used. Typically rendered by drawing lines between associated hotspots.

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

**XML Example:**

```xml
<graphicGapMatchInteraction responseIdentifier="RESPONSE">
  <prompt>Drag the labels to the correct parts of the cell:</prompt>
  <object type="image/png" data="cell_diagram.png" width="400" height="300"/>
  <gapImg identifier="L1" matchMax="1">
    <object type="image/png" data="nucleus_label.png" width="60" height="20"/>
  </gapImg>
  <gapImg identifier="L2" matchMax="1">
    <object type="image/png" data="membrane_label.png" width="60" height="20"/>
  </gapImg>
  <associableHotspot identifier="H1" shape="circle" coords="200,150,30" matchMax="1"/>
  <associableHotspot identifier="H2" shape="rect" coords="50,50,350,250" matchMax="1"/>
</graphicGapMatchInteraction>
```

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

**Structure:**

Must be contained within a `positionObjectStage` element which provides the background:

```xml
<positionObjectStage>
  <object type="image/png" data="background.png" width="400" height="300"/>
  <positionObjectInteraction responseIdentifier="RESPONSE" maxChoices="1">
    <object type="image/png" data="marker.png" width="20" height="20"/>
  </positionObjectInteraction>
</positionObjectStage>
```

**Implementation Notes:** Multiple positionObjectInteractions can share the same stage. The response records where the candidate placed the moveable object. Use `areaMapping` for scoring based on placement regions.

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

**XML Example:**

```xml
<sliderInteraction responseIdentifier="RESPONSE"
    lowerBound="0" upperBound="100" step="5" stepLabel="true">
  <prompt>Rate your confidence level (0-100%):</prompt>
</sliderInteraction>
```

**Implementation Notes:** Provide clear visual feedback of current value. Consider accessibility—ensure keyboard navigation works. The `step` attribute constrains valid values (e.g., step=5 means only 0, 5, 10, 15... are valid).

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

**XML Example (using object):**

```xml
<mediaInteraction responseIdentifier="RESPONSE" minPlays="1" maxPlays="3">
  <prompt>Listen to the audio clip, then answer the questions below:</prompt>
  <object type="audio/mpeg" data="listening_passage.mp3"/>
</mediaInteraction>
```

**XML Example (using HTML5 audio - QTI 2.2):**

```xml
<mediaInteraction responseIdentifier="RESPONSE" minPlays="1">
  <audio>
    <source src="listening_passage.mp3" type="audio/mpeg"/>
    <source src="listening_passage.ogg" type="audio/ogg"/>
  </audio>
</mediaInteraction>
```

**Implementation Notes:** QTI 2.2 adds native `audio` and `video` elements alongside the traditional `object` element. Use `minPlays` to enforce listening/viewing requirements. The response variable tracks play count for validation.

---

### 3.4.3 drawingInteraction

**Purpose:** Provides a freehand drawing canvas where candidates can sketch responses. The drawing occurs on a provided background image which also determines output dimensions and format.

**Response Binding:** Bound to a response variable with baseType `file` and cardinality `single`. The response is the drawing as image data.

**Structure:**

```xml
<drawingInteraction responseIdentifier="RESPONSE">
  <prompt>Draw a diagram of photosynthesis:</prompt>
  <object type="image/png" data="blank_canvas.png" width="400" height="300"/>
</drawingInteraction>
```

**Implementation Notes:** Requires a canvas-capable rendering environment. The `object` element provides the background/canvas and determines output format. Typically requires human scoring. Provide basic drawing tools (pen, eraser, color selection). Consider touch device support.

---

### 3.4.4 uploadInteraction

**Purpose:** Allows candidates to upload a file as their response. Used for submitting documents, spreadsheets, code files, or other artifacts.

**Response Binding:** Bound to a response variable with baseType `file` and cardinality `single`.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `type` | Optional | MIME type constraint for accepted files (e.g., 'application/pdf') |

**XML Example:**

```xml
<uploadInteraction responseIdentifier="RESPONSE" type="application/pdf">
  <prompt>Upload your completed assignment as a PDF file:</prompt>
</uploadInteraction>
```

**Implementation Notes:** Response processing for file-based questions is typically out of scope—files usually require human review or external processing systems. Implement file size limits and security scanning. Consider providing progress feedback for large uploads.

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

**XML Example:**

```xml
<responseDeclaration identifier="HINT" cardinality="single" baseType="boolean"/>

<itemBody>
  <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
    <prompt>What is the capital of Australia?</prompt>
    <simpleChoice identifier="A">Sydney</simpleChoice>
    <simpleChoice identifier="B">Melbourne</simpleChoice>
    <simpleChoice identifier="C">Canberra</simpleChoice>
  </choiceInteraction>
  <endAttemptInteraction responseIdentifier="HINT" 
      title="Request Hint" countAttempt="false"/>
</itemBody>
```

**Implementation Notes:** Combine with `adaptive='true'` on the item and responseProcessing logic that checks the button's response variable. Use `countAttempt='false'` for hint requests that shouldn't penalize the candidate. The item continues presenting until `completionStatus` is set to "completed".

---

### 3.4.6 customInteraction

**Purpose:** Extension point for proprietary interaction types not covered by standard QTI interactions. Allows platform-specific features while maintaining overall QTI structure.

**Response Binding:** Response type depends on the custom implementation.

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `responseIdentifier` | Required | Identifier binding to responseDeclaration |
| `class` | Optional | Implementation class identifier |
| `extension` | Optional | Additional extension data |

**Structure:**

```xml
<customInteraction responseIdentifier="RESPONSE" class="myPlatform.chemEditor">
  <!-- Platform-specific content -->
  <extension>
    <!-- Custom configuration data -->
  </extension>
</customInteraction>
```

**Implementation Notes:** Using customInteraction trades interoperability for capability. Content using custom interactions may not transfer between platforms. QTI 3.0 introduces Portable Custom Interactions (PCI) for better standardized extensibility. Document any custom interactions thoroughly for potential migration.

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

| Namespace URI | Purpose |
|--------------|---------|
| `http://www.imsglobal.org/xsd/imsqti_v2p2` | Core QTI ASI content |
| `http://www.imsglobal.org/xsd/imsqti_result_v2p2` | Results reporting |
| `http://www.imsglobal.org/xsd/imsqti_metadata_v2p2` | QTI-specific metadata |
| `http://www.w3.org/1998/Math/MathML` | Mathematical content |
| `http://www.imsglobal.org/xsd/imscp_v1p1` | Content packaging manifest |

## 5.2 Document Structure

### Assessment Item Structure

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

# Part VI: Implementation Guidance

## 6.1 Conformance Profiles

1EdTech defines certification through profiles constraining the full specification:

| Profile | Description |
|---------|-------------|
| **Entry Level** | Basic interactions (choice, text entry, extended text), standard response templates |
| **Core Level** | Additional interactions, custom response processing, test sections |
| **Full Level** | All 21 interactions, adaptive items, templates, complete feature set |

**Four certification categories exist:**

1. **Authoring Systems** - Create QTI content
2. **Delivery Systems** - Present and score QTI content
3. **Item Bank Systems** - Store and manage QTI content (must preserve unchanged)
4. **Content Packages** - Bundled QTI content for exchange

The **CC QTI Package** profile represents the most widely supported minimal subset—validated as importable across multiple QTI 2.x implementations during interoperability testing. Targeting this profile maximizes portability.

## 6.2 Common Implementation Issues

- **Version incompatibility** between 1.x and 2.x (fundamentally different models)
- **Incomplete implementations** claiming QTI support with low actual compliance
- **Custom interactions and operators** reducing portability
- **Inconsistent rendering** of complex graphical interactions
- **Namespace declaration errors** in exported content
- **Identifier case sensitivity** (QTI 2.x identifiers are case-sensitive, unlike 1.x)
- **Missing or incorrect schema locations** causing validation failures
- **Floating-point comparison** issues in scoring (use tolerance)

## 6.3 Best Practices

### Content Authoring

- Target the **CC QTI Package profile** for maximum portability
- Use **standard response processing templates** whenever possible
- **Validate content against official XSDs** before export
- Limit identifiers to **32 characters** for compatibility
- Use meaningful, descriptive identifiers (not just "A", "B", "C")
- Include `correctResponse` even when using custom processing

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

### Validation Resources

- **1EdTech online validator** (members only) - Official certification testing
- **QTIWorks validator** - Public alternative validation
- **Official XSD schemas** - Available at imsglobal.org

---

# Conclusion

QTI 2.2 represents the stable, mature standard for assessment interoperability with broad industry adoption. Its hierarchical data model cleanly separates test structure from item content, while the extensive interaction type library covers virtually all assessment scenarios. The specification's use of standard XML with formal XSD validation ensures content can be reliably exchanged between systems.

For maximum interoperability, implementers should:

1. **Target the CC QTI Package profile** for widest compatibility
2. **Use standard response processing templates** when possible
3. **Validate content rigorously** against official schemas before export
4. **Test imports/exports** across multiple platforms

While QTI 3.0 offers modernized features and native accessibility integration, QTI 2.2 remains widely deployed with continued maintenance support (version 2.2.4 released March 2021).

The key to successful QTI implementation lies in understanding that the specification prioritizes **portability over presentation**—content should transfer between systems even if rendered somewhat differently. This design philosophy enables the vendor-neutral assessment ecosystem that benefits educational institutions, publishers, and assessment organizations worldwide.

---

## References

- **Local snapshot (preferred)**: [SPEC_SNAPSHOTS.md](./SPEC_SNAPSHOTS.md)
- **Canonical source page**: [`https://www.imsglobal.org/content/question-and-test-interoperability-v222-final`](https://www.imsglobal.org/content/question-and-test-interoperability-v222-final)
- **1EdTech standards landing**: [`https://www.1edtech.org/standards/qti/index`](https://www.1edtech.org/standards/qti/index)

---

*Document Version: 1.0 | Generated: December 2024*
