# PRD: Response Processing Engine

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/qti-processing
  Last reviewed: 2026-04-27
-->

**Status:** draft  
**Type:** architecture  
**Packages:** `@pie-qti/qti-processing`  
**Last reviewed:** 2026-04-27

---

## Summary

`@pie-qti/qti-processing` is the shared scoring engine for the PIE-QTI framework. It converts QTI `<responseProcessing>`, `<outcomeProcessing>`, and `<templateProcessing>` XML into a typed AST, evaluates expressions against a declaration context, and executes statements that mutate outcome and template variables. Both the item-level player (`@pie-qti/item-player`) and the assessment-level player use this package. The engine is intentionally framework-agnostic — no DOM, no Svelte, no browser APIs — and can run identically in the browser and on the server (Node.js).

---

## Background and rationale

### Why AST-based, not direct eval

The alternative to building an AST is to evaluate the QTI XML tree recursively in a single pass (parse-and-execute). That approach is simpler to write but has two serious problems:

1. **Testability**: You cannot unit-test an expression in isolation without constructing the XML context around it. With an AST, every expression node and statement node is a plain TypeScript value that can be constructed in a test and passed directly to `evalExpr` or `execStatement`.
2. **Separation of concerns**: The XML structure of QTI 2.x differs from QTI 3.0 only in element names and some attribute names. The `ElementNameMapper` interface abstracts the XML-level differences at parse time; the AST is version-agnostic. This means the same evaluator runs for both QTI 2.x and QTI 3.0 content without conditionals in the evaluation logic.

The three-layer structure (build → eval → exec) also makes it straightforward to insert a transform step (e.g. constant-folding, scope validation) between parsing and execution without touching either layer.

### Why decimal.js for rounding

Floating-point arithmetic in JavaScript produces surprising results for rounding at common decimal boundaries (e.g. `Math.round(3.175 * 100) / 100 === 3.17` in most environments, not 3.18). The QTI spec does not mandate a specific rounding algorithm, but test content authors write scoring rules that assume decimal arithmetic. `roundDecimalPlaces` and `roundSignificantFigures` in `evaluator.ts` use `decimal.js` with `ROUND_HALF_UP` to produce the result a human would expect. This is a precision-sensitive decision: changing the rounding library or mode would alter scores for items that use `round` or `equalRounded` operators with borderline inputs.

### Why scope enforcement at parse time

The `buildStatements` function in `build.ts` takes a `mode` parameter (`'response'`, `'outcome'`, or `'template'`). Statements and expressions that are not legal in a given processing scope (e.g. `setResponseValue` inside `<outcomeProcessing>`) are silently skipped or cause a parse-time error. This means:

- Malformed content is rejected early, before execution, not mid-run.
- The executor (`execute.ts`) does not need to check scope at runtime; it can assume the program was built with the correct mode.
- Test fixtures that contain out-of-scope elements surface errors immediately.

The trade-off is that the builder must know all legal element-to-mode mappings, and adding a new statement kind requires updating `buildStatements` (and its tests) as well as `execStatement`.

### Why three files must change to add a new operator

Adding a new expression operator requires:

1. **`ast/types.ts`**: Add a new `ExpressionNode` variant to the `ExpressionNode` union type, with its specific fields.
2. **`ast/build.ts`**: Add a `case` in `buildExpression()` that parses the XML element attributes and children into the new node type.
3. **`eval/evaluator.ts`**: Add a `case` in `evalExpr()` that evaluates the new node given an `EvalEnv`.

This is the minimum set. Unit tests live in `src/test/`. The three-file discipline is intentional: it keeps each layer's responsibility explicit and prevents the evaluator from containing parsing logic or vice versa.

### Why `DeclarationContext` is mutable

