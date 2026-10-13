/**
 * APIP accessibility
 *
 * Access elements read from APIP map to catalog cards under QTI 3's support names, and cards
 * written back as APIP read the same; what APIP cannot hold is reported by support.
 */

import { describe, expect, test } from 'bun:test';
import {
	type ApipAccessElementSource,
	type CatalogCard,
	readApipAccessElements,
	writeApipAccessibility,
} from '../accessibility/index.js';

const APIP = 'http://www.imsglobal.org/xsd/apip/apipv1p0/imsapip_qtiv1p0';

const ITEM = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:apip="${APIP}" xmlns:ssml="http://www.w3.org/2001/10/synthesis" identifier="apip-1">
  <itemBody><p id="stem">Ecologists say the count is accurate.</p><img id="map" src="map.png" alt="map"/></itemBody>
  <apip:apipAccessibility>
    <apip:accessibilityInfo>
      <apip:accessElement identifier="ae-stem">
        <apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:textLink><apip:fullString/></apip:textLink></apip:contentLinkInfo>
        <apip:relatedElementInfo>
          <apip:spoken>
            <apip:audioFileInfo contentLinkIdentifier="a1" mimeType="audio/mpeg"><apip:fileHref>https://media.example.com/stem.mp3</apip:fileHref><apip:startTime>00:00:01.5</apip:startTime><apip:duration>00:00:02.25</apip:duration></apip:audioFileInfo>
            <apip:spokenText contentLinkIdentifier="s1">Ecologists say the count is accurate.</apip:spokenText>
            <apip:textToSpeechPronunciation contentLinkIdentifier="t1">Ecologists say the count is ack-yur-it.</apip:textToSpeechPronunciation>
            <apip:textToSpeechPronunciationSSML>Ecologists say the count is <ssml:emphasis>accurate</ssml:emphasis>.</apip:textToSpeechPronunciationSSML>
          </apip:spoken>
          <apip:brailleText><apip:brailleTextString contentLinkIdentifier="b1">⠑⠉⠕</apip:brailleTextString></apip:brailleText>
          <apip:signing>
            <apip:signFileASL><apip:videoFileInfo contentLinkIdentifier="v1" mimeType="video/mp4"><apip:fileHref>https://media.example.com/asl.mp4</apip:fileHref><apip:startCue>00:00:03</apip:startCue><apip:endCue>00:00:07.5</apip:endCue></apip:videoFileInfo></apip:signFileASL>
          </apip:signing>
          <apip:guidance>
            <apip:languageLearnerSupport><apip:supportOrder>1</apip:supportOrder><apip:textString contentLinkIdentifier="g1">Accurate means correct &amp; exact.</apip:textString></apip:languageLearnerSupport>
            <apip:cognitiveGuidanceSupport><apip:supportOrder>1</apip:supportOrder><apip:textString contentLinkIdentifier="g2">Read slowly.</apip:textString></apip:cognitiveGuidanceSupport>
          </apip:guidance>
          <apip:revealAlternativeRepresentation><apip:textString>Unused</apip:textString></apip:revealAlternativeRepresentation>
        </apip:relatedElementInfo>
      </apip:accessElement>
      <apip:accessElement identifier="ae-word">
        <apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:textLink><apip:wordLink>6</apip:wordLink></apip:textLink></apip:contentLinkInfo>
        <apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:textLink><apip:characterStringLink><apip:startCharacter>1</apip:startCharacter><apip:stopCharacter>10</apip:stopCharacter></apip:characterStringLink></apip:textLink></apip:contentLinkInfo>
        <apip:relatedElementInfo>
          <apip:keyWordTranslation>
            <apip:definitionId xml:lang="es"><apip:textString contentLinkIdentifier="k1">exacto</apip:textString></apip:definitionId>
          </apip:keyWordTranslation>
        </apip:relatedElementInfo>
      </apip:accessElement>
      <apip:accessElement identifier="ae-map">
        <apip:contentLinkInfo qtiLinkIdentifierRef="map"><apip:objectLink/></apip:contentLinkInfo>
        <apip:relatedElementInfo>
          <apip:tactileFile>
            <apip:tactileAudioFile contentLinkIdentifier="ta1" mimeType="audio/mpeg"><apip:fileHref>https://media.example.com/map.mp3</apip:fileHref></apip:tactileAudioFile>
            <apip:tactileAudioText contentLinkIdentifier="tt1">Raised lines mark the rivers.</apip:tactileAudioText>
            <apip:tactileBrailleText contentLinkIdentifier="tb1">⠗⠊⠧</apip:tactileBrailleText>
          </apip:tactileFile>
        </apip:relatedElementInfo>
      </apip:accessElement>
    </apip:accessibilityInfo>
  </apip:apipAccessibility>
