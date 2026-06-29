import { describe, expect, test } from 'bun:test';
import { applyInteractionSecurity } from '../../src/extraction/interactionSecurity.js';

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

	test('leaves prompt text unwrapped while processing HTML injection fields', () => {
		const interactions = applyInteractionSecurity([
			{
				type: 'choiceInteraction',
				responseId: 'RESPONSE',
				prompt: '<b>Plain prompt</b>',
				choices: [{ identifier: 'A', text: '<span>Choice A</span>' }],
			} as any,
		]);

		expect((interactions[0] as any).prompt).toBe('<b>Plain prompt</b>');
		expect((interactions[0] as any).choices[0].text).toBe('<span>Choice A</span>');
	});
});