The QTI processing model is inherently stateful: `setOutcomeValue` and `setTemplateValue` mutate variables in place, and the spec requires that later expressions in the same program see the updated values. A purely functional approach (immutable context, pass updated context through each statement) was considered but rejected because it would require threading a context value through every recursive call in `evalExpr` and `execStatement`, making the code significantly harder to read and increasing allocation pressure for complex programs.

`DeclarationContext.setValue()` mutates the underlying `Declaration` in place. The caller (item player or test player) is responsible for snapshot/restore if it needs rollback semantics.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.1, QTI 2.2, QTI 3.0 (via `ElementNameMapper`)
- **Spec section(s):** §4 (Response Processing), §4.3 (outcomeProcessing operators), QTI 2.2.2 §3 (expression types)

### Supported statement kinds

| Statement | QTI element | Scope |
|---|---|---|
| `setOutcomeValue` | `<setOutcomeValue>` | response, outcome |
| `lookupOutcomeValue` | `<lookupOutcomeValue>` | response, outcome |
| `setResponseValue` | `<setResponseValue>` | response |
| `setTemplateValue` | `<setTemplateValue>` | template |
| `setCorrectResponse` | `<setCorrectResponse>` | template |
| `setDefaultValue` | `<setDefaultValue>` | response, outcome, template |
| `exitResponse` | `<exitResponse>` | response |
| `exitTemplate` | `<exitTemplate>` | template |
| `exitTest` | `<exitTest>` | outcome |
| `responseCondition` / `responseIf` / `responseElse` | `<responseCondition>` | response |
| `outcomeCondition` / `outcomeIf` / `outcomeElse` | `<outcomeCondition>` | outcome |
| `templateCondition` / `templateIf` / `templateElse` | `<templateCondition>` | template |
| `templateConstraint` | `<templateConstraint>` | template |
| `responseProcessingFragment` | inline fragment inlining | response |
| `outcomeProcessingFragment` | inline fragment inlining | outcome |

### Supported expression kinds (operator inventory)

**Literal / variable access**  
`baseValue`, `null`, `variable`, `correct`, `default`

**Test-level aggregation** (requires `TestEvalContext`)  
`testVariables`, `outcomeMinimum`, `outcomeMaximum`, `numberCorrect`, `numberIncorrect`, `numberPresented`, `numberResponded`, `numberSelected`

**Comparison**  
`match`, `equal`, `equalRounded`, `notEqual`, `lt`, `lte`, `gt`, `gte`

**Arithmetic**  
`sum`, `subtract`, `product`, `divide`, `power`, `mod`, `integerDivide`, `integerModulus`, `integerToFloat`, `round`, `roundTo`, `truncate`, `mathOperator` (sin/cos/tan/asin/acos/atan/atan2/exp/ln/log/signum/floor/ceil/abs/toDegrees/toRadians), `mathConstant` (pi/e)

**Logic**  
`and`, `or`, `not`, `anyN`, `allN`

**Container**  
`ordered`, `multiple`, `containerSize`, `index`, `member`, `contains`, `deleteValue`, `repeat`, `fieldValue`, `record`

**String**  
`stringMatch`, `patternMatch`, `substring`

**Statistics**  
`mean`, `sampleVariance`, `sampleSD`, `popVariance`, `popSD`

**Type utilities**  
`isNull`, `isNotNull`, `isTypeOf`

**Response mapping (QTI-specific)**  
`mapResponse`, `mapResponsePoint`, `mapOutcome`

**Lookup tables**  
`lookupTable` (match and interpolation)

**Random**  
`random`, `randomInteger`, `randomFloat`

**Geometry**  
`inside`, `durationLT`, `durationGTE`

**Math**  
`gcd`, `lcm`

**Conditionals (expression form)**  
`preCondition`

**Extension**  
`customOperator` (dispatches to `EvalEnv.customOperators` registry)

### Deliberately omitted

