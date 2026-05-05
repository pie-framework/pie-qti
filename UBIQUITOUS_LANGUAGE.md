# Ubiquitous Language

## Assessment Content

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **AssessmentItem** | A single, self-contained QTI unit of assessment content. | Question, Task, Item XML |
| **AssessmentTest** | A QTI document that organizes items into test parts and sections with navigation, timing, and scoring rules. | Test, Exam, Quiz |
| **TestPart** | The top-level runnable division inside an AssessmentTest. | Test section, Routing container |
| **Section** | An ordered container of item references within a TestPart. | TestPart, Subtest |
| **ItemRef** | A reference from a Section to one AssessmentItem, optionally carrying session constraints. | Item pointer |
| **Stimulus** | Shared content that provides context for one or more AssessmentItems. | Passage, Reading passage |
| **RubricBlock** | Role-filtered instructional or grading content attached to an item or section. | Instructions, Grading guide |
| **Metadata** | Descriptive package or item information used for discovery, cataloging, or certification review. | Data, Tags |

## Variables And Scoring

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **ResponseDeclaration** | A QTI variable that defines the expected value shape for one candidate response. | Response variable |
| **OutcomeDeclaration** | A QTI variable that stores a computed result such as score or feedback state. | Score variable, Result variable |
| **TemplateDeclaration** | A QTI variable used to parameterize an item before delivery. | Template, Randomization field |
| **BaseType** | The scalar type of a QTI variable value. | Data type, Type |
| **Cardinality** | The multiplicity of a QTI variable value: `single`, `multiple`, or `ordered`. | Multiplicity |
| **CorrectResponse** | The authoritative expected response declared for scoring or review. | Answer key, Correct answer |
| **Mapping** | A lookup table that maps response values to partial scores. | Scoring table, Score map |
| **AreaMapping** | A spatial Mapping that maps coordinate regions to scores. | Hotspot scoring map |
| **ResponseProcessing** | The QTI rule set that evaluates responses and writes outcome values. | Scoring engine, Scoring rules |
| **ScoringResult** | The runtime result of scoring an item, including score, max score, completion, and outcomes. | Score result |

## Interactions

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Interaction** | A candidate-facing response control inside an AssessmentItem. | Question, Prompt, Widget |
| **InteractionType** | The QTI interaction family, such as choice, match, hotspot, text entry, or inline choice. | Question type |
| **InlineInteraction** | An Interaction rendered in the flow of item body text. | Inline placeholder |
| **BlockInteraction** | An Interaction rendered as a standalone block outside sentence flow. | Component interaction |
| **ChoiceInteraction** | An Interaction where the candidate selects one or more choices. | Multiple choice |
| **TextEntryInteraction** | An inline Interaction where the candidate types a short response. | Fill in the blank |
| **InlineChoiceInteraction** | An inline Interaction where the candidate selects from a dropdown embedded in text. | Inline dropdown |
| **HotspotInteraction** | A spatial Interaction where the candidate selects one or more regions on an image. | Image click question |
| **GapMatchInteraction** | An Interaction where candidates place choices into gaps in content. | Drag in the blank |
| **Response** | The candidate's current value for one Interaction. | Answer, User input |
| **InteractionData** | The typed runtime model extracted from QTI XML for rendering an Interaction. | Interaction config, Extracted data |

## Sessions And Delivery

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **ItemSession** | Runtime state for one candidate's attempt at one AssessmentItem. | Item state |
| **AssessmentSession** | Runtime state for a candidate working through an AssessmentTest. | Test session, Attempt |
| **NavigationMode** | The rule that determines whether navigation is linear or nonlinear. | Nav mode |
| **SubmissionMode** | The rule that determines whether responses are submitted per item or all at once. | Submit mode |
| **CompletionStatus** | The lifecycle state of an ItemSession. | Item status |
| **AdaptiveItem** | An AssessmentItem that can continue across multiple attempts based on completion status. | Retry item |
| **Candidate** | The role representing the test taker. | Student, User |
| **Scorer** | The role representing a human grader. | Grader, Rater |
| **Proctor** | The role representing a test administrator. | Administrator |
| **Author** | The role representing an item or test creator. | TestConstructor |
| **RolePolicy** | Runtime rules that determine what a role may see or do. | Permission model |

