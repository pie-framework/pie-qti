# Custom extractor and definition-plugin guide

Custom extractors recognize vendor-specific QTI markup and return a plain payload. The item delivery
pipeline then attaches framework-owned `type` and `responseId`, applies the extractor's HTML/URL
delivery schema, freezes the result, and memoizes it for the live session.

Package application extensions as `AssessmentItemDefinitionPlugin`. Plugins register synchronously
during definition construction; complete asynchronous setup before creating the definition.

## `ElementExtractor` contract

The public shape is:

```ts
interface ElementExtractor<
  TPayload extends object = Record<string, unknown>,
  TOutputType extends string = string,
  TContext extends ExtractionContext = ExtractionContext
> {
  id: string;
  name: string;
  priority: number;
  elementTypes: string[];
  description?: string;
  outputType?: TOutputType;
  delivery?: InteractionDeliverySchema;
  canHandle(element: QTIElement, context: TContext): boolean;
  extract(element: QTIElement, context: TContext): TPayload;
  validate?(data: TPayload): ValidationResult;
}
```

- `elementTypes` names the authored interaction kind. Use QTI 2.x camel-case names such as
  `choiceInteraction`; the registry maps QTI 3 kebab-case input to the same canonical key.
- Higher `priority` values are evaluated first for a given authored type.
- `outputType` selects the renderer-facing interaction type. If omitted, the normalized authored
  type is used.
- `extract()` returns only vendor payload. Any payload `type` or `responseId` is overwritten by the
  framework after extraction.
- `delivery` is required for every payload field that can reach an HTML or resource URL sink.

`canHandle()` should be cheap because it runs during dispatch. Use context utilities rather than
depending on parser-specific node APIs.

## Complete extractor

This example recognizes vendor rating markup embedded in a QTI `customInteraction`:

```ts
import type {
  DeliveredInteraction,
  ElementExtractor,
  HtmlContent
} from '@pie-qti/item-player';
import { htmlField, urlField } from '@pie-qti/item-player';

interface VendorRatingDraft {
  prompt: string | null;
  image: { src: string; alt: string };
  options: Array<{ identifier: string; label: string }>;
}

interface VendorRatingDeliveredPayload {
  prompt: HtmlContent | null;
  image: { src: string; alt: string };
  options: Array<{ identifier: string; label: HtmlContent }>;
}

export type VendorRatingData = DeliveredInteraction<
  'vendorRating',
  VendorRatingDeliveredPayload
>;

export const vendorRatingExtractor: ElementExtractor<
  VendorRatingDraft,
  'vendorRating'
> = {
  id: 'vendor:rating',
  name: 'Vendor rating interaction',
  priority: 500,
  elementTypes: ['customInteraction'],
  outputType: 'vendorRating',

  delivery: {
    fields: [
      htmlField('prompt'),
      htmlField('options', '*', 'label'),
      urlField('img', 'image', 'src')
    ]
  },

  canHandle(element, { utils }) {
    return utils
      .getAttribute(element, 'class')
      .split(/\s+/)
      .includes('vendor-rating');
  },

  extract(element, { utils }) {
    const image = utils.querySelector(element, 'img');
    return {
      prompt: utils.getPrompt(element),
      image: {
        src: image ? utils.getAttribute(image, 'src') : '',
        alt: image ? utils.getAttribute(image, 'alt') : ''
      },
      options: utils.getChildrenByTag(element, 'vendorOption').map((option) => ({
        identifier: utils.getAttribute(option, 'identifier'),
        label: utils.getHtmlContent(option)
      }))
    };
  },

  validate(data) {
    const errors = data.options.length >= 2
      ? []
      : ['Vendor rating requires at least two options'];
    return { valid: errors.length === 0, errors };
  }
};
```

The extractor's draft uses `string` for rich fields because `getHtmlContent()` and `getPrompt()`
return ingress-sanitized strings. Final delivery may replace declared HTML fields with
`TrustedHTML`, so renderer-facing types use `HtmlContent`. Do not type final rich fields as only
`string` or call string-only methods on them.