- `xi:include` in processing XML: `xi:include` references in `<responseProcessing>` or `<outcomeProcessing>` throw a parse-time error with a message explaining why (the engine does not resolve external resources for item-only processing). Content authors must inline the rules.
- `preCondition` / `branchRule` at the test level: these are `testPart`- and `assessmentSection`-level QTI constructs controlled by the assessment player, not by the processing engine.

### Known divergences from spec

- **`outcomeProcessing` XML at assessment level (G-11):** `buildOutcomeProcessingAst()` and the full test-level expression set (`testVariables`, `numberCorrect`, etc.) are implemented and pass tests. However, the assessment player does not currently wire the XML path: it uses TypeScript scoring templates instead of parsing the `<outcomeProcessing>` element from the `assessmentTest` document. See G-11.
- **`xi:include` is a parse error, not a no-op:** The spec implies `xi:include` should be resolved. The engine throws instead of silently ignoring it, to surface content authoring errors early.

---

## Functional requirements

- **FR-1:** `buildResponseProcessingAst(el)` must produce a `ProcessingProgram` with `kind: 'program'` and zero or more `StatementNode` children that faithfully represent the structure of the `<responseProcessing>` element.
- **FR-2:** `buildOutcomeProcessingAst(el)` must support `scope: 'test'` and include test-level expression nodes (`testVariables`, `numberCorrect`, etc.) in the produced AST.
- **FR-3:** `evalExpr(env, expr)` must return `QtiValue` with `kind: 'null'` (not throw) when a variable is referenced that does not exist in `env.ctx`.
- **FR-4:** `evalExpr(env, expr)` must return `QtiValue` with `kind: 'invalid'` (not throw) when an operator receives operands of incompatible types unless the spec defines NULL propagation for that operator.
- **FR-5:** `execProgram(env, program)` must treat `QtiExit` (thrown by `exitResponse`, `exitTemplate`, `exitTest`) as a normal program termination, not as an unhandled error.
- **FR-6:** `templateConstraint` must restart the entire `templateProcessing` program from statement 0 if the constraint evaluates to false or NULL, resetting all template variables to their default values. It must stop retrying after 100 iterations.
- **FR-7:** `OperatorRegistry.register(name, impl)` must accept names case-insensitively. `OperatorRegistry.get(name)` must look up names case-insensitively.
- **FR-8:** `DeclarationContext.resetToDefault(id)` must restore the variable's value to a clone of its `defaultValue`, not to the same object reference.
- **FR-9:** `round` and `equalRounded` operators must use `ROUND_HALF_UP` semantics via `decimal.js`, not native `Math.round`.
- **FR-10:** `mapResponse` must apply `lowerBound` and `upperBound` from the response declaration's mapping, clamping the result.
- **FR-11:** `patternMatch` must compare the response value against the pattern using ECMAScript `RegExp` (not XSD regex). Differences between XSD and ECMAScript regex syntax may cause content-specific divergences; this is a known limitation.
- **FR-12:** Unknown processing statement tags must throw a parse-time error with the tag name and mode, rather than silently skipping, to surface coverage gaps.

---

## Non-functional requirements

- **Performance:** The engine must not hold DOM references. All parsing happens from `Element` objects but the resulting AST is plain TypeScript. `evalExpr` must be synchronous; no Promises or I/O.
- **Bundle size:** `decimal.js` is the only non-trivial runtime dependency. The package must remain tree-shakeable so hosts that only use item-player (not qti-processing directly) can exclude unused expression kinds.
- **Cross-platform:** Must run without modification in browser and Node.js. No `document`, `window`, or browser-only globals.
- **Security:** No `eval()`, `new Function()`, or dynamic code execution of any kind. All operator logic is compiled TypeScript.
- **Testability:** Each layer (build, eval, exec) must be independently testable without the others. Test fixtures live in `src/test/`.

---

## Design decisions

### Three-layer architecture: build / eval / exec

