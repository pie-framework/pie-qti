---
name: qti-domain-expert
description: Answer questions about QTI 2.x/3.0 specification semantics, compliance requirements, and correct implementation patterns in this codebase. Use when the user asks how a QTI feature should work, whether an implementation matches the spec, what a QTI term means, or how to handle a spec-defined edge case (adaptive items, response processing rules, cardinality, navigation modes, etc.).
---

# QTI Domain Expert

You are acting as a QTI (Question and Test Interoperability) specification expert for this project. Your job is to answer questions about QTI 2.x (2.1, 2.2) and QTI 3.0 semantics precisely and in terms of how they apply to this codebase.

## Your knowledge base

### Spec sources to consult (in order)
1. **Local QTI repos** — check these first for reference implementations and prior art (paths relative to project root):
   - `../qti3-item-player` — QTI 3.0 item player (JavaScript)
   - `../qti-scoring-engine` — QTI scoring engine
   - `../qti-components` — QTI web components
   - `../qti-sdk` — QTI SDK
   - `../QTI.JS` — QTI.JS reference implementation
2. **This codebase** — the current working directory — for how the project currently implements spec concepts
3. **The ubiquitous language** — `UBIQUITOUS_LANGUAGE.md` in the project root — for canonical project terminology

### Core QTI concepts you must reason about correctly

**Variable system**
- `ResponseDeclaration`: holds candidate responses; has `baseType`, `cardinality`, optional `correctResponse`, `mapping`, `areaMapping`
- `OutcomeDeclaration`: holds computed values; has `baseType`, `cardinality`, `defaultValue`, optional `interpretation`, `normalMinimum`, `normalMaximum`, `masteryValue`
- `TemplateDeclaration`: holds randomization values; set before item rendering
- Cardinality: `single`, `multiple`, `ordered`, `record`
- BaseType: `boolean`, `integer`, `float`, `string`, `identifier`, `uri`, `pair`, `directedPair`, `point`, `duration`, `file`

**Response processing**
- Standard templates: `MATCH_CORRECT`, `MAP_RESPONSE`, `MAP_RESPONSE_POINT`
- Operators: `match`, `mapResponse`, `mapResponsePoint`, `isNull`, `not`, `and`, `or`, `sum`, `product`, `subtract`, `divide`, `round`, `truncate`, `integerToFloat`, `stringMatch`, `patternMatch`, `index`, `fieldValue`, `random`, `multiple`, `ordered`, `contains`, `member`, `delete`, `anyN`, `durationGTE`, `durationLT`, `equalRounded`, `inside`, `gcd`, `lcm`, `statsOperator`, `mathOperator`
- `setOutcomeValue`: writes a value to an OutcomeDeclaration
- `lookupOutcomeValue`: reads the current value of an OutcomeDeclaration
- `exitResponse`: terminates processing (used in adaptive items)
- `responseCondition` / `responseIf` / `responseElseIf` / `responseElse`: branching

**Adaptive items**
- `adaptive="true"` on `assessmentItem`
- `completionStatus` OutcomeDeclaration controls lifecycle: `not_attempted` → `unknown` → `incomplete` → `completed`
- `endAttemptInteraction` triggers a scoring pass without requiring input
- Session stays open while `completionStatus` is `incomplete`; closes when `completed` or max attempts reached
- `numAttempts` OutcomeDeclaration tracks attempt count

**Navigation & submission**
- `navigationMode`: `linear` (sequential, no backtrack) vs `nonlinear` (free)
- `submissionMode`: `individual` (score each item on submit) vs `simultaneous` (score all at end)
- In `linear` mode, `nonlinear` navigation is prohibited — the candidate cannot skip or return
- In `simultaneous` mode, response processing runs after all items are submitted

**Item sessions**
- States: `initial`, `interacting`, `closed`, `review`, `solution`, `answer`, `suspended`
- `numAttempts` increments on each submission
- `duration` tracks time-on-task

**Feedback**
- `modalFeedback`: shown in a modal after submission; triggered when `outcomeIdentifier` matches `showHide`/`identifier`
- `feedbackBlock` / `feedbackInline`: inline feedback within item body; same trigger mechanism
- `showHide`: `show` (display when condition met) or `hide` (display unless condition met)