## Formats And Transformation

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **QTI** | The IMS/1EdTech XML standard for assessment content interchange. | IMS format |
| **QTI 2.2** | The supported QTI 2.x certification target in this project. | QTI2 |
| **QTI 3.0** | The supported QTI 3.x certification target in this project. | QTI3 |
| **Shared Vocabulary** | QTI 3.0 CSS class vocabulary that carries standardized rendering semantics. | CSS hints, Styling classes |
| **PIE** | The JSON and web-component based Portable Interactions and Elements ecosystem. | PIE format |
| **PieItem** | A PIE representation of an assessment item. | PIE question |
| **PieModel** | The JSON configuration and response model for one PIE Element. | Model object |
| **PieSession** | The JSON response state for one PIE Element. | Session data |
| **Controller** | The PIE TypeScript module that derives a ViewModel and scoring outcome from a model and session. | Scoring engine |
| **ViewModel** | The render-ready model produced by a PIE Controller. | Render model |
| **PieScore** | The normalized scoring output of a PIE Controller. | Outcome, Score |
| **TransformPlugin** | A registered unit that converts content between source and target formats. | Transformer, Converter |
| **VendorExtension** | Transformation support for a vendor-specific QTI dialect. | Vendor transformer |
| **AssetResolver** | A component that resolves external resources referenced by transformed content. | Resource loader |
| **TransformHarness** | The internal reference app used to exercise transformation flows. | Transform app, Import app |

## Player Architecture

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **ItemPlayer** | The player responsible for rendering one AssessmentItem and managing its interactions. | Item renderer |
| **AssessmentPlayer** | The player shell that sequences AssessmentItems through an AssessmentTest. | Test player |
| **ComponentRegistry** | The registry that maps InteractionData to the web component used to render it. | Component map |
| **ExtractionRegistry** | The registry that chooses extractors for QTI XML elements. | Extractor map |
| **Extractor** | A parser that converts one QTI element into typed InteractionData. | Parser, Reader |
| **InteractionModule** | The internal home for one interaction type's contract, extractor, and rendering helpers. | Interaction folder |
| **CompatibilityBarrel** | A re-export file that preserves an older import path during refactors. | Shim, Legacy path |
| **DefaultComponent** | A packaged renderer web component supplied by `@pie-qti/default-components`. | Built-in renderer |
| **HostApplication** | The application embedding the players and integrating them with its own backend or platform. | LMS, Consumer app |
| **BackendAdapter** | The integration boundary used by a host to persist state and scoring. | API adapter, Server adapter |

## Certification

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **PublicCertificationGate** | The clean-room automated gate run in this repository for public certification coverage. | Certification test, Public conformance |
| **CleanRoomFixture** | A locally authored fixture that covers certification behavior without copying official assets. | Sample, Mock official package |
| **OfficialConformancePackage** | A member-only 1EdTech package used only by the private conformance runner. | Public fixture, Sample ZIP |
| **PrivateConformanceRunner** | The sibling project that executes official packages against published `@pie-qti/*` builds. | Certification project |
| **EvidenceRecord** | A sanitized, git-tracked summary of certification results. | Report, Proof document |
| **EvidenceBundle** | Generated raw artifacts from a conformance run, kept outside git unless explicitly needed for submission. | Screenshots, Reports |
| **CoverageMatrix** | A mapping from certification criteria to fixtures and tests that exercise them. | Checklist, Test matrix |
| **CertificationScope** | The deliberately chosen set of QTI features and 1EdTech certifications this project targets. | Roadmap, Compliance list |

