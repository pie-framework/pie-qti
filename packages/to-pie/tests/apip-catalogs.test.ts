/**
 * APIP accessibility catalogs
 *
 * A QTI 2.x APIP item's access elements reach the PIE item as catalogs under the support names
 * QTI 3 uses, docked on the content their links name; inline SSML speaks through a `spoken`
 * card on its enclosing element, and what has no PIE counterpart is reported.
 */

import { describe, expect, test } from 'bun:test';
import type { TransformOutput } from '@pie-qti/transform-types';
import { convertQtiPassageDocument, prepareQtiAccessibility, QtiToPiePlugin } from '../src';
import { ACCESSIBILITY_NOT_CARRIED } from '../src/utils/accessibility-inventory';

const APIP = 'http://www.imsglobal.org/xsd/apip/apipv1p0/imsapip_qtiv1p0';

const APIP_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:apip="${APIP}" xmlns:ssml="http://www.w3.org/2010/10/synthesis" identifier="apip-1" title="APIP supports" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p id="stem">Ecologists say the bird count is accurate.</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt id="prompt">Which claim holds?</prompt>
      <simpleChoice identifier="A" id="choice-a">The count is right</simpleChoice>
      <simpleChoice identifier="B" id="choice-b"><p>The count is wrong</p></simpleChoice>
    </choiceInteraction>
  </itemBody>
  <apip:apipAccessibility>
    <apip:inclusionOrder><apip:textGraphicsDefaultOrder><apip:elementOrder identifierRef="ae-stem"><apip:order>1</apip:order></apip:elementOrder></apip:textGraphicsDefaultOrder></apip:inclusionOrder>
    <apip:accessibilityInfo>
      <apip:accessElement identifier="ae-stem">
        <apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:objectLink/></apip:contentLinkInfo>
        <apip:relatedElementInfo>
          <apip:spoken>
            <apip:audioFileInfo mimeType="audio/mpeg"><apip:fileHref>https://media.example.com/assets/stem-audio</apip:fileHref><apip:startTime>00:00:01.5</apip:startTime><apip:duration>00:00:02.25</apip:duration></apip:audioFileInfo>
            <apip:spokenText>Ecologists say the bird count is accurate.</apip:spokenText>
            <apip:textToSpeechPronunciation>Ecologists say the bird count is ack-yur-it.</apip:textToSpeechPronunciation>
            <apip:textToSpeechPronunciationSSML><ssml:speak>Ecologists say the bird count is <ssml:emphasis>accurate</ssml:emphasis>.</ssml:speak></apip:textToSpeechPronunciationSSML>
            <apip:voiceType>synthetic</apip:voiceType>
            <apip:voiceSpeed>standard</apip:voiceSpeed>
          </apip:spoken>
          <apip:brailleText><apip:brailleTextString>⠑⠉⠕⠇⠕⠛⠊⠎⠞⠎</apip:brailleTextString></apip:brailleText>
          <apip:signing>
            <apip:signFileASL><apip:videoFileInfo mimeType="video/mp4"><apip:fileHref>https://media.example.com/assets/stem-asl</apip:fileHref><apip:startCue>00:00:03</apip:startCue><apip:endCue>00:00:07.5</apip:endCue></apip:videoFileInfo></apip:signFileASL>
            <apip:signFileSignedEnglish><apip:videoFileInfo mimeType="video/mp4"><apip:fileHref>https://media.example.com/assets/stem-se</apip:fileHref></apip:videoFileInfo></apip:signFileSignedEnglish>
          </apip:signing>
        </apip:relatedElementInfo>
      </apip:accessElement>
      <apip:accessElement identifier="ae-accurate">
        <apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:textLink><apip:wordLink>7</apip:wordLink></apip:textLink></apip:contentLinkInfo>
        <apip:relatedElementInfo>
          <apip:keyWordTranslation>
            <apip:definitionId xml:lang="es"><apip:textString>exacto</apip:textString></apip:definitionId>
            <apip:definitionId xml:lang="de"><apip:textString>genau</apip:textString></apip:definitionId>
          </apip:keyWordTranslation>
          <apip:guidance><apip:languageLearnerSupport><apip:supportOrder>1</apip:supportOrder><apip:textString>Accurate means correct &amp; exact.</apip:textString></apip:languageLearnerSupport></apip:guidance>
        </apip:relatedElementInfo>
      </apip:accessElement>
      <apip:accessElement identifier="ae-prompt">
        <apip:contentLinkInfo qtiLinkIdentifierRef="prompt"><apip:textLink><apip:characterStringLink><apip:startCharacter>7</apip:startCharacter><apip:stopCharacter>11</apip:stopCharacter></apip:characterStringLink></apip:textLink></apip:contentLinkInfo>
        <apip:relatedElementInfo>
          <apip:tactileFile>
            <apip:tactileAudioFile mimeType="audio/mpeg"><apip:fileHref>https://media.example.com/assets/tactile-audio</apip:fileHref></apip:tactileAudioFile>
            <apip:tactileAudioText>Raised dots mark the claim.</apip:tactileAudioText>
            <apip:tactileBrailleText>⠉⠇⠁⠊⠍</apip:tactileBrailleText>
          </apip:tactileFile>
        </apip:relatedElementInfo>
      </apip:accessElement>
      <apip:accessElement identifier="ae-choices">
        <apip:contentLinkInfo qtiLinkIdentifierRef="choice-a"><apip:objectLink/></apip:contentLinkInfo>
        <apip:contentLinkInfo qtiLinkIdentifierRef="choice-b"><apip:objectLink/></apip:contentLinkInfo>
        <apip:relatedElementInfo><apip:spoken><apip:spokenText>An answer choice.</apip:spokenText></apip:spoken></apip:relatedElementInfo>
      </apip:accessElement>
    </apip:accessibilityInfo>
  </apip:apipAccessibility>
