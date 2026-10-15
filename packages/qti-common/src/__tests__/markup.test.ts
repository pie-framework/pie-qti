/**
 * Content markup preparation
 *
 * Read-aloud markup in QTI 2.2 and QTI 3.0 content: SSML docked under generated catalog idrefs and
 * unwrapped from the visible body, `data-qti-suppress-tts` restated as `data-tts-suppress`, and the
 * hiding classes left to a stylesheet when delivery ships one.
 */

import { describe, expect, test } from 'bun:test';
import { prepareContentMarkup } from '../accessibility/index.js';
import { convertQti2ToQti3 } from '../element-mapper/qti2-to-qti3.js';

const ITEM = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:ssml="http://www.w3.org/2010/10/synthesis" identifier="tts" title="TTS" adaptive="false" timeDependent="false">
<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
<itemBody>
<p>Water is <ssml:sub alias="water">H2O</ssml:sub>.</p>
<p data-qti-suppress-tts="computer-read-aloud">Answer word</p>
<p class="qti-hidden">Hidden</p>
<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
<prompt data-ssml="&lt;speak&gt;Pick one&lt;/speak&gt;">Choose</prompt>
<simpleChoice identifier="A" data-ssml="&lt;speak&gt;Ay&lt;/speak&gt;">A</simpleChoice>
</choiceInteraction>
</itemBody>
</assessmentItem>`;

describe.each([
	['QTI 2.2', ITEM],
	['QTI 3.0', convertQti2ToQti3(ITEM)],
])('prepareContentMarkup (%s)', (_version, xml) => {
	const prepared = prepareContentMarkup(xml, [], { hidingStyles: false });

	test('docks SSML under generated idrefs and unwraps it from the visible body', () => {
		expect(prepared.spoken).toEqual([
			{ identifier: 'ssml-1', content: '<speak>Pick one</speak>' },
			{ identifier: 'ssml-2', content: '<speak>Ay</speak>' },
			{ identifier: 'ssml-3', content: '<speak>Water is <sub alias="water">H2O</sub>.</speak>' },
		]);
		expect(prepared.xml).toContain('<p data-catalog-idref="ssml-3">Water is H2O.</p>');
		expect(prepared.xml).toContain('data-catalog-idref="ssml-1">Choose</');
		expect(prepared.xml).toContain('<span data-catalog-idref="ssml-2">A</span>');
		expect(prepared.xml).not.toContain('ssml:sub');
	});

	test('restates read-aloud suppression', () => {
		expect(prepared.xml).toContain('data-tts-suppress="computer-read-aloud">Answer word</p>');
	});

	test('leaves the hiding classes to the stylesheet when asked', () => {
		expect(prepared.xml).toContain('<p class="qti-hidden">Hidden</p>');
		expect(prepareContentMarkup(xml).xml).toContain('style="display:none"');
	});

	test('generates the same idrefs on every run', () => {
		expect(prepareContentMarkup(xml, [], { hidingStyles: false })).toEqual(prepared);
	});
});
