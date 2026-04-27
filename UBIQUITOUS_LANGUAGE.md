# Ubiquitous Language

## Assessment structure

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **AssessmentTest** | A top-level QTI document that organizes items into test parts and sections, with navigation rules, time limits, and scoring. | Test, Exam, Quiz |
| **TestPart** | The top-level organizational container within an AssessmentTest. Controls submission mode and item session rules. | Routing container, Test section |
| **Section** | An ordered container of item references within a TestPart. May have its own time limit and rubric blocks. | Subsection (only acceptable when describing nesting) |
| **AssessmentItem** | A single, self-contained unit of assessment content — the canonical QTI representation (XML). | Item (acceptable shorthand), Question, Task |
| **PieItem** | A JSON-based representation of an AssessmentItem in the PIE format. Structurally equivalent; used for authoring and interchange. | PIE question |
| **Stimulus** | Shared reading or visual content that provides context for one or more AssessmentItems. Rendered alongside but separate from items. | Passage, Reading passage |
| **ItemRef** | A reference from a Section to an AssessmentItem, carrying rendering hints and session constraints. Not the item itself. | Item pointer |

## Variables & scoring

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **ResponseDeclaration** | A QTI variable that holds the candidate's answer for one interaction. Defines expected baseType and cardinality. | Response variable |
| **OutcomeDeclaration** | A QTI variable that holds a computed result (score, feedback identifier). Set by ResponseProcessing. | Score variable, Result variable |
| **TemplateDeclaration** | A QTI variable used to randomize or parameterize an item before presentation. Set before rendering. | Template variable |
| **BaseType** | The scalar data type of a variable's value (e.g., `string`, `integer`, `float`, `identifier`, `pair`, `point`). | Type, Data type |
| **Cardinality** | The multiplicity of a variable's value: `single`, `multiple`, or `ordered`. | Multiplicity |
| **CorrectResponse** | The authoritative expected answer stored in a ResponseDeclaration. Used for automatic scoring and review display. | Answer key, Keyed response |
| **Mapping** | A lookup table inside a ResponseDeclaration that maps response values to partial scores. | Score map, Scoring table |
| **AreaMapping** | A Mapping variant for spatial (hotspot) responses; maps coordinate regions to scores. | |
| **ResponseProcessing** | The deterministic rule set that evaluates a candidate's responses and writes values to OutcomeDeclarations. | Scoring rules, Scoring engine |
| **ScoringResult** | The output of ResponseProcessing for one item: score, maxScore, outcome values, and any triggered feedback. | Score result |

## Interactions

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Interaction** | A rendered UI element where a candidate provides a response. Every interaction maps to exactly one ResponseDeclaration. | Question, Prompt, Input |
| **Response** | The value a candidate has entered for a specific Interaction during a session. | Answer, User input |
| **ModalFeedback** | Feedback content shown after submission when an outcome value matches a declared condition. | Popup feedback, Result feedback |
| **RubricBlock** | Role-filtered instructional or grading content associated with an item or section. Displayed to specific roles only. | Instructions, Rubric, Grading guide |

## Sessions & navigation

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **ItemSession** | The runtime state of one candidate's interaction with a single AssessmentItem: responses, attempts, completion status. | Item state |
| **AssessmentSession** | The full runtime state of a candidate working through an AssessmentTest: current position, all ItemSessions, timing. | Test session, Attempt |
| **NavigationMode** | Controls whether a candidate must answer items sequentially (`linear`) or may navigate freely (`nonlinear`). | Nav mode |
| **SubmissionMode** | Controls when responses are submitted for scoring: `individual` (per item) or `simultaneous` (all at end). | |
| **CompletionStatus** | The lifecycle state of an ItemSession: `not_attempted`, `unknown`, `incomplete`, `completed`. | Item status |
| **AdaptiveItem** | An AssessmentItem that allows multiple attempts; CompletionStatus may cycle between `incomplete` and `completed`. | Retry item, Multi-attempt item |