</assessmentItem>`;

function audio(src: string, fragment?: { startSeconds: number; endSeconds?: number }): CatalogCard['payload'] {
	return {
		media: { version: 1, id: src, kind: 'audio', sources: [{ src, type: 'audio/mpeg' }] },
		...(fragment ? { fragment } : {}),
	};
}

function video(src: string, fragment?: { startSeconds: number; endSeconds?: number }): CatalogCard['payload'] {
	return {
		media: { version: 1, id: src, kind: 'video', sources: [{ src, type: 'video/mp4' }] },
		...(fragment ? { fragment } : {}),
	};
}

function element(cards: CatalogCard[], identifier = 'term'): ApipAccessElementSource {
	return { identifier, links: [{ target: 'stem' }], cards };
}

describe('readApipAccessElements', () => {
	const [stem, word, map] = readApipAccessElements(ITEM);

	test('maps each support to cards under the QTI 3 support names', () => {
		expect(stem?.identifier).toBe('ae-stem');
		expect(stem?.cards).toEqual([
			{ catalog: 'spoken', content: '<speak>Ecologists say the count is <emphasis>accurate</emphasis>.</speak>' },
			{ catalog: 'ext:custom-text-to-speech-pronunciation', content: 'Ecologists say the count is ack-yur-it.' },
			{ catalog: 'ext:custom-spoken-text', content: 'Ecologists say the count is accurate.' },
			{ catalog: 'spoken', payload: audio('https://media.example.com/stem.mp3', { startSeconds: 1.5, endSeconds: 3.75 }) },
			{ catalog: 'braille', content: '⠑⠉⠕' },
			{
				catalog: 'sign-language',
				language: 'ase',
				payload: video('https://media.example.com/asl.mp4', { startSeconds: 3, endSeconds: 7.5 }),
			},
			{ catalog: 'linguistic-guidance', content: 'Accurate means correct &amp; exact.' },
		]);
		expect(word?.cards).toEqual([{ catalog: 'keyword-translation', language: 'es', content: 'exacto' }]);
		expect(map?.cards).toEqual([
			{ catalog: 'tactile', content: 'Raised lines mark the rivers.' },
			{ catalog: 'tactile', payload: audio('https://media.example.com/map.mp3') },
			{ catalog: 'ext:custom-tactile-braille-text', content: '⠗⠊⠧' },
		]);
	});

	test('reports the supports QTI 3 has no counterpart for', () => {
		expect(stem?.unmapped).toEqual(['cognitiveGuidanceSupport', 'revealAlternativeRepresentation']);
		expect(word?.unmapped).toEqual([]);
	});

	test('reads whole-element, word, character and object links', () => {
		expect(stem?.links).toEqual([{ target: 'stem' }]);
		expect(word?.links).toEqual([
			{ target: 'stem', range: { unit: 'word', start: 6, stop: 6 } },
			{ target: 'stem', range: { unit: 'character', start: 1, stop: 10 } },
		]);
		expect(map?.links).toEqual([{ target: 'map', object: true }]);
	});

	test('reads access elements inside CDATA', () => {
		const wrapped = ITEM.replace('<apip:apipAccessibility>', '<![CDATA[<apip:apipAccessibility>').replace(
			'</apip:apipAccessibility>',
			'</apip:apipAccessibility>]]>'
		);
		expect(readApipAccessElements(wrapped).map((read) => read.identifier)).toEqual(['ae-stem', 'ae-word', 'ae-map']);
	});
});

describe('writeApipAccessibility', () => {
	test('writes cards that read back as the same cards and links', () => {
		const elements = readApipAccessElements(ITEM);
		const { xml, unwritten } = writeApipAccessibility(elements);
		expect(unwritten.size).toBe(0);
		const reread = readApipAccessElements(`<assessmentItem>${xml}</assessmentItem>`);
		expect(reread.map(({ identifier, links, cards }) => ({ identifier, links, cards }))).toEqual(
			elements.map(({ identifier, links, cards }) => ({ identifier, links, cards }))
		);
	});

	test('declares the SSML namespace only when it writes SSML', () => {
		const spoken = writeApipAccessibility([element([{ catalog: 'spoken', content: '<speak>water</speak>' }])]);
		expect(spoken.xml).toStartWith(
			`<apip:apipAccessibility xmlns:apip="${APIP}" xmlns:ssml="http://www.w3.org/2001/10/synthesis">`
		);
		const braille = writeApipAccessibility([element([{ catalog: 'braille', content: '⠺⠁⠞' }])]);
		expect(braille.xml).toStartWith(`<apip:apipAccessibility xmlns:apip="${APIP}">`);
	});

	test('prefixes the SSML elements APIP admits and unwraps the others', () => {
		const { xml } = writeApipAccessibility([
			element([
				{
					catalog: 'spoken',
					content:
						'<speak xmlns="http://www.w3.org/2001/10/synthesis">Say <sub alias="H 2 O">H2O</sub><break time="300ms"/> <lang xml:lang="fr">eau</lang> &amp; more</speak>',
				},
			]),
		]);
		expect(xml).toContain(
			'<apip:textToSpeechPronunciationSSML>Say <ssml:sub alias="H 2 O">H2O</ssml:sub><ssml:break time="300ms"/> eau &amp; more</apip:textToSpeechPronunciationSSML>'
		);
	});

	test('writes a plain-text spoken card as the pronunciation, then as the spoken text', () => {
		const { xml, unwritten } = writeApipAccessibility([
			element([
				{ catalog: 'spoken', content: '<p>first</p>' },
				{ catalog: 'spoken', content: 'second' },
				{ catalog: 'spoken', content: 'third' },
			]),
		]);
		expect(xml).toContain(
			'<apip:spoken><apip:spokenText contentLinkIdentifier="term-1">second</apip:spokenText><apip:textToSpeechPronunciation contentLinkIdentifier="term-2">first</apip:textToSpeechPronunciation></apip:spoken>'
		);
		expect(unwritten.get('term')).toEqual(['spoken']);
	});

	test('names the supports it does not write', () => {
		const { xml, unwritten } = writeApipAccessibility([
			element([
				{ catalog: 'glossary-on-screen', content: 'H<sub>2</sub>O' },
				{ catalog: 'braille', content: '⠺⠁⠞' },
				{ catalog: 'keyword-translation', content: 'agua' },
				{ catalog: 'linguistic-guidance', content: 'one' },
				{ catalog: 'linguistic-guidance', content: 'two' },
				{ catalog: 'sign-language', language: 'bfi', payload: video('https://media.example.com/bsl.mp4') },
				{
					catalog: 'spoken',
					payload: {
						media: {
							version: 1,
							id: 'clip',
							kind: 'audio',
							sources: [{ src: 'https://media.example.com/clip' }],
						},
					},
				},
			]),
		]);
		expect(unwritten.get('term')).toEqual([
			'glossary-on-screen',
			'spoken',
			'sign-language',
			'keyword-translation',
			'linguistic-guidance',
		]);
		expect(xml).toContain('<apip:brailleText>');
		expect(xml).toContain('<apip:guidance><apip:languageLearnerSupport><apip:supportOrder>1</apip:supportOrder>');
	});

	test('leaves out a tactile file without its text', () => {
		const { xml, unwritten } = writeApipAccessibility([
			element([
				{ catalog: 'tactile', payload: audio('https://media.example.com/map.mp3') },
				{ catalog: 'ext:custom-tactile-braille-text', content: '⠗⠊⠧' },
			]),
		]);
		expect(xml).toBeUndefined();
		expect(unwritten.get('term')).toEqual(['tactile', 'ext:custom-tactile-braille-text']);
	});

	test('takes a MIME type from the extension when the source declares none', () => {
		const { xml } = writeApipAccessibility([
			element([
				{
					catalog: 'spoken',
					payload: {
						media: { version: 1, id: 'a', kind: 'audio', sources: [{ src: 'https://media.example.com/a.m4a?v=2' }] },
						fragment: { startSeconds: 61.25 },
					},
				},
			]),
		]);
		expect(xml).toContain(
			'<apip:audioFileInfo contentLinkIdentifier="term-1" mimeType="audio/mp4"><apip:fileHref>https://media.example.com/a.m4a?v=2</apip:fileHref><apip:startTime>00:01:01.25</apip:startTime></apip:audioFileInfo>'
		);
	});

	test('writes an element only when it has a link APIP can express', () => {
		const braille: CatalogCard[] = [{ catalog: 'braille', content: '⠺⠁⠞' }];
		const { xml, unwritten } = writeApipAccessibility([
			{ identifier: 'unlinked', links: [], cards: braille },
			{ identifier: 'run', links: [{ target: 'stem', range: { unit: 'word', start: 2, stop: 3 } }], cards: braille },
			{
				identifier: 'linked',
				links: [
					{ target: 'stem', range: { unit: 'word', start: 2, stop: 3 } },
					{ target: 'stem', range: { unit: 'character', start: 4, stop: 4 } },
				],
				cards: braille,
			},
		]);
		expect(unwritten.get('unlinked')).toEqual(['braille']);
		expect(unwritten.get('run')).toEqual(['braille']);
		expect(xml).toContain(
			'<apip:accessElement identifier="linked"><apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:textLink><apip:characterLink>4</apip:characterLink></apip:textLink></apip:contentLinkInfo>'
		);
		expect(xml).not.toContain('identifier="unlinked"');
		expect(xml).not.toContain('identifier="run"');
	});

	test('gives access elements and labels ids the document does not use', () => {
		const braille: CatalogCard[] = [{ catalog: 'braille', content: '⠺⠁⠞' }];
		const { xml } = writeApipAccessibility(
			[element(braille, 'stem'), element(braille, '1 term'), element(braille, '1 term')],
			{ reservedIds: ['stem', 'stem-1'] }
		);
		const ids = [...(xml ?? '').matchAll(/(?:identifier|contentLinkIdentifier)="([^"]+)"/g)].map((match) => match[1]);
		expect(ids).toEqual(['stem-2', 'stem-2-1', '_1-term', '_1-term-1', '_1-term-2', '_1-term-2-1']);
	});

	test('writes nothing when no element has a writable support', () => {
		const { xml, unwritten } = writeApipAccessibility([element([{ catalog: 'glossary-on-screen', content: 'x' }])]);
		expect(xml).toBeUndefined();
		expect(unwritten.get('term')).toEqual(['glossary-on-screen']);
	});
});