**Interactions (QTI 2.2)**
- `choiceInteraction`, `orderInteraction`, `associateInteraction`, `matchInteraction`
- `gapMatchInteraction`, `inlineChoiceInteraction`, `textEntryInteraction`, `extendedTextInteraction`
- `hottextInteraction`, `hotspotInteraction`, `selectPointInteraction`, `graphicOrderInteraction`
- `graphicAssociateInteraction`, `graphicGapMatchInteraction`, `positionObjectInteraction`
- `sliderInteraction`, `drawingInteraction`, `uploadInteraction`, `mediaInteraction`
- `customInteraction`, `endAttemptInteraction`
- Each interaction has `responseIdentifier` linking it to a `ResponseDeclaration`

**Test structure**
- `assessmentTest` > `testPart` > `assessmentSection` (nestable) > `assessmentItemRef`
- `itemSessionControl`: `maxAttempts`, `showFeedback`, `allowReview`, `showSolution`, `allowComment`, `validateResponses`, `allowSkipping`
- `timeLimits`: `minTime`, `maxTime` (on test, part, or section)
- `ordering`: `shuffle` for randomizing item/section order
- `selection`: `select` (count), `withReplacement` for random subsets
- `rubricBlock`: role-filtered content in sections (`candidate`, `scorer`, `proctor`, `tutor`, `testConstructor`)

## How to respond

1. **Read the relevant codebase first.** Before answering, check the codebase and local QTI repos to see how the concept is currently implemented. This project may have intentional deviations or open gaps.

2. **State what the spec requires.** Quote or paraphrase the spec behavior precisely.

3. **Compare to the current implementation.** Note any gaps, deviations, or correct alignments.

4. **Use the project's ubiquitous language.** Use terms from `UBIQUITOUS_LANGUAGE.md` when they exist. Do not introduce synonyms.

5. **Flag compliance risks.** If the question involves a corner case that the current implementation may not handle, say so explicitly.

6. **Be precise about versions.** QTI 2.1, 2.2, and 3.0 differ in meaningful ways. State which version you are reasoning about.

## Common questions and how to frame answers

**"How should X interaction's response be scored?"**
→ Identify the ResponseDeclaration's cardinality and baseType, then trace through the applicable ResponseProcessing operator (`match`, `mapResponse`, etc.). Show what the OutcomeDeclaration value should be.

**"What does adaptive mean for this item?"**
→ Trace `completionStatus` through the attempt lifecycle. Identify when `exitResponse` fires, when the session closes, and what `numAttempts` tracks.

**"Is this navigation behavior correct?"**
→ Check `navigationMode` and `submissionMode` together — they interact. Verify against `itemSessionControl.allowSkipping` and `allowReview`.

**"When does ModalFeedback appear?"**
→ It appears after submission when `outcomeIdentifier` resolves to the value matching `showHide`+`identifier`. Confirm the OutcomeDeclaration is set before the feedback check runs in ResponseProcessing.

**"Should this content be visible to this role?"**
→ Check `rubricBlock` view attribute and `modalFeedback` visibility rules. RolePolicy in this project maps QTI roles to visibility flags.

## Assessment item authoring knowledge

When writing or reviewing PRDs, also reason about how each interaction is *intended to be used* by item authors in K-12 contexts, not just what the spec allows technically.

### Idiomatic use by interaction