## Roles & access

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Role** | The actor type viewing an item, which determines visibility of content such as RubricBlocks and CorrectResponses. | View, Audience, Actor |
| **Candidate** | A Role representing the test taker. Sees the item prompt and interactions; never sees CorrectResponse or scorer rubrics. | Student, Test taker, User |
| **Scorer** | A Role representing a human grader. May see CorrectResponse and rubric content hidden from Candidate. | Grader, Rater |
| **Proctor** | A Role representing a test administrator. Sees administrative controls; no access to scoring content. | Administrator |
| **Author** | A Role representing an item creator. Has full visibility into all content. | TestConstructor (QTI term — acceptable in spec references) |
| **RolePolicy** | The runtime rules that enforce content visibility and interaction behavior for a given Role. | Permission model |

## Formats & transformation

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **QTI** | The IMS/1EdTech XML-based standard for assessment content interchange (versions 2.1, 2.2). | QTI format |
| **PIE** | The JSON-based Portable Interactions & Elements format — the system's internal authoring representation. | PIE format |
| **TransformPlugin** | A registered unit that converts content between one format pair (e.g., QTI → PIE or PIE → QTI). | Transformer, Converter |
| **VendorExtension** | A TransformPlugin that handles a specific vendor's dialect of QTI. Takes precedence over generic plugins. | Vendor transformer |
| **VendorInfo** | Detected metadata about the vendor origin of a QTI document (name, confidence level). | Vendor metadata |
| **AssetResolver** | A component that loads external resources (images, audio, CSS) referenced within content during transformation. | Resource loader |
| **TransformContext** | Runtime data passed through a transformation pipeline: source format, target format, metadata, and options. | Transform config |

## Player architecture

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **ItemPlayer** | The component responsible for rendering a single AssessmentItem, managing its interactions and lifecycle. | Item renderer |
| **AssessmentPlayer** | The shell that sequences ItemSessions through an AssessmentTest, delegating rendering to the ItemPlayer. | Test player |
| **ComponentRegistry** | A priority-ordered registry that maps an Interaction type to the web component tag used to render it. | Component map |
| **ExtractionRegistry** | A priority-ordered registry of extractors that parse QTI XML and produce typed InteractionData. | Extractor map |
| **Plugin** | An installable extension that registers extractors, components, and lifecycle hooks with the ItemPlayer. | Extension, Add-on |
| **PlayerConfig** | The configuration object passed to the ItemPlayer: role, seed, security settings, and registered plugins. | Config, Options |
| **BackendAdapter** | The interface through which the AssessmentPlayer communicates with the server for scoring and state persistence. | Server adapter, API adapter |

## Relationships

- An **AssessmentTest** contains one or more **TestParts**.
- A **TestPart** contains one or more **Sections**; Sections may be nested.
- A **Section** contains one or more **ItemRefs**.
- Each **ItemRef** points to exactly one **AssessmentItem**.
- An **AssessmentItem** declares one or more **ResponseDeclarations** and one or more **OutcomeDeclarations**.
- Each **Interaction** in an item is bound to exactly one **ResponseDeclaration**.
- **ResponseProcessing** reads **Responses** from **ResponseDeclarations** and writes computed values to **OutcomeDeclarations**.
- A **RolePolicy** is derived from the active **Role** and governs visibility of **RubricBlocks**, **CorrectResponses**, and **ModalFeedback**.
- An **AssessmentSession** contains one **ItemSession** per **ItemRef** visited.
- A **PieItem** and an **AssessmentItem** are equivalent domain entities in different formats; a **TransformPlugin** converts between them.

## Example dialogue

> **Dev:** "When a **Candidate** submits a **Response** for a **choiceInteraction**, who triggers **ResponseProcessing**?"
>
> **Domain expert:** "The **ItemPlayer** triggers it immediately if the **SubmissionMode** is `individual`. **ResponseProcessing** reads the **Response** from the **ResponseDeclaration**, evaluates the rules, and writes the score to the **OutcomeDeclaration**. Then the **ScoringResult** is returned to the caller."
>
> **Dev:** "So the **CorrectResponse** is never sent to the **Candidate**?"
>
> **Domain expert:** "Right — the **RolePolicy** for the **Candidate** role strips **CorrectResponse** from the serialized **ResponseDeclaration** before it leaves the server. The **BackendAdapter** enforces this on the **SecureItemRef**. The **Scorer** role gets it."
>
> **Dev:** "What if the item is **Adaptive**? Can the **Candidate** keep trying?"
>
> **Domain expert:** "Yes. After each attempt, **ResponseProcessing** runs and writes a new **CompletionStatus** to the `completionStatus` **OutcomeDeclaration**. If it's `incomplete`, the **ItemSession** stays open and the **ItemPlayer** allows another **Response**. Once it's `completed` — or max attempts is hit — the session closes."
>
> **Dev:** "And if the same **Stimulus** is shared across three **AssessmentItems** in a **Section**, is it loaded three times?"
>
> **Domain expert:** "No. The **PassageRegistry** deduplicates **Stimuli** during transformation. Each **ItemRef** in the **Section** gets a reference to the same resolved **Stimulus**; it renders once, alongside all three items."

