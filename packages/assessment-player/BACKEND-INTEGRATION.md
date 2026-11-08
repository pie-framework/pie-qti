# Backend integration

`AssessmentPlayer` is backend-authoritative. The browser collects candidate responses and renders the
client-safe assessment returned by the backend; the backend authenticates the session, owns the full
QTI source, performs scoring, persists state, and decides branching.

The TypeScript contract is exported from `@pie-qti/assessment-player/integration`.

## Create the player

Initialization is asynchronous:

```ts
import { AssessmentPlayer } from '@pie-qti/assessment-player';

const player = await AssessmentPlayer.create({
  backend,
  initSession: {
    assessmentId: 'math-final',
    candidateId: 'candidate-42',
    resumeSessionId
  }
});
```

Do not call `new AssessmentPlayer(...)`; its constructor is private. Browser hosts may assign the
same `backend` and `initSession` objects to `pie-qti-assessment-player` from
`@pie-qti/player-elements`.

## Adapter contract

```ts
import type {
  BackendAdapter,
  FinalizeAssessmentRequest,
  FinalizeAssessmentResponse,
  InitSessionRequest,
  InitSessionResponse,
  SaveAssessmentStateRequest,
  SaveAssessmentStateResponse,
  SubmitResponsesRequest,
  SubmitResponsesResponse
} from '@pie-qti/assessment-player/integration';

export class HttpBackend implements BackendAdapter {
  initSession(request: InitSessionRequest): Promise<InitSessionResponse> {
    return post('/api/qti/session', request);
  }

  submitResponses(request: SubmitResponsesRequest): Promise<SubmitResponsesResponse> {
    return post('/api/qti/item-submission', request);
  }

  saveState(request: SaveAssessmentStateRequest): Promise<SaveAssessmentStateResponse> {
    return post('/api/qti/session/state', request);
  }

  finalizeAssessment(request: FinalizeAssessmentRequest): Promise<FinalizeAssessmentResponse> {
    return post('/api/qti/finalize', request);
  }
}
```

