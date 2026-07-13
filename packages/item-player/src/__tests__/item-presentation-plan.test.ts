import { describe, expect, it } from 'bun:test';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { InteractionData } from '../interactions/index.js';
import {
	createItemPresentationPlan,
	interactionKey,
	type ItemPresentationPlayer,
} from '../presentation/itemPresentationPlan.js';
import { Player } from '../core/Player.js';

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

	it('passes an extended-text stringIdentifier response back as its lexical companion', () => {
		const player = fakePlayer({
			interactions: [{
				type: 'extendedTextInteraction',
				responseId: 'RESPONSE',
				cardinality: 'single',
				baseType: 'integer',
				base: 16,
				stringIdentifier: 'RAW',
				minStrings: 0,
				maxStrings: 1,
				expectedLines: 1,
				expectedLength: 0,
				prompt: null,
				placeholderText: '',
				format: 'plain',
			}],
		});

		const plan = createItemPresentationPlan({
			player,
			responses: { RESPONSE: 255, RAW: '00FF' },
		});

		expect(plan.blockInteractions[0]).toMatchObject({
			response: 255,
			stringResponse: '00FF',
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

	it('filters item body rubric blocks by role view before rendering', () => {
		const player = fakePlayer({
			bodyHtml: `
				<p>Stem</p>
				<rubricBlock view="candidate"><p>Candidate instructions</p></rubricBlock>
				<rubricBlock view="candidate, scorer"><p>Shared review guidance</p></rubricBlock>
				<rubricBlock view="author scorer"><p>Answer key</p></rubricBlock>
				<rubricBlock><p>Visible to all roles</p></rubricBlock>
			`,
		});

		const candidate = createItemPresentationPlan({ player, role: 'candidate' });
		const scorer = createItemPresentationPlan({ player, role: 'scorer' });

		expect(candidate.itemBodyHtml).toContain('Candidate instructions');
		expect(candidate.itemBodyHtml).toContain('Shared review guidance');
		expect(candidate.itemBodyHtml).toContain('Visible to all roles');
		expect(candidate.itemBodyHtml).not.toContain('Answer key');

		expect(scorer.itemBodyHtml).not.toContain('Candidate instructions');
		expect(scorer.itemBodyHtml).toContain('Shared review guidance');
		expect(scorer.itemBodyHtml).toContain('Answer key');
		expect(scorer.itemBodyHtml).toContain('Visible to all roles');
	});

	it('wraps visible item body rubric blocks with inert render metadata', () => {
		const player = fakePlayer({
			bodyHtml: `
				<p>Stem</p>
				<rubricBlock view="scorer" use="rubric">
					<h3>Scoring guide</h3>
					<table><tr><td>2</td><td>Complete answer</td></tr></table>
				</rubricBlock>
				<qti-rubric-block view="candidate" use="instructions">
					<p>Student instructions</p>
				</qti-rubric-block>
			`,
		});

		const scorer = createItemPresentationPlan({ player, role: 'scorer' });
		const candidate = createItemPresentationPlan({ player, role: 'candidate' });

		expect(scorer.itemBodyHtml).toContain('class="qti-rubric-block"');
		expect(scorer.itemBodyHtml).toContain('data-qti-rubric-view="scorer"');
		expect(scorer.itemBodyHtml).toContain('data-qti-rubric-use="rubric"');
		expect(scorer.itemBodyHtml).toContain('<table>');
		expect(scorer.itemBodyHtml).not.toContain('<rubricBlock');
		expect(scorer.itemBodyHtml).not.toContain('<qti-rubric-block');

		expect(candidate.itemBodyHtml).toContain('Student instructions');
		expect(candidate.itemBodyHtml).toContain('class="qti-rubric-block"');
		expect(candidate.itemBodyHtml).not.toContain('Scoring guide');
	});

	it('can suppress item body rubric blocks for host-placed rubric panels', () => {
		const player = fakePlayer({
			bodyHtml: `
				<p>Stem</p>
				<rubricBlock view="scorer" use="rubric">
					<p>Scorer-only answer key</p>
				</rubricBlock>
			`,
		});

		const defaultPlan = createItemPresentationPlan({ player, role: 'scorer' });
		const hostPlacedPlan = createItemPresentationPlan({
			player,
			role: 'scorer',
			renderItemBodyRubrics: false,
		});

		expect(defaultPlan.itemBodyHtml).toContain('Scorer-only answer key');
		expect(hostPlacedPlan.itemBodyHtml).toContain('Stem');
		expect(hostPlacedPlan.itemBodyHtml).not.toContain('Scorer-only answer key');
		expect(hostPlacedPlan.itemBodyHtml).not.toContain('rubricBlock');
	});

	it('renders only item body HTML by default so hosts can place direct rubrics separately', () => {
		const player = new Player({
			itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="direct-rubrics">
	<rubricBlock view="scorer" use="rubric"><p>Direct scorer rubric</p></rubricBlock>
	<itemBody><p>Body only</p></itemBody>
</assessmentItem>`,
			role: 'scorer',
		});

		const scorer = createItemPresentationPlan({ player, role: 'scorer' });
		const candidate = createItemPresentationPlan({ player, role: 'candidate' });

		expect(scorer.itemBodyHtml).toContain('Body only');
		expect(scorer.itemBodyHtml).not.toContain('Direct scorer rubric');
		expect(candidate.itemBodyHtml).toContain('Body only');
		expect(candidate.itemBodyHtml).not.toContain('Direct scorer rubric');
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
	const player: ItemPresentationPlayer = {
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
	return player;
}
