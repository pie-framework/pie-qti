# @pie-qti/assessment-player

Backend-authoritative orchestration for multi-item QTI 2.2 and QTI 3.0 assessments.

The package owns assessment navigation, timing, item-session lifecycle, state persistence, and the
`BackendAdapter` boundary. Browser rendering is published separately by
`@pie-qti/player-elements`; there is no public `@pie-qti/assessment-player/components` export.

## Install

For the framework-neutral orchestration API:

```bash
bun add @pie-qti/assessment-player
```

For the supported browser elements:

```bash
bun add @pie-qti/player-elements
```

## Browser element

Import the registration entry and use the `pie-qti-assessment-player` tag:

```ts
import '@pie-qti/player-elements/register';

const element = document.createElement('pie-qti-assessment-player');
element.backend = backend;
element.initSession = {
  assessmentId: 'algebra-final',
  candidateId: 'candidate-42'
};
element.config = {
  showSections: true,
  allowSectionNavigation: true,
  showProgress: true
};
document.body.append(element);
```

The element also exposes `next()`, `previous()`, `navigateTo()`, `navigateToSection()`, `submit()`,
`getResponses()`, `getState()`, and `restoreState()`. Its public properties and events are documented
in [`@pie-qti/player-elements`](../player-elements/README.md).

### Explicit reference/preview mode

Raw assessment XML is a demo and offline-preview path. Enable it explicitly before assigning XML:

```ts
import '@pie-qti/player-elements/register';

const element = document.createElement('pie-qti-assessment-player');
element.referenceMode = true;
element.assessmentTestXml = assessmentTestXml;
element.items = {
  'items/item-1.xml': item1Xml,
  'ITEM-2': item2Xml
};
document.body.append(element);
```

Alternatively, set `itemBaseUrl` so the element can resolve `assessmentItemRef@href`. Reference mode
uses the client-side `ReferenceBackendAdapter`; item XML, correct answers, and scoring rules are
therefore available in the browser. Do not use it for authoritative delivery.

## Programmatic API

`AssessmentPlayer` initializes asynchronously. Construct it with `AssessmentPlayer.create()` and
the exact `BackendAdapter` session request:

```ts
import { AssessmentPlayer } from '@pie-qti/assessment-player';
import type { BackendAdapter } from '@pie-qti/assessment-player/integration';

declare const backend: BackendAdapter;

const player = await AssessmentPlayer.create({
  backend,
  initSession: {
    assessmentId: 'algebra-final',
    candidateId: 'candidate-42'
  },
  security,
  plugins
});

const unsubscribe = player.onResponseChange((responses) => {
  console.log(responses);
});

await player.navigateTo(0);
const session = player.getCurrentItemSession();
const presentation = session?.present();

// Section/test-part shared rubrics are separate from direct assessmentItem rubrics.
const sharedRubrics = player.getCurrentSharedRubricBlocks();
const directRubrics = presentation?.directRubrics ?? [];

await player.next();
const results = await player.submit();

unsubscribe();
player.destroy();
```

Each secure item fixes the role of its compiled item definition and live session. Callers cannot
change that role through `ItemSession.present()`.

### Development adapter

The reference adapter is useful for tests and demos when a `SecureAssessment` is already available:

```ts
import { AssessmentPlayer } from '@pie-qti/assessment-player';
import { ReferenceBackendAdapter } from '@pie-qti/assessment-player/integration';

const backend = new ReferenceBackendAdapter();
backend.registerAssessment('preview', secureAssessment);

const player = await AssessmentPlayer.create({
  backend,
  initSession: { assessmentId: 'preview', candidateId: 'local-user' }
});
```

This adapter stores state and scores in the client. It is not a production security boundary.

## Backend contract

Implement `BackendAdapter` for production:

```ts
import type {
  BackendAdapter,
  FinalizeAssessmentRequest,
  InitSessionRequest,
  SaveAssessmentStateRequest,
  SubmitResponsesRequest
} from '@pie-qti/assessment-player/integration';

export class HttpAssessmentBackend implements BackendAdapter {
  initSession(request: InitSessionRequest) {
    return post('/api/qti/session', request);
  }

  submitResponses(request: SubmitResponsesRequest) {
    return post('/api/qti/item-submission', request);
  }

  saveState(request: SaveAssessmentStateRequest) {
    return post('/api/qti/session/state', request);
  }

  finalizeAssessment(request: FinalizeAssessmentRequest) {
    return post('/api/qti/finalize', request);
  }
}
```

The backend must authenticate the candidate, authorize the assessment, filter candidate-visible item
XML, own authoritative scoring state, and validate every client submission. See
[BACKEND-INTEGRATION.md](./BACKEND-INTEGRATION.md) for the request/response contract.

## Submission and lifecycle behavior

- `updateResponse()` and the current `ItemSession` update local response state.
- `submitCurrentItem()` provisionally ends the live attempt, then sends the response to the backend.
  If validation or the backend request fails, the player restores the pre-submit item-session
  snapshot so the candidate can retry.
- In `individual` mode, `next()` submits the current item before navigating and honors the backend's
  `nextItemIdentifier` branch decision.
- In `simultaneous` mode, `submit()` sends every unsubmitted item before finalization while preserving
  responses and serialized item sessions across backend state replacements.
- `submit()` finishes by calling `finalizeAssessment()` and returns `AssessmentResults`.

The optional `sendItemSessionToBackend` flag includes the rich serialized item-session snapshot in
submission requests. Treat that snapshot as untrusted client save data; a production backend should
validate it against server-owned source and state.

## Core configuration

`BackendAssessmentPlayerConfig` requires:

- `backend: BackendAdapter`
- `initSession: InitSessionRequest`

It also accepts definition plugins, security and PCI policy, PNP, i18n, deterministic RNG, section
host/tool configuration, display hints, timing warnings, and compatibility callbacks. Prefer the
`onItemChange()`, `onSectionChange()`, `onResponseChange()`, `onComplete()`, and timing subscription
methods when lifecycle-managed unsubscription is useful.

Definition plugins use `AssessmentItemDefinitionPlugin` from `@pie-qti/item-player` and are applied
to every item definition created by the assessment player.

## Public exports

- `@pie-qti/assessment-player`: `AssessmentPlayer`, navigation types, and backend contract re-exports.
- `@pie-qti/assessment-player/integration`: `BackendAdapter`, request/response types,
  `ReferenceBackendAdapter`, and assessment scoring/composition helpers.
- `@pie-qti/player-elements/register`: complete browser registration entry.
- `@pie-qti/player-elements/elements`: browser constructors for manual registration.

Svelte source components inside this package are implementation details and are not published as a
package subpath.
