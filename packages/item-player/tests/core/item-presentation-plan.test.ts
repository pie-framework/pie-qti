import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createItemPresentationPlan } from '../../src/presentation/itemPresentationPlan.js';

function presentationPlayer(itemBodyHtml: string) {
	return {
		getComponentRegistry() {
			return {
				getTagName() {
					return 'pie-qti-choice';
				},
			};
		},
		getInteractionData() {
			return [];
		},
		getCorrectResponses() {
			return {};
		},
		getItemBodyHtml() {
			return itemBodyHtml;
		},
		getDeliveryContext() {
			return undefined;
		},
		sanitizeHtmlContent(html: string) {
			return html;
		},
		getPnp() {
			return undefined;
		},
	};
}

describe('createItemPresentationPlan', () => {
	test('reprocesses feedbackInline visibility from current post-submit outcome values', () => {
		const player = presentationPlayer(`
			<p>
				<feedbackInline outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show">Correct feedback</feedbackInline>
				<feedbackInline outcomeIdentifier="FEEDBACK" identifier="incorrect" showHide="show">Incorrect feedback</feedbackInline>
			</p>
		`);

		const incorrect = createItemPresentationPlan({
			player,
			outcomeValues: { FEEDBACK: 'incorrect' },
		});
		expect(incorrect.itemBodyHtml).toContain('Incorrect feedback');
		expect(incorrect.itemBodyHtml).not.toContain('Correct feedback');

		const correct = createItemPresentationPlan({
			player,
			outcomeValues: { FEEDBACK: 'correct' },
		});
		expect(correct.itemBodyHtml).toContain('Correct feedback');
		expect(correct.itemBodyHtml).not.toContain('Incorrect feedback');
		expect(correct.itemBodyHtml).not.toContain('feedbackInline');
	});

	test('ItemPlayer threads post-submit outcome values into ItemBody presentation', () => {
		const itemPlayerSource = readFileSync(
			new URL('../../src/components/ItemPlayer.svelte', import.meta.url),
			'utf8'
		);

		expect(itemPlayerSource).toContain('outcomeValues = result.outcomeValues || {};');
		expect(itemPlayerSource).toContain('<ItemBody');
		expect(itemPlayerSource).toContain('{outcomeValues}');
	});
});