**Decision:** XML parsing (build), expression evaluation (eval), and statement execution (exec) are separate modules with no circular dependencies.  
**Rationale:** Testability and version-agnosticism (see Background). The AST acts as a stable intermediate representation.  
**Alternatives considered:** Single-pass recursive interpreter. Rejected — see Background.  
**Consequences:** Any new feature touches three files minimum. The discipline is intentional.

### `QtiValue` as a discriminated union with `null` and `invalid` as first-class kinds

**Decision:** `QtiValue` is `{ kind: 'null' } | { kind: 'value', ... } | { kind: 'invalid', ... }` rather than using TypeScript `null`/`undefined` or throwing exceptions.  
**Rationale:** QTI's NULL propagation semantics require callers to distinguish between "variable not set" (`null`), "valid value" (`value`), and "type error in expression" (`invalid`). Using JS `null` would conflate the first two; throwing exceptions would make NULL-propagating operators complex. Having `invalid` as a first-class kind means type errors are contained and do not stop execution of unrelated parts of the program.  
**Alternatives considered:** Throwing on type errors; using `null | T` union. Both rejected — they break NULL propagation and make partial-credit programs fragile.  
**Consequences:** Every caller of `evalExpr` must handle all three kinds. Helper functions `isNull()`, `isInvalid()`, `toBoolean()`, `toNumber()` are provided to reduce boilerplate.

### `DeclarationContext` is mutable, not functional

**Decision:** `setValue()` mutates in place. No immutable update pattern.  
**Rationale:** See Background. QTI processing is inherently a sequence of mutations; making it functional would add significant complexity for marginal benefit.  
**Alternatives considered:** Immutable context with structural sharing. Rejected.  
**Consequences:** Callers that need snapshot/rollback semantics (e.g. adaptive items that retry) must clone the declarations before calling `execProgram`. The item player does this in `submitAttempt()`.

### `OperatorRegistry` is a simple `Map<string, OperatorImpl>`, not a plugin system

**Decision:** `OperatorRegistry` wraps a `Map`. Extension is done by calling `register()` before calling `evalExpr`.  
**Rationale:** The full operator set for QTI 2.x/3.0 is finite and known. The registry exists primarily to support `<customOperator>` extensions by content authors or vendors, not to make the built-in operators swappable.  
**Alternatives considered:** Immutable operator table compiled into the evaluator. This would prevent `customOperator` support.  
**Consequences:** The default `EvalEnv` passed to `evalExpr` does not pre-populate the registry with built-in operators — built-in operator logic is inline in `evalExpr` switch cases. `OperatorRegistry` is only consulted for `customOperator` dispatch. This is the current design; built-in operators could be moved into the registry in future if the switch case grows unwieldy.

### `elementNameMapper` defaults to `Qti2xElementNameMapper` at build time

**Decision:** `BuildOptions.elementNameMapper` defaults to `new Qti2xElementNameMapper()` if not provided.  
**Rationale:** QTI 2.x is the primary supported format. The mapper converts element names (e.g. `qti-response-condition` → `responsecondition`) so the rest of the builder can use canonical lowercase names.  
**Alternatives considered:** Requiring callers to always supply a mapper. Rejected — most callers use QTI 2.x content and should not be burdened.  
**Consequences:** QTI 3.0 content must be passed with the QTI 3.0 mapper; using the default mapper on QTI 3.0 XML will silently fail to parse many elements because the element names will not match.

### `exitTest` is modelled as a statement that throws `QtiExit('test')` even at item scope

