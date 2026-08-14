# @acme/likert-scale-plugin

Example `AssessmentItemDefinitionPlugin` for vendor-specific `<likertChoice>` markup inside a QTI
`choiceInteraction`.

The package demonstrates high-priority extraction, validation, explicit renderer identity, and rich
field delivery policy. It does not ship a custom element: `outputType: 'choiceInteraction'` routes
the delivered data to the host's registered choice renderer.

This workspace package is private and serves as an integration example.

## Use with the primary item API

```ts
import { likertScalePlugin } from '@acme/likert-scale-plugin';
import { createAssessmentItemDefinition } from '@pie-qti/item-player';

const definition = createAssessmentItemDefinition({
  itemXml: qtiXml,
  role: 'candidate',
  plugins: [likertScalePlugin]
});

const session = definition.openSession();
try {
  const presentation = session.present();
  // Render presentation.flow with the host's item adapter.
} finally {
  session.dispose();
}
```

The browser element accepts the same plugin list as a JavaScript property:

```ts
import '@pie-qti/player-elements/register';

const element = document.createElement('pie-qti-item-player');
element.itemXml = qtiXml;
element.plugins = [likertScalePlugin];
document.body.append(element);
```

The assessment player also accepts `plugins` in `BackendAssessmentPlayerConfig` and applies them to
every item definition it compiles.

## Markup

```xml
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="likert-demo"
  title="Likert demo">
  <responseDeclaration
    identifier="RESPONSE"
    cardinality="single"
    baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>How confident are you with this topic?</prompt>
      <likertChoice identifier="not_confident">Not confident</likertChoice>
      <likertChoice identifier="somewhat">Somewhat confident</likertChoice>
      <likertChoice identifier="confident">Confident</likertChoice>
      <likertChoice identifier="very_confident">Very confident</likertChoice>
      <likertChoice identifier="expert">Expert</likertChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>
```

Empty labels receive defaults for 3-, 4-, 5-, or 7-point scales. Text patterns identify agreement,
frequency, satisfaction, quality, importance, and likelihood scales; otherwise the type is
`'unknown'`.

## Plugin contract

```ts
import type {
  AssessmentItemDefinitionPlugin,
  ExtractionRegistry
} from '@pie-qti/item-player';

export const likertScalePlugin: AssessmentItemDefinitionPlugin = {
  kind: 'assessment-item-definition-plugin',
  name: '@acme/likert-scale-plugin',
  version: '1.0.0',
  description: 'Likert scale choice interactions for QTI assessments',
  registerExtractors(registry: ExtractionRegistry) {
    registry.register(likertChoiceExtractor);
  }
};
```

Definition plugins are synchronous. Definition construction installs the plugin once, then seals
its registries before any live session opens. Complete asynchronous setup before constructing the
definition.

## Extractor contract

The extractor is declared as:

```ts
ElementExtractor<LikertInteractionDraftPayload, 'choiceInteraction'>
```

Its relevant descriptor fields are:

```ts
{
  id: 'acme:likert-choice',
  priority: 500,
  elementTypes: ['choiceInteraction'],
  outputType: 'choiceInteraction',
  delivery: {
    fields: [htmlField('prompt')]
  }
}
```

Priority `500` lets it win over the standard choice extractor only when `canHandle()` finds direct
`likertChoice` children. The framework attaches the authored `responseId` and the declared
`choiceInteraction` output type after extraction.

`prompt` is produced as an ingress-sanitized string, then the delivery pipeline finalizes it for the
HTML sink. With a Trusted Types policy, the delivered prompt may be `TrustedHTML`; the exported
`LikertInteractionData.prompt` therefore uses `HtmlContent | null`, not just `string | null`.

Choice labels are extracted with `getTextContent()` and are semantically plain text. Their exported
`text` field uses the common `HtmlContent`-compatible choice shape expected by the standard renderer.

## Delivered data

```ts
interface LikertInteractionData {
  readonly type: 'choiceInteraction';
  readonly responseId: string;
  readonly choices: LikertChoiceData[];
  readonly shuffle: boolean;
  readonly maxChoices: number;
  readonly prompt: HtmlContent | null;
  readonly metadata: {
    isLikert: true;
    scalePoints: number;
    scaleType:
      | 'agreement'
      | 'frequency'
      | 'satisfaction'
      | 'quality'
      | 'importance'
      | 'likelihood'
      | 'unknown';
  };
}

interface LikertChoiceData {
  identifier: string;
  text: HtmlContent;
  classes: string[];
  fixed: boolean;
  metadata: {
    likertIndex: number;
    scalePoints: number;
    scaleType: LikertScaleType;
  };
}
```

The finalized interaction graph is frozen and memoized for the session.

## Validation

The example extractor enforces:

- at least two and at most seven scale points;
- `shuffle: false`;
- `maxChoices: 1`;
- a non-empty identifier for every choice.

Validation failure becomes an `ExtractionError`; the standard extractor is not retried after a
matching vendor extractor fails validation.

See the item player's [custom extractor guide](../item-player/docs/custom-extractors.md) for
`outputType`, `htmlField()`, `urlField()`, delivery finalization, and plugin testing guidance.
