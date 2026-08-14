import { afterEach, describe, expect, test } from 'bun:test';
import { applyInteractionSecurity } from '../../src/extraction/interactionSecurity.js';

const originalTrustedTypes = Object.getOwnPropertyDescriptor(globalThis, 'trustedTypes');

afterEach(() => {
	if (originalTrustedTypes) Object.defineProperty(globalThis, 'trustedTypes', originalTrustedTypes);
	else delete (globalThis as { trustedTypes?: unknown }).trustedTypes;
});

describe('applyInteractionSecurity', () => {
	test('sanitizes shared imageData URLs', () => {
		const interactions = applyInteractionSecurity([
			{
				type: 'hotspotInteraction',
				responseId: 'RESPONSE',
				imageData: {
					type: 'image',
					src: 'javascript:alert(1)',
					width: '100',
					height: '100',
				},
			} as any,
		]);

		expect((interactions[0] as any).imageData.src).toBe('');
	});

	test('sanitizes position object stage URLs', () => {
		const interactions = applyInteractionSecurity([
			{
				type: 'positionObjectInteraction',
				responseId: 'RESPONSE',
				positionObjectStages: [
					{
						objectData: {
							type: 'image',
							src: 'data:text/html,<script>alert(1)</script>',
							width: '100',
							height: '100',
						},
					},
				],
			} as any,
		]);

		expect((interactions[0] as any).positionObjectStages[0].objectData.src).toBe('');
	});

	test('applies media object embed allowance from security config', () => {
		const interactions = applyInteractionSecurity(
			[
				{
					type: 'mediaInteraction',
					responseId: 'MEDIA',
					mediaElement: {
						type: 'object',
						src: 'https://cdn.example.com/content.swf',
						mimeType: 'application/x-shockwave-flash',
					},
				} as any,
			],
			{
				allowObjectEmbeds: true,
				urlPolicy: {
					allowedHosts: ['cdn.example.com'],
				},
			}
		);

		expect((interactions[0] as any).mediaElement.src).toBe(
			'https://cdn.example.com/content.swf'
		);
		expect((interactions[0] as any).allowObjectEmbeds).toBe(true);
	});

	test('finalizes every declared rich field and freezes the delivered graph', () => {
		class FakeTrustedHtml {
			constructor(readonly value: string) {}
			toString() {
				return this.value;
			}
		}
		Object.defineProperty(globalThis, 'trustedTypes', {
			configurable: true,
			value: {
				createPolicy: () => ({ createHTML: (html: string) => new FakeTrustedHtml(html) }),
			},
		});

		const interactions = applyInteractionSecurity(
			[
				{
					type: 'choiceInteraction',
					responseId: 'RESPONSE',
					prompt: '<b>Prompt</b><script>bad()</script>',
					choices: [{ identifier: 'A', text: '<span onclick="bad()">Choice A</span>' }],
				} as any,
				{
					type: 'gapMatchInteraction',
					responseId: 'GAPS',
					prompt: null,
					promptText: '<p>Put <script>bad()</script>[GAP:G1] here.</p>',
					gapTexts: [],
					gaps: [],
				} as any,
			],
			{ trustedTypesPolicyName: `interaction-delivery-${Date.now()}` }
		);

		const interaction = interactions[0] as any;
		expect(interaction.prompt).toBeInstanceOf(FakeTrustedHtml);
		expect(String(interaction.prompt)).toBe('<b>Prompt</b>');
		expect(interaction.choices[0].text).toBeInstanceOf(FakeTrustedHtml);
		expect(String(interaction.choices[0].text)).toBe('<span>Choice A</span>');
		const gapInteraction = interactions[1] as any;
		expect(gapInteraction.promptText).toBeInstanceOf(FakeTrustedHtml);
		expect(String(gapInteraction.promptText)).toBe('<p>Put [GAP:G1] here.</p>');
		expect(Object.isFrozen(interactions)).toBe(true);
		expect(Object.isFrozen(interaction.choices[0])).toBe(true);
		expect(Object.isFrozen(gapInteraction.promptText)).toBe(false);
	});

	test('fails closed when a plugin supplies unexpected values for known sink fields', () => {
		const interactions = applyInteractionSecurity([
			{
				type: 'choiceInteraction',
				responseId: 'RESPONSE',
				prompt: { attackerControlled: '<img src=x onerror=bad()>' },
				choices: [{ identifier: 'A', text: 42 }],
			} as any,
			{
				type: 'hotspotInteraction',
				responseId: 'HOTSPOT',
				imageData: {
					type: 'image',
					src: { attackerControlled: 'javascript:bad()' },
					width: '10',
					height: '10',
				},
			} as any,
		]);

		expect((interactions[0] as any).prompt).toBe('');
		expect((interactions[0] as any).choices[0].text).toBe('');
		expect((interactions[1] as any).imageData.src).toBe('');
	});
});
