import { describe, expect, test } from 'bun:test';
import type { ComponentRegistry } from '../../src/core/ComponentRegistry.js';
import {
	createAssessmentItemDefinition,
	type AssessmentItemDefinitionConfig,
	type AssessmentItemDefinitionPlugin,
} from '../../src/core/AssessmentItemDefinition.js';
import type { ExtractionRegistry } from '../../src/extraction/ExtractionRegistry.js';
import { htmlField, urlField } from '../../src/extraction/deliveryTypes.js';
import type { ElementExtractor } from '../../src/extraction/types.js';
import type { DeliveredInteraction } from '../../src/interactions/shared/types.js';
import type { HtmlContent } from '../../src/types/index.js';

interface SpoofingVendorPayload {
	type: 'payload-controlled-type';
	responseId: 'payload-controlled-response';
	vendorScore: number;
	vendorMetadata: {
		readonly scale: 'confidence';
	};
}

function definitionPlugin(
	name: string,
	registerExtractors: (registry: ExtractionRegistry) => void,
	registerComponents?: (registry: ComponentRegistry) => void,
): AssessmentItemDefinitionPlugin {
	return {
		kind: 'assessment-item-definition-plugin',
		name,
		version: '1.0.0',
		registerExtractors,
		...(registerComponents ? { registerComponents } : {}),
	};
}

function registerTestComponent(registry: ComponentRegistry, type: string): void {
	registry.register(type, {
		name: `${type}-test-renderer`,
		tagName: 'test-vendor-interaction',
		canHandle: () => true,
	});
}

function deliveredInteraction(
	config: AssessmentItemDefinitionConfig,
): { interaction: DeliveredInteraction<string, Record<string, unknown>>; tagName: string } {
	const session = createAssessmentItemDefinition(config).openSession();
	try {
		const mount = session
			.present()
			.flow.find((node) => node.kind === 'interaction' && node.mount.placement === 'block');
		if (!mount || mount.kind !== 'interaction' || mount.mount.placement !== 'block') {
			throw new Error('Expected a delivered block interaction');
		}
		return {
			interaction: mount.mount.interaction as DeliveredInteraction<
				string,
				Record<string, unknown>
			>,
			tagName: mount.mount.tagName,
		};
	} finally {
		session.dispose();
	}
}

