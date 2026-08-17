# @pie-qti/item-player

Framework-neutral QTI 2.2/3.0 item compilation, live session state, response processing, and
render-neutral presentation data.

The primary API has two lifetimes:

1. `AssessmentItemDefinition` compiles immutable item XML, security policy, mappings, and plugins.
2. `ItemSession` owns one mutable attempt, its variables, lifecycle, responses, and presentation.

The implementation engine is private. Browser, assessment, standalone, and server deployments all
use the definition/session interface.

## Install

```bash
bun add @pie-qti/item-player
```

For the complete browser runtime, prefer `@pie-qti/player-elements`:

```bash
bun add @pie-qti/player-elements
```

```ts
import '@pie-qti/player-elements/register';
```

## Compile a definition and open a session

```ts
import { createAssessmentItemDefinition } from '@pie-qti/item-player';

const definition = createAssessmentItemDefinition({
  itemXml: qtiXml,
  role: 'candidate',
  security: {
    parsingLimits: { enabled: true, rejectDoctype: true },
    trustedTypesPolicyName: 'qti-content'
  },
  plugins
});

const session = definition.openSession({
  responses: { RESPONSE: 'A' }
});

const unsubscribe = session.subscribe(({ command, current }) => {
  console.log(command.action, current.revision, current.responses);
});

session.dispatch({
  action: 'setResponse',
  responseIdentifier: 'RESPONSE',
  value: 'B'
});

const presentation = session.present();
const result = session.dispatch({ action: 'scoreAttempt' }).result?.scoring;
const saved = session.serialize();

unsubscribe();
session.dispose();
```

`openSession()` accepts an optional serialized `restore` snapshot, response overrides, and
`activate: true` to resume a suspended handoff as an active session. Response identifiers are
validated against the compiled declarations.

The definition's role is fixed for every session it opens and is visible as `session.state().role`.
`present()` intentionally does not accept a role override.

## Session commands

`ItemSession.dispatch()` is the single mutation boundary:

- `setResponse` and `setResponses` update declared response variables.
- `updatePnp` applies a partial PNP update.
- `suspendAttempt` serializes a handoff state.
- `endAttempt` optionally validates responses and counts an attempt.
- `scoreAttempt` runs response processing without the adaptive submit guard.
- `submitAttempt` applies the adaptive attempt workflow.
- `newTemplate` reruns template processing for a new template instance.

Every successful dispatch increments `state().revision` and notifies subscribers with immutable
previous/current views. Response writes are rejected when the lifecycle is not writable. `dispose()`
is idempotent. The final `state()` view remains readable with `disposed: true`; later dispatch,
present, subscribe, and serialize calls are rejected.

## Presentation contract

`session.present()` returns an immutable `ItemPresentation` instead of a `Player` adapter:

```ts
const presentation = session.present({
  disabled: false,
  renderItemBodyRubrics: true
});

for (const node of presentation.flow) {
  if (node.kind === 'html') renderFinalHtml(node.html);
  else mountInteraction(node.mount);
}

renderRubrics(presentation.directRubrics);
```

The presentation contains role capabilities, disabled state, role-filtered correct responses,
policy-checked scoped CSS, ordered body flow, and direct `assessmentItem` rubric blocks. HTML values
use `HtmlContent` (`string | TrustedHTML` when available); `FinalItemBodyHtml` marks content that has
completed the body transform and delivery pipeline.

Section/test-part shared rubrics are not duplicated into item presentation. Assessment and section
hosts place those through section composition.

## Browser element

The all-in-one browser package registers `pie-qti-item-player`:

```ts
import '@pie-qti/player-elements/register';

const element = document.createElement('pie-qti-item-player');
element.itemXml = qtiXml;
element.role = 'candidate';
element.plugins = plugins;
element.addEventListener('response-change', (event) => {
  console.log(event.detail.responses);
});
document.body.append(element);
```

An orchestrator may inject its exact live session instead of asking the element to create one:

```ts
element.session = session;
```

`session`, `plugins`, security, PNP, PCI, i18n, processing-fragment resolvers, and response maps are
JavaScript properties rather than HTML attributes. See
[`@pie-qti/player-elements`](../player-elements/README.md) for the full element contract.

The older standalone registration entry remains available when a host intentionally composes the
interaction implementations itself:

```ts
import '@pie-qti/default-components/plugins';
import '@pie-qti/item-player/element';
```

## Definition plugins

`AssessmentItemDefinitionPlugin` is the primary synchronous extension contract:

```ts
import type { AssessmentItemDefinitionPlugin } from '@pie-qti/item-player';

export const plugin: AssessmentItemDefinitionPlugin = {
  kind: 'assessment-item-definition-plugin',
  name: '@vendor/interactions',
  version: '1.0.0',
  registerExtractors(registry) {
    registry.register(vendorExtractor);
  },
  registerComponents(registry) {
    registry.register('vendorInteraction', {
      name: 'vendor-interaction',
      tagName: 'vendor-qti-interaction'
    });
  }
};
```

Definition creation registers standard modules and plugins, then seals the registries before a
session opens. Plugin extractors declare renderer identity with `outputType` and declare all HTML and
resource URL fields with a `delivery` schema. See
[Custom extractors](./docs/custom-extractors.md).

## Security boundary

The player applies configured HTML sanitation, URL policy, parsing limits, and optional Trusted
Types finalization to declared delivery fields. Plugins are trusted executable application code and
are not sandboxed. Sanitized same-DOM content is still not equivalent to isolating untrusted
JavaScript; use a suitably sandboxed cross-origin iframe when content is not trusted to run in the
host origin.

Portable Custom Interaction execution is disabled unless the host supplies a trusted
`pci.moduleResolver`. Authored module paths are never imported directly by default.

`createAllowlistPciModuleResolver` builds a resolver that imports only from allow-listed origins
and/or absolute URL prefixes, refusing non-http(s) schemes outright. Passing it is still the host's
trust decision; it exists so the security-critical check does not have to be rewritten per host.

```ts
import { createAllowlistPciModuleResolver } from '@pie-qti/item-player';

const pci = {
  baseUrl: 'https://packages.example.com/items/item-1/',
  moduleResolver: createAllowlistPciModuleResolver({
    allowedOrigins: ['https://cdn.example.com'],
    allowedPathPrefixes: ['https://cdn.example.com/pci/'],
  }),
};
```

Prefixes are matched against the normalized URL, so `pci/../secrets/token.js` cannot escape its
prefix.

## Server scoring

`@pie-qti/item-player/server` exports a DOM-free definition/session interface with the same ownership
model. It omits presentation, PNP DOM, PCI, catalogs, and browser component types. See the
[server scoring guide](./docs/server-api.md).

## Public entries

- `@pie-qti/item-player`: definitions, sessions, presentation/extraction/plugin contracts, security
  types, PNP/catalog/PCI helpers.
- `@pie-qti/item-player/server`: DOM-free definitions, sessions, scoring commands, and persistence.
- `@pie-qti/item-player/web-components`: interaction element base contracts.
- `@pie-qti/item-player/element` and `/element-class`: standalone browser element compatibility.
- `@pie-qti/item-player/iframe`: optional iframe host/protocol helpers.
- `@pie-qti/item-player/security`: security utilities.

Additional detail: [QTI compliance](./docs/QTI-COMPLIANCE.md),
[server scoring](./docs/server-api.md), and [iframe mode](./docs/iframe-mode.md).