**Decision:** `exitTest` is parsed and executed in the item-level player, even though it is only meaningful at test scope.  
**Rationale:** Some fixture XML includes `<exitTest>` in `<responseProcessing>` (possibly incorrectly authored, or authored for a test-delivery context). Throwing at parse time would prevent loading those items at all. The current approach treats `exitTest` in item scope as a program halt, which is the least surprising interpretation.  
**Alternatives considered:** Parse-time error for `exitTest` outside `outcomeProcessing`. Rejected because it would break real content.  
**Consequences:** Items with `<exitTest>` in response processing will halt processing after that statement, which may produce unexpected scores if processing rules follow it. This is acceptable as a content-authoring error.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|---|---|---|---|
| Custom operators | `EvalEnv.customOperators: Record<string, (args, meta) => QtiValue>` | Populate the `customOperators` map before calling `evalExpr`. Keys are the operator `class` attribute or `definition` URI from the QTI XML. | Map `class="my:weighted"` to a custom scoring function |
| `OperatorRegistry` | `OperatorRegistry` in `eval/operators.ts` | Call `registry.register(name, impl)` to add or override an operator. Pass the registry as `EvalEnv.ops`. | Override `round` to use a different rounding mode |
| Element name mapping | `ElementNameMapper` (from `@pie-qti/qti-common`) | Implement and pass via `BuildOptions.elementNameMapper` | Support a content vendor's non-standard element names |
| Test-level context | `TestEvalContext` in `test/types.ts` | Populate and pass as `EvalEnv.test` | Wire `testVariables`/`numberCorrect` to real assessment-player state (prerequisite for G-11) |

---

## Data model / contracts

### `QtiValue`

Defined in `src/runtime/types.ts`. Three kinds: `'null'` (no value), `'value'` (typed value), `'invalid'` (type error). Key invariants:

- `kind: 'null'` is the QTI NULL value. `baseType` and `cardinality` are optional hints.
- `kind: 'value'` carries `baseType`, `cardinality`, and `value: unknown`. The actual runtime type of `value` depends on `baseType` and `cardinality`:
  - `cardinality: 'single'`, `baseType: 'integer'` → `value` is a JS `number` (integer).
  - `cardinality: 'single'`, `baseType: 'float'` → `value` is a JS `number`.
  - `cardinality: 'single'`, `baseType: 'boolean'` → `value` is a JS `boolean`.
  - `cardinality: 'single'`, `baseType: 'duration'` → `value` is a JS `number` representing milliseconds (NOT an ISO 8601 string; see `coerceBaseValue`).
  - `cardinality: 'multiple' | 'ordered'` → `value` is an array of the scalar type above.
  - `cardinality: 'single'`, `baseType: 'pair'` → `value` is a string `"A B"` with identifiers sorted (unordered).
  - `cardinality: 'single'`, `baseType: 'directedPair'` → `value` is a string `"A B"` (ordered).
- `kind: 'invalid'` has a `message` field. Callers should not treat invalid as false; use `isInvalid()` to check.

### `Declaration`

Defined in `src/runtime/types.ts`. A variable declaration holds `identifier`, `baseType`, `cardinality`, `defaultValue`, `value`, and optionally `correctResponse`, `mapping`, `areaMapping`, `lookupTable`. Key invariant: `value` is always a `QtiValue` (never undefined). `defaultValue` is also a `QtiValue` (may be `kind: 'null'` if no default was declared).

### `ProcessingProgram`

Defined in `src/ast/types.ts`. A flat list of `StatementNode[]`. The scope (`response`/`outcome`/`template`) is enforced at build time, not stored in the program itself. The program is stateless; all state lives in `DeclarationContext`.

### `EvalEnv`

Defined in `src/eval/evaluator.ts`. The environment passed to `evalExpr`:
- `ctx: DeclarationContext` — mutable variable state
- `ops: OperatorRegistry` — for `customOperator` dispatch
- `rng: () => number` — injectable RNG (default: `Math.random`; inject a seeded RNG for reproducible templates)
- `test?: TestEvalContext` — optional test-level context for aggregation expressions

### `TestEvalContext`

Defined in `src/test/types.ts`. Provides the item-level data needed by test-level aggregation operators. An item entry carries: `variables` (outcome/response variable values), `sectionIdentifiers`, `categories`, `weights`, and optional `correct`/`incorrect`/`presented`/`responded`/`selected` flags. This is the interface the assessment player must populate when wiring G-11.

---

