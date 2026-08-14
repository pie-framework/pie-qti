import { describe, expect, it } from 'bun:test';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { StandardInteractionData } from '../interactions/shared/types.js';
import {
	createItemPresentation,
	interactionKey,
	type ItemPresentation,
	type ItemPresentationSource,
} from '../presentation/itemPresentationPlan.js';
import { Player } from '../core/Player.js';
import { createComponentRegistry } from '../core/ComponentRegistry.js';

describe('createItemPresentation', () => {
	it('builds one ordered flow with inline and block interaction mounts', () => {
		const source = presentationSource({
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

		const presentation = createItemPresentation({
			source,
			responses: { RESPONSE: 'A', INLINE: 'A' },
			role: 'scorer',
		});

		expect(
			presentation.flow.some(
				(node) => node.kind === 'interaction' && node.mount.renderer === 'inline-choice'
			)
		).toBe(true);
		expect(presentationHtml(presentation)).toContain('qti-hidden-interaction');
		const blockMounts = presentation.flow
			.filter((node) => node.kind === 'interaction' && node.mount.placement === 'block')
			.map((node) => node.kind === 'interaction' ? node.mount : null);
		expect(blockMounts).toHaveLength(1);
		expect(blockMounts[0]).toMatchObject({
			tagName: 'pie-qti-choice',
			response: 'A',
			correctResponse: 'A',
			disabled: true,
			componentRole: 'scorer',
		});
	});

	it('passes an extended-text stringIdentifier response back as its lexical companion', () => {
		const source = presentationSource({
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

		const presentation = createItemPresentation({
			source,
			responses: { RESPONSE: 255, RAW: '00FF' },
		});

		const block = presentation.flow.find(
			(node) => node.kind === 'interaction' && node.mount.placement === 'block'
		);
		expect(block && block.kind === 'interaction' ? block.mount : null).toMatchObject({
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
		const source = presentationSource({
			bodyHtml: '<qti-assessment-stimulus-ref identifier="stimulus1" /><p class="stem">Stem</p>',
			deliveryContext,
		});

		const presentation = createItemPresentation({ source });

		expect(presentationHtml(presentation)).not.toContain('<style');
		expect(presentation.scopedCss).toContain('[data-qti-item-body-scope] .stem { color: red; }');
		expect(presentation.flow[0]?.kind).toBe('html');
		expect(presentationHtml(presentation)).toContain('Shared stimulus');
	});

	it('filters item body rubric blocks by role view before rendering', () => {
		const source = presentationSource({
			bodyHtml: `
				<p>Stem</p>
				<rubricBlock view="candidate"><p>Candidate instructions</p></rubricBlock>
				<rubricBlock view="candidate, scorer"><p>Shared review guidance</p></rubricBlock>
				<rubricBlock view="author scorer"><p>Answer key</p></rubricBlock>
				<rubricBlock><p>Visible to all roles</p></rubricBlock>
			`,
		});

		const candidate = createItemPresentation({ source, role: 'candidate' });
		const scorer = createItemPresentation({ source, role: 'scorer' });
		const candidateHtml = presentationHtml(candidate);
		const scorerHtml = presentationHtml(scorer);

		expect(candidateHtml).toContain('Candidate instructions');
		expect(candidateHtml).toContain('Shared review guidance');
		expect(candidateHtml).toContain('Visible to all roles');
		expect(candidateHtml).not.toContain('Answer key');

		expect(scorerHtml).not.toContain('Candidate instructions');
		expect(scorerHtml).toContain('Shared review guidance');
		expect(scorerHtml).toContain('Answer key');
		expect(scorerHtml).toContain('Visible to all roles');
	});

	it('wraps visible item body rubric blocks with inert render metadata', () => {
		const source = presentationSource({
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

		const scorer = presentationHtml(createItemPresentation({ source, role: 'scorer' }));
		const candidate = presentationHtml(createItemPresentation({ source, role: 'candidate' }));

		expect(scorer).toContain('class="qti-rubric-block"');
		expect(scorer).toContain('data-qti-rubric-view="scorer"');
		expect(scorer).toContain('data-qti-rubric-use="rubric"');
		expect(scorer).toContain('<table>');
		expect(scorer).not.toContain('<rubricBlock');
		expect(scorer).not.toContain('<qti-rubric-block');

		expect(candidate).toContain('Student instructions');
		expect(candidate).toContain('class="qti-rubric-block"');
		expect(candidate).not.toContain('Scoring guide');
	});

	it('can suppress item body rubric blocks for host-placed rubric panels', () => {
		const source = presentationSource({
			bodyHtml: `
				<p>Stem</p>
				<rubricBlock view="scorer" use="rubric">
					<p>Scorer-only answer key</p>
				</rubricBlock>
			`,
		});

		const defaultHtml = presentationHtml(createItemPresentation({ source, role: 'scorer' }));
		const hostPlacedHtml = presentationHtml(createItemPresentation({
			source,
			role: 'scorer',
			renderItemBodyRubrics: false,
		}));

		expect(defaultHtml).toContain('Scorer-only answer key');
		expect(hostPlacedHtml).toContain('Stem');
		expect(hostPlacedHtml).not.toContain('Scorer-only answer key');
		expect(hostPlacedHtml).not.toContain('rubricBlock');
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

		const source = sourceFromPlayer(player);
		const scorer = presentationHtml(createItemPresentation({ source, role: 'scorer' }));
		const candidate = presentationHtml(createItemPresentation({ source, role: 'candidate' }));

		expect(scorer).toContain('Body only');
		expect(scorer).not.toContain('Direct scorer rubric');
		expect(candidate).toContain('Body only');
		expect(candidate).not.toContain('Direct scorer rubric');
	});

	it('keeps final item body HTML trusted after every presentation transform', () => {
		const policyName = `pie-qti-presentation-${Date.now()}-${Math.random()}`;
		const previous = Object.getOwnPropertyDescriptor(globalThis, 'trustedTypes');
		class TestTrustedHtml {
			constructor(readonly value: string) {}
			toString() {
				return this.value;
			}
		}
		Object.defineProperty(globalThis, 'trustedTypes', {
			configurable: true,
			value: {
				createPolicy: (_name: string, rules: { createHTML(input: string): string }) => ({
					createHTML: (input: string) => new TestTrustedHtml(rules.createHTML(input)),
				}),
			},
		});

		try {
			const player = new Player({
				itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="trusted-presentation">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
		<correctResponse><value>answer</value></correctResponse>
	</responseDeclaration>
	<itemBody>
		<p onclick="alert(1)">Enter <textEntryInteraction responseIdentifier="RESPONSE"/></p>
		<rubricBlock view="candidate"><p>Candidate guidance</p></rubricBlock>
	</itemBody>
</assessmentItem>`,
				security: { trustedTypesPolicyName: policyName },
			});
			const source = sourceFromPlayer(player);
			expect(source.itemBodyHtml).toBeInstanceOf(TestTrustedHtml);

			const presentation = createItemPresentation({ source, role: 'candidate' });
			const htmlNodes = presentation.flow.filter((node) => node.kind === 'html');
			expect(htmlNodes.length).toBeGreaterThan(0);
			for (const node of htmlNodes) {
				if (node.kind === 'html') expect(node.html).toBeInstanceOf(TestTrustedHtml);
			}
			const html = presentationHtml(presentation);
			expect(html).toContain('Candidate guidance');
			expect(html).not.toContain('onclick');
		} finally {
			if (previous) Object.defineProperty(globalThis, 'trustedTypes', previous);
			else delete (globalThis as { trustedTypes?: unknown }).trustedTypes;
		}
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

function presentationSource({
	bodyHtml = '<p>Stem</p>',
	interactions = [],
	correctResponses = {},
	deliveryContext,
}: {
	bodyHtml?: string;
	interactions?: StandardInteractionData[];
	correctResponses?: Record<string, unknown>;
	deliveryContext?: ResolvedItemDeliveryContext;
}): ItemPresentationSource {
	return {
		itemBodyHtml: bodyHtml,
		interactions,
		correctResponses,
		componentRegistry: createComponentRegistry(),
		deliveryContext,
	};
}

function sourceFromPlayer(player: Player): ItemPresentationSource {
	return {
		itemBodyHtml: player.getItemBodyHtml(),
		interactions: player.getInteractionData(),
		correctResponses: player.getCorrectResponses(),
		componentRegistry: player.getComponentRegistry(),
		deliveryContext: player.getDeliveryContext(),
		pnp: player.getPnp(),
		security: player.getSecurityConfig(),
	};
}

function presentationHtml(presentation: ItemPresentation): string {
	return presentation.flow
		.filter((node) => node.kind === 'html')
		.map((node) => node.kind === 'html' ? String(node.html) : '')
		.join('');
}
