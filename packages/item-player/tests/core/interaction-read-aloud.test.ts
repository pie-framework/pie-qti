/**
 * Language, catalog idrefs and read-aloud suppression authored on an interaction, prompt or choice
 * reach its rendered content, since extraction carries an element's children only.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';
import type { ChoiceInteractionData } from '../../src/interactions/shared/types.js';

const QTI22 = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="read-aloud" title="Read aloud"
  adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="SILENT" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE" maxChoices="1">
      <prompt xml:lang="es">Elige uno</prompt>
      <simpleChoice identifier="A" data-catalog-idref="glossary-mercury">Mercury</simpleChoice>
      <simpleChoice identifier="B" data-qti-suppress-tts="computer-read-aloud">Venus</simpleChoice>
      <simpleChoice identifier="C">Earth</simpleChoice>
    </choiceInteraction>
    <choiceInteraction responseIdentifier="SILENT" maxChoices="1" data-qti-suppress-tts="computer-read-aloud" xml:lang="fr">
      <simpleChoice identifier="X">X</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

describe.each([
	['QTI 2.2', QTI22],
	['QTI 3.0', convertQti2ToQti3(QTI22)],
])('interaction read-aloud attributes (%s)', (_version, itemXml) => {
	const interactions = new Map(
		new Player({ itemXml }).getInteractionData().map((interaction) => [interaction.responseId, interaction]),
	);
	const choice = interactions.get('CHOICE') as ChoiceInteractionData;

	test('a prompt and choices keep their own attributes around their content', () => {
		expect(choice.prompt).toBe('<span lang="es">Elige uno</span>');
		const [mercury, venus, earth] = choice.choices.map((option) => option.text);
		expect(mercury).toBe('<span data-catalog-idref="glossary-mercury">Mercury</span>');
		expect(venus).toBe('<span data-tts-suppress="computer-read-aloud">Venus</span>');
		expect(earth).toBe('Earth');
	});

	test('an interaction carries its attributes for its host', () => {
		expect(interactions.get('SILENT')?.readAloud).toEqual({ lang: 'fr', 'data-tts-suppress': 'computer-read-aloud' });
		expect(choice).not.toHaveProperty('readAloud');
	});
});