`urlField()` takes the URL use first (`'img'`, `'media'`, `'object'`, `'link'`, `'any'`, or
`'media-or-object'`) followed by path segments. A `'*'` segment visits every array entry or record
value. Blocked or invalid resource URLs fail closed to an empty string.

## Package as a definition plugin

```ts
import type { AssessmentItemDefinitionPlugin } from '@pie-qti/item-player';

export const vendorRatingPlugin: AssessmentItemDefinitionPlugin = {
  kind: 'assessment-item-definition-plugin',
  name: '@vendor/qti-rating',
  version: '1.0.0',

  registerExtractors(registry) {
    registry.register(vendorRatingExtractor);
  },

  registerComponents(registry) {
    registry.register('vendorRating', {
      name: 'vendor-rating',
      priority: 100,
      tagName: 'vendor-rating-interaction'
    });
  }
};
```

The tag must contain a hyphen. If the plugin includes `componentClass`, the registry can define it in
a browser; server-oriented plugins normally provide only extraction or a tag mapping.

Plugins may declare dependency names. Dependencies must appear earlier in the immutable plugin list:

```ts
const definition = createAssessmentItemDefinition({
  itemXml,
  role: 'candidate',
  plugins: [vendorBasePlugin, vendorRatingPlugin]
});
```

Definition construction validates duplicate names, semantic versions, dependencies, and plugin
branding. It registers standard interaction modules and plugins, then seals both registries before
`openSession()` succeeds. To change an extractor or renderer set, create a new definition.

## Use from item and assessment players

```ts
import { createAssessmentItemDefinition } from '@pie-qti/item-player';

const definition = createAssessmentItemDefinition({
  itemXml,
  role: 'candidate',
  security,
  plugins: [vendorRatingPlugin]
});

const session = definition.openSession();
const presentation = session.present();
```

The item web component exposes a JavaScript-only `plugins` property. The assessment player's
`BackendAssessmentPlayerConfig.plugins` list is propagated into every definition it compiles:

```ts
import { AssessmentPlayer } from '@pie-qti/assessment-player';

const assessment = await AssessmentPlayer.create({
  backend,
  initSession,
  plugins: [vendorRatingPlugin]
});
```

## Security model

There are two enforcement stages:

1. `ExtractionUtils.getHtmlContent()` and `getPrompt()` apply the active sanitizer at extraction
   ingress and return strings.
2. The final delivery pipeline applies the merged standard and extractor delivery schemas, enforces
   resource URL policy, optionally creates `TrustedHTML`, and freezes the delivered graph.

Plugin code itself is trusted executable host code and is not sandboxed. A plugin can bypass its own
contract in arbitrary JavaScript, so only install plugins you trust. The delivery schema protects
QTI-derived data crossing known renderer sinks; it is not a plugin sandbox.

If an extractor replaces a standard authored interaction, the standard interaction's delivery fields
remain in force even when `outputType` chooses a vendor renderer. This prevents a renderer rename from
discarding standard prompt, choice HTML, or resource URL policy.

## Testing

Test recognition, validation, delivery, identity, and definition sealing through the real session
pipeline:

```ts
const definition = createAssessmentItemDefinition({
  itemXml: maliciousFixtureXml,
  role: 'candidate',
  plugins: [vendorRatingPlugin],
  security: {
    trustedTypesPolicyName: 'qti-test',
    urlPolicy: { allowHttp: false }
  }
});

const session = definition.openSession();
try {
  const interaction = session
    .present()
    .flow
    .find((node) => node.kind === 'interaction')?.mount.interaction;

  expect(interaction?.type).toBe('vendorRating');
  expect(interaction?.responseId).toBe('RESPONSE');
  expect(Object.isFrozen(interaction)).toBe(true);
} finally {
  session.dispose();
}
```

Direct `ExtractionRegistry.extract()` is useful for extractor unit tests, but it returns the raw
payload. It does not attach framework identity or run the final delivery pipeline, so it cannot by
itself prove renderer safety.
