import { describe, expect, it } from 'bun:test';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { InteractionData } from '../interactions/index.js';
import {
	createItemPresentationPlan,
	interactionKey,
	type ItemPresentationPlayer,
} from '../presentation/itemPresentationPlan.js';

describe('createItemPresentationPlan', () => {
	it('builds inline segments and block interaction presentations from one plan', () => {
		const player = fakePlayer({
			bodyHtml: `
				<p>Choose <inlineChoiceInteraction responseIdentifier="INLINE"><inlineChoice identifier="A">A</inlineChoice></inlineChoiceInteraction>.</p>
				<choiceInteraction responseIdentifier="RESPONSE"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction>
			`,
			interactions: [
				{ type: 'inlineChoiceInteraction', responseId: 'INLINE', choices: [{ identifier: 'A', text: 'A' }] },
				{ type: 'choiceInteraction', responseId: 'RESPONSE', choices: [{ identifier: 'A', text: 'A' }] },
			],
			correctResponses: { RESPONSE: 'A', INLINE: 'A' },
		});

		const plan = createItemPresentationPlan({
			player,
			responses: { RESPONSE: 'A', INLINE: 'A' },
			role: 'scorer',
		});

		expect(plan.inlineSegments.some((segment) => segment.type === 'inlineChoice')).toBe(true);
		expect(plan.itemBodyHtml).toContain('qti-hidden-interaction');
		expect(plan.blockInteractions).toHaveLength(1);
		expect(plan.blockInteractions[0]).toMatchObject({
			tagName: 'pie-qti-choice',
			response: 'A',
			correctResponse: 'A',
			disabled: true,
			componentRole: 'scorer',
		});
	});

	it('injects delivery-context styles and stimulus content before rendering inline segments', () => {
		const deliveryContext: ResolvedItemDeliveryContext = {
			itemHref: 'items/item.xml',
			itemBasePath: 'items',
			stimuli: {
				stimulus1: {
					identifier: 'stimulus1',
					href: 'stimulus.xml',
					bodyHtml: '<p data-catalog-idref="term">Shared stimulus</p>',
				},
			},
			stylesheets: [
				{
					href: 'style.css',
					cssText: '.stem { color: red; }',
					source: 'item',
				},
			],
			catalogSources: [],
		};
		const player = fakePlayer({
			bodyHtml: '<qti-assessment-stimulus-ref identifier="stimulus1" /><p class="stem">Stem</p>',
			deliveryContext,
		});

		const plan = createItemPresentationPlan({ player, deliveryContext });

		expect(plan.itemBodyHtml).toContain('<style data-qti-stylesheets="resolved">');
		expect(plan.itemBodyHtml).toContain('[data-qti-item-body-scope] .stem { color: red; }');
		expect(plan.inlineSegments[0]?.type).toBe('html');
		expect(plan.inlineSegments[0]?.content).toContain('Shared stimulus');
	});

	it('uses stable interaction keys that include item-specific choice identity', () => {
		const first = interactionKey({
			type: 'choiceInteraction',
			responseId: 'RESPONSE',
			choices: [{ identifier: 'A' }],
			prompt: 'First',
		} as any);
		const second = interactionKey({
			type: 'choiceInteraction',
			responseId: 'RESPONSE',
			choices: [{ identifier: 'B' }],
			prompt: 'Second',
		} as any);

		expect(first).not.toBe(second);
	});
});

function fakePlayer({
	bodyHtml = '<p>Stem</p>',
	interactions = [],
	correctResponses = {},
	deliveryContext,
}: {
	bodyHtml?: string;
	interactions?: InteractionData[];
	correctResponses?: Record<string, unknown>;
	deliveryContext?: ResolvedItemDeliveryContext;
}): ItemPresentationPlayer {
	return {
		getComponentRegistry: () => ({
			getTagName: (interaction: InteractionData) => `pie-qti-${interaction.type.replace(/Interaction$/, '').replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`,
		}),
		getInteractionData: () => interactions,
		getCorrectResponses: () => correctResponses,
		getItemBodyHtml: () => bodyHtml,
		getDeliveryContext: () => deliveryContext,
		sanitizeHtmlContent: (html: string) => html,
		getPnp: () => undefined,
	};
}
