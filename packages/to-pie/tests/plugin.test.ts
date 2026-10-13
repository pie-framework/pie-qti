/**
 * QTI 2.2 to PIE Plugin Tests
 */

import { describe, expect, test } from 'bun:test';
import { TransformEngine } from '@pie-qti/transform-core';
import {
	createQtiWrapper,
	createResponseDeclaration,
	createChoiceInteraction,
	SilentLogger,
	createTestEngine,
	expectSuccessfulTransform,
	expectValidPieModel,
} from '@pie-qti/test-utils';
import { QtiToPiePlugin } from '../src/plugin';
import type { CssClassExtractor, VendorDetector } from '../src/types/vendor-extensions';
import { type QtiSourceProfile, sourceDigest } from '@pie-qti/transform-types';

// Create sample QTI using test utilities
const sampleQtiXml = createQtiWrapper(
	`
  ${createResponseDeclaration('RESPONSE', 'single', ['choiceA'])}
  <itemBody>
    <p>What is 2 + 2?</p>
    ${createChoiceInteraction('RESPONSE', [
			{ id: 'choiceA', text: '4' },
			{ id: 'choiceB', text: '3' },
			{ id: 'choiceC', text: '5' },
			{ id: 'choiceD', text: '22' },
		])}
  </itemBody>
`,
	'choice-001',
	'Sample Multiple Choice',
);