## PIE ecosystem

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **PIE** | Portable Interactions & Elements — an open-source framework for building reusable, package-based assessment interactions. QTI-aligned but JSON/web-component native. | PIE format (too narrow) |
| **Element** | A self-contained, npm-published interaction component (e.g., `@pie-element/multiple-choice`). The PIE equivalent of a QTI interaction type, but delivered as a reusable package. | Plugin, Widget, Component (reserved for UI internals) |
| **PieModel** | The JSON configuration object that defines both the question setup (prompt, choices, scoring rules) and the student's response state for one Element. Passed to the Controller at render time. | Config, Model object |
| **Controller** | The pure TypeScript module (`controller.ts`) that transforms PieModel + PieSession + Environment → ViewModel and computes scoring outcomes. No UI; fully testable in isolation. | Scoring engine, Response processor |
| **PieSession** | The JSON object that records a student's current response for one Element. Mutated by the Element UI and read by the Controller. | Session data, Answer object |
| **ViewModel** | The output of `controller.model()`: a derived, render-ready snapshot of the PieModel adapted for the current Environment. Consumed by the Element UI. | Render model, Display model |
| **Environment** | The runtime context passed to every Controller call: current Mode, Role, accessibility settings, and scoring flags. No QTI equivalent. | Context, Config |
| **Mode** | The UI phase of an assessment: `gather` (responding), `view` (reviewing own answer), `evaluate` (seeing scored result), `author` (configuring the item). | State, Phase |
| **ElementView** | One of the UI variants an Element exposes: `delivery` (student/teacher interaction), `author` (configuration), `print` (static output). Accessed via ESM subpath exports. | Variant, Export |
| **PieScore** | The scoring output of `controller.outcome()`: a normalized 0–1 score, an `empty` flag, and an optional `completed` flag. Not the same as a QTI OutcomeDeclaration value. | Score, Outcome (use qualified form) |
| **Tool** | An assistive or productivity utility available to candidates during assessment (calculator, text-to-speech, ruler, annotation toolbar). Configured per-assessment. | Widget, Accommodation (Tools are distinct from Accommodations) |
| **Accommodation** | An accessibility support enabled for a specific candidate via a Personal Needs Profile (PNP). Examples: screen reader, high contrast, extended time. Distinct from Tools, which are available to all candidates. | Tool, Support |
| **PersonalNeedsProfile** | The PNP 3.0 record that declares which Accommodations are active, prohibited, or auto-launched for a specific candidate. | Accessibility profile, PNP |
| **SectionPlayer** | The PIE player component that orchestrates multiple Items within one Section: loads Elements once (aggregation), manages navigation, and coordinates PieSessions. | Multi-item player |
| **ElementAggregation** | The SectionPlayer optimization that pre-analyzes all Items in a Section, deduplicates Element types, and loads each Element package exactly once. | Element dedup, Bundle optimization |
| **PrintPlayer** | The PIE player that renders Items as static, print-safe output. Transforms interactive Element markup into non-interactive print markup; supports role-based output (student worksheet vs. answer key). | PDF renderer, Static player |

## QTI ↔ PIE concept mapping

These are parallel concepts across the two formats. Prefer the QTI term when discussing the QTI/XML layer; prefer the PIE term when discussing the JSON/component layer. Never use them interchangeably without qualifying the context.

