# QTI response tracking and scoring

This document describes the current item-session model in `@pie-qti/item-player` and how the
assessment player sends item responses to an authoritative backend.

## State ownership

QTI item state is split by lifetime:

- `AssessmentItemDefinition` owns immutable item XML, declarations, security/configuration,
  extraction/component registries, and definition plugins.
- `ItemSession` owns one live attempt: response, outcome, template, and context variables; lifecycle;
  attempt count; duration; validation messages; and revision.
- `ItemPresentation` is an immutable rendering projection. It never owns responses and cannot mutate
  the session.
- An assessment `BackendAdapter` owns authoritative multi-item persistence and scoring decisions.

One rendered attempt must have one authoritative `ItemSession`. Browser elements and section
composition borrow that session rather than maintaining a second response store.

## Create a session

```ts
import { createAssessmentItemDefinition } from '@pie-qti/item-player';

const definition = createAssessmentItemDefinition({
  itemXml,
  role: 'candidate',
  seed: 42,
  security,
  plugins
});

const session = definition.openSession();
```

The definition runs template processing and prepares immutable registries/source for sessions. Each
opened session gets independent mutable variables and an independent random stream. The definition's
role is fixed; `session.present()` cannot override it.

To restore state:

```ts
const session = definition.openSession({
  restore: savedSession,
  responses: responseOverrides,
  activate: true
});
```

Restore is applied before response overrides. `activate: true` changes a suspended handoff into an
active interaction session.

## Read state

```ts
const view = session.state();

view.revision;
view.role;
view.lifecycleStatus;
view.completionStatus;
view.numAttempts;
view.duration;
view.responses;
view.outcomes;
view.templates;
view.context;
view.adaptive;
view.completed;
view.canSubmit;
```

The returned view is an immutable snapshot. `role` is fixed by the definition and cannot be changed
through presentation. Mutating the view does not update the session.

## Write responses

All primary API mutations go through `dispatch()`:

```ts
session.dispatch({
  action: 'setResponse',
  responseIdentifier: 'RESPONSE',
  value: 'choiceA'
});

session.dispatch({
  action: 'setResponses',
  responses: {
    RESPONSE: ['choiceA', 'choiceB'],
    CONFIDENCE: 0.8
  }
});
```

The session rejects unknown response identifiers and response writes in non-writable lifecycle
states. The underlying player coerces values according to the response declaration's cardinality and
base type.

Subscribe to transitions when a host needs reactive state:

```ts
const unsubscribe = session.subscribe(({ command, previous, current, result }) => {
  persistDraft(current.responses);
  console.log(command.action, previous.revision, current.revision, result);
});
```

Every successful dispatch increments `revision` and publishes immutable previous/current snapshots.

## Scoring and lifecycle commands

### `scoreAttempt`

Runs response processing and returns a `ScoringResult` without applying the adaptive submit guard:

```ts
const transition = session.dispatch({ action: 'scoreAttempt' });
const scoring = transition.result?.scoring;

console.log(scoring?.score);
console.log(scoring?.maxScore);
console.log(scoring?.outcomeValues);
```

### `submitAttempt`

Runs the adaptive attempt workflow. It counts the attempt before response processing so QTI
expressions observe the current `numAttempts`, then returns the updated completion state and optional
scoring:

```ts
const transition = session.dispatch({ action: 'submitAttempt' });

console.log(transition.current.numAttempts);
console.log(transition.current.completionStatus);
console.log(transition.result?.completed);
```

A completed adaptive item cannot be submitted again.

### `endAttempt`

Ends the current interaction lifecycle and optionally validates/counts the attempt:

```ts
const transition = session.dispatch({
  action: 'endAttempt',
  validateResponses: true,
  countAttempt: true
});

if (transition.result?.validation?.valid === false) {
  console.log(transition.result.validation.issues);
}
```

Assessment submission uses this command before sending a serialized attempt to its backend.

### Other lifecycle commands