describe('vendor interaction delivery', () => {
	test('sanitizes standard interaction resource URLs at the definition/session seam', () => {
		const { interaction } = deliveredInteraction({
			itemXml: `
				<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
					identifier="unsafe-hotspot" title="Unsafe hotspot">
					<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
					<itemBody>
						<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
							<object type="image/png" data="javascript:alert(1)" width="100" height="100"/>
							<hotspotChoice identifier="A" shape="rect" coords="0,0,20,20"/>
						</hotspotInteraction>
					</itemBody>
				</assessmentItem>`,
			plugins: [
				definitionPlugin(
					'standard-hotspot-renderer',
					() => {},
					(registry) => registerTestComponent(registry, 'hotspotInteraction'),
				),
			],
		});

		expect(
			(interaction as { imageData: { src?: string } | null }).imageData?.src,
		).toBe('');
	});

	test('applies object-embed policy to standard media delivery', () => {
		const { interaction } = deliveredInteraction({
			itemXml: `
				<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
					identifier="allowed-object" title="Allowed object">
					<responseDeclaration identifier="MEDIA" cardinality="single" baseType="integer"/>
					<itemBody>
						<mediaInteraction responseIdentifier="MEDIA" autostart="false" minPlays="0">
							<object type="application/x-shockwave-flash"
								data="https://cdn.example.com/content.swf"/>
						</mediaInteraction>
					</itemBody>
				</assessmentItem>`,
			plugins: [
				definitionPlugin(
					'standard-media-renderer',
					() => {},
					(registry) => registerTestComponent(registry, 'mediaInteraction'),
				),
			],
			security: {
				allowObjectEmbeds: true,
				urlPolicy: { allowedHosts: ['cdn.example.com'] },
			},
		});

		const media = interaction as {
			mediaElement: { src: string };
			allowObjectEmbeds?: boolean;
		};
		expect(media.mediaElement.src).toBe('https://cdn.example.com/content.swf');
		expect(media.allowObjectEmbeds).toBe(true);
	});

	test('fails closed for malformed values at authored standard sink fields', () => {
		const extractor: ElementExtractor<
			{
				prompt: unknown;
				choices: Array<{ identifier: string; text: unknown }>;
			},
			'acmeMalformedChoiceInteraction'
		> = {
			id: 'acme:malformed-choice',
			name: 'ACME malformed choice interaction',
			priority: 1000,
			elementTypes: ['choiceInteraction'],
			outputType: 'acmeMalformedChoiceInteraction',
			canHandle: () => true,
			extract: () => ({
				prompt: { attackerControlled: '<img src=x onerror=bad()>' },
				choices: [{ identifier: 'A', text: 42 }],
			}),
		};
		const { interaction } = deliveredInteraction({
			itemXml: `
				<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
					identifier="malformed-choice" title="Malformed choice">
					<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
					<itemBody>
						<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
							<simpleChoice identifier="A">Choice A</simpleChoice>
						</choiceInteraction>
					</itemBody>
				</assessmentItem>`,
			plugins: [
				definitionPlugin(
					'acme-malformed-choice',
					(registry) => registry.register(extractor),
					(registry) => registerTestComponent(registry, 'acmeMalformedChoiceInteraction'),
				),
			],
		});

		const malformed = interaction as unknown as {
			prompt: unknown;
			choices: Array<{ text: unknown }>;
		};
		expect(malformed.prompt).toBe('');
		expect(malformed.choices[0]?.text).toBe('');
	});

	test('selects, executes, and applies delivery policy from one extractor dispatch', () => {
		let unstablePredicateCalls = 0;
		let unstableExtractionCalls = 0;
		let fallbackExtractionCalls = 0;
		const unstableExtractor: ElementExtractor<
			{ stableMarkup: string },
			'unstableVendorInteraction'
		> = {
			id: 'hostile:stateful-predicate',
			name: 'Stateful predicate extractor',
			priority: 2000,
			elementTypes: ['vendorInteraction'],
			outputType: 'unstableVendorInteraction',
			delivery: { fields: [htmlField('stableMarkup')] },
			canHandle: () => {
				unstablePredicateCalls += 1;
				return unstablePredicateCalls === 1;
			},
			extract: () => {
				unstableExtractionCalls += 1;
				return {
					stableMarkup: '<strong onclick="bad()">Selected</strong><script>bad()</script>',
				};
			},
		};
		const fallbackExtractor: ElementExtractor<
			{ fallbackMarkup: string },
			'fallbackVendorInteraction'
		> = {
			id: 'hostile:unsafe-fallback',
			name: 'Unsafe fallback extractor',
			priority: 1000,
			elementTypes: ['vendorInteraction'],
			outputType: 'fallbackVendorInteraction',
			delivery: { fields: [htmlField('fallbackMarkup')] },
			canHandle: () => true,
			extract: () => {
				fallbackExtractionCalls += 1;
				return { fallbackMarkup: '<img src="x" onerror="bad()">' };
			},
		};
		const { interaction: delivered } = deliveredInteraction({
			itemXml: `
				<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
					identifier="atomic-vendor" title="Atomic vendor">
					<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
					<itemBody><vendorInteraction responseIdentifier="RESPONSE"/></itemBody>
				</assessmentItem>`,
			plugins: [
				definitionPlugin(
					'hostile-atomic-dispatch',
					(registry) => {
						registry.register(unstableExtractor);
						registry.register(fallbackExtractor);
					},
					(registry) => registerTestComponent(registry, 'unstableVendorInteraction'),
				),
			],
		});

		const interaction = delivered as DeliveredInteraction<
			'unstableVendorInteraction',
			{ stableMarkup: string; fallbackMarkup?: string }
		>;

		expect(unstablePredicateCalls).toBe(1);
		expect(unstableExtractionCalls).toBe(1);
		expect(fallbackExtractionCalls).toBe(0);
		expect(interaction.type).toBe('unstableVendorInteraction');
		expect(String(interaction.stableMarkup)).toBe('<strong>Selected</strong>');
		expect(interaction.fallbackMarkup).toBeUndefined();
		expect(JSON.stringify(interaction)).not.toContain('onerror');
	});

	test('delivers arbitrary payload while preserving framework-owned identity', () => {
		const extractor: ElementExtractor<
			SpoofingVendorPayload,
			'acmeConfidenceInteraction'
		> = {
			id: 'acme:confidence',
			name: 'ACME confidence interaction',
			priority: 1000,
			elementTypes: ['vendorInteraction'],
			outputType: 'acmeConfidenceInteraction',
			canHandle: () => true,
			extract: () => ({
				type: 'payload-controlled-type',
				responseId: 'payload-controlled-response',
				vendorScore: 7,
				vendorMetadata: { scale: 'confidence' },
			}),
		};
		const { interaction: delivered, tagName } = deliveredInteraction({
			itemXml: `
				<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
					identifier="vendor-item" title="Vendor item">
					<responseDeclaration identifier="AUTHORED_RESPONSE" cardinality="single" baseType="integer"/>
					<itemBody>
						<vendorInteraction responseIdentifier="AUTHORED_RESPONSE"/>
					</itemBody>
				</assessmentItem>`,
			plugins: [
				definitionPlugin(
					'acme-confidence',
					(registry) => registry.register(extractor),
					(registry) =>
						registry.register<
							DeliveredInteraction<'acmeConfidenceInteraction', SpoofingVendorPayload>
						>('acmeConfidenceInteraction', {
							name: 'acme-confidence',
							tagName: 'acme-confidence',
							canHandle: (data) => data.vendorMetadata.scale === 'confidence',
						}),
				),
			],
		});

		const interaction = delivered as DeliveredInteraction<
			'acmeConfidenceInteraction',
			SpoofingVendorPayload
		>;
		const typedOutputType: 'acmeConfidenceInteraction' = interaction.type;
		const typedVendorScore: number = interaction.vendorScore;

		expect(typedOutputType).toBe('acmeConfidenceInteraction');
		expect(interaction.responseId).toBe('AUTHORED_RESPONSE');
		expect(typedVendorScore).toBe(7);
		expect(interaction.vendorMetadata).toEqual({ scale: 'confidence' });
		expect(tagName).toBe('acme-confidence');
		expect(Object.isFrozen(interaction)).toBe(true);
	});

	test('keeps authored standard sink policy when a plugin selects a vendor renderer', () => {
		class FakeTrustedHtml {
			constructor(readonly value: string) {}
			toString() {
				return this.value;
			}
		}
		const originalTrustedTypes = Object.getOwnPropertyDescriptor(globalThis, 'trustedTypes');
		Object.defineProperty(globalThis, 'trustedTypes', {
			configurable: true,
			value: {
				createPolicy: () => ({ createHTML: (html: string) => new FakeTrustedHtml(html) }),
			},
		});
		type ChoiceDraft = {
			prompt: string;
			choices: Array<{ identifier: string; text: string }>;
		};
		type ChoiceDelivery = {
			prompt: HtmlContent;
			choices: Array<{ identifier: string; text: HtmlContent }>;
		};
		const extractor: ElementExtractor<
			ChoiceDraft,
			'acmeChoiceInteraction'
		> = {
			id: 'acme:choice-override',
			name: 'ACME choice override',
			priority: 1000,
			elementTypes: ['choiceInteraction'],
			outputType: 'acmeChoiceInteraction',
			canHandle: () => true,
			extract: () => ({
				prompt: '<strong onclick="bad()">Choose</strong><script>bad()</script>',
				choices: [
					{
						identifier: 'A',
						text: '<span onmouseover="bad()">Choice A</span>',
					},
				],
			}),
		};
		const { interaction: delivered } = deliveredInteraction({
			itemXml: `
				<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
					identifier="vendor-choice" title="Vendor choice">
					<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
					<itemBody>
						<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
							<prompt>Authored prompt</prompt>
							<simpleChoice identifier="A">Choice A</simpleChoice>
						</choiceInteraction>
					</itemBody>
				</assessmentItem>`,
			plugins: [
				definitionPlugin(
					'acme-choice-override',
					(registry) => registry.register(extractor),
					(registry) => registerTestComponent(registry, 'acmeChoiceInteraction'),
				),
			],
			security: { trustedTypesPolicyName: `vendor-choice-${Date.now()}` },
		});

		const interaction = delivered as DeliveredInteraction<
			'acmeChoiceInteraction',
			ChoiceDelivery
		>;
		expect(interaction.type).toBe('acmeChoiceInteraction');
		const typedPrompt: HtmlContent = interaction.prompt;
		expect(typedPrompt).toBeInstanceOf(FakeTrustedHtml);
		expect(String(interaction.prompt)).toBe('<strong>Choose</strong>');
		expect(interaction.choices[0]?.text).toBeInstanceOf(FakeTrustedHtml);
		expect(String(interaction.choices[0]?.text)).toBe('<span>Choice A</span>');
		if (originalTrustedTypes) {
			Object.defineProperty(globalThis, 'trustedTypes', originalTrustedTypes);
		} else {
			delete (globalThis as { trustedTypes?: unknown }).trustedTypes;
		}
	});

	test('does not let a plugin weaken an authored standard URL sink classification', () => {
		const extractor: ElementExtractor<
			{ mediaElement: { type: 'object'; src: string } },
			'acmeMediaInteraction'
		> = {
			id: 'acme:media-policy-override',
			name: 'ACME media policy override',
			priority: 1000,
			elementTypes: ['mediaInteraction'],
			outputType: 'acmeMediaInteraction',
			delivery: { fields: [urlField('img', 'mediaElement', 'src')] },
			canHandle: () => true,
			extract: () => ({
				mediaElement: { type: 'object', src: 'blob:https://trusted.test/object' },
			}),
		};
		const { interaction: delivered } = deliveredInteraction({
			itemXml: `
				<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
					identifier="vendor-media" title="Vendor media">
					<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>
					<itemBody>
						<mediaInteraction responseIdentifier="RESPONSE" autostart="false" minPlays="0">
							<object type="video/mp4" data="movie.mp4"/>
						</mediaInteraction>
					</itemBody>
				</assessmentItem>`,
			plugins: [
				definitionPlugin(
					'acme-media-override',
					(registry) => registry.register(extractor),
					(registry) => registerTestComponent(registry, 'acmeMediaInteraction'),
				),
			],
			security: { urlPolicy: { allowBlobMedia: true }, allowObjectEmbeds: false },
		});

		const interaction = delivered as DeliveredInteraction<
			'acmeMediaInteraction',
			{ mediaElement: { type: 'object'; src: string } }
		>;
		expect(interaction.mediaElement.src).toBe('');
		expect((interaction as { allowObjectEmbeds?: boolean }).allowObjectEmbeds).toBe(false);
	});

	test('does not let registry-level plugin policy weaken an authored object URL sink', () => {
		const extractor: ElementExtractor<
			{ mediaElement: { type: 'object'; src: string } },
			'acmeRegistryMediaInteraction'
		> = {
			id: 'acme:registry-media-policy-override',
			name: 'ACME registry media policy override',
			priority: 1000,
			elementTypes: ['mediaInteraction'],
			outputType: 'acmeRegistryMediaInteraction',
			canHandle: () => true,
			extract: () => ({
				mediaElement: { type: 'object', src: 'blob:https://trusted.test/object' },
			}),
		};
		const { interaction: delivered } = deliveredInteraction({
			itemXml: `
				<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
					identifier="registry-vendor-media" title="Registry vendor media">
					<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>
					<itemBody>
						<mediaInteraction responseIdentifier="RESPONSE" autostart="false" minPlays="0">
							<object type="video/mp4" data="movie.mp4"/>
						</mediaInteraction>
					</itemBody>
				</assessmentItem>`,
			plugins: [
				definitionPlugin('acme-registry-media-override', (registry) => {
						registry.register(extractor);
						// Blob media is allowed, while object embeds are not. If this plugin
						// classification wins, the authored object URL incorrectly survives.
						registry.registerDeliveryFields('mediaInteraction', [
							urlField('media', 'mediaElement', 'src'),
						]);
				}, (registry) => registerTestComponent(registry, 'acmeRegistryMediaInteraction')),
			],
			security: { urlPolicy: { allowBlobMedia: true }, allowObjectEmbeds: false },
		});

		const interaction = delivered as DeliveredInteraction<
			'acmeRegistryMediaInteraction',
			{ mediaElement: { type: 'object'; src: string } }
		>;
		expect(interaction.mediaElement.src).toBe('');
		expect((interaction as { allowObjectEmbeds?: boolean }).allowObjectEmbeds).toBe(false);
	});
});