</assessmentItem>`;

async function convert(qtiXml: string): Promise<TransformOutput> {
  return new QtiToPiePlugin().transform({ content: qtiXml, format: 'qti' }, {});
}

function pieItemOf(output: TransformOutput): Record<string, any> {
  return output.items[0]?.content as Record<string, any>;
}

function notCarried(output: TransformOutput) {
  return (output.warnings ?? [])
    .filter((warning) => warning.code === ACCESSIBILITY_NOT_CARRIED)
    .map((warning) => warning.message);
}

function apipItem(body: string, accessElements: string): string {
  return `<assessmentItem xmlns:apip="${APIP}" identifier="apip-2" title="APIP links" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <itemBody>${body}<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">Yes</simpleChoice><simpleChoice identifier="B">No</simpleChoice></choiceInteraction></itemBody>
  <apip:apipAccessibility><apip:accessibilityInfo>${accessElements}</apip:accessibilityInfo></apip:apipAccessibility>
</assessmentItem>`;
}

function accessElement(identifier: string, link: string, supports = ''): string {
  return `<apip:accessElement identifier="${identifier}"><apip:contentLinkInfo ${link}</apip:contentLinkInfo><apip:relatedElementInfo><apip:brailleText><apip:brailleTextString>${identifier}</apip:brailleTextString></apip:brailleText>${supports}</apip:relatedElementInfo></apip:accessElement>`;
}

function characters(target: string, start: number, stop: number): string {
  return `qtiLinkIdentifierRef="${target}"><apip:textLink><apip:characterStringLink><apip:startCharacter>${start}</apip:startCharacter><apip:stopCharacter>${stop}</apip:stopCharacter></apip:characterStringLink></apip:textLink>`;
}

describe('APIP accessibility catalogs', () => {
  test('each access element becomes a catalog of QTI 3 support cards', () => {
    const { catalogs } = prepareQtiAccessibility(APIP_ITEM);

    expect(catalogs).toEqual([
      {
        identifier: 'ae-stem',
        cards: [
          {
            catalog: 'spoken',
            content:
              '<speak>Ecologists say the bird count is <emphasis>accurate</emphasis>.</speak>',
          },
          {
            catalog: 'ext:custom-text-to-speech-pronunciation',
            content: 'Ecologists say the bird count is ack-yur-it.',
          },
          {
            catalog: 'ext:custom-spoken-text',
            content: 'Ecologists say the bird count is accurate.',
          },
          {
            catalog: 'spoken',
            payload: {
              media: {
                version: 1,
                id: 'https://media.example.com/assets/stem-audio',
                kind: 'audio',
                sources: [{ src: 'https://media.example.com/assets/stem-audio', type: 'audio/mpeg' }],
              },
              fragment: { startSeconds: 1.5, endSeconds: 3.75 },
            },
          },
          { catalog: 'braille', content: '⠑⠉⠕⠇⠕⠛⠊⠎⠞⠎' },
          {
            catalog: 'sign-language',
            language: 'ase',
            payload: {
              media: {
                version: 1,
                id: 'https://media.example.com/assets/stem-asl',
                kind: 'video',
                sources: [{ src: 'https://media.example.com/assets/stem-asl', type: 'video/mp4' }],
              },
              fragment: { startSeconds: 3, endSeconds: 7.5 },
            },
          },
          {
            catalog: 'sign-language',
            language: 'eng-US',
            payload: {
              media: {
                version: 1,
                id: 'https://media.example.com/assets/stem-se',
                kind: 'video',
                sources: [{ src: 'https://media.example.com/assets/stem-se', type: 'video/mp4' }],
              },
            },
          },
        ],
      },
      {
        identifier: 'ae-accurate',
        cards: [
          { catalog: 'keyword-translation', language: 'es', content: 'exacto' },
          { catalog: 'keyword-translation', language: 'de', content: 'genau' },
          { catalog: 'linguistic-guidance', content: 'Accurate means correct &amp; exact.' },
        ],
      },
      {
        identifier: 'ae-prompt',
        cards: [
          { catalog: 'tactile', content: 'Raised dots mark the claim.' },
          {
            catalog: 'tactile',
            payload: {
              media: {
                version: 1,
                id: 'https://media.example.com/assets/tactile-audio',
                kind: 'audio',
                sources: [{ src: 'https://media.example.com/assets/tactile-audio', type: 'audio/mpeg' }],
              },
            },
          },
          { catalog: 'ext:custom-tactile-braille-text', content: '⠉⠇⠁⠊⠍' },
        ],
      },
      { identifier: 'ae-choices', cards: [{ catalog: 'spoken', content: 'An answer choice.' }] },
    ]);
  });

  test('each link docks its catalog on the element, word or characters it names', () => {
    const { xml } = prepareQtiAccessibility(APIP_ITEM);

    expect(xml).toContain(
      '<p id="stem" data-catalog-idref="ae-stem">Ecologists say the bird count is <span data-catalog-idref="ae-accurate">accurate.</span></p>'
    );
    expect(xml).toContain(
      '<prompt id="prompt">Which <span data-catalog-idref="ae-prompt">claim</span> holds?</prompt>'
    );
    expect(xml).toContain(
      '<simpleChoice identifier="A" id="choice-a"><span data-catalog-idref="ae-choices">The count is right</span></simpleChoice>'
    );
    expect(xml).toContain(
      '<simpleChoice identifier="B" id="choice-b"><div data-catalog-idref="ae-choices"><p>The count is wrong</p></div></simpleChoice>'
    );
  });

  test('a link to an element that names its access element already leaves the element as it is', () => {
    const qti = apipItem(
      '<p id="docked" data-catalog-idref="ae-docked">Docked</p><p id="other" data-catalog-idref="authored">Other</p>',
      [
        accessElement('ae-docked', 'qtiLinkIdentifierRef="docked"><apip:objectLink/>'),
        accessElement('ae-other', 'qtiLinkIdentifierRef="other"><apip:objectLink/>'),
      ].join('')
    );

    const { xml } = prepareQtiAccessibility(qti);
    expect(xml).toContain('<p id="docked" data-catalog-idref="ae-docked">Docked</p>');
    expect(xml).toContain(
      '<p id="other" data-catalog-idref="authored"><span data-catalog-idref="ae-other">Other</span></p>'
    );
  });

  test('an APIP item converts with nothing reported but its read order', async () => {
    const converted = await convert(APIP_ITEM);
    const item = pieItemOf(converted);
    const [model] = item.config.models;

    expect(notCarried(converted)).toEqual([
      'apip:inclusionOrder (1) not carried into PIE: PIE has no read-order counterpart.',
    ]);
    expect(model.accessibilityCatalogs.map((catalog: any) => catalog.identifier)).toEqual([
      'ae-stem',
      'ae-accurate',
      'ae-prompt',
      'ae-choices',
    ]);
    expect(model.choices.map((choice: any) => choice.label)).toEqual([
      '<span data-catalog-idref="ae-choices">The count is right</span>',
      '<div data-catalog-idref="ae-choices"><p>The count is wrong</p></div>',
    ]);
    expect(item.metadata.accessibility.supports).toEqual([
      'braille',
      'ext:custom-spoken-text',
      'ext:custom-tactile-braille-text',
      'ext:custom-text-to-speech-pronunciation',
      'keyword-translation',
      'linguistic-guidance',
      'sign-language',
      'spoken',
      'tactile',
    ]);
  });

  test('ranges nest, and a range that crosses markup or another range is reported', async () => {
    const qti = apipItem(
      '<p id="mixed">A <b>bold</b> claim and a plain one.</p><img id="figure" src="a.png" alt="A figure"/>',
      [
        accessElement('ae-claim', characters('mixed', 8, 12)),
        accessElement('ae-cl', characters('mixed', 8, 9)),
        accessElement(
          'ae-bold',
          'qtiLinkIdentifierRef="mixed"><apip:textLink><apip:wordLink>2</apip:wordLink></apip:textLink>'
        ),
        accessElement('ae-figure', 'qtiLinkIdentifierRef="figure"><apip:objectLink/>'),
        accessElement('ae-cross', characters('mixed', 1, 3)),
        accessElement('ae-overlap', characters('mixed', 10, 16)),
        accessElement('ae-past-end', characters('mixed', 28, 30)),
        accessElement('ae-missing', 'qtiLinkIdentifierRef="nowhere"><apip:objectLink/>'),
      ].join('')
    );

    expect(prepareQtiAccessibility(qti).xml).toContain(
      '<p id="mixed">A <b><span data-catalog-idref="ae-bold">bold</span></b> <span data-catalog-idref="ae-claim"><span data-catalog-idref="ae-cl">cl</span>aim</span> and a plain one.</p><img id="figure" src="a.png" alt="A figure" data-catalog-idref="ae-figure" />'
    );
    expect(notCarried(await convert(qti))).toEqual([
      'apip:accessElement (4) not carried into PIE: the content it links loses its supports.',
    ]);
  });

  test('a support QTI 3 has no counterpart for is reported by name', async () => {
    const qti = apipItem(
      '<p id="stem">Text</p>',
      accessElement(
        'ae-stem',
        'qtiLinkIdentifierRef="stem"><apip:objectLink/>',
        `<apip:keyWordEmphasis/><apip:chunk/>
        <apip:guidance><apip:cognitiveGuidanceSupport><apip:textString>Think</apip:textString></apip:cognitiveGuidanceSupport></apip:guidance>
        <apip:signing><apip:signFileASL><apip:videoFileInfo><apip:fileHref>asl.mp4</apip:fileHref></apip:videoFileInfo><apip:boneAnimationVideoFile><apip:fileHref>asl.bvh</apip:fileHref></apip:boneAnimationVideoFile></apip:signFileASL></apip:signing>`
      )
    );
    const converted = await convert(qti);

    expect(notCarried(converted)).toEqual([
      'apip:support (4) not carried into PIE: PIE has no counterpart for boneAnimationVideoFile, chunk, cognitiveGuidanceSupport, keyWordEmphasis.',
    ]);
    expect(pieItemOf(converted).config.models[0].accessibilityCatalogs).toEqual([
      {
        identifier: 'ae-stem',
        cards: [
          { catalog: 'braille', content: 'ae-stem' },
          {
            catalog: 'sign-language',
            language: 'ase',
            payload: {
              media: { version: 1, id: 'asl.mp4', kind: 'video', sources: [{ src: 'asl.mp4' }] },
            },
          },
        ],
      },
    ]);
  });

  test('inline SSML speaks through its enclosing element, unless a catalog there speaks already', async () => {
    const body = `<p>Read <ssml11:say-as interpret-as="characters">QTI</ssml11:say-as> aloud.</p>
      <p>Say it <emphasis xmlns="http://www.w3.org/2001/10/synthesis" level="strong">now</emphasis><span class="qti-hidden"> (hidden)</span>.</p>
      <p id="stem">A <ssml11:sub alias="doctor">Dr.</ssml11:sub> visits.</p>`;
    const qti = apipItem(
      body,
      `<apip:accessElement identifier="ae-stem"><apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:objectLink/></apip:contentLinkInfo><apip:relatedElementInfo><apip:spoken><apip:spokenText>A doctor visits.</apip:spokenText></apip:spoken></apip:relatedElementInfo></apip:accessElement>`
    ).replace(
      '<assessmentItem ',
      '<assessmentItem xmlns:ssml11="http://www.w3.org/2010/10/synthesis" '
    );
    const prepared = prepareQtiAccessibility(qti);

    expect(prepared.catalogs).toEqual([
      { identifier: 'ae-stem', cards: [{ catalog: 'spoken', content: 'A doctor visits.' }] },
      {
        identifier: 'ssml-1',
        cards: [
          {
            catalog: 'spoken',
            content: '<speak>Read <say-as interpret-as="characters">QTI</say-as> aloud.</speak>',
          },
        ],
      },
      {
        identifier: 'ssml-2',
        cards: [
          {
            catalog: 'spoken',
            content: '<speak>Say it <emphasis level="strong">now</emphasis>.</speak>',
          },
        ],
      },
    ]);
    expect(prepared.xml).toContain('<p data-catalog-idref="ssml-1">Read QTI aloud.</p>');
    expect(prepared.xml).toContain(
      '<p data-catalog-idref="ssml-2">Say it now<span class="qti-hidden" style="display:none"> (hidden)</span>.</p>'
    );
    expect(prepared.xml).toContain('<p id="stem" data-catalog-idref="ae-stem">A Dr. visits.</p>');
    expect(notCarried(await convert(qti))).toEqual([
      'ssml:* (1) not carried into PIE: read-aloud ignores its speech markup.',
    ]);
  });

  test('a stimulus carries its access elements on the passage', () => {
    const result = convertQtiPassageDocument({
      passageId: 'P2',
      xml: `<assessmentStimulus xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:apip="${APIP}" identifier="P2" title="Rivers">
  <stimulusBody><p id="nile">The Nile is long.</p></stimulusBody>
  <apip:apipAccessibility><apip:accessibilityInfo><apip:accessElement identifier="ae-nile"><apip:contentLinkInfo qtiLinkIdentifierRef="nile"><apip:objectLink/></apip:contentLinkInfo><apip:relatedElementInfo><apip:spoken><apip:spokenText>The Nile river is long.</apip:spokenText></apip:spoken></apip:relatedElementInfo></apip:accessElement></apip:accessibilityInfo></apip:apipAccessibility>
</assessmentStimulus>`,
    });

    expect(result.status).toBe('converted');
    if (result.status !== 'converted') return;
    expect(result.passage.accessibilityCatalogs).toEqual([
      { identifier: 'ae-nile', cards: [{ catalog: 'spoken', content: 'The Nile river is long.' }] },
    ]);
    expect(JSON.stringify(result.passage.config.models)).toContain(
      'data-catalog-idref=\\"ae-nile\\"'
    );
  });
});