- `suspendAttempt` creates a resumable handoff state.
- `newTemplate` creates a new template instance, optionally resetting responses.
- `updatePnp` applies a partial PNP update through the same transition stream.

## Serialize and dispose

```ts
const snapshot = session.serialize();
session.dispose();
```

`SerializedItemSessionState` includes the item/session identifiers, lifecycle, completion status,
attempt count, duration, response/outcome/template/context variable records, validation messages, and
save timestamp. It is JSON-safe but must be treated as untrusted if it crosses a client/server
boundary.

`dispose()` is idempotent. After disposal, the final `state()` snapshot remains readable with
`disposed: true`; dispatch, presentation, subscription, and serialization calls fail.

## Presentation and response events

```ts
const presentation = session.present();
```

`presentation.flow` contains final HTML nodes and interaction mounts. Each mount receives the
current response snapshot, correct-response data allowed by the fixed role, PNP, disabled state, and
its delivered interaction descriptor. `presentation.directRubrics` contains direct item rubric
blocks; shared section/test-part rubrics are placed by section composition.

Interaction web components emit `qti-change`. The item browser adapter translates the event into an
`ItemSession.dispatch({ action: 'setResponse', ... })` command, then emits a bubbling/composed
`response-change` event with the updated response map. The component does not become a second state
owner.

## QTI variable behavior

The player parses response, outcome, template, and context declarations. Missing built-in
`completionStatus` and `numAttempts` outcomes are supplied for interoperability with content that
omits them.

Response processing reads response/template/context values and writes outcomes. Template processing
runs before interaction delivery for a new definition/session template instance. Adaptive response
processing can use `numAttempts` and set `completionStatus` to determine whether another attempt is
allowed.

`state().responses` and `state().outcomes` are the public snapshots. There is no current primary API
named `getOutcomeValues()`.

## Server definition/session flow

Server code uses the same ownership model through the DOM-free entry:

```ts
import { createAssessmentItemDefinition } from '@pie-qti/item-player/server';

const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
const session = definition.openSession({ responses: { RESPONSE: 'choiceA' } });
try {
  const result = session.dispatch({ action: 'scoreAttempt' }).result?.scoring;
  const saved = session.serialize();
} finally {
  session.dispose();
}
```

The server entry excludes browser presentation and DOM-bearing types while preserving session
commands, immutable state, and serialized persistence.

## Assessment-player flow

`AssessmentPlayer` mirrors the active item session's response snapshots into its assessment session
state. The backend contract submits:

```ts
interface SubmitResponsesRequest {
  sessionId: string;
  itemIdentifier: string;
  responses: Record<string, ResponseValue>;
  submittedAt: number;
  timeSpent?: number;
  timing?: SubmitTimingEvidence;
  itemSession?: SerializedItemSessionState;
}
```

The rich item session is included only when `sendItemSessionToBackend` is enabled. A production
backend must validate it against server-owned item source and state rather than accepting template,
context, lifecycle, attempt, or timing values as authoritative.

In individual submission mode, `next()` submits the current item before navigation. Local
`endAttempt` is provisional: if validation or the backend request fails, `submitCurrentItem()`
restores the exact pre-submit session snapshot so the candidate can retry. A successful backend may
return an authoritative `nextItemIdentifier` and replacement assessment state.

In simultaneous mode, `submit()` sends every unsubmitted item before calling
`finalizeAssessment()`. Those item requests are sequential rather than one transport transaction, so
backend writes must be idempotent and retry-safe after partial success.

## Security rules

- Do not send candidate clients full answer-bearing QTI XML for authoritative assessments.
- Load authoritative item XML and response processing from server-controlled storage.
- Authenticate session ownership and authorize every item submission.
- Validate response identifiers, cardinality, base types, lifecycle, attempt limits, and timing.
- Treat client scores, outcomes, timestamps, and serialized item variables as untrusted.
- Configure parsing limits, HTML sanitation, URL policy, and Trusted Types for same-DOM rendering.
- Use a sandboxed cross-origin iframe when content is not trusted to execute in the host origin.