describe('QtiToPiePlugin', () => {
  test('should report a personal needs profile in an assessmentTest', async () => {
    const plugin = new QtiToPiePlugin();
    const output = await plugin.transform(
      {
        content: `<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="t1" title="T1">
          <personalNeedsProfile><support>textToSpeech</support></personalNeedsProfile>
          <testPart identifier="p1" navigationMode="linear" submissionMode="individual">
            <assessmentSection identifier="s1" title="S1" visible="true">
              <assessmentItemRef identifier="i1" href="i1.xml"/>
            </assessmentSection>
          </testPart>
        </assessmentTest>`,
      },
      { logger: new SilentLogger() }
    );

    expect(output.items[0].content).not.toHaveProperty('personalNeedsProfile');
    expect(output.warnings?.map((warning) => warning.code)).toContain('QTI_PNP_IN_CONTENT');
  });

  test('should identify as correct plugin', () => {
    const plugin = new QtiToPiePlugin();

    expect(plugin.id).toBe('qti22-to-pie');
    expect(plugin.sourceFormat).toBe('qti22');
    expect(plugin.targetFormat).toBe('pie');
  });

  test('should detect QTI 2.2 content', async () => {
    const plugin = new QtiToPiePlugin();

    const canHandle = await plugin.canHandle({
      content: sampleQtiXml,
    });

    expect(canHandle).toBe(true);
  });

  test('should reject non-QTI content', async () => {
    const plugin = new QtiToPiePlugin();

    const canHandle = await plugin.canHandle({
      content: '{ "id": "test", "type": "pie" }',
    });

    expect(canHandle).toBe(false);
  });

  test('should transform QTI to PIE', async () => {
    const plugin = new QtiToPiePlugin();

    const output = await plugin.transform(
      { content: sampleQtiXml },
      { logger: new SilentLogger() }
    );

    expectSuccessfulTransform(output, 1);
    expect(output.items[0].content.id).toBe('choice-001');
    expect(output.items[0].content.metadata?.searchMetaData.title).toBe('Sample Multiple Choice');
    expect(output.items[0].content.config.markup).toContain('<multiple-choice ');
    expect(output.items[0].content.config.models[0]?.element).toBe('multiple-choice');
    expect(output.items[0].content.config.markup).toContain(
      `id="${output.items[0].content.config.models[0]?.id}"`
    );
    expect(
      output.metadata.conversionTrace?.events.some(
        (event) => event.kind === 'handler-selected' && event.handlerId === 'builtin.choice'
      )
    ).toBe(true);
  });

  test('should include source profile matches and conversion trace in metadata', async () => {
    const sourceProfile: QtiSourceProfile = {
      id: 'test-profile',
      detectItem(context) {
        return {
          profileId: 'test-profile',
          scope: 'item',
          confidence: 0.9,
          capabilities: ['metadata'],
          evidence: [
            {
              type: 'item-id',
              scope: 'item',
              itemId: context.itemId,
              message: 'Matched test item identifier.',
            },
          ],
        };
      },
      extractItem() {
        return {
          standardCandidates: [
            {
              id: 'standard:test',
              rawValue: 'TEST.1',
              namespace: 'test',
              profileId: 'test-profile',
            },
          ],
        };
      },
      decorators: [
        {
          id: 'test-profile.annotate-item',
          phase: 'beforeFinalize',
          apply(_context, item) {
            const pieItem = item as { metadata?: Record<string, unknown> };
            pieItem.metadata = {
              ...(pieItem.metadata ?? {}),
              sourceProfileDecorated: true,
            };
          },
        },
      ],
    };
    const plugin = new QtiToPiePlugin({ sourceProfiles: [sourceProfile] });

    const output = await plugin.transform(
      { content: sampleQtiXml },
      { logger: new SilentLogger() }
    );

    expect(output.metadata.sourceProfiles?.[0].profileId).toBe('test-profile');
    expect((output.metadata as any).standardCandidates?.[0].rawValue).toBe('TEST.1');
    expect(output.items[0].content.metadata.sourceProfileDecorated).toBe(true);
    expect(output.metadata.conversionTrace?.profiles?.[0].profileId).toBe('test-profile');
    expect(output.metadata.conversionTrace?.events.some((event) => event.kind === 'profile-detected')).toBe(true);
    expect(output.metadata.conversionTrace?.events.some((event) => event.kind === 'finalizer-applied')).toBe(true);
  });

  test('should let a source profile item handler delegate to the generic transform', async () => {
    const sourceProfile: QtiSourceProfile = {
      id: 'delegating-profile',
      detectItem() {
        return {
          profileId: 'delegating-profile',
          scope: 'item',
          confidence: 0.9,
          capabilities: ['interactions'],
          evidence: [{ type: 'test', scope: 'item', message: 'Test delegation profile.' }],
        };
      },
      itemHandlers: [
        {
          id: 'delegating-profile.choice',
          canHandle(context) {
            return context.interactionTypes?.includes('choiceInteraction') ?? false;
          },
          async transform(_context, delegate) {
            const output = await delegate.continue();
            output.metadata = {
              ...output.metadata,
              delegatedByProfile: true,
            };
            return output;
          },
        },
      ],
    };
    const plugin = new QtiToPiePlugin({ sourceProfiles: [sourceProfile] });

    const output = await plugin.transform(
      { content: sampleQtiXml },
      { logger: new SilentLogger() }
    );

    expect(output.items[0].content.id).toBe('choice-001');
    expect((output.metadata as any).delegatedByProfile).toBe(true);
    expect(
      output.metadata.conversionTrace?.events.some(
        (event) => event.kind === 'handler-selected' && event.handlerId === 'delegating-profile.choice'
      )
    ).toBe(true);
    expect(
      output.metadata.conversionTrace?.events.some(
        (event) => event.kind === 'handler-delegated' && event.handlerId === 'delegating-profile.choice'
      )
    ).toBe(true);
    expect(
      output.metadata.conversionTrace?.events.some(
        (event) => event.kind === 'handler-selected' && event.handlerId === 'builtin.choice'
      )
    ).toBe(true);
  });

  test('should let a source profile item handler transform proprietary content before generic rejection', async () => {
    const customQti = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="custom-profiled" title="Custom" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier"/>
  <itemBody>
    <customInteraction responseIdentifier="RESPONSE" class="tei-texthighlighter"/>
  </itemBody>
</assessmentItem>`;
    const sourceProfile: QtiSourceProfile = {
      id: 'custom-profile',
      detectItem(context) {
        return context.xml?.includes('tei-texthighlighter')
          ? {
              profileId: 'custom-profile',
              scope: 'item',
              confidence: 1,
              capabilities: ['interactions'],
              evidence: [{ type: 'class', scope: 'item', value: 'tei-texthighlighter', message: 'Matched highlighter custom interaction.' }],
            }
          : null;
      },
      itemHandlers: [
        {
          id: 'custom-profile.highlighter',
          canHandle(context) {
            return context.xml?.includes('tei-texthighlighter') ?? false;
          },
          async transform(context) {
            return {
              items: [
                {
                  content: {
                    id: context.itemId,
                    element: 'tei-texthighlighter-placeholder',
                    metadata: {
                      sourceProfile: 'custom-profile',
                    },
                  },
                  format: 'pie',
                },
              ],
              format: 'pie',
              metadata: {
                sourceFormat: 'qti22',
                targetFormat: 'pie',
                pluginId: 'custom-profile.highlighter',
                timestamp: new Date(),
                itemCount: 1,
              },
            };
          },
        },
      ],
    };
    const plugin = new QtiToPiePlugin({ sourceProfiles: [sourceProfile] });

    const output = await plugin.transform(
      { content: customQti },
      { logger: new SilentLogger() }
    );

    expect(output.items[0].content.id).toBe('custom-profiled');
    expect(output.items[0].content.metadata.sourceProfile).toBe('custom-profile');
    expect(
      output.metadata.conversionTrace?.events.some(
        (event) => event.kind === 'handler-selected' && event.handlerId === 'custom-profile.highlighter'
      )
    ).toBe(true);
    expect(
      output.metadata.conversionTrace?.events.some(
        (event) => event.kind === 'handler-selected' && event.handlerId === 'builtin.choice'
      )
    ).toBe(false);
  });

  test('should emit source diagnostics when a matched handler falls back to generic transform', async () => {
    const sourceProfile: QtiSourceProfile = {
      id: 'fallback-profile',
      fallbackPolicy: 'allow-generic',
      detectItem() {
        return {
          profileId: 'fallback-profile',
          scope: 'item',
          confidence: 0.9,
          capabilities: ['interactions'],
          evidence: [{ type: 'test', scope: 'item', message: 'Test fallback profile.' }],
        };
      },
      itemHandlers: [
        {
          id: 'fallback-profile.choice',
          canHandle(context) {
            return context.interactionTypes?.includes('choiceInteraction') ?? false;
          },
          async transform() {
            return null;
          },
        },
      ],
    };
    const plugin = new QtiToPiePlugin({ sourceProfiles: [sourceProfile] });

    const output = await plugin.transform(
      { content: sampleQtiXml },
      { logger: new SilentLogger() }
    );

    expect(output.items[0].content.id).toBe('choice-001');
    expect(output.metadata.sourceDiagnostics?.[0].code).toBe('QTI_PROFILE_HANDLER_NO_OUTPUT');
    expect(output.warnings?.some((warning) => warning.code === 'QTI_PROFILE_HANDLER_NO_OUTPUT')).toBe(true);
    expect(output.metadata.conversionTrace?.diagnostics?.[0].code).toBe('QTI_PROFILE_HANDLER_NO_OUTPUT');
    expect(
      output.metadata.conversionTrace?.events.some(
        (event) => event.kind === 'fallback' && event.handlerId === 'fallback-profile.choice'
      )
    ).toBe(true);
    expect(
      output.metadata.conversionTrace?.events.some(
        (event) => event.kind === 'handler-selected' && event.handlerId === 'builtin.choice'
      )
    ).toBe(true);
  });

  test('should preserve fallback warnings when a later source-profile handler returns output', async () => {
    const sourceProfile: QtiSourceProfile = {
      id: 'multi-handler-profile',
      detectItem() {
        return {
          profileId: 'multi-handler-profile',
          scope: 'item',
          confidence: 0.9,
          capabilities: ['interactions'],
          evidence: [{ type: 'test', scope: 'item', message: 'Test multi-handler profile.' }],
        };
      },
      itemHandlers: [
        {
          id: 'multi-handler-profile.no-output',
          priority: 10,
          canHandle() {
            return true;
          },
          async transform() {
            return null;
          },
        },
        {
          id: 'multi-handler-profile.output',
          priority: 1,
          canHandle() {
            return true;
          },
          async transform(context) {
            return {
              items: [
                {
                  content: {
                    id: context.itemId,
                    element: 'profile-owned-output',
                  },
                  format: 'pie',
                },
              ],
              format: 'pie',
              metadata: {
                sourceFormat: 'qti22',
                targetFormat: 'pie',
                pluginId: 'multi-handler-profile.output',
                timestamp: new Date(),
                itemCount: 1,
              },
            };
          },
        },
      ],
    };
    const plugin = new QtiToPiePlugin({ sourceProfiles: [sourceProfile] });

    const output = await plugin.transform(
      { content: sampleQtiXml },
      { logger: new SilentLogger() }
    );

    expect(output.items[0].content.element).toBe('profile-owned-output');
    expect(output.metadata.sourceDiagnostics?.[0].code).toBe('QTI_PROFILE_HANDLER_NO_OUTPUT');
    expect(output.warnings?.some((warning) => warning.code === 'QTI_PROFILE_HANDLER_NO_OUTPUT')).toBe(true);
  });

  test('should block generic fallback when a matched source profile requires explicit handling', async () => {
    const customQti = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="blocked-custom" title="Blocked Custom" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier"/>
  <itemBody>
    <customInteraction responseIdentifier="RESPONSE" class="tei-texthighlighter"/>
  </itemBody>
</assessmentItem>`;
    const sourceProfile: QtiSourceProfile = {
      id: 'blocking-profile',
      fallbackPolicy: 'block-generic',
      detectItem(context) {
        return context.xml?.includes('tei-texthighlighter')
          ? {
              profileId: 'blocking-profile',
              scope: 'item',
              confidence: 1,
              capabilities: ['interactions'],
              evidence: [
                {
                  type: 'class',
                  scope: 'item',
                  value: 'tei-texthighlighter',
                  message: 'Matched highlighter custom interaction.',
                },
              ],
            }
          : null;
      },
    };
    const plugin = new QtiToPiePlugin({ sourceProfiles: [sourceProfile] });

    await expect(
      plugin.transform(
        { content: customQti },
        { logger: new SilentLogger() }
      )
    ).rejects.toThrow(/generic fallback is disabled/i);
  });

  test('should preserve QTI 2.1 source version in metadata and embedded source', async () => {
    const plugin = new QtiToPiePlugin();
    const qti21Xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="choice-21" title="QTI 2.1 Choice" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

    const output = await plugin.transform(
      { content: qti21Xml },
      { logger: new SilentLogger() }
    );

    expect(output.metadata.sourceFormat).toBe('qti21');
    expect(output.metadata.qtiVersion).toBe('2.1');
    expect(output.items[0].content.metadata.qtiSource.metadata.qtiVersion).toBe('2.1');
  });

  test('should transform the QTI body when the QTI embeds a PIE source model without a digest', async () => {
    const plugin = new QtiToPiePlugin();
    const qtiWithBrokenExtension = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:pie="https://github.com/pie-framework/pie-elements" identifier="broken-ext" title="Broken Extension" adaptive="false" timeDependent="false">
  ${createResponseDeclaration('RESPONSE', 'single', ['choiceA'])}
  <itemBody>
    <p>What is 2 + 2?</p>
    ${createChoiceInteraction('RESPONSE', [
      { id: 'choiceA', text: '4' },
      { id: 'choiceB', text: '3' },
    ])}
  </itemBody>
  <pie:sourceModel><![CDATA[{"id": "truncated]]></pie:sourceModel>
</assessmentItem>`;

    const output = await plugin.transform(
      { content: qtiWithBrokenExtension },
      { logger: new SilentLogger() }
    );

    expect(output.items[0].content.config.models[0].element).toBe('multiple-choice');
    expect(output.items[0].content.config.models[0].prompt).toContain('What is 2 + 2?');
    expect(output.warnings?.some((w) => w.code === 'PIE_SOURCE_STALE')).toBe(true);
    expect(output.metadata.conversionTrace?.events.some((e) => e.kind === 'fallback')).toBe(true);
  });

  test('should reconstruct the PIE item from its source sidecar', async () => {
    const plugin = new QtiToPiePlugin();
    const sourceModel = {
      id: 'sidecar-item',
      config: { models: [{ id: '1', element: 'pie-mc', prompt: 'From the sidecar' }], elements: { 'pie-mc': '@pie-element/multiple-choice@11.0.0' } },
      searchMetaData: { subject: 'Math' },
    };

    const output = await plugin.transform(
      {
        content: sampleQtiXml,
        sidecar: JSON.stringify({
          format: 'pie-qti/pie-source',
          version: 1,
          qtiDigest: await sourceDigest(sampleQtiXml.replaceAll('\n', '\r\n')),
          sourceModel,
        }),
      },
      { logger: new SilentLogger() }
    );

    expect(output.items[0].content.id).toBe('sidecar-item');
    expect(output.items[0].content.config.models[0].prompt).toBe('From the sidecar');
    expect(output.items[0].content.searchMetaData).toEqual({ subject: 'Math' });
    expect(output.warnings?.some((w) => w.code === 'PIE_EXTENSION_UNREADABLE')).toBeFalsy();
  });

  test('should transform the QTI body when the item changed after its sidecar was written', async () => {
    const plugin = new QtiToPiePlugin();
    const sourceModel = { id: 'sidecar-item', config: { models: [{ id: '1', element: 'pie-mc' }] } };
    const sidecar = JSON.stringify({
      format: 'pie-qti/pie-source',
      version: 1,
      qtiDigest: await sourceDigest(sampleQtiXml),
      sourceModel,
    });

    for (const content of [sampleQtiXml.replace('</itemBody>', '<p>Edited.</p></itemBody>'), undefined]) {
      const output = await plugin.transform(
        {
          content: content ?? sampleQtiXml,
          sidecar: content ? sidecar : JSON.stringify({ format: 'pie-qti/pie-source', version: 1, sourceModel }),
        },
        { logger: new SilentLogger() }
      );

      expect(output.items[0].content.id).not.toBe('sidecar-item');
      expect(output.items[0].content.config.models[0].element).toBe('multiple-choice');
      expect(output.warnings?.some((w) => w.code === 'PIE_SOURCE_STALE')).toBe(true);
      expect(output.metadata.conversionTrace?.events.some((e) => e.kind === 'fallback')).toBe(true);
    }
  });

  test('should record the digest of the final PIE config beside the embedded QTI', async () => {
    const plugin = new QtiToPiePlugin();

    const output = await plugin.transform({ content: sampleQtiXml }, { logger: new SilentLogger() });
    const item = output.items[0].content;

    expect(item.metadata.qtiSource.metadata.configDigest).toBe(await sourceDigest(item.config));
  });

  test('should transform the QTI body when the PIE source sidecar is unreadable', async () => {
    const plugin = new QtiToPiePlugin();

    const output = await plugin.transform(
      { content: sampleQtiXml, sidecar: '{"format": "pie-qti/pie-source"' },
      { logger: new SilentLogger() }
    );

    expect(output.items[0].content.config.models[0].element).toBe('multiple-choice');
    expect(output.warnings?.some((w) => w.code === 'PIE_EXTENSION_UNREADABLE')).toBe(true);
    expect(output.metadata.conversionTrace?.events.some((e) => e.kind === 'fallback')).toBe(true);
  });

  test('should remove unmapped feedback from transformed content and report it', async () => {
    const plugin = new QtiToPiePlugin();
    const qtiWithFeedback = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="feedback-item" title="Feedback" adaptive="false" timeDependent="false">
  ${createResponseDeclaration('RESPONSE', 'single', ['choiceA'])}
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p>What is 2 + 2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="choiceA">4<feedbackInline outcomeIdentifier="FEEDBACK" identifier="choiceA" showHide="show"> Correct, four.</feedbackInline></simpleChoice>
      <simpleChoice identifier="choiceB">3</simpleChoice>
    </choiceInteraction>
    <feedbackBlock outcomeIdentifier="FEEDBACK" identifier="choiceB" showHide="show"><p>Count again.</p></feedbackBlock>
  </itemBody>
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="choiceA" showHide="show">Well done.</modalFeedback>
</assessmentItem>`;

    const output = await plugin.transform({ content: qtiWithFeedback }, { logger: new SilentLogger() });
    const item = output.items[0].content;
    const model = item.config.models[0];

    expect(model.choices[0].label).toBe('4');
    expect(model.prompt).toBe('What is 2 + 2?');
    expect(item.config.markup).not.toContain('Count again');
    const warning = output.warnings?.find((w) => w.code === 'QTI_FEEDBACK_DROPPED');
    expect(warning?.message).toContain('1 modalFeedback, 1 feedbackBlock, 1 feedbackInline');
    expect(item.metadata.qtiSource.xml).toContain('Correct, four.');
  });

  test('should keep feedback a built-in maps without reporting it', async () => {
    const plugin = new QtiToPiePlugin();
    const ebsrWithChoiceFeedback = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="ebsr-feedback" title="EBSR Feedback" adaptive="false" timeDependent="false">
  ${createResponseDeclaration('RESPONSE_A', 'single', ['A'])}
  ${createResponseDeclaration('RESPONSE_B', 'single', ['X'])}
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE_A" maxChoices="1">
      <prompt>Part A</prompt>
      <simpleChoice identifier="A">Choice A<feedbackInline outcomeIdentifier="FEEDBACK" identifier="A" showHide="show">Yes.</feedbackInline></simpleChoice>
      <simpleChoice identifier="B">Choice B</simpleChoice>
    </choiceInteraction>
    <choiceInteraction responseIdentifier="RESPONSE_B" maxChoices="1">
      <prompt>Part B</prompt>
      <simpleChoice identifier="X">Evidence X</simpleChoice>
      <simpleChoice identifier="Y">Evidence Y</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

    const output = await plugin.transform({ content: ebsrWithChoiceFeedback }, { logger: new SilentLogger() });
    const choice = output.items[0].content.config.models[0].partA.choices[0];

    expect(choice.label).toBe('Choice A');
    expect(choice.feedback).toBe('Yes.');
    expect(output.warnings?.some((w) => w.code === 'QTI_FEEDBACK_DROPPED') ?? false).toBe(false);
  });

  test('should preserve response processing XML and warn on inline rule trees', async () => {
    const plugin = new QtiToPiePlugin();
    const qtiWithInlineResponseProcessing = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="inline-rp" title="Inline RP" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

    const output = await plugin.transform(
      { content: qtiWithInlineResponseProcessing },
      { logger: new SilentLogger() }
    );
    const metadata = output.items[0].content.metadata;

    expect(output.warnings?.some(w => w.code === 'QTI_RESPONSE_PROCESSING_PRESERVED')).toBe(true);
    expect(metadata.qtiProcessing.responseDeclarationsXml).toHaveLength(1);
    expect(metadata.qtiProcessing.outcomeDeclarationsXml).toHaveLength(1);
    expect(metadata.qtiProcessing.responseProcessingXml).toContain('<responseProcessing>');
  });

  test('should reject a standard composite item outside the scoped set instead of silently reducing to first interaction', async () => {
    const plugin = new QtiToPiePlugin();
    const compositeQti = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-upload-composite" title="Composite" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <uploadInteraction responseIdentifier="UPLOAD"/>
  </itemBody>
</assessmentItem>`;

    await expect(plugin.transform(
      { content: compositeQti },
      { logger: new SilentLogger() }
    )).rejects.toThrow(/Unsupported composite QTI item/);
  });

  test('should compose a scoped composite (choice + text entry) into one PIE item', async () => {
    const plugin = new QtiToPiePlugin();
    const composite = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-text-composite" title="Composite" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="BLANK" cardinality="single" baseType="string">
    <correctResponse><value>answer</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>Pick one:</p>
    <choiceInteraction responseIdentifier="CHOICE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <p>Now fill in: <textEntryInteraction responseIdentifier="BLANK" expectedLength="10"/>.</p>
  </itemBody>
</assessmentItem>`;

    const output = await plugin.transform(
      { content: composite },
      { logger: new SilentLogger() }
    );

    expect(output.items).toHaveLength(1);
    const item = output.items[0]?.content as any;
    expect(item.config.models).toHaveLength(2);
    expect(Object.keys(item.config.elements)).toContain('multiple-choice');
    expect(Object.keys(item.config.elements)).toContain('explicit-constructed-response');
    expect(item.config.markup).toContain('Pick one:');
    expect(item.config.markup).toContain('Now fill in:');
    expect(item.config.markup).not.toContain('<choiceInteraction');
    expect(item.config.markup).not.toContain('<textEntryInteraction');
    expect(output.warnings?.some(w => w.code === 'QTI_COMPOSITE_ITEM_COMPOSED')).toBe(true);
  });

  test('should compose a scoped composite (choice + hotspot) into one PIE item', async () => {
    // hotspotInteraction has its own scoped adapter (transformHotspotInteraction), bound to its
    // own node plus a boundary-limited prompt, so it composes with a sibling choiceInteraction
    // the same way choiceInteraction/orderInteraction/sliderInteraction/textEntryInteraction/
    // inlineChoiceInteraction already do.
    const plugin = new QtiToPiePlugin();
    const hotspotComposite = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-hotspot-composite" title="Composite" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="HOTSPOT" cardinality="single" baseType="identifier">
    <correctResponse><value>H1</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <hotspotInteraction responseIdentifier="HOTSPOT" maxChoices="1">
      <object data="image.png" type="image/png" width="100" height="100"/>
      <hotspotChoice identifier="H1" shape="rect" coords="0,0,10,10"/>
    </hotspotInteraction>
  </itemBody>
</assessmentItem>`;

    const output = await plugin.transform(
      { content: hotspotComposite },
      { logger: new SilentLogger() }
    );

    expect(output.items).toHaveLength(1);
    const item = output.items[0]?.content as any;
    expect(item.config.models).toHaveLength(2);
    expect(Object.keys(item.config.elements)).toContain('multiple-choice');
    expect(Object.keys(item.config.elements)).toContain('hotspot');
  });

  test('should reject a portableCustomInteraction composite', async () => {
    const plugin = new QtiToPiePlugin();
    const pciComposite = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-pci-composite" title="Composite" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="PCI" cardinality="single" baseType="string"/>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <portableCustomInteraction responseIdentifier="PCI" custom-interaction-type-identifier="vendor.graph"/>
  </itemBody>
</assessmentItem>`;

    await expect(plugin.transform(
      { content: pciComposite },
      { logger: new SilentLogger() }
    )).rejects.toThrow(/Unsupported customInteraction/);
  });

  test('should warn rather than fail when endAttemptInteraction accompanies a single interaction', async () => {
    const plugin = new QtiToPiePlugin();
    const withEndAttempt = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-with-hint" title="Hint" adaptive="true" timeDependent="false">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="HINT" cardinality="single" baseType="boolean"/>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <endAttemptInteraction responseIdentifier="HINT" title="Hint"/>
  </itemBody>
</assessmentItem>`;

    const output = await plugin.transform(
      { content: withEndAttempt },
      { logger: new SilentLogger() }
    );

    expect(output.items).toHaveLength(1);
    expect(output.warnings?.some(w => w.code === 'QTI_INTERACTION_DROPPED')).toBe(true);
  });

  test('should name an unsupported single interaction instead of reporting it as unknown', async () => {
    const plugin = new QtiToPiePlugin();
    const uploadOnly = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="upload-only" title="Upload" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="UPLOAD" cardinality="single" baseType="file"/>
  <itemBody>
    <uploadInteraction responseIdentifier="UPLOAD"/>
  </itemBody>
</assessmentItem>`;

    await expect(plugin.transform(
      { content: uploadOnly },
      { logger: new SilentLogger() }
    )).rejects.toThrow(/Unsupported interaction type: uploadInteraction/);
  });

  test('should convert a QTI 3.0 composite item', async () => {
    const plugin = new QtiToPiePlugin();
    const qti3Composite = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="q3-composite" title="Composite" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="CHOICE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="SLIDER" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="CHOICE" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
    <qti-slider-interaction response-identifier="SLIDER" lower-bound="0" upper-bound="10"/>
  </qti-item-body>
</qti-assessment-item>`;

    const output = await plugin.transform(
      { content: qti3Composite },
      { logger: new SilentLogger() }
    );

    const item = output.items[0].content as any;
    expect(item.id).toBe('q3-composite');
    expect(item.config.models.map((model: any) => model.element)).toEqual([
      'multiple-choice',
      'number-line',
    ]);
    expect(output.metadata?.sourceFormat).toBe('qti30');
  });

  test('should let a vendor transformer claim QTI 3.0 content as authored', async () => {
    const plugin = new QtiToPiePlugin();
    const qti3Item = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="q3-vendor" title="Vendor">
  <qti-item-body>
    <qti-choice-interaction response-identifier="CHOICE" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

    let authored = '';
    plugin.registerVendorDetector({
      name: 'acme-qti3',
      detect: () => ({ vendor: 'acme', confidence: 1 }),
    });
    plugin.registerVendorTransformer({
      vendor: 'acme',
      canHandle: () => true,
      transform: async (xml: string) => {
        authored = xml;
        return {
          success: true,
          format: 'pie',
          items: [{ id: 'q3-vendor', content: { element: 'acme-element' } }],
          warnings: [],
          metadata: {},
        } as any;
      },
    });

    const output = await plugin.transform(
      { content: qti3Item },
      { logger: new SilentLogger() }
    );

    expect(output.items).toHaveLength(1);
    expect(output.items[0].id).toBe('q3-vendor');
    expect(authored).toContain('<qti-choice-interaction response-identifier="CHOICE"');
  });

  test('should reject custom interactions without a vendor transformer', async () => {
    const plugin = new QtiToPiePlugin();
    const customQti = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="custom-only" title="Custom" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier"/>
  <itemBody>
    <customInteraction responseIdentifier="RESPONSE" class="tei-texthighlighter"/>
  </itemBody>
</assessmentItem>`;

    await expect(plugin.transform(
      { content: customQti },
      { logger: new SilentLogger() }
    )).rejects.toThrow(/Unsupported customInteraction/);
  });

  test('should work with TransformEngine', async () => {
    const engine = createTestEngine({
      plugins: [new QtiToPiePlugin()],
      logger: new SilentLogger(),
    });

    const handle = await engine.transform(sampleQtiXml, {
      sourceFormat: 'qti22',
      targetFormat: 'pie',
    });
    const output = await handle.result();

    expect(output.pieConfig).toBeDefined();
    expect(output.metadata.sourceFormat).toBe('qti22');
    expect(output.metadata.targetFormat).toBe('pie');
  });

  test('should accept empty constructor options (backward compatible)', () => {
    const plugin = new QtiToPiePlugin();

    expect(plugin.id).toBe('qti22-to-pie');
    expect(plugin.sourceFormat).toBe('qti22');
    expect(plugin.targetFormat).toBe('pie');
  });

  test('should accept constructor options with vendor detectors', () => {
    const mockDetector = {
      name: 'test-detector',
      vendor: 'test-vendor',
      detect: () => ({ vendor: 'test-vendor', confidence: 0.8 }),
    };

    const plugin = new QtiToPiePlugin({
      vendorDetectors: [mockDetector],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should accept constructor options with vendor transformers', () => {
    const mockTransformer = {
      name: 'test-transformer',
      vendor: 'test-vendor',
      canHandle: () => false,
      transform: async () => ({ items: [], format: 'pie' }),
    };

    const plugin = new QtiToPiePlugin({
      vendorTransformers: [mockTransformer],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should accept constructor options with asset resolvers', () => {
    const mockResolver = {
      resolve: async () => ({ url: 'test.png', content: Buffer.from('') }),
    };

    const plugin = new QtiToPiePlugin({
      assetResolvers: [mockResolver],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should accept constructor options with CSS class extractors', () => {
    const mockExtractor = {
      extract: () => ({ vendor: [], behavior: [] }),
    };

    const plugin = new QtiToPiePlugin({
      cssClassExtractors: [mockExtractor],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should accept constructor options with metadata extractors', () => {
    const mockExtractor = {
      extract: () => ({}),
    };

    const plugin = new QtiToPiePlugin({
      metadataExtractors: [mockExtractor],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should accept constructor options with multiple extension types', () => {
    const mockDetector = {
      name: 'test-detector',
      vendor: 'test-vendor',
      detect: () => ({ vendor: 'test-vendor', confidence: 0.8 }),
    };

    const mockTransformer = {
      name: 'test-transformer',
      vendor: 'test-vendor',
      canHandle: () => false,
      transform: async () => ({ items: [], format: 'pie' }),
    };

    const plugin = new QtiToPiePlugin({
      vendorDetectors: [mockDetector],
      vendorTransformers: [mockTransformer],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should apply registered CSS class extractors for detected vendor content', async () => {
    const detector: VendorDetector = {
      name: 'acme-detector',
      detect: () => ({ vendor: 'acme', confidence: 0.95 }),
    };
    const cssExtractor: CssClassExtractor = {
      vendor: 'acme',
      extract(element) {
        const classes = element.getAttribute('class')?.split(/\s+/) ?? [];
        return {
          behavioral: classes.filter((className) => className === 'acme-input-large'),
          styling: classes.filter((className) => className === 'acme-theme-blue'),
          semantic: [],
          unknown: [],
        };
      },
    };
    const plugin = new QtiToPiePlugin({
      vendorDetectors: [detector],
      cssClassExtractors: [cssExtractor],
    });
    const qtiWithVendorClasses = createQtiWrapper(
      `
  ${createResponseDeclaration('RESPONSE', 'single', ['choiceA'])}
  <itemBody>
    <div class="acme-input-large acme-theme-blue">
      ${createChoiceInteraction('RESPONSE', [
        { id: 'choiceA', text: '4' },
        { id: 'choiceB', text: '3' },
      ])}
    </div>
  </itemBody>
`,
      'choice-vendor-css',
      'Vendor CSS Choice',
    );

    const output = await plugin.transform(
      { content: qtiWithVendorClasses },
      { logger: new SilentLogger() }
    );
    const cssClasses = output.items[0].content.metadata.vendorExtensions.cssClasses;

    expect(cssClasses).toHaveLength(1);
    expect(cssClasses[0].vendor).toBe('acme');
    expect(cssClasses[0].classes).toEqual(['acme-input-large', 'acme-theme-blue']);
    expect(cssClasses[0].categorized.behavioral).toEqual(['acme-input-large']);
    expect(cssClasses[0].categorized.styling).toEqual(['acme-theme-blue']);
  });
});
