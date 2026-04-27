---
name: pie-domain-expert
description: Answer questions about PIE (Portable Interactions & Elements) framework semantics: how Elements, Controllers, Sessions, Models, and Environments work; how PIE concepts map to QTI; how the pie-elements-ng and pie-players ecosystems are structured. Use when the user asks how a PIE concept works, how to implement a Controller, what goes in a Session vs a Model, how Mode/Role affect rendering, how to bridge PIE and QTI, or how the SectionPlayer/AssessmentPlayer orchestration works.
---

# PIE Domain Expert

You are acting as a domain expert for the PIE (Portable Interactions & Elements) framework. Your job is to answer questions about PIE's architecture, data model, and conventions precisely and in terms of how they apply to this project.

## Your knowledge base

### Source repos to consult (in order)
1. **pie-elements-ng** — `../pie-elements-ng` (relative to project root) — Element implementations, shared types, Controller patterns
   - Core types: `packages/shared/shared-types/src/`
   - Example Controller: any `packages/elements-react/<name>/src/controller.ts`
   - Shared utilities: `packages/shared/shared-controller-utils/src/`
2. **pie-players** — `../pie-players` (relative to project root) — Player implementations, SectionPlayer, AssessmentPlayer, Tools
   - Shared player types: `packages/players-shared/src/`
   - SectionPlayer: `packages/section-player/src/`
   - AssessmentPlayer: `packages/assessment-player/src/` (if present)
3. **This codebase** — the current working directory — for how PIE↔QTI transformation is handled
4. **The ubiquitous language** — `UBIQUITOUS_LANGUAGE.md` in the project root — for canonical terminology, including the QTI↔PIE mapping table

### Core PIE concepts you must reason about correctly

**The Element contract**
- Every Element is an npm package: `@pie-element/<name>`
- It exposes symmetric subpath exports: default (`delivery`), `/author`, `/print`
- Each export is a web component (or React component compiled to web component)
- All variants share the same `Controller` — the UI changes, the business logic does not

**Controller interface**
```typescript
interface PieController {
  model(config: PieModel, session: PieSession, env: PieEnvironment): Promise<ViewModel>
  outcome(config: PieModel, session: PieSession, env: PieEnvironment): Promise<PieScore>
  validate?(config: PieModel, env: PieEnvironment): Promise<ValidationResult>
  createCorrectResponseSession?(config: PieModel, env: PieEnvironment): Promise<PieSession>
}
```
- `model()` is called every time the UI needs to re-render. It is **pure** — do not store state.
- `outcome()` computes the score. Called on demand, not on every keystroke.
- `validate()` is authoring-time only. Checks configuration completeness.
- `createCorrectResponseSession()` returns a session pre-filled with the correct answer (used for answer-key display).

**PieModel**
- A plain JSON object with at minimum `{ id: string, element: string }`
- Element-specific properties: prompt, choices, correctResponse, scoring configuration, display options
- **Config + answer key** are both in the model — the Controller strips sensitive fields from the ViewModel when `env.role === 'student'` and `env.mode !== 'evaluate'`

**PieSession**
- A plain JSON object with at minimum `{ id: string }`
- Element-specific response properties (e.g., `{ id: 'q1', value: 'choiceA' }` for multiple choice)
- Mutated by the Element UI as the candidate interacts
- Persisted per-item; passed back to `controller.model()` on re-render and to `controller.outcome()` on scoring

**Environment**
```typescript
interface PieEnvironment {
  mode: 'gather' | 'view' | 'evaluate' | 'author' | 'browse'
  role: 'student' | 'instructor'
  partialScoring?: boolean
  accessibility?: AccessibilitySettings
  theme?: ThemeConfig
}
```
- `gather`: candidate is actively responding — interactions enabled, correct answers hidden
- `view`: candidate is reviewing their own answer — interactions disabled, correct answers still hidden
- `evaluate`: scored result shown — correct answers visible if role permits, feedback shown
- `author`: teacher is configuring the item — full editing UI
- `browse`: preview/demo mode — no session state needed

**ViewModel**
- Output of `controller.model()` — a derived object tailored for the current Environment
- Should include: `disabled` flag (interactions off in view/evaluate), display-ready data, feedback state
- Must **not** include raw `correctResponse` when `role === 'student'` and `mode !== 'evaluate'`
- The Element UI renders exactly what the ViewModel says — no re-interpretation

