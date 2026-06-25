import { describe, expect, test } from 'bun:test';
import { DOMParser } from 'linkedom';
import { extractReadableInteractionSpeechHtml } from '../../src/tts/readable-interaction-projection';

const parser = DOMParser as unknown as typeof globalThis.DOMParser;

describe('extractReadableInteractionSpeechHtml', () => {
	test('extracts readable prompts and options from common QTI interactions', () => {
		const html = extractReadableInteractionSpeechHtml(
			`<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="sample">
				<itemBody>
					<choiceInteraction responseIdentifier="CHOICE">
						<prompt>Choose the best option.</prompt>
						<simpleChoice identifier="A">Alpha</simpleChoice>
						<simpleChoice identifier="B"><math><mi>x</mi></math> beta</simpleChoice>
					</choiceInteraction>
					<orderInteraction responseIdentifier="ORDER">
						<prompt>Order the steps.</prompt>
						<simpleChoice identifier="first">First step</simpleChoice>
						<simpleChoice identifier="second">Second step</simpleChoice>
					</orderInteraction>
					<matchInteraction responseIdentifier="MATCH">
						<prompt>Match each term.</prompt>
						<simpleMatchSet>
							<simpleAssociableChoice identifier="left1" matchMax="1">Term one</simpleAssociableChoice>
						</simpleMatchSet>
						<simpleMatchSet>
							<simpleAssociableChoice identifier="right1" matchMax="1">Definition one</simpleAssociableChoice>
						</simpleMatchSet>
					</matchInteraction>
					<gapMatchInteraction responseIdentifier="GAP">
						<prompt>Fill the gaps.</prompt>
						<gapText identifier="g1" matchMax="1">photosynthesis</gapText>
					</gapMatchInteraction>
					<p>The <inlineChoiceInteraction responseIdentifier="INLINE"><inlineChoice identifier="c1">red</inlineChoice><inlineChoice identifier="c2">blue</inlineChoice></inlineChoiceInteraction> bird flew.</p>
					<hottextInteraction responseIdentifier="HOT">
						<prompt>Select the phrase.</prompt>
						<p><hottext identifier="h1">important phrase</hottext></p>
					</hottextInteraction>
					<uploadInteraction responseIdentifier="UPLOAD">
						<prompt>Upload your work.</prompt>
					</uploadInteraction>
				</itemBody>
			</assessmentItem>`,
			{ DOMParserImpl: parser },
		);

		expect(html).toContain('Choose the best option.');
		expect(html).toContain('Alpha');
		expect(html).toContain('<math><mi>x</mi></math> beta');
		expect(html).toContain('Order the steps.');
		expect(html).toContain('First step');
		expect(html).toContain('Match each term.');
		expect(html).toContain('Term one');
		expect(html).toContain('Definition one');
		expect(html).toContain('Fill the gaps.');
		expect(html).toContain('photosynthesis');
		expect(html).toContain('red');
		expect(html).toContain('blue');
		expect(html).toContain('Select the phrase.');
		expect(html).toContain('important phrase');
		expect(html).toContain('Upload your work.');
	});

	test('returns empty markup for items with no readable interaction content', () => {
		const html = extractReadableInteractionSpeechHtml(
			`<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="sample">
				<itemBody><p>Standalone prompt only.</p></itemBody>
			</assessmentItem>`,
			{ DOMParserImpl: parser },
		);

		expect(html).toBe('');
	});
});
