/**
 * Feedback blocks, template content and modal feedback in delivery: a QTI 2.2 item and its QTI
 * 3.0 twin show the same content, matched by membership in multiple-cardinality variables, in the
 * item body, interaction content, MathML and modal feedback. Context variables are QTI 3 only.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';
import type { ItemPresentation } from '../../src/presentation/itemPresentationPlan.js';

const tpl = (tag: 'templateInline' | 'templateBlock', identifier: string, showHide: string, content: string) =>
	`<${tag} templateIdentifier="MODE" identifier="${identifier}" showHide="${showHide}">${content}</${tag}>`;
const fb = (tag: 'feedbackInline' | 'feedbackBlock', identifier: string, showHide: string, content: string) =>
	`<${tag} outcomeIdentifier="FEEDBACK" identifier="${identifier}" showHide="${showHide}">${content}</${tag}>`;

const QTI22 = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="blocks" title="Blocks"
  adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="HOT" cardinality="multiple" baseType="identifier"/>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="multiple" baseType="identifier"/>
  <outcomeDeclaration identifier="MODAL" cardinality="single" baseType="identifier"/>
  <templateDeclaration identifier="MODE" cardinality="multiple" baseType="identifier">
    <defaultValue><value>EASY</value><value>HINTS</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="CHOICES" cardinality="multiple" baseType="identifier">
    <defaultValue><value>A</value><value>C</value><value>H1</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="N" cardinality="single" baseType="integer" mathVariable="true">
    <defaultValue><value>7</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="SYM" cardinality="single" baseType="string" mathVariable="true">
    <defaultValue><value>k</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="PLAIN" cardinality="single" baseType="integer">
    <defaultValue><value>3</value></defaultValue>
  </templateDeclaration>
  <itemBody>
    <p class="inline">Mode:${tpl('templateInline', 'EASY', 'show', ` easy${tpl('templateInline', 'HINTS', 'show', ' hints')}`)}${tpl('templateInline', 'EASY', 'hide', ' hard')}${tpl('templateInline', 'OTHER', 'show', ' other')}</p>
    ${tpl('templateBlock', 'HINTS', 'show', `<p class="block">Hint block${tpl('templateInline', 'OTHER', 'hide', ' not other')}</p>`)}
    ${tpl('templateBlock', 'HINTS', 'hide', '<p class="block">No hints</p>')}
    ${fb('feedbackBlock', 'SEEN', 'show', `<p class="feedback">Seen${fb('feedbackInline', 'RIGHT', 'show', ' right')}${fb('feedbackInline', 'RIGHT', 'hide', ' wrong')}</p>`)}
    ${fb('feedbackBlock', 'SEEN', 'hide', '<p class="feedback">Unseen</p>')}
    <p class="math"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>N</mi><mo>+</mo><mi>SYM</mi><mo>+</mo><mi>PLAIN</mi></math></p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Pick${tpl('templateInline', 'EASY', 'show', ' the easy one')} of <printedVariable identifier="N"/></prompt>
      <simpleChoice identifier="A" templateIdentifier="CHOICES" showHide="show">Alpha</simpleChoice>
      <simpleChoice identifier="B" templateIdentifier="CHOICES" showHide="show">Beta</simpleChoice>
      <simpleChoice identifier="C" templateIdentifier="CHOICES" showHide="hide">Gamma</simpleChoice>
      <simpleChoice identifier="D">Delta</simpleChoice>
    </choiceInteraction>
    <hottextInteraction responseIdentifier="HOT" maxChoices="2">
      <p>Find <hottext identifier="H1" templateIdentifier="CHOICES">one</hottext> and <hottext identifier="H2" templateIdentifier="CHOICES">two</hottext>.</p>
    </hottextInteraction>
  </itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="FEEDBACK">
      <multiple><baseValue baseType="identifier">SEEN</baseValue><baseValue baseType="identifier">RIGHT</baseValue></multiple>
    </setOutcomeValue>
    <setOutcomeValue identifier="MODAL">
      <multiple><baseValue baseType="identifier">SHOW</baseValue></multiple>
    </setOutcomeValue>
  </responseProcessing>
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="RIGHT" showHide="show">Modal:${fb('feedbackBlock', 'SEEN', 'show', ' seen')}${tpl('templateInline', 'EASY', 'show', ' easy')}</modalFeedback>
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="WRONG" showHide="hide">Not wrong</modalFeedback>
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="RIGHT" showHide="hide">Not right</modalFeedback>
</assessmentItem>`;

const QTI30 = convertQti2ToQti3(QTI22);

const text = (html: unknown) =>
	String(html)
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

function bodyText(presentation: ItemPresentation): string {
	return text(
		presentation.flow
			.map((node) => (node.kind === 'html' ? String(node.html) : ''))
			.join('')
	);
}

interface Choices {
	prompt: unknown;
	choices: { identifier: string }[];
}
interface Hottext {
	contentHtml: unknown;
	hottextChoices: { identifier: string }[];
}

function deliver(xml: string) {
	const session = createAssessmentItemDefinition({ itemXml: xml }).openSession();
	const before = bodyText(session.present());
	session.dispatch({ action: 'setResponses', responses: { RESPONSE: 'A' } });
	session.dispatch({ action: 'endAttempt' });
	const after = bodyText(session.present());
	session.dispose();

	const player = new Player({ itemXml: xml });
	const [choice, hottext] = player.getInteractionData() as unknown as [Choices, Hottext];
	const math = String(player.getItemBodyHtml()).match(/<math[\s\S]*<\/math>/)?.[0] ?? '';
	player.setResponses({ RESPONSE: 'A' });
	const modal = player.processResponses().modalFeedback?.map((entry) => text(entry.content));

	return {
		before,
		after,
		modal,
		math: math.replace(/\s+xmlns(:\w+)?="[^"]*"/g, ''),
		prompt: text(choice.prompt),
		choices: choice.choices.map((c) => c.identifier),
		hottext: text(hottext.contentHtml),
		hottextChoices: hottext.hottextChoices.map((c) => c.identifier),
	};
}

describe('feedback and template blocks in delivery', () => {
	test('the QTI 3.0 twin spells the constructs the QTI 3 way', () => {
		expect(QTI30).toContain('<qti-template-block template-identifier="MODE"');
		expect(QTI30).toContain('<qti-template-inline template-identifier="MODE"');
		expect(QTI30).toContain('<qti-feedback-block outcome-identifier="FEEDBACK"');
		expect(QTI30).toContain('math-variable="true"');
		expect(QTI30).toContain('<qti-simple-choice identifier="A" template-identifier="CHOICES"');
	});

	test.each([
		['QTI 2.2', QTI22],
		['QTI 3.0', QTI30],
	])('%s resolves template and feedback content by membership', (_version, xml) => {
		const delivered = deliver(xml);
		expect(delivered.before).toContain('Mode: easy hints Hint block not other Unseen');
		expect(delivered.before).not.toMatch(/hard|other Seen|No hints/);
		expect(delivered.after).toContain('Hint block not other Seen right');
		expect(delivered.after).not.toMatch(/Unseen|wrong/);
		expect(delivered.modal).toEqual(['Modal: seen easy', 'Not wrong']);
		expect(delivered.math).toBe('<math><mn>7</mn><mo>+</mo><mi>k</mi><mo>+</mo><mi>PLAIN</mi></math>');
		expect(delivered.prompt).toBe('Pick the easy one of 7');
		expect(delivered.choices).toEqual(['A', 'D']);
		expect(delivered.hottext).toBe('Find one and .');
		expect(delivered.hottextChoices).toEqual(['H1']);
	});

	test('the QTI 3.0 twin delivers the same content as the QTI 2.2 item', () => {
		expect(deliver(QTI30)).toEqual(deliver(QTI22));
	});

	test('interactions are extracted again when template values change', () => {
		const player = new Player({ itemXml: QTI30 });
		player.setTemplateVariables({ CHOICES: ['B', 'H2'], MODE: [], N: 9 });
		const [choice, hottext] = player.getInteractionData() as unknown as [Choices, Hottext];
		expect(choice.choices.map((c) => c.identifier)).toEqual(['B', 'C', 'D']);
		expect(hottext.hottextChoices.map((c) => c.identifier)).toEqual(['H2']);
		expect(text(choice.prompt)).toBe('Pick of 9');
		expect(text(player.getItemBodyHtml())).toContain('Mode: hard');
	});
});

const CONTEXT_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="context" title="Context"
  adaptive="false" time-dependent="false">
  <qti-context-declaration identifier="LEVEL" cardinality="single" base-type="identifier">
    <qti-default-value><qti-value>BASIC</qti-value></qti-default-value>
  </qti-context-declaration>
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="CANDIDATE" cardinality="single" base-type="string"/>
  <qti-template-declaration identifier="MODE" cardinality="single" base-type="identifier"/>
  <qti-template-processing>
    <qti-set-template-value identifier="MODE"><qti-variable identifier="LEVEL"/></qti-set-template-value>
  </qti-template-processing>
  <qti-item-body>
    <p>Level:<qti-template-inline template-identifier="MODE" identifier="BASIC" show-hide="show"> basic</qti-template-inline><qti-template-inline template-identifier="MODE" identifier="ADVANCED" show-hide="show"> advanced</qti-template-inline></p>
  </qti-item-body>
  <qti-response-processing>
    <qti-set-outcome-value identifier="CANDIDATE">
      <qti-field-value field-identifier="candidateIdentifier"><qti-variable identifier="QTI_CONTEXT"/></qti-field-value>
    </qti-set-outcome-value>
  </qti-response-processing>
</qti-assessment-item>`;

describe('context variables in delivery', () => {
	test('a declared context variable takes its default and feeds template processing', () => {
		const player = new Player({ itemXml: CONTEXT_ITEM });
		expect(text(player.getItemBodyHtml())).toBe('Level: basic');
	});

	test('host context values reach template and response processing, and survive save and restore', () => {
		const definition = createAssessmentItemDefinition({ itemXml: CONTEXT_ITEM });
		const session = definition.openSession({
			contextVariables: { LEVEL: 'ADVANCED', QTI_CONTEXT: { candidateIdentifier: 'cand-42' } },
		});
		expect(bodyText(session.present())).toBe('Level: advanced');
		session.dispatch({ action: 'endAttempt' });
		expect(session.state().outcomes.CANDIDATE).toBe('cand-42');

		const saved = session.serialize();
		expect(Object.keys(saved.contextVariables ?? {})).toEqual(expect.arrayContaining(['LEVEL', 'QTI_CONTEXT']));
		session.dispose();
		const restored = definition.openSession({ restore: saved });
		expect(bodyText(restored.present())).toBe('Level: advanced');
		restored.dispose();
	});
});
