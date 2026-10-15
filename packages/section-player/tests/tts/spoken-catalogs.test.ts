import { describe, expect, test } from 'bun:test';
import { DOMParser } from 'linkedom';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { extractItemSpeech, prepareReadableBlock } from '../../src/tts/spoken-catalogs';

const parser = DOMParser as unknown as typeof globalThis.DOMParser;
// linkedom has no XMLSerializer; its nodes serialize themselves.
class serializer {
	serializeToString(node: Node) {
		return String(node);
	}
}

const APIP = 'http://www.imsglobal.org/xsd/apip/apipv1p0/imsapip_qtiv1p0';

const BASE_ITEM = (prompt: string, extra = '') => `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:apip="${APIP}" identifier="spoken-1">
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      ${prompt}
      <simpleChoice identifier="A">Alpha</simpleChoice>
    </choiceInteraction>
  </itemBody>${extra}
</assessmentItem>`;

const APIP_ITEM = BASE_ITEM(
	'<prompt id="prompt">Pick the NaCl sample.</prompt>',
	`
  <apip:apipAccessibility>
    <apip:accessibilityInfo>
      <apip:accessElement identifier="ae-prompt">
        <apip:contentLinkInfo qtiLinkIdentifierRef="prompt"><apip:textLink><apip:fullString/></apip:textLink></apip:contentLinkInfo>
        <apip:relatedElementInfo>
          <apip:spoken><apip:spokenText>Pick the sodium chloride sample.</apip:spokenText></apip:spoken>
        </apip:relatedElementInfo>
      </apip:accessElement>
    </apip:accessibilityInfo>
  </apip:apipAccessibility>`,
);

const NATIVE_ITEM = convertQti2ToQti3(BASE_ITEM('<prompt>Pick the NaCl sample.</prompt>'))
	.replace('<qti-prompt>', '<qti-prompt data-catalog-idref="ae-prompt">')
	.replace(
		'</qti-item-body>',
		`</qti-item-body>
  <qti-catalog-info>
    <qti-catalog id="ae-prompt">
      <qti-card support="spoken"><qti-html-content>Pick the sodium chloride sample.</qti-html-content></qti-card>
      <qti-card support="glossary-on-screen"><qti-html-content>Table salt.</qti-html-content></qti-card>
    </qti-catalog>
  </qti-catalog-info>`,
	);

describe.each([
	['QTI 2.2 APIP', APIP_ITEM],
	['QTI 3.0 catalog', NATIVE_ITEM],
])('extractItemSpeech authored spoken cards (%s)', (_version, xml) => {
	const speech = extractItemSpeech(xml, { DOMParserImpl: parser, XMLSerializerImpl: serializer });

	test('returns the spoken cards under the catalog identifier', () => {
		expect(speech.catalogs).toEqual([
			{ identifier: 'ae-prompt', cards: [{ catalog: 'spoken', content: 'Pick the sodium chloride sample.' }] },
		]);
	});
});

const READ_ALOUD_ITEM = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:ssml="http://www.w3.org/2010/10/synthesis" identifier="read-aloud">
	<itemBody>
		<p>Water is <ssml:sub alias="water">H2O</ssml:sub>.</p>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<prompt data-ssml="&lt;speak&gt;Pick one&lt;/speak&gt;">Choose one.</prompt>
			<simpleChoice identifier="A" data-ssml="&lt;speak&gt;Ay&lt;/speak&gt;">A</simpleChoice>
			<simpleChoice identifier="B" data-qti-suppress-tts="computer-read-aloud">photosynthesis</simpleChoice>
			<simpleChoice identifier="C" data-qti-suppress-tts="screen-reader">Carbon</simpleChoice>
			<simpleChoice identifier="D" class="qti-hidden">Decoy</simpleChoice>
		</choiceInteraction>
	</itemBody>
</assessmentItem>`;

describe.each([
	['QTI 2.2', READ_ALOUD_ITEM],
	['QTI 3.0', convertQti2ToQti3(READ_ALOUD_ITEM)],
])('extractItemSpeech SSML cards (%s)', (_version, xml) => {
	test('returns the cards under the idrefs the item player docks', () => {
		expect(extractItemSpeech(xml, { DOMParserImpl: parser }).catalogs).toEqual([
			{ identifier: 'ssml-1', cards: [{ catalog: 'spoken', content: '<speak>Pick one</speak>' }] },
			{ identifier: 'ssml-2', cards: [{ catalog: 'spoken', content: '<speak>Ay</speak>' }] },
			{
				identifier: 'ssml-3',
				cards: [{ catalog: 'spoken', content: '<speak>Water is <sub alias="water">H2O</sub>.</speak>' }],
			},
		]);
	});
});

const SPANISH_ITEM = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="es-item" xml:lang="es">
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<prompt>Elige la palabra inglesa.</prompt>
			<simpleChoice identifier="A">gato</simpleChoice>
			<simpleChoice identifier="B" xml:lang="en">cat</simpleChoice>
		</choiceInteraction>
	</itemBody>
</assessmentItem>`;

describe.each([
	['QTI 2.2', SPANISH_ITEM],
	['QTI 3.0', convertQti2ToQti3(SPANISH_ITEM)],
])('extractItemSpeech content language (%s)', (_version, xml) => {
	test('returns the language the item declares', () => {
		expect(extractItemSpeech(xml, { DOMParserImpl: parser }).language).toBe('es');
	});

	test('an item without xml:lang declares no language', () => {
		expect(extractItemSpeech(xml.replace(' xml:lang="es"', ''), { DOMParserImpl: parser }).language).toBeUndefined();
	});
});

describe('prepareReadableBlock', () => {
	test('docks data-ssml and inline SSML under generated idrefs', () => {
		const block = prepareReadableBlock(
			'<p data-ssml="&lt;speak&gt;NaCl is &lt;sub alias=&quot;sodium chloride&quot;&gt;NaCl&lt;/sub&gt;&lt;/speak&gt;">NaCl is salt.<br></p><p>The <ssml:sub alias="World Wide Web">WWW</ssml:sub> grew.</p>',
		);
		expect(block.html).toBe(
			'<p data-ssml="&lt;speak&gt;NaCl is &lt;sub alias=&quot;sodium chloride&quot;&gt;NaCl&lt;/sub&gt;&lt;/speak&gt;" data-catalog-idref="ssml-1">NaCl is salt.<br></p><p data-catalog-idref="ssml-2">The WWW grew.</p>',
		);
		expect(block.catalogs).toEqual([
			{ identifier: 'ssml-1', cards: [{ catalog: 'spoken', content: '<speak>NaCl is <sub alias="sodium chloride">NaCl</sub></speak>' }] },
			{ identifier: 'ssml-2', cards: [{ catalog: 'spoken', content: '<speak>The <sub alias="World Wide Web">WWW</sub> grew.</speak>' }] },
		]);
	});

	test('leaves markup without SSML as it is', () => {
		expect(prepareReadableBlock('<p class="qti-hidden">Plain</p>')).toEqual({
			html: '<p class="qti-hidden">Plain</p>',
			catalogs: [],
		});
	});
});