## Acceptance criteria

### Functional

```
AC-1: buildResponseProcessingAst produces setOutcomeValue node
  Given: A <responseProcessing> element containing a <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
  When: buildResponseProcessingAst(el) is called
  Then: The program contains exactly one stmt.setOutcomeValue node with identifier 'SCORE' and an expr.baseValue child

AC-2: evalExpr returns null for missing variable
  Given: A DeclarationContext with no declarations
  When: evalExpr(env, { kind: 'expr.variable', identifier: 'MISSING' }) is called
  Then: The result has kind 'null'
  Notes: Must not throw

AC-3: execProgram sets SCORE to 1 for correct match_correct template
  Given: A declaration context with RESPONSE set to 'choiceA' and correctResponse for RESPONSE set to 'choiceA'; SCORE declared as float
  And: A program built from a match_correct equivalent XML (responseCondition: if match(variable(RESPONSE), correct(RESPONSE)) then setOutcomeValue(SCORE, 1) else setOutcomeValue(SCORE, 0))
  When: execProgram(env, program) is called
  Then: ctx.getValue('SCORE') has kind 'value' and value 1

AC-4: execProgram sets SCORE to 0 for incorrect response
  Given: The same context as AC-3 but RESPONSE set to 'choiceB'
  When: execProgram(env, program) is called
  Then: ctx.getValue('SCORE') has kind 'value' and value 0

AC-5: exitResponse halts program without error
  Given: A program with two statements: exitResponse followed by setOutcomeValue(SCORE, 99)
  When: execProgram(env, program) is called
  Then: No error is thrown and SCORE is not set to 99

AC-6: round uses ROUND_HALF_UP semantics
  Given: An expression <round><baseValue baseType="float">3.175</baseValue></round> evaluated with 2 decimal places
  When: evalExpr is called
  Then: The result value is 3.18, not 3.17
  Notes: Verifies decimal.js is used instead of Math.round

AC-7: mapResponse applies lower and upper bounds
  Given: A mapping with lowerBound=0, upperBound=2, default=0, and entries mapping 'A'->3 and 'B'->-1
  And: RESPONSE='A'
  When: mapResponse is evaluated
  Then: The result is 2 (clamped to upperBound)
  And: When RESPONSE='B', the result is 0 (clamped to lowerBound)

AC-8: templateConstraint restarts template processing
  Given: A templateProcessing program with setTemplateValue(X, randomInteger(1,10)) followed by templateConstraint(gt(variable(X), 5))
  And: The RNG is seeded to produce values [3, 7] in sequence
  When: execProgram is called
  Then: After execution, X has value 7 (the constraint forced a restart and the second random value satisfied it)

AC-9: Unknown statement tag throws at build time
  Given: A <responseProcessing> element containing an unrecognized element <qti-unknown-thing/>
  When: buildResponseProcessingAst is called
  Then: An error is thrown containing the tag name
  Notes: Does not silently skip

AC-10: testVariables returns multiple-cardinality collection
  Given: A TestEvalContext with 3 items each having SCORE values 0.5, 0.75, 1.0
  And: An expr.testVariables node with variableIdentifier='SCORE' and baseType='float'
  When: evalExpr is called with test context
  Then: The result has kind 'value', cardinality 'multiple', and value [0.5, 0.75, 1.0]

AC-11: customOperator dispatches to registered function
  Given: An EvalEnv with customOperators mapping 'my:bonus' to a function that returns qtiValue('float', 'single', 5)
  And: An expression node of kind 'expr.customOperator' with class 'my:bonus' and no args
  When: evalExpr is called
  Then: The result has kind 'value' and value 5

AC-12: outcomeCondition with elseIf branches
  Given: A program with outcomeCondition: if GRADE=='A' set PASSED=true, elseIf GRADE=='B' set PASSED=false, else set PASSED=false
  And: ctx value for GRADE is 'B'
  When: execProgram is called
  Then: PASSED is false

AC-13: OperatorRegistry lookup is case-insensitive
  Given: An OperatorRegistry with 'MyOp' registered
  When: registry.get('myop') is called
  Then: The registered impl is returned
```

