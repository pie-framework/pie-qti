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
import type { QtiSourceProfile } from '@pie-qti/transform-types';

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

  test('should reject standard composite items instead of silently reducing to first interaction', async () => {
    const plugin = new QtiToPiePlugin();
    const compositeQti = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-match-composite" title="Composite" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="MATCH" cardinality="single" baseType="directedPair">
    <correctResponse><value>S1 T1</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <matchInteraction responseIdentifier="MATCH">
      <simpleMatchSet><simpleAssociableChoice identifier="S1" matchMax="1">Stem</simpleAssociableChoice></simpleMatchSet>
      <simpleMatchSet><simpleAssociableChoice identifier="T1" matchMax="1">Target</simpleAssociableChoice></simpleMatchSet>
    </matchInteraction>
  </itemBody>
</assessmentItem>`;

    await expect(plugin.transform(
      { content: compositeQti },
      { logger: new SilentLogger() }
    )).rejects.toThrow(/Unsupported composite QTI item/);
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
