# Server scoring guide

`@pie-qti/item-player/server` exposes the definition/session model without DOM-bearing presentation,
custom-element, PNP, PCI, catalog, or renderer types. Compile server-owned QTI once, then open an
independent session for each attempt.

## Minimal scorer

```ts
import { createAssessmentItemDefinition } from '@pie-qti/item-player/server';

export interface ScoreItemRequest {
  itemXml: string;
  responses: Record<string, unknown>;
}

export function scoreItem({ itemXml, responses }: ScoreItemRequest) {
  const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
  const session = definition.openSession({ responses });
  try {
    const transition = session.dispatch({
      action: 'endAttempt',
      countAttempt: false,
      validateResponses: false
    });
    if (!transition.result?.scoring) throw new Error('QTI scoring produced no result');
    return transition.result.scoring;
  } finally {
    session.dispose();
  }
}
```

The server session interface has four operations:

- `state()` reads the immutable authoritative view;
- `dispatch(command)` updates responses or runs a lifecycle/scoring command;
- `serialize()` captures persistence state;
- `dispose()` releases the session.

## Persisted item sessions

Restore template variables, outcomes, attempts, duration, and context before scoring an existing
attempt:

```ts
import {
  createAssessmentItemDefinition,
  type ServerSerializedItemSessionState
} from '@pie-qti/item-player/server';

export function scoreSavedAttempt(itemXml: string, snapshot: ServerSerializedItemSessionState) {
  const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
  const session = definition.openSession({ restore: snapshot });
  try {
    const scoring = session.dispatch({ action: 'scoreAttempt' }).result?.scoring;
    if (!scoring) throw new Error('QTI scoring produced no result');
    return scoring;
  } finally {
    session.dispose();
  }
}
```

Candidate response overrides are rejected for closed/restored sessions. Validate and apply responses
while the attempt is writable, then persist the resulting serialized state.

Treat any browser-provided snapshot as untrusted save data. Verify its item identifier, declarations,
variable types/cardinalities, lifecycle, attempt count, and timing against server-owned state.

## HTTP boundary

The package does not prescribe endpoint paths or authentication. A production endpoint should accept
an item identifier and candidate responses, then load authoritative QTI XML from server storage:

```ts
export async function POST(request: Request) {
  const identity = await requireCandidate(request);
  const input = await readBoundedJson(request);
  const item = await itemRepository.getForSession(identity.sessionId, input.itemIdentifier);

  if (!item) return Response.json({ error: 'Unknown item' }, { status: 404 });

  const result = scoreItem({
    itemXml: item.authoritativeXml,
    responses: validateDeclaredResponses(item, input.responses)
  });

  await submissionRepository.saveIdempotently({
    sessionId: identity.sessionId,
    itemIdentifier: input.itemIdentifier,
    responses: input.responses,
    result
  });

  return Response.json({ success: true, result });
}
```

Do not accept authoritative item XML from a candidate request in production. Otherwise the client
can replace scoring rules or correct responses before asking the server to score them.

Also enforce request/XML size limits, authentication, session ownership, allowed item identifiers,
attempt limits, submission timing, and idempotency. Client timestamps are evidence, not the
authoritative clock.

## Candidate-safe item delivery

Server scoring does not make candidate delivery safe. Candidate-visible XML must exclude
answer-bearing material, including `<correctResponse>`, response processing rules, sensitive
outcomes, and restricted rubric/feedback content. Keep the full item in server storage and return a
role-filtered representation to the browser.

`@pie-qti/assessment-player/integration` exports `scoreAssessmentItem()` as the reference adapter's
normalization helper. Production `BackendAdapter.submitResponses()` implementations still own
authentication, validation, persistence, and authorization.