## Platform Boundaries

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **LTIHost** | An external platform that launches or embeds the player through LTI. | LTI player |
| **EmbeddingBoundary** | The contract that lets a host application embed the player without this repo implementing the host protocol. | Integration layer |
| **LTIAdvantage** | The LTI 1.3 services family for launch, deep linking, grade sync, and roster access. | IMS LTI |
| **DeepLinking** | The LTI workflow for selecting or creating content links in a host platform. | Import, Picker |
| **AGS** | The LTI Assignment and Grade Services interface for grade passback. | Grade sync |

## Relationships

- An **AssessmentTest** contains one or more **TestParts**.
- A **TestPart** contains one or more **Sections**.
- A **Section** contains one or more **ItemRefs**.
- Each **ItemRef** points to exactly one **AssessmentItem**.
- An **AssessmentItem** declares one or more **ResponseDeclarations** and zero or more **OutcomeDeclarations**.
- Each **Interaction** is bound to exactly one **ResponseDeclaration**.
- **ResponseProcessing** reads **Responses** and writes values to **OutcomeDeclarations**.
- An **ItemPlayer** renders one **AssessmentItem** using **InteractionData** extracted by **Extractors**.
- An **AssessmentPlayer** coordinates many **ItemSessions** inside one **AssessmentSession**.
- An **InteractionModule** owns the domain contract and extractor for one **InteractionType**.
- A **CompatibilityBarrel** preserves old imports while canonical code moves into **InteractionModules**.
- A **HostApplication** may use an **LTIHost**, but this project owns only the **EmbeddingBoundary**.
- The **PublicCertificationGate** uses **CleanRoomFixtures**; the **PrivateConformanceRunner** uses **OfficialConformancePackages**.
- An **EvidenceRecord** summarizes results; an **EvidenceBundle** contains generated raw artifacts.

## Example Dialogue

> **Dev:** "For Q12, should we call it a dropdown question or an **InlineChoiceInteraction**?"
>
> **Domain expert:** "Use **InlineChoiceInteraction** when discussing QTI behavior. It is an **InlineInteraction** because it renders inside the item body text, unlike a block **ChoiceInteraction**."
>
> **Dev:** "And where does the renderer get its data?"
>
> **Domain expert:** "An **Extractor** reads the QTI element and produces **InteractionData**. The **ItemPlayer** renders that through the **ComponentRegistry** or inline rendering support."
>
> **Dev:** "Can an LTI platform launch this directly?"
>
> **Domain expert:** "An **LTIHost** can embed the player through the **EmbeddingBoundary**, but **LTIAdvantage**, **DeepLinking**, and **AGS** belong to the host application, not this project."
>
> **Dev:** "Which certification assets do we commit?"
>
> **Domain expert:** "Commit **CleanRoomFixtures**, the **CoverageMatrix**, and the sanitized **EvidenceRecord**. Keep **OfficialConformancePackages** and raw **EvidenceBundles** out of git."

## Flagged Ambiguities

- **"Item"** can mean **AssessmentItem** in QTI or **PieItem** in PIE; qualify the format when it matters.
- **"Question type"** should usually be **InteractionType** in QTI discussions because the spec models candidate input as interactions, not questions.
- **"Answer"** can mean **Response** or **CorrectResponse**; use **Response** for candidate state and **CorrectResponse** for the keyed value.
- **"Score"** can mean a numeric score value, an **OutcomeDeclaration**, a **ScoringResult**, or a **PieScore**; qualify the layer and shape.
- **"Session"** can mean **ItemSession**, **AssessmentSession**, or **PieSession**; never use it unqualified in design docs.
- **"Plugin"** can mean **TransformPlugin**, player plugin, vendor extension, or Cursor plugin; qualify the registry or platform.
- **"Transform app"** now refers only to the internal **TransformHarness**; do not describe it as a supported import product.
- **"Conformance"** and **"certification"** are related but not identical; conformance is behavior against criteria, certification is the formal 1EdTech program.
- **"Report"** is too vague for certification artifacts; use **EvidenceRecord** for the sanitized document and **EvidenceBundle** for generated raw output.
- **"LTI player"** implies this project implements LTI; use **LTIHost** for the external platform and **EmbeddingBoundary** for this project's responsibility.
