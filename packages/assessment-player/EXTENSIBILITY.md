# Assessment player extensibility

`@pie-qti/assessment-player` is extended through explicit backend, item-definition, security, and
section-host contracts. Its Svelte source components are not a published extension API; browser hosts
should embed `@pie-qti/player-elements` or build a renderer around the headless
`AssessmentPlayer`/`ItemSession` APIs.

## Backend adapter

The backend is the authority for session initialization, item submission, state persistence, and
assessment finalization:

```ts
import { AssessmentPlayer } from '@pie-qti/assessment-player';
import type { BackendAdapter } from '@pie-qti/assessment-player/integration';

declare const backend: BackendAdapter;

const player = await AssessmentPlayer.create({
  backend,
  initSession: {
    assessmentId: 'assessment-1',
    candidateId: 'candidate-1'
  }
});
```

See [BACKEND-INTEGRATION.md](./BACKEND-INTEGRATION.md) for the full boundary. LTI launch validation,
authorization, grade passback, and roster services belong to the host application behind this
adapter.

## Item-definition plugins

Use `AssessmentItemDefinitionPlugin` for synchronous extractor and renderer registration. The
assessment player passes the same immutable plugin list into every compiled item definition:

```ts
import type {
  AssessmentItemDefinitionPlugin,
  ElementExtractor
} from '@pie-qti/item-player';
import { htmlField } from '@pie-qti/item-player';

const ratingExtractor: ElementExtractor<
  { prompt: string | null; levels: string[] },
  'vendorRating'
> = {
  id: 'vendor:rating',
  name: 'Vendor rating interaction',
  priority: 500,
  elementTypes: ['customInteraction'],
  outputType: 'vendorRating',
  delivery: { fields: [htmlField('prompt')] },
  canHandle(element, { utils }) {
    return utils.getAttribute(element, 'class').split(/\s+/).includes('vendor-rating');
  },
  extract(element, { utils }) {
    return {
      prompt: utils.getPrompt(element),
      levels: utils
        .getChildrenByTag(element, 'vendorLevel')
        .map((level) => utils.getTextContent(level))
    };
  }
};

const ratingPlugin: AssessmentItemDefinitionPlugin = {
  kind: 'assessment-item-definition-plugin',
  name: '@vendor/rating',
  version: '1.0.0',
  registerExtractors(registry) {
    registry.register(ratingExtractor);
  },
  registerComponents(registry) {
    registry.register('vendorRating', {
      name: 'vendor-rating',
      tagName: 'vendor-rating-interaction'
    });
  }
};

const player = await AssessmentPlayer.create({
  backend,
  initSession,
  plugins: [ratingPlugin]
});
```

Definition construction validates plugin identity and dependency ordering, registers standard and
plugin extensions, then seals the registries. Changing the plugin set requires a new assessment
player/definition. There is no separate managed lifecycle or mutable host-registry interface.

Extractor fields that reach an HTML or resource URL sink must declare `delivery` rules. See the
[custom extractor guide](../item-player/docs/custom-extractors.md).

## Security, PCI, and content policy

Pass one `security` policy to apply consistent parsing, HTML, URL, and Trusted Types behavior to all
items. Pass `pci` only when the host owns an allow-listed module resolver for Portable Custom
Interactions:

```ts
const player = await AssessmentPlayer.create({
  backend,
  initSession,
  security: {
    trustedTypesPolicyName: 'assessment-content'
  },
  pci: {
    baseUrl: 'https://content.example/assessment/',
    moduleResolver(resolvedUrl, context) {
      return loadTrustedPciModule(resolvedUrl, context);
    }
  }
});
```

Sanitization is not a JavaScript sandbox. Deliver content that is not trusted to execute in the host
origin through a suitably isolated, cross-origin iframe.

## PNP and i18n

`pnp` is shared with every item session, including extended-time calculation and component-level
preferences. `i18nProvider` supplies translated player messages:

```ts
const player = await AssessmentPlayer.create({
  backend,
  initSession,
  pnp: candidatePnp,
  i18nProvider
});
```

The item role is fixed when its definition is compiled from `SecureItemRef.role`; a presentation
caller cannot override it later.

## Section host and tools

Delegated section rendering accepts host policy hooks and scoped tool descriptors:

```ts
const player = await AssessmentPlayer.create({
  backend,
  initSession,
  sectionHost: {
    sanitizeAssetUrl(href, context) {
      return allowAssessmentAsset(href, context) ? href : null;
    },
    onFrameworkError(error) {
      reportAssessmentError(error);
    }
  },
  sectionTools,
  passageTools,
  itemTools
});
```

The active section composition borrows the assessment player's exact live `ItemSession`; it does not
create a second mutable owner. Shared section/test-part rubrics are delivered through section
composition, while direct `assessmentItem` rubrics are exposed as
`ItemSession.present().directRubrics`.

## Browser properties

The public assessment web component exposes `config`, `security`, `pci`, `backend`, `initSession`,
`assessmentId`, `candidateId`, and explicit reference-mode XML properties. The item element exposes
`session` and `plugins` as JavaScript-only properties. Consult
[`@pie-qti/player-elements`](../player-elements/README.md) for the complete browser contract.