`canSaveState?`, `requiresItemSession?`, `resumeSession(sessionId)` and `queryItemBank(request)` are
optional. A host may instead resume by passing `resumeSessionId` to `initSession()`. `canSaveState`
declares whether the backend can persist candidate drafts through `saveState()` at all; it defaults
to enabled, so an adapter that implements `saveState` gets the shell's autosave without extra wiring
(see [Autosave](#autosave) for the opt-outs). `requiresItemSession` declares that the backend scores
from the candidate's serialized item session (see [Item submission](#item-submission)).

## Initialization response

`initSession()` returns a server-generated `sessionId`, a client-safe `SecureAssessment`, and
optionally a previously saved `AssessmentSessionState`:

```ts
return {
  sessionId: crypto.randomUUID(),
  assessment: {
    identifier: 'math-final',
    title: 'Mathematics final',
    navigationMode: 'linear',
    submissionMode: 'individual',
    testParts: [
      {
        identifier: 'part-1',
        navigationMode: 'linear',
        submissionMode: 'individual',
        sections: [
          {
            identifier: 'section-1',
            visible: true,
            assessmentItemRefs: [
              {
                identifier: 'item-1',
                role: 'candidate',
                itemXml: filteredItemXml
              }
            ]
          }
        ]
      }
    ]
  },
  restoredState
};
```

For candidate delivery, `SecureItemRef.itemXml` must not contain correct responses, answer keys, or
authoritative scoring rules. The item ref's `role` is compiled into the item definition and remains
fixed for that live session. The browser trusts this response; it cannot repair an unsafe backend
payload.

Rubric placement is scoped:

- test-part and section rubric blocks are shared section content;
- direct `assessmentItem` rubric blocks remain with the item and are exposed as
  `ItemSession.present().directRubrics` after role filtering.

### Resume and finished sessions

When `initSession()` (or `resumeSession()`) carries a `resumeSessionId`, return the saved
`AssessmentSessionState` as `restoredState`. The snapshot restores the candidate's responses,
scoring results and item-session lifecycle, flags for review, candidate comments, the
timer-visibility preference and the timing clocks; delivery reopens at the snapshot's
`currentItemIdentifier`, and the shell's resume prompt dates itself from `timing.savedAt`.
Persist every field the shell sends: anything the backend drops silently disappears on resume.

A session that has already been finalized has no resumable draft. Return it with
`InitSessionResponse.finalized: true` and no `restoredState`; the player then renders a terminal
"already submitted" view instead of reopening the test. Player builds that predate the flag
ignore it, so always pair it with the absence of `restoredState` — the flag tells newer builds
why there is nothing to restore.

## Item submission

The player sends one `SubmitResponsesRequest` per item:

```ts
interface SubmitResponsesRequest {
  sessionId: string;
  itemIdentifier: string;
  responses: Record<string, ResponseValue>;
  submittedAt: number;
  timeSpent?: number;
  countAttempt?: boolean;
  timing?: SubmitTimingEvidence;
  itemSession?: SerializedItemSessionState;
  comment?: string;
}
```

The serialized `itemSession` is sent when the host enables `sendItemSessionToBackend`, and always to a
backend that declares `requiresItemSession: true` — whatever the host flag says. It can contain
template and context variables (the instance a templated item drew, possibly its key) and an
adaptive item's accumulated outcomes, so it is still untrusted client data: validate it against the
server-owned item, declarations, lifecycle, and session record. `ReferenceBackendAdapter`
(reference/preview mode) declares it and scores from it: a templated item against the instance the
candidate saw (never a fresh template draw), an adaptive item from its outcomes as submitted. It
refuses a templated or adaptive item that arrives without one (`success: false`,
`itemSessionRequired`). A production backend that owns item sessions server-side leaves the flag
unset, and the session stays client-local.

Return a successful scoring result and, when applicable, an authoritative branch/state update:

```ts
return {
  success: true,
  result: {
    itemIdentifier: request.itemIdentifier,
    score: 1,
    maxScore: 1,
    completed: true,
    outcomeValues: { SCORE: 1 },
    feedback: [{ content: '<p>Well done.</p>', type: 'correct' }]
  },
  nextItemIdentifier: 'item-3',
  updatedState
};
```

`nextItemIdentifier` may also be `EXIT_SECTION`, `EXIT_TESTPART`, or `EXIT_TEST`. If `success` is
false, include an `error` and omit `result`.

**Outcome-processing failures.** When test-level outcome processing fails on your side, keep the
submission accepted (`success: true`) and report the failure as `outcomeProcessingError`
(`{ code, message }`) on the `SubmitResponsesResponse` — and on the `FinalizeAssessmentResponse` when
it happens at the end. The player surfaces it to the host once per distinct failure (`onError`
with the coded `outcomeProcessingFailed`, the element's `player-error` event) and attaches it to
the final `AssessmentResults.outcomeProcessingError`; the raw message never reaches candidates.
Responses stay persisted: only SCORE and `testFeedback` computation failed.

**Attempts.** `countAttempt` defaults to `true`: the submission consumes an attempt, and its
result is the item's recorded result. Hint and "show me" controls (QTI `endAttemptInteraction`
with `countAttempt="false"`) submit with `countAttempt: false` instead. These submissions run
response processing but are not attempts: do not count them toward `maxAttempts` and do not
record their result as the item's result — the candidate stays on the item and may revise.
Enforce the same distinction the player applies: only a `countAttempt: true` submission may
spend an attempt or record the item's result.

**Comments.** `comment` carries the candidate's per-item comment and is sent with the item's
submissions whenever the test allows comments (the resolved `itemSessionControl.allowComment`
cascade). Backends should enforce `allowComment` the same way they enforce `maxAttempts`: accept
a comment only where the item's resolved control turns it on, and ignore or reject one where it
does not. Comments also ride the persisted session snapshot (`itemComments`), so an unsubmitted
comment survives autosave and resume.

**Timing and expiry.** `timing` is client evidence and production backends stay authoritative,
but `timing.submissionReason` is part of the flow contract: `candidate` (default) for a normal
candidate action, `time-expired` for the response collection a hard time limit triggers,
`proctor` for the collection a proctor's forced end of the test runs (`submit({ force: true })`,
see [Proctor controls](#proctor-controls)), and `unreachable` for a question the end of the test
collects as it stands because the candidate can no longer reach it (see the skipping rule below).
After a whole-test expiry the player finalizes through the same path; a test-part, section or item
limit without late submission collects the closed scope's previously answered items as
`time-expired` submissions whose own scope has expired. Accept them: the delivery window closed
with the expiry, and collecting the pending responses is the mandated terminal step — rejecting
them as late loses candidate work. A `proctor` collection is an administrative end of the test;
record it as such. A scope expiry looks across the whole reachable delivery: the candidate moves to
the next open question of the part, else to an open question earlier in a nonlinear part, else to
the next part — only when no open question remains anywhere is it the dead end that asks for the
submission. A session restored after one of its limits ran out locks that scope from the restored
clocks before any item is entered and lands the same way, and a restored whole-test expiry
finalizes as soon as delivery runs.

**Skipping and validation (QTI `allowSkipping` / `validateResponses`).** Both controls apply only
to items in `individual` submission-mode parts, and they gate *submission*, not navigation: in a
nonlinear part the candidate may move away from an unanswered item (navigation is not
submission). An item is skipped when every response is NULL, empty, or still equal to its declared
default (the test QTI `numberResponded` applies). A candidate-initiated submission never sends a
skipped item while `allowSkipping=false`, nor an answered item whose responses do not satisfy its
interactions (minChoices, minStrings, matchMin…) while `validateResponses=true`: `next()`,
`submitCurrentItem()` and `checkCurrentItem()` reject with the coded `responseRequired` /
`attemptValidationFailed`, and the end of the test rejects with `finalizeResponseRequired` /
`finalizeResponseInvalid`, naming the items (`params.items`, `params.itemIdentifiers`;
`getSubmissionBlockers()` lists them for a confirmation UI, an incomplete answer with the
interaction's `requirement`). Because a test part cannot be re-entered, leaving an individual part
with such questions is refused the same way (`leavePartResponseRequired` /
`leavePartResponseInvalid`; `getTestPartBlockers()` lists them) — on Next, on a direct jump into the
next part, and on a branch decision (`EXIT_TESTPART`, `EXIT_SECTION`, a target in a later part,
`EXIT_TEST`) that would leave the part: the candidate stays, and the next `next()` from that item
follows the decision once the questions are answered. A question the candidate can no longer reach
never holds the end of the test (a session restored from before this gate, a branch rule's own
consequences): it is collected as it stands with `submissionReason: 'unreachable'` — record it as
skipped or incomplete, never as a normal candidate submission. An administrative end — a time expiry
or a proctor's forced submit — collects every item as it stands, so an unanswered required item
reaches you as an empty, `time-expired` (or `proctor`) submission: record it as skipped by the
expiry. Simultaneous parts are never gated (QTI: the controls are not applicable there).

**Feedback.** Production builds strip `<responseProcessing>` from candidate item XML, so the
candidate's own session cannot compute modal or integrated feedback. When your delivered item XML
has no response processing, return the item's feedback in `result.feedback` (`FeedbackItem[]`:
`content` HTML and a `correct` / `incorrect` / `hint` / `solution` type) together with the
outcome values that drive feedback selection in `result.outcomeValues`; the shell surfaces that
feedback under the resolved `showFeedback` on the check-answer and submit-on-move paths.
Without it, candidates see no feedback even where `showFeedback` is on.

For the active item, `submitCurrentItem()` treats local end-attempt as provisional: validation or a
failed backend submission restores the exact pre-submit item-session snapshot so the candidate can
retry. Backend writes should be idempotent by `(sessionId, itemIdentifier, submission identity)` to
make network retries safe.

Simultaneous assessment submission calls `submitResponses()` sequentially for every unsubmitted item
and only then calls `finalizeAssessment()`. It is not one transport-level transaction: the backend
must tolerate a retry after some item requests have already succeeded.

The end of the test also collects **individual-mode items** the backend has not accepted yet: the
open current item, and every item the candidate visited and answered but left through a nonlinear
jump (navigation submits nothing) or whose answer changed after a practice check. They arrive as
normal candidate submissions (`countAttempt: true`, no `submissionReason`) before
`finalizeAssessment()` — except a question the candidate can no longer reach whose skipping or
validation control would refuse it, which arrives as it stands with `submissionReason:
'unreachable'`. Responses you already accepted unchanged are never re-sent, so no attempt is spent
twice.

## Server-side scoring

Keep full QTI XML and scoring rules on the server. The DOM-free server entry uses the same
definition/session model as browser delivery:

```ts
import { createAssessmentItemDefinition } from '@pie-qti/item-player/server';

export function scoreItem(itemXml: string, responses: Record<string, unknown>) {
  const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
  const session = definition.openSession({ responses });
  try {
    const scoring = session.dispatch({
      action: 'endAttempt',
      countAttempt: false,
      validateResponses: false
    }).result?.scoring;
    if (!scoring) throw new Error('QTI scoring produced no result');
    return scoring;
  } finally {
    session.dispose();
  }
}
```

Restore serialized state through `definition.openSession({ restore })`; closed sessions reject
response overrides. A restored session keeps its template values (template processing does not run
again), which is how a templated item must be scored: against the instance the candidate saw. The
helper `scoreAssessmentItem()` from `@pie-qti/assessment-player/integration` performs the same
normalization used by the reference adapter: given an `itemSession` it restores it (an adaptive
item's outcomes are taken as submitted, never recomputed), and it throws an
`AssessmentItemScoringError` with code `itemSessionRequired` for a templated or adaptive item that
comes without one (`itemScoringRequiresSession(itemXml)` tells you in advance). Production code
still owns validation and error handling.

## State persistence

`saveState()` receives the assessment state, including responses, visited items, scoring results,
timing, lifecycle hints, and optional rich item-session snapshots. Store it under the authenticated
session and candidate. On resume, return it as `InitSessionResponse.restoredState`.

The server should reject:

- a session owned by another candidate;
- an item not present in the server-owned assessment/session form;
- response identifiers or values incompatible with declarations;
- impossible lifecycle, attempt-count, or timing transitions;
- client scores, answer keys, or template values treated as authoritative.

### Autosave

Autosave is ON by default: the shell persists a session snapshot through `saveState()` whenever
the backend reports the save capability (`canSaveState` is not `false`) and the host has not
opted out. Every kind of candidate activity — response edits, navigation, flags, comments, the
timer-visibility preference, pause changes — restarts a 1.5 s debounce window, and
`visibilitychange` / `pagehide` flush immediately. Hosts turn it off (because they persist state
themselves, or the backend cannot store drafts) by setting the player config `autosave: false`,
the element attribute `autosave="false"`, or `canSaveState: false` on the adapter; the shell's
save indicator hides with it. The debounce window is tunable through `autosaveIntervalMs`
(element attribute `autosave-interval-ms`).

Each payload is a full session snapshot (`SaveAssessmentStateRequest.state`) stamped with
`timing.savedAt`. A save due while a navigation or submission transition is in flight defers
until the transition settles, and nothing saves after finalization. A failed save (a rejected
promise or `success: false`) is a non-fatal event, never a delivery failure: the shell logs it,
reports it through `onAutosaveChange` (`failed`), `onAutosaveFailed` and the element's
`autosave-failed` event ("Not saved" on the indicator), and retries the draft automatically after
2 s, 8 s and 30 s; after the third retry it waits for the next change or flush. A successful save
or new candidate activity starts the backoff over. The backend is the store — there is no
offline queue — so treat each save as an idempotent replace of the session's draft keyed by
`sessionId`. The end of the test always persists the final snapshot (after any save still in
flight) before it calls `finalizeAssessment()`, so outcome processing reads the end-of-test clocks.

### Start over

`startOver()` is the candidate-facing restart behind the resume prompt's destructive action. It
clears what the candidate authored and you have not accepted — responses, flags, comments, the
visited marks, the timer preference and any unrecorded check state — and persists the blank draft
immediately, so a refresh cannot resurrect discarded answers. It **keeps the time accounting**:
every clock, each expired scope and a whole-test expiry persist, so restarting never grants a fresh
time allowance after the questions were seen. Items you already accepted keep their recorded
results (and responses): the backend stays authoritative for them, and the end of the test does not
re-send them. A test part the candidate already left is never re-entered: the restart covers the
furthest part reached, and questions of earlier parts stay closed exactly as they stand (visited,
collected at the end of the test as they are). Delivery repositions to the first question of that
part that is still open (else the first open question after it); when nothing is open (the expired
scopes cover every remaining question, or the whole test expired), the player reports the expiry
dead end again (`onTimeExpired` with `submissionRequired`) and the candidate's way out is Submit. Hosts that never let a candidate discard saved work turn the action off with the shell prop
`allowStartOver={false}` (element attribute `allow-start-over="false"`): a restored draft then
simply continues.

### Proctor controls

A proctor console drives the player through the core (`AssessmentPlayer`) or the element
(`<pie-qti-assessment-player>`):

| Control | Core | Element |
| --- | --- | --- |
| Pause with a candidate-facing reason | `pause(reason?)` | `pause(reason?)` |
| Resume | `resume()` | `resume()` |
| Read the pause | `isPaused()`, `getPauseReason()` | `isPaused()`, `getPauseReason()` |
| Read the clocks | `getTimeState()` | `getTimeState()` |
| Read the terminal state | `isFinalized()` | `isFinalized()` |
| Save the draft now | `flushAutosave()` | `flushAutosave()` |
| Force-submit | `submit({ force: true })` | `submit({ force: true })` |

A candidate's `submit()` is rejected while paused; `submit({ force: true })` is the administrative
end of the test: it runs during a pause and behind the begin gate, ignores minimum times and the
skipping/validation controls, and every collected submission carries
`timing.submissionReason: 'proctor'`. It never fails for concurrency: while a candidate's navigation
or submission is in flight it is queued behind that transition and lands once it settles (when the
transition itself ended the test, it resolves with those results).

Events for the console: `onPauseChange` (`player-pause` / `player-resume`) — a session restored
paused reports its pause once right after creation, so the console never misses it;
`onTimeExpired` (`time-expired`) and `onScopeTimeExpired` (`scope-time-expired`, with the `nextIndex`
delivery moved to) for limits that ran out; `onFinalized` (`session-finalized`,
`{ restored, results, endReason }`) once the session is terminal, including a session restored
already finalized. `endReason` (also `results.endReason` and `getEndReason()`) says which path ended
the test in this delivery: `candidate`, `expiry`, `proctor` or `branch`. Every ending — a proctor's
force-submit and a QTI `EXIT_TEST` included — fires `onComplete` with the results and the shell's
`onSubmit` (the element's `submit` event) once. While paused, the shell closes every dialog it
contains and dispatches `pie-qti-close-transient-ui` (`{ reason: 'pause' }`) on `document` so
editors and popups outside dialogs close too; the host page around an embedded player stays
operable.

## Finalization

`finalizeAssessment({ sessionId })` computes the final assessment result and returns per-item scores:

```ts
return {
  success: true,
  totalScore: 18,
  maxScore: 20,
  itemScores,
  outcomes: { GRADE: 'A', FLAGS: ['SEEN', 'RIGHT'], TOTAL: 18 },
  finalizedAt: Date.now()
};
```

The optional `outcomes` map holds the test-level outcome values after outcome processing
(`TestOutcomeValues`: a scalar, an array for a multiple or ordered outcome, `null` for NULL) and
drives QTI `testFeedback` visibility. Return it from `submitResponses()` and from a resumed
`initSession()` as well, so `access="during"` feedback follows each submission. The older single
`feedback` string is retained for compatibility; structured assessment feedback plus outcome values
is preferred. Report an outcome-processing failure as `outcomeProcessingError` here too (see
[Item submission](#item-submission)); the finalization still succeeds.

## Reference adapter

`ReferenceBackendAdapter` parses and scores on the client and stores sessions in browser storage. It
is intentionally suitable only for demos, tests, and explicit `referenceMode` preview. It does not
provide authentication, authorization, answer secrecy, or tamper-resistant scoring.
