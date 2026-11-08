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

`canSaveState?`, `resumeSession(sessionId)` and `queryItemBank(request)` are optional. A host may
instead resume by passing `resumeSessionId` to `initSession()`. `canSaveState` declares whether
the backend can persist candidate drafts through `saveState()` at all; it defaults to enabled, so
an adapter that implements `saveState` gets the shell's autosave without extra wiring (see
[Autosave](#autosave) for the opt-outs).

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

The serialized `itemSession` is omitted unless `sendItemSessionToBackend` is enabled. It can contain
template and context variables and is useful for save/resume scoring, but it is still untrusted
client data. Validate it against the server-owned item, declarations, lifecycle, and session record.

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
candidate action, `time-expired` for the response collection a hard time limit triggers. After a
whole-test expiry the player finalizes through the same path; a test-part, section or item limit
without late submission collects the closed scope's previously answered items as `time-expired`
submissions whose own scope has expired. Accept them: the delivery window closed with the expiry,
and collecting the pending responses is the mandated terminal step — rejecting them as late loses
candidate work.

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
response overrides. The helper `scoreAssessmentItem()` from
`@pie-qti/assessment-player/integration` performs the same normalization used by the reference
adapter, but production code still owns validation and error handling.

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
until the transition settles, and nothing saves after finalization. A failed save is a
non-fatal event, never a delivery failure: the shell logs it, reports it through
`onAutosaveChange` (`failed`), `onAutosaveFailed` and the element's `autosave-failed` event
("Not saved" on the indicator), and retries on the next change. The backend is the store —
there is no offline queue — so treat each save as an idempotent replace of the session's draft
keyed by `sessionId`.

### Start over

`startOver()` is the candidate-facing restart behind the resume prompt's destructive action: the
shell resets the draft — responses, sessions, results, flags, comments, visited state, the timer
preference and the clocks — and immediately persists the blank state, so a refresh cannot
resurrect discarded answers. Already-submitted items keep their accepted results: the backend
remains authoritative for everything it has accepted.

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
is preferred.

## Reference adapter

`ReferenceBackendAdapter` parses and scores on the client and stores sessions in browser storage. It
is intentionally suitable only for demos, tests, and explicit `referenceMode` preview. It does not
provide authentication, authorization, answer secrecy, or tamper-resistant scoring.
