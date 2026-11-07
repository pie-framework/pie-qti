/**
 * The item body is an ordered content model: every interaction renders where it was authored,
 * interleaved with the authored content around it, in either QTI version.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { type HTMLElement as ParsedElement, parse } from 'node-html-parser';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';
import {
	INTERACTION_SLOT_ATTRIBUTE,
	type ItemInteractionMount,
	type ItemPresentation,
} from '../../src/presentation/itemPresentationPlan.js';

const PARTS_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="parts" title="Parts" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="PART_A" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="PART_B" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="BLANK_1" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="BLANK_2" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="LAYOUT" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="CELL" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p>Part A text</p>
    <choiceInteraction responseIdentifier="PART_A" maxChoices="1">
      <prompt>Pick one.</prompt>
      <simpleChoice identifier="A">Alpha</simpleChoice>
      <simpleChoice identifier="B">Beta</simpleChoice>
    </choiceInteraction>
    <p>Part B text</p>
    <extendedTextInteraction responseIdentifier="PART_B"/>
    <p>Text after Part B</p>
    <p>Fill <textEntryInteraction responseIdentifier="BLANK_1" expectedLength="8"/> and <inlineChoiceInteraction responseIdentifier="BLANK_2"><inlineChoice identifier="X">X</inlineChoice><inlineChoice identifier="Y">Y</inlineChoice></inlineChoiceInteraction> here.</p>
    <p>A separate paragraph.</p>
    <div class="qti-layout-row">
      <div class="qti-layout-col6"><p>Left column</p></div>
      <div class="qti-layout-col6"><extendedTextInteraction responseIdentifier="LAYOUT"/></div>
    </div>
    <table><tbody><tr><td>Cell text</td><td><choiceInteraction responseIdentifier="CELL" maxChoices="1"><simpleChoice identifier="C">C</simpleChoice></choiceInteraction></td></tr></tbody></table>
    <p>The end</p>
  </itemBody>
</assessmentItem>`;

const VERSIONS = [
	['QTI 2.2', PARTS_ITEM],
	['QTI 3.0', convertQti2ToQti3(PARTS_ITEM)],
] as const;

function openSession(itemXml: string): ItemSession {
	return createAssessmentItemDefinition({ itemXml }).openSession();
}

function bodyHtml(presentation: ItemPresentation): string {
	const nodes = presentation.flow.filter((node) => node.kind === 'html');
	expect(nodes).toHaveLength(1);
	const [node] = nodes;
	return node?.kind === 'html' ? String(node.html) : '';
}

function mounts(presentation: ItemPresentation): ItemInteractionMount[] {
	return presentation.flow.flatMap((node) => (node.kind === 'interaction' ? [node.mount] : []));
}

function mountFor(presentation: ItemPresentation, responseId: string): ItemInteractionMount {
	const mount = mounts(presentation).find((entry) => entry.interaction.responseId === responseId);
	if (!mount) throw new Error(`no mount for ${responseId}`);
	return mount;
}

function slotElement(root: ParsedElement, slot: string | null): ParsedElement {
	const element = root.querySelector(`[${INTERACTION_SLOT_ATTRIBUTE}="${slot}"]`);
	if (!element) throw new Error(`no slot ${slot}`);
	return element;
}

describe.each(VERSIONS)('authored interaction order (%s)', (_version, itemXml) => {
	test('block interactions sit between the content they were authored between', () => {
		const session = openSession(itemXml);
		try {
			const presentation = session.present();
			const html = bodyHtml(presentation);
			const at = (text: string) => {
				const index = html.indexOf(text);
				expect(index).toBeGreaterThanOrEqual(0);
				return index;
			};
			const slotAt = (responseId: string) =>
				at(`${INTERACTION_SLOT_ATTRIBUTE}="${mountFor(presentation, responseId).slot}"`);

			expect(at('Part A text')).toBeLessThan(slotAt('PART_A'));
			expect(slotAt('PART_A')).toBeLessThan(at('Part B text'));
			expect(at('Part B text')).toBeLessThan(slotAt('PART_B'));
			expect(slotAt('PART_B')).toBeLessThan(at('Text after Part B'));
			expect(slotAt('CELL')).toBeLessThan(at('The end'));
		} finally {
			session.dispose();
		}
	});

	test('mounts follow document order and every interaction has a slot', () => {
		const session = openSession(itemXml);
		try {
			const presentation = session.present();
			expect(presentation.flow[0]?.kind).toBe('html');
			expect(mounts(presentation).map((mount) => [mount.interaction.responseId, mount.slot])).toEqual([
				['PART_A', '0'],
				['PART_B', '1'],
				['BLANK_1', '2'],
				['BLANK_2', '3'],
				['LAYOUT', '4'],
				['CELL', '5'],
			]);
			// The interaction markup itself is gone: its slot is all that is left of it.
			expect(bodyHtml(presentation)).not.toMatch(/<\/?(?:[a-z]+Interaction|qti-[a-z-]+-interaction)[\s/>]/i);
		} finally {
			session.dispose();
		}
	});

	test('interactions inside layout columns and table cells mount inside them', () => {
		const session = openSession(itemXml);
		try {
			const presentation = session.present();
			const root = parse(bodyHtml(presentation));
			const layoutSlot = slotElement(root, mountFor(presentation, 'LAYOUT').slot);
			expect(layoutSlot.parentNode?.getAttribute('class')).toBe('qti-layout-col6');
			expect(layoutSlot.getAttribute('class')).toContain('qti-interaction-slot--block');
			const cellSlot = slotElement(root, mountFor(presentation, 'CELL').slot);
			expect(cellSlot.parentNode?.rawTagName.toLowerCase()).toBe('td');
		} finally {
			session.dispose();
		}
	});

	test('a paragraph with inline interactions stays one paragraph and its neighbours stay separate', () => {
		const session = openSession(itemXml);
		try {
			const presentation = session.present();
			const root = parse(bodyHtml(presentation));
			const paragraphs = root.querySelectorAll('p');
			expect(paragraphs.map((p) => p.text.replace(/\s+/g, ' ').trim())).toEqual([
				'Part A text',
				'Part B text',
				'Text after Part B',
				'Fill and here.',
				'A separate paragraph.',
				'Left column',
				'The end',
			]);
			const blanks = paragraphs[3];
			const inlineSlots = blanks?.querySelectorAll(`[${INTERACTION_SLOT_ATTRIBUTE}]`) ?? [];
			expect(inlineSlots.map((slot) => slot.getAttribute(INTERACTION_SLOT_ATTRIBUTE))).toEqual([
				mountFor(presentation, 'BLANK_1').slot,
				mountFor(presentation, 'BLANK_2').slot,
			]);
			for (const slot of inlineSlots) {
				expect(slot.rawTagName).toBe('span');
				expect(slot.getAttribute('class')).toContain('qti-interaction-slot--inline');
			}
		} finally {
			session.dispose();
		}
	});

	test('inline interactions are numbered across the item in document order', () => {
		const session = openSession(itemXml);
		try {
			const presentation = session.present();
			expect(mountFor(presentation, 'BLANK_1')).toMatchObject({
				placement: 'inline',
				renderer: 'text-entry',
				position: { index: 1, count: 2 },
			});
			expect(mountFor(presentation, 'BLANK_2')).toMatchObject({
				placement: 'inline',
				renderer: 'inline-choice',
				position: { index: 2, count: 2 },
			});
		} finally {
			session.dispose();
		}
	});

	test('a response change leaves the body markup, slots and mount keys as they were', () => {
		const session = openSession(itemXml);
		try {
			const before = session.present();
			session.dispatch({ action: 'setResponse', responseIdentifier: 'BLANK_1', value: 'typed' });
			session.dispatch({ action: 'setResponse', responseIdentifier: 'PART_A', value: 'B' });
			const after = session.present();
			expect(bodyHtml(after)).toBe(bodyHtml(before));
			expect(mounts(after).map((mount) => [mount.key, mount.slot])).toEqual(
				mounts(before).map((mount) => [mount.key, mount.slot])
			);
			expect(mountFor(after, 'PART_A')).toMatchObject({ response: 'B' });
		} finally {
			session.dispose();
		}
	});
});

describe('authored interaction order: containers, feedback and safety', () => {
	const item = (body: string, declarations = '') => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="slots" title="Slots" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  ${declarations}
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
  <itemBody>${body}</itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">shown</baseValue></setOutcomeValue>
  </responseProcessing>
</assessmentItem>`;

	test('feedback shown after response processing keeps its authored place around the interactions', () => {
		const session = openSession(
			item(`<p>Question</p>
			<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction>
			<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="shown" showHide="show"><p>Feedback text</p></feedbackBlock>
			<p>Closing text</p>`)
		);
		try {
			expect(bodyHtml(session.present())).not.toContain('Feedback text');
			session.dispatch({ action: 'endAttempt' });
			const presentation = session.present();
			const html = bodyHtml(presentation);
			const slot = html.indexOf(`${INTERACTION_SLOT_ATTRIBUTE}="${mountFor(presentation, 'RESPONSE').slot}"`);
			expect(html.indexOf('Question')).toBeLessThan(slot);
			expect(slot).toBeLessThan(html.indexOf('Feedback text'));
			expect(html.indexOf('Feedback text')).toBeLessThan(html.indexOf('Closing text'));
		} finally {
			session.dispose();
		}
	});

	test('a position object stage is replaced as a unit by the slot of its interaction', () => {
		const session = openSession(
			item(
				`<p>Place it.</p>
				<positionObjectStage><object type="image/png" data="stage.png" width="100" height="100"/>
					<positionObjectInteraction responseIdentifier="POINT" maxChoices="1"><object type="image/png" data="pin.png" width="10" height="10"/></positionObjectInteraction>
				</positionObjectStage>
				<p>After the stage.</p>`,
				'<responseDeclaration identifier="POINT" cardinality="single" baseType="point"/>'
			)
		);
		try {
			const presentation = session.present();
			const html = bodyHtml(presentation);
			const mount = mountFor(presentation, 'POINT');
			expect(mount.slot).not.toBeNull();
			expect(html).not.toContain('stage.png');
			expect(html.indexOf('Place it.')).toBeLessThan(html.indexOf(`${INTERACTION_SLOT_ATTRIBUTE}="${mount.slot}"`));
			expect(html.indexOf(`${INTERACTION_SLOT_ATTRIBUTE}="${mount.slot}"`)).toBeLessThan(html.indexOf('After the stage.'));
		} finally {
			session.dispose();
		}
	});

	test('authored slot attributes cannot redirect where an interaction mounts', () => {
		const session = openSession(
			item(`<p ${INTERACTION_SLOT_ATTRIBUTE}="0">Decoy</p>
			<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction>`)
		);
		try {
			const root = parse(bodyHtml(session.present()));
			const slots = root.querySelectorAll(`[${INTERACTION_SLOT_ATTRIBUTE}]`);
			expect(slots).toHaveLength(1);
			expect(slots[0]?.rawTagName).toBe('span');
		} finally {
			session.dispose();
		}
	});

	test('the composed body is sanitized after slots are placed', () => {
		const session = openSession(
			item(`<p onclick="alert(1)">Pick <inlineChoiceInteraction responseIdentifier="RESPONSE"><inlineChoice identifier="A">A</inlineChoice></inlineChoiceInteraction> now</p>`)
		);
		try {
			const presentation = session.present();
			const html = bodyHtml(presentation);
			expect(html).not.toContain('onclick');
			expect(html).toContain(`${INTERACTION_SLOT_ATTRIBUTE}="${mountFor(presentation, 'RESPONSE').slot}"`);
		} finally {
			session.dispose();
		}
	});
});
