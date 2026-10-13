import { describe, expect, it } from 'bun:test';
import { extractCatalogFromItemXml } from '../catalog/catalogExtractor.js';
import { Player } from '../core/Player.js';

const APIP = 'http://www.imsglobal.org/xsd/apip/apipv1p0/imsapip_qtiv1p0';

const APIP_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:apip="${APIP}" xmlns:ssml="http://www.w3.org/2001/10/synthesis" identifier="apip-1" title="APIP" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p id="stem">Ecologists say the bird count is accurate.</p>
    <p id="marked" data-catalog-idref="authored">Already <em>marked</em> up.</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt id="prompt">Which claim holds?</prompt>
      <simpleChoice identifier="A" id="choice-a">The count is right</simpleChoice>
      <simpleChoice identifier="B">The count is wrong</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <apip:apipAccessibility>
    <apip:accessibilityInfo>
      <apip:accessElement identifier="ae-stem">
        <apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:textLink><apip:fullString/></apip:textLink></apip:contentLinkInfo>
        <apip:relatedElementInfo>
          <apip:spoken><apip:textToSpeechPronunciationSSML>Ecologists say the bird count is <ssml:emphasis>accurate</ssml:emphasis>.</apip:textToSpeechPronunciationSSML></apip:spoken>
          <apip:brailleText><apip:brailleTextString contentLinkIdentifier="b1">⠑⠉⠕</apip:brailleTextString></apip:brailleText>
        </apip:relatedElementInfo>
      </apip:accessElement>
      <apip:accessElement identifier="ae-accurate">
        <apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:textLink><apip:wordLink>7</apip:wordLink></apip:textLink></apip:contentLinkInfo>
        <apip:relatedElementInfo>
          <apip:keyWordTranslation>
            <apip:definitionId xml:lang="es"><apip:textString contentLinkIdentifier="k1">exacto</apip:textString></apip:definitionId>
            <apip:definitionId xml:lang="de"><apip:textString contentLinkIdentifier="k2">genau</apip:textString></apip:definitionId>
          </apip:keyWordTranslation>
        </apip:relatedElementInfo>
      </apip:accessElement>
      <apip:accessElement identifier="ae-bird">
        <apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:textLink><apip:characterStringLink><apip:startCharacter>20</apip:startCharacter><apip:stopCharacter>23</apip:stopCharacter></apip:characterStringLink></apip:textLink></apip:contentLinkInfo>
        <apip:contentLinkInfo qtiLinkIdentifierRef="marked"><apip:textLink><apip:characterStringLink><apip:startCharacter>5</apip:startCharacter><apip:stopCharacter>12</apip:stopCharacter></apip:characterStringLink></apip:textLink></apip:contentLinkInfo>
        <apip:relatedElementInfo><apip:brailleText><apip:brailleTextString contentLinkIdentifier="b2">⠃⠊⠗⠙</apip:brailleTextString></apip:brailleText></apip:relatedElementInfo>
      </apip:accessElement>
      <apip:accessElement identifier="ae-marked">
        <apip:contentLinkInfo qtiLinkIdentifierRef="marked"><apip:objectLink/></apip:contentLinkInfo>
        <apip:relatedElementInfo><apip:spoken><apip:spokenText contentLinkIdentifier="s1">Already marked up.</apip:spokenText></apip:spoken></apip:relatedElementInfo>
      </apip:accessElement>
      <apip:accessElement identifier="ae-prompt">
        <apip:contentLinkInfo qtiLinkIdentifierRef="prompt"><apip:textLink><apip:fullString/></apip:textLink></apip:contentLinkInfo>
        <apip:contentLinkInfo qtiLinkIdentifierRef="choice-a"><apip:textLink><apip:fullString/></apip:textLink></apip:contentLinkInfo>
        <apip:relatedElementInfo><apip:spoken><apip:spokenText contentLinkIdentifier="s2">Read the prompt.</apip:spokenText></apip:spoken></apip:relatedElementInfo>
      </apip:accessElement>
    </apip:accessibilityInfo>
  </apip:apipAccessibility>
</assessmentItem>`;

describe('APIP accessibility', () => {
	it('indexes each access element as a catalog under its identifier', () => {
		const index = extractCatalogFromItemXml(APIP_ITEM);
		expect(index.get('ae-stem')?.entries).toEqual([
			{ usage: 'spoken', html: '<speak>Ecologists say the bird count is <emphasis>accurate</emphasis>.</speak>' },
			{ usage: 'braille', html: '⠑⠉⠕' },
		]);
		expect(index.get('ae-accurate')?.entries).toEqual([
			{ usage: 'keyword-translation', lang: 'es', html: 'exacto' },
			{ usage: 'keyword-translation', lang: 'de', html: 'genau' },
		]);
	});

	it('resolves APIP entries through the player by language', () => {
		const player = new Player({ itemXml: APIP_ITEM });
		expect(player.getCatalogEntry('ae-accurate', 'keyword-translation', 'de')).toBe('genau');
		expect(player.getCatalogEntry('ae-stem', 'braille')).toBe('⠑⠉⠕');
	});

	it('docks whole-element links on the element and ranges on a span around their text', () => {
		const html = String(new Player({ itemXml: APIP_ITEM }).getItemBodyHtml());
		expect(html).toContain('<p id="stem" data-catalog-idref="ae-stem"');
		expect(html).toContain(
			'>Ecologists say the <span data-catalog-idref="ae-bird">bird</span> count is <span data-catalog-idref="ae-accurate">accurate.</span></p>'
		);
	});

	it('wraps the content of an element that names a catalog already, and leaves out ranges that cross markup', () => {
		const html = String(new Player({ itemXml: APIP_ITEM }).getItemBodyHtml());
		expect(html).toContain('<p id="marked" data-catalog-idref="authored"');
		expect(html).toContain('><span data-catalog-idref="ae-marked">Already <em>marked</em> up.</span></p>');
	});

	it('leaves an element that names its access element already as it is', () => {
		const item = APIP_ITEM.replace('data-catalog-idref="authored"', 'data-catalog-idref="ae-marked"');
		const html = String(new Player({ itemXml: item }).getItemBodyHtml());
		expect(html).toContain('<p id="marked" data-catalog-idref="ae-marked"');
		expect(html).toContain('>Already <em>marked</em> up.</p>');
		expect(html).not.toContain('<span data-catalog-idref="ae-marked">');
	});

	it('wraps the content of a prompt and a choice, whose tags the player does not render', () => {
		const [interaction] = new Player({ itemXml: APIP_ITEM }).getInteractionData() as unknown as Array<{
			prompt: string;
			choices: Array<{ identifier: string; text: string }>;
		}>;
		expect(interaction?.prompt).toBe('<span data-catalog-idref="ae-prompt">Which claim holds?</span>');
		expect(interaction?.choices.find((choice) => choice.identifier === 'A')?.text).toBe(
			'<span data-catalog-idref="ae-prompt">The count is right</span>'
		);
	});

	it('leaves an item without APIP as authored', () => {
		const item = APIP_ITEM.replace(/<apip:apipAccessibility>[\s\S]*<\/apip:apipAccessibility>/, '');
		const html = String(new Player({ itemXml: item }).getItemBodyHtml());
		expect(html).toContain('>Ecologists say the bird count is accurate.</p>');
		expect(html).not.toContain('ae-');
	});
});