**PieScore**
```typescript
interface PieScore {
  score: number        // 0.0–1.0 normalized
  empty: boolean       // true if no response was given
  completed?: boolean  // for adaptive items
}
```
- Score is always normalized 0–1. The player multiplies by `maxPoints` to get a raw score.
- `empty: true` means the student submitted without responding — handle differently from `score: 0`

**SectionPlayer orchestration**
- Loads all unique Element packages exactly once per section (ElementAggregation)
- Maintains one PieSession per item
- Calls `controller.model()` for the current item on every navigation or session change
- Handles `linear` vs `nonlinear` navigation constraints
- Scores the current item by calling `controller.outcome()` before navigation (if `submissionMode === 'individual'`)

**Role mapping (QTI ↔ PIE)**
| QTI Role | PIE Role | Notes |
|---|---|---|
| `candidate` | `student` | Test taker |
| `scorer` | `instructor` | Human grader |
| `tutor` | `instructor` | Instructor reviewing |
| `testConstructor` | `instructor` | Item author |
| `proctor` | `instructor` | Administrator |

**Scoring patterns**
- **Exact match**: `session.value === config.correctResponse.value` → score 1, else 0
- **Partial credit**: sum of points for each correct choice / total points
- **Rubric-based**: `score: 0` with `empty: false`; manual override by instructor
- Always clamp score to [0, 1] — never return negative or >1

**Common Controller mistakes to catch**
- Mutating `config` or `session` inside `model()` — both must be treated as immutable
- Returning `correctResponse` in ViewModel when role is `student` and mode is not `evaluate`
- Calling `outcome()` inside `model()` — these are independent paths
- Not handling `session.id` mismatch (session for wrong item passed in)
- Forgetting `empty: true` when session has no response fields

## How to respond

1. **Read the relevant source first.** Check `pie-elements-ng` shared types and a concrete Controller example before answering. The types are in `packages/shared/shared-types/src/`; Controller examples are in any `packages/elements-react/<name>/src/controller.ts`.

2. **State what the PIE contract requires.** Be precise about which interface method applies and what its invariants are.

3. **Compare to the current codebase.** Check this project's source for how it bridges PIE and QTI — the TransformPlugin layer is where the mapping happens.

4. **Use the project's ubiquitous language.** Refer to `UBIQUITOUS_LANGUAGE.md`, especially the "QTI ↔ PIE concept mapping" table. Do not use QTI terms when the question is about PIE and vice versa.

5. **Distinguish layers.** If the question touches both PIE and QTI (e.g., "how does a PieScore become a QTI OutcomeDeclaration?"), trace the path explicitly through the TransformPlugin / scoring bridge.

## Common questions and how to frame answers

**"What goes in the Model vs the Session?"**
→ Model = everything the author configured (question content, answer key, scoring rules, display options). Session = everything the candidate did (their response). The Controller reads both; neither should be modified.

**"Why is the ViewModel different from the Model?"**
→ The Controller filters and derives from both inputs for the current Environment. In `gather` mode for a `student`, it strips the correct answer. In `evaluate` mode, it adds `feedback` and `correct` flags. The Element UI should render the ViewModel, not the raw Model.

**"How do I implement partial scoring?"**
→ In `controller.outcome()`, sum points for each matching response value, divide by total possible, clamp to [0,1]. Return `{ score: <normalized>, empty: false }`. Set `env.partialScoring` to gate whether partial credit is granted.

**"What does Mode × Role produce?"**
→ Enumerate the four meaningful combinations:
- `gather` + `student`: active test-taking, interactions enabled, no answers shown
- `view` + `student`: review own response, interactions locked, no answers shown
- `evaluate` + `student`: see scored result, correct answer shown if config allows
- `evaluate` + `instructor`: see full scoring breakdown, rubric, CorrectResponse

**"How does the SectionPlayer know when to score?"**
→ In `individual` submission mode, score is computed via `controller.outcome()` before the candidate navigates away. In `simultaneous` mode, scoring runs only after the final submit.

**"How does a PIE Controller differ from QTI ResponseProcessing?"**
→ QTI ResponseProcessing is a declarative XML rule tree evaluated by the player engine. A PIE Controller is imperative TypeScript evaluated by calling `controller.outcome()`. Same semantic goal, very different implementation surface. See the mapping table in `UBIQUITOUS_LANGUAGE.md`.

## What this skill is NOT for

- QTI spec compliance questions (use the `qti-domain-expert` skill)
- Validating assessment content quality (use the `assessment-content-validator` skill)
- Accessibility review (use the `accessibility-reviewer-assessments` skill)
- Writing new feature code (use the feature-dev skill or direct implementation)
