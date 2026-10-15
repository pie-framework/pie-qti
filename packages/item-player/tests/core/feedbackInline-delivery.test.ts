/**
 * feedbackInline in delivery: a QTI 2.2 item and its QTI 3.0 twin show the same inline feedback,
 * nested and matched by membership in a multiple-cardinality outcome, in the item body, choice
 * text, a rubric block and modal feedback.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { processFeedbackInline } from '../../src/components/utils/feedbackUtils.js';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';
import type { ItemPresentation } from '../../src/presentation/itemPresentationPlan.js';

const fb = (identifier: string, showHide: string, content: string) =>
	`<feedbackInline outcomeIdentifier="FEEDBACK" identifier="${identifier}" showHide="${showHide}">${content}</feedbackInline>`;

const QTI22 = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="inline-feedback" title="Inline feedback"
  adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="multiple" baseType="identifier"/>
  <outcomeDeclaration identifier="MODAL" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p class="body">Body:${fb('SEEN', 'show', ` seen${fb('RIGHT', 'show', ' right')}${fb('RIGHT', 'hide', ' wrong')}`)}${fb('SEEN', 'hide', ' unseen')}${fb('OTHER', 'show', ' other')}</p>
    <rubricBlock view="candidate"><p class="rubric">Rubric:${fb('RIGHT', 'show', ' right')}${fb('OTHER', 'hide', ' not other')}</p></rubricBlock>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Choice A${fb('RIGHT', 'show', 'Well done')}${fb('SEEN', 'hide', 'Not yet')}</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="FEEDBACK">
      <multiple><baseValue baseType="identifier">SEEN</baseValue><baseValue baseType="identifier">RIGHT</baseValue></multiple>
    </setOutcomeValue>
    <setOutcomeValue identifier="MODAL"><baseValue baseType="identifier">SHOW</baseValue></setOutcomeValue>
  </responseProcessing>
  <modalFeedback outcomeIdentifier="MODAL" identifier="SHOW" showHide="show">Modal:${fb('SEEN', 'show', ` seen${fb('RIGHT', 'show', ' right')}`)}${fb('RIGHT', 'hide', ' wrong')}</modalFeedback>
</assessmentItem>`;

const QTI30 = convertQti2ToQti3(QTI22);

const text = (html: unknown) =>
	String(html)
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim();

function bodyText(presentation: ItemPresentation): string {
	return text(
		presentation.flow
			.filter((node) => node.kind === 'html')
			.map((node) => (node.kind === 'html' ? String(node.html) : ''))
			.join('')
	);
}

function deliver(xml: string) {
	const session = createAssessmentItemDefinition({ itemXml: xml }).openSession();
	const before = bodyText(session.present());
	session.dispatch({ action: 'setResponses', responses: { RESPONSE: 'A' } });
	session.dispatch({ action: 'endAttempt' });
	const after = bodyText(session.present());
	const outcomes = session.state().outcomes;
	session.dispose();

	const player = new Player({ itemXml: xml });
	const rubricBefore = player.getRubrics().map((rubric) => text(rubric.html));
	player.setResponses({ RESPONSE: 'A' });
	const modal = player.processResponses().modalFeedback?.map((entry) => text(entry.content));
	const rubricAfter = player.getRubrics().map((rubric) => text(rubric.html));
	const choice = (player.getInteractionData()[0] as unknown as { choices: { text: string }[] }).choices[0]?.text ?? '';

	return {
		before,
		after,
		rubricBefore,
		rubricAfter,
		modal,
		choiceBefore: text(processFeedbackInline(choice, { outcomeValues: {} })),
		choiceAfter: text(processFeedbackInline(choice, { outcomeValues: outcomes })),
	};
}

describe('feedbackInline in delivery', () => {
	test('the QTI 3.0 twin spells feedback the QTI 3 way', () => {
		expect(QTI30).toContain('<qti-feedback-inline outcome-identifier="FEEDBACK"');
		expect(QTI30).not.toContain('feedbackInline');
	});

	test.each([
		['QTI 2.2', QTI22],
		['QTI 3.0', QTI30],
	])('%s resolves nested feedback by membership', (_version, xml) => {
		const delivered = deliver(xml);
		expect(delivered.before).toContain('Body: unseen');
		expect(delivered.after).toContain('Body: seen right Rubric: right not other');
		expect(delivered.after).not.toMatch(/wrong|unseen|Not yet/);
		expect(delivered.rubricBefore).toEqual(['Rubric: not other']);
		expect(delivered.rubricAfter).toEqual(['Rubric: right not other']);
		expect(delivered.modal).toEqual(['Modal: seen right']);
		expect(delivered.choiceBefore).toBe('Choice ANot yet');
		expect(delivered.choiceAfter).toBe('Choice AWell done');
	});

	test('the QTI 3.0 twin delivers the same text as the QTI 2.2 item', () => {
		expect(deliver(QTI30)).toEqual(deliver(QTI22));
	});
});
