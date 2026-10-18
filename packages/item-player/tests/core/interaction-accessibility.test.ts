/**
 * Authored `aria-*` on an interaction reaches its data as text, since an idref cannot resolve
 * across the shadow root the interaction renders in; the order interaction carries its classes.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';

const QTI22 = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="a11y" title="A11y"
  adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="ORDER" cardinality="ordered" baseType="identifier"/>
  <responseDeclaration identifier="TEXT" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="PLAIN" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p id="planets-label">Inner   planets</p>
    <p id="planets-help">Pick the one nearest the Sun.</p>
    <choiceInteraction responseIdentifier="CHOICE" maxChoices="1" aria-labelledby="planets-label" aria-describedby="planets-help">
      <simpleChoice identifier="A">Mercury</simpleChoice>
      <simpleChoice identifier="B">Venus</simpleChoice>
    </choiceInteraction>
    <orderInteraction responseIdentifier="ORDER" class="qti-labels-upper-alpha qti-labels-suffix-period qti-orientation-horizontal" aria-label="Order the steps" aria-description="Drag or use the arrow keys.">
      <simpleChoice identifier="S1">First</simpleChoice>
      <simpleChoice identifier="S2">Second</simpleChoice>
    </orderInteraction>
    <p>Name it: <textEntryInteraction responseIdentifier="TEXT" aria-label="Planet name"/></p>
    <choiceInteraction responseIdentifier="PLAIN" maxChoices="1">
      <simpleChoice identifier="X">X</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

describe.each([
	['QTI 2.2', QTI22],
	['QTI 3.0', convertQti2ToQti3(QTI22)],
])('interaction accessibility (%s)', (_version, itemXml) => {
	const interactions = new Map(
		new Player({ itemXml }).getInteractionData().map((interaction) => [interaction.responseId, interaction]),
	);

	test('resolves aria-labelledby and aria-describedby to text', () => {
		expect(interactions.get('CHOICE')?.accessibility).toEqual({
			label: 'Inner planets',
			description: 'Pick the one nearest the Sun.',
		});
	});

	test('takes aria-label and aria-description as authored', () => {
		expect(interactions.get('ORDER')?.accessibility).toEqual({
			label: 'Order the steps',
			description: 'Drag or use the arrow keys.',
		});
		expect(interactions.get('TEXT')?.accessibility).toEqual({ label: 'Planet name' });
	});

	test('leaves accessibility out when nothing is authored', () => {
		expect(interactions.get('PLAIN')).not.toHaveProperty('accessibility');
	});

	test('the order interaction carries its vocabulary classes', () => {
		expect((interactions.get('ORDER') as { interactionClasses?: string[] })?.interactionClasses).toEqual([
			'qti-labels-upper-alpha',
			'qti-labels-suffix-period',
			'qti-orientation-horizontal',
		]);
	});
});

describe('inline controls', () => {
	test.each([
		['text-entry/InlineTextEntry.svelte', 'Text entry'],
		['inline-choice/InlineChoice.svelte', 'Inline choice'],
	])('%s takes the authored label and description', (file, fallback) => {
		const source = readFileSync(new URL(`../../src/interactions/${file}`, import.meta.url), 'utf8');
		expect(source).toContain(`interaction.accessibility?.label ?? \`${fallback} \${interaction.responseId}\``);
		expect(source).toContain('{#if interaction.accessibility?.description}');
		expect(source).toContain('aria-describedby=');
	});
});