### Edge cases

```
AC-E1: NULL propagation through arithmetic
  Given: An expr.sum with two children: a variable with kind 'null' and a baseValue of 1
  When: evalExpr is called
  Then: The result has kind 'null' (QTI NULL propagates through sum)
  Notes: Spec §4.1: operators that receive NULL input produce NULL output unless explicitly stated otherwise.

AC-E2: invalid kind does not propagate as boolean true
  Given: An expr.and with one child that returns kind 'invalid' and one that returns kind 'value' true
  When: evalExpr is called
  Then: The result is not kind 'value' with value true; it must be either kind 'invalid' or kind 'null'

AC-E3: duration values are stored as milliseconds, compared correctly
  Given: Two duration values PT5S and PT3S
  When: durationLT(PT3S, PT5S) is evaluated
  Then: The result is kind 'value' with value true

AC-E4: pair normalization makes A B == B A
  Given: Two single pair values 'X Y' and 'Y X'
  When: match(baseValue('X Y'), baseValue('Y X')) with baseType pair is evaluated
  Then: The result is kind 'value' with value true

AC-E5: templateConstraint caps at 100 iterations
  Given: A templateProcessing program where the constraint is always false
  When: execProgram is called
  Then: Execution terminates (no infinite loop) after at most 100 restarts; no error is thrown

AC-E6: buildOutcomeProcessingAst with scope 'test' allows outcomeCondition
  Given: An <outcomeProcessing> element with <outcomeCondition>
  When: buildOutcomeProcessingAst(el, { scope: 'test' }) is called
  Then: The program contains a stmt.outcomeCondition node without error
```

---

## Open questions

- [ ] **G-11 wiring**: The infrastructure for `buildOutcomeProcessingAst` and `TestEvalContext` is complete. The remaining work is in `@pie-qti/assessment-player`: parse `<outcomeProcessing>` from the assessmentTest XML, build a `TestEvalContext` from current item scores/attempts, and call `execProgram`. What is the blocking dependency — is there a concrete content-bank item that requires this?
- [ ] **`patternMatch` XSD vs ECMAScript regex divergence**: QTI uses XSD 1.1 regular expressions; JavaScript uses ECMAScript regex. Known differences include character class syntax and anchoring behaviour. Should we add a thin compatibility layer, or document the divergence and leave content authors responsible for using a compatible subset?
- [ ] **`customOperator` error handling**: If a registered custom operator throws, `evalExpr` will propagate the exception. Should it be caught and returned as `kind: 'invalid'` instead? This would make the behaviour consistent with built-in type errors but would also hide bugs in custom operator implementations.

---

## Related

- QTI spec: §4 (Response Processing), §4.3 (outcomeProcessing), QTI 2.2.2 expression reference
- Implementation:
  - `packages/qti-processing/src/ast/build.ts` — XML to AST
  - `packages/qti-processing/src/ast/types.ts` — AST node types
  - `packages/qti-processing/src/eval/evaluator.ts` — expression evaluation
  - `packages/qti-processing/src/eval/operators.ts` — `OperatorRegistry`
  - `packages/qti-processing/src/exec/execute.ts` — statement execution
  - `packages/qti-processing/src/runtime/context.ts` — `DeclarationContext`
  - `packages/qti-processing/src/runtime/value.ts` — `QtiValue` helpers, type coercion
  - `packages/qti-processing/src/runtime/types.ts` — `QtiValue`, `Declaration`, `BaseType`
  - `packages/qti-processing/src/test/types.ts` — `TestEvalContext`
- Adjacent PRDs: `docs/prds/architecture/item-player.md`, `docs/prds/architecture/assessment-player.md`
- Existing docs: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` §G-11
