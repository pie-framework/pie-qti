import { describe, expect, test } from 'bun:test';
import {
	createItemPresentation,
	type ItemPresentation,
	type ItemPresentationSource,
} from '../../src/presentation/itemPresentationPlan.js';
import { Player } from '../../src/core/Player.js';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';

describe('createItemPresentation', () => {
	test('reprocesses feedbackInline visibility from current post-submit outcome values', () => {
		const player = new Player({
			itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="feedback-inline">
	<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
	<itemBody><p>
				<feedbackInline outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show">Correct feedback</feedbackInline>
				<feedbackInline outcomeIdentifier="FEEDBACK" identifier="incorrect" showHide="show">Incorrect feedback</feedbackInline>
			</p></itemBody>
</assessmentItem>`,
		});
		const source = sourceFromPlayer(player);

		const incorrect = createItemPresentation({
			source,
			outcomeValues: { FEEDBACK: 'incorrect' },
		});
		expect(presentationHtml(incorrect)).toContain('Incorrect feedback');
		expect(presentationHtml(incorrect)).not.toContain('Correct feedback');

		const correct = createItemPresentation({
			source,
			outcomeValues: { FEEDBACK: 'correct' },
		});
		expect(presentationHtml(correct)).toContain('Correct feedback');
		expect(presentationHtml(correct)).not.toContain('Incorrect feedback');
		expect(presentationHtml(correct)).not.toContain('feedbackInline');
	});

	test('a live ItemSession presents post-submit outcomes without a response snapshot handoff', () => {
		const definition = createAssessmentItemDefinition({
			itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="session-feedback">
	<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
	<itemBody><p>
		<feedbackInline outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show">Correct feedback</feedbackInline>
	</p></itemBody>
	<responseProcessing>
		<setOutcomeValue identifier="FEEDBACK">
			<baseValue baseType="identifier">correct</baseValue>
		</setOutcomeValue>
	</responseProcessing>
</assessmentItem>`,
		});
		const session = definition.openSession();

		expect(presentationHtml(session.present())).not.toContain('Correct feedback');
		session.dispatch({ action: 'endAttempt' });
		expect(presentationHtml(session.present())).toContain('Correct feedback');
		session.dispose();
	});
});

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
		.map((node) => (node.kind === 'html' ? String(node.html) : ''))
		.join('');
}