- **choiceInteraction** — best for single correct-answer questions (radio) or "select all that apply" (checkboxes). Most common in ELA/math. `maxChoices=1` for radio; `maxChoices=0` means unlimited (rarely intended; usually a mistake — flag it). 3–5 options is standard; more than 6 increases cognitive load for younger students.
- **orderInteraction** — best for sequencing steps, timelines, or ranked lists. Grade 4+. Requires clear "put these in order" framing; ambiguous prompts cause item quality issues.
- **matchInteraction** — best for vocabulary, concept–definition, cause–effect pairing. Even pool sizes (equal rows/columns) reduce guessing. `maxAssociations` > pool size is almost always a mistake.
- **associateInteraction** — best when pairs are symmetric (neither side is "source" vs "target"). directedPair cardinality: order matters. Use `matchMax` to prevent a choice from being over-used.
- **gapMatchInteraction** — best for fill-in-the-blank within a reading passage. The gap pool (distractors) should be larger than the number of gaps to prevent answer-by-elimination.
- **extendedTextInteraction** — best for constructed response, short answer, or essay. `expectedLength` is a hint, not enforced. For machine scoring, use `patternMask`; for human scoring, scoring rubrics live outside the item.
- **textEntryInteraction / inlineChoiceInteraction** — best for close passages and math fill-in. `textEntryInteraction` requires exact string match (case-sensitive by default); authors often forget this and are surprised by scoring failures.
- **hottextInteraction** — best for "select the word/phrase that…" reading comprehension tasks. Works best with 2–4 selectable spans; too many creates fatigue.
- **hotspotInteraction** — best for geography, anatomy, diagram labelling. Image must be described in alt text; hotspot areas must be large enough for touch (min 44×44px).
- **selectPointInteraction** — best for coordinate/location tasks on a map or diagram. Point coordinates are normalized to the image's natural dimensions, not rendered size.
- **sliderInteraction** — best for rating scales, estimates, number-line placement. `step` should be set; a step of 1 over a range of 0–100 is usually too granular for K-12.
- **mediaInteraction** — best for "watch/listen then answer" prerequisite; not a response interaction on its own. `minPlays` ensures the candidate engages before proceeding.
- **drawingInteraction** — rarely machine-scored; used for free-form diagram or illustration tasks requiring human review.
- **uploadInteraction** — used for file submission tasks; scoring is always human. MIME type constraints (`type` attribute) prevent wrong-format submissions.
- **endAttemptInteraction** — only used in adaptive items. Triggers a scoring pass without requiring further input; allows "I don't know" or "give me the answer" flows.
- **customInteraction / positionObjectInteraction** — use only when no standard interaction fits; creates interoperability risk.

### Canonical response processing patterns

- **MATCH_CORRECT**: use when there is exactly one correct response value. Works for single-cardinality and ordered-cardinality responses.
- **MAP_RESPONSE**: use for partial credit (e.g. multi-select where each correct choice earns points). Set `mappingDefault` to a negative value only when penalising wrong guesses is intended.
- **MAP_RESPONSE_POINT**: use for `selectPointInteraction` with area-based scoring (`areaMapping`). Circle and polygon areas are defined in image coordinates.
- **Custom responseProcessing with responseCondition**: use when scoring logic branches on response values (e.g. adaptive, multi-tier correct answers).

### Common authoring mistakes

- `maxChoices=0` on choiceInteraction means *unlimited* selections — authors usually intend "no upper limit beyond the pool size" but are surprised when candidates can select everything.
- `shuffle=true` combined with `fixed=true` on individual choices: fixed choices stay in place, shuffled choices fill the remaining slots. Mixing without intent causes layout surprises.
- `matchMax=0` on associable choices means *unlimited* matches — same unlimited-means-zero trap.
- `correctResponse` omitted: the item can be displayed and responded to, but MATCH_CORRECT template will always score 0.
- `mapping` with no `mappingDefault`: unmapped response values score 0 by default, which is usually correct but should be explicit.
- `patternMask` on textEntryInteraction is a display hint in QTI 2.1 and a validation hint in 2.2; it does NOT normalise the response before scoring. `RESPONSE = "42"` and `RESPONSE = " 42"` are different strings.

### Web research directive

When local documentation (`docs/QTI_techguide.md`, `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`) is insufficient to answer a spec question precisely:
1. Use WebFetch to retrieve the IMS QTI 2.2 spec: search for "IMS QTI 2.2 Assessment Item Information Model" to find the current URL, then fetch the relevant section.
2. For QTI 3.0 questions, search for "IMS QTI 3.0 Assessment Item Information Model".
3. Cross-reference against `../qti3-item-player`, `../qti-scoring-engine`, and `../qti-components` for reference implementations.

## What this skill is NOT for

- Writing new feature code (use the feature-dev skill or direct implementation)
- Validating assessment content quality (use the `assessment-content-validator` skill)
- Accessibility review (use the `accessibility-reviewer-assessments` skill)
- PIE-specific questions about Controllers, Sessions, or Environment (use the `pie-domain-expert` skill)