| QTI concept | PIE concept | Key difference |
| ----------- | ----------- | -------------- |
| **Interaction** (type) | **Element** (package) | QTI interaction is a spec template; PIE Element is a versioned npm package with a full lifecycle |
| **ResponseProcessing** (declarative rules) | **Controller** (TypeScript function) | QTI uses XML rule templates; PIE Controller is code, fully unit-testable |
| **ResponseDeclaration** + `itemBody` | **PieModel** | QTI separates structure from config; PIE merges both into one JSON object |
| **candidateResponse** / response variable | **PieSession** | QTI response is typed by cardinality/baseType; PIE session is a custom JSON shape per Element |
| **OutcomeDeclaration** value | **PieScore** | QTI outcomes are arbitrary named variables; PIE score is always normalized 0–1 with an `empty` flag |
| **Role** (QTI: candidate/scorer/proctor…) | **Role** (PIE: student/instructor) | Same concept, different vocabulary — QTI has more granular roles |
| *(no equivalent)* | **Mode** | PIE explicitly models UI phase (gather/view/evaluate/author); QTI has no rendering-phase concept |
| *(no equivalent)* | **Environment** | PIE bundles mode + role + settings into one context object passed to every Controller call |
| **ModalFeedback** | *(inline in ViewModel)* | QTI feedback is declared separately; PIE Controller inlines feedback state into ViewModel |
| **RubricBlock** | **RubricBlock** | Shared concept; PIE uses same term, same role-filtered semantics |
| **Stimulus** | **Stimulus** / PassageEntity | Shared concept; PIE may embed or reference stimulus content |

## Relationships (updated)

- A **PieItem** contains a **PieModel** for each **Element** it uses.
- A **Controller** receives a **PieModel**, a **PieSession**, and an **Environment**; it returns a **ViewModel** and a **PieScore**.
- An **Element** UI writes candidate input to a **PieSession**; the **Controller** reads it to compute the **PieScore**.
- A **SectionPlayer** loads each unique **Element** package once (**ElementAggregation**) and manages one **PieSession** per item per **Element**.
- An **Environment** combines **Mode** and **Role**; changing either produces a different **ViewModel** from the same **Controller**.
- A **Tool** is available to all candidates in a session; an **Accommodation** is scoped to a specific candidate via a **PersonalNeedsProfile**.

## Flagged ambiguities

- **"Item"** is used loosely throughout the codebase to mean either an **AssessmentItem** (the QTI XML artifact) or a **PieItem** (the JSON artifact). These are the same *domain concept* in different *formats*. Prefer **AssessmentItem** when discussing QTI spec compliance, and **PieItem** when discussing the PIE authoring model. Use **item** as an informal shorthand only when the format is irrelevant.
- **"Score"** is overloaded: it can refer to a raw numeric value, an **OutcomeDeclaration** named `SCORE`, a **ScoringResult** object (QTI layer), or a **PieScore** (PIE layer). Always qualify: "score value", "SCORE outcome", "ScoringResult", or "PieScore".
- **"Session"** means different things in the two layers: in QTI it is an **ItemSession** (runtime state of one candidate's attempt at one item); in PIE it is a **PieSession** (the JSON response object for one Element). Never use "session" unqualified — state which layer you mean.
- **"Outcome"** has different shapes: a QTI **OutcomeDeclaration** is a named variable with arbitrary type and value; a PIE **PieScore** is always a normalized 0–1 float with an `empty` flag. Do not conflate them.
- **"Mode"** is PIE-specific (`gather` / `view` / `evaluate` / `author`). QTI has no rendering-phase concept. When discussing QTI, use **CompletionStatus** and **SubmissionMode** instead. When discussing PIE, use **Mode**.
- **"Role"** exists in both layers but with different granularity. QTI defines: `candidate`, `scorer`, `proctor`, `tutor`, `testConstructor`. PIE defines: `student`, `instructor`. When bridging the two, map explicitly: QTI `candidate` = PIE `student`; QTI `scorer`/`tutor`/`testConstructor` ≈ PIE `instructor`.
- **"Section"** vs **"TestPart"**: both are containers, but they sit at different levels of the hierarchy and have different rules. Never use them interchangeably; always state the level.
- **"Template"** sometimes means a **TemplateDeclaration** (a QTI variable for randomization) and sometimes an HTML/Svelte template (a rendering artifact). Disambiguate by context; prefer "TemplateDeclaration" for the domain concept.
- **"Plugin"** refers to both a **QTIPlugin** (registered with the **ItemPlayer**) and a **TransformPlugin** (registered with the transform engine). These are distinct extension points. Qualify with the registry name when the context is not obvious.
- **"Tool"** vs **"Accommodation"**: both support candidates, but a Tool is available to everyone (calculator, ruler) while an Accommodation is scoped to a specific candidate via a PersonalNeedsProfile. Never treat them as synonyms.
