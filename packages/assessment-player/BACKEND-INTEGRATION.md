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

`resumeSession(sessionId)` and `queryItemBank(request)` are optional. A host may instead resume by
passing `resumeSessionId` to `initSession()`.

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

## Item submission

The player sends one `SubmitResponsesRequest` per item:

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
    outcomeValues: { SCORE: 1 }
  },
  nextItemIdentifier: 'item-3',
  updatedState
};
```

`nextItemIdentifier` may also be `EXIT_SECTION`, `EXIT_TESTPART`, or `EXIT_TEST`. If `success` is
false, include an `error` and omit `result`.

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

## Finalization

`finalizeAssessment({ sessionId })` computes the final assessment result and returns per-item scores:

```ts
return {
  success: true,
  totalScore: 18,
  maxScore: 20,
  itemScores,
  outcomes: { PASS: 'PASS' },
  finalizedAt: Date.now()
};
```

The optional `outcomes` map drives QTI `testFeedback` visibility. The older single `feedback` string
is retained for compatibility; structured assessment feedback plus outcome values is preferred.

## Reference adapter

`ReferenceBackendAdapter` parses and scores on the client and stores sessions in browser storage. It
is intentionally suitable only for demos, tests, and explicit `referenceMode` preview. It does not
provide authentication, authorization, answer secrecy, or tamper-resistant scoring.
