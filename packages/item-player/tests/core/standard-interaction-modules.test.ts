import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';
import {
	getStandardBlockInteractionModules,
	getStandardInlineInteractionModules,
	getStandardInteractionExtractors,
	getStandardInteractionModules,
	isStandardBlockInteractionType,
	isStandardInlineInteractionTagName,
	isStandardInlineInteractionType,
} from '../../src/interactions/modules.js';

describe('standard interaction modules', () => {
	test('define a unique extractor-backed standard inventory', () => {
		const modules = getStandardInteractionModules();
		const types = modules.map((module) => module.type);

		expect(new Set(types).size).toBe(types.length);
		expect(getStandardInteractionExtractors()).toEqual(modules.map((module) => module.extractor));

		for (const module of modules) {
			expect(module.extractor.elementTypes.length).toBeGreaterThan(0);
		}
	});

	test('classifies block and inline placement from the canonical inventory', () => {
		expect(getStandardInlineInteractionModules().map((module) => module.type)).toEqual([
			'textEntryInteraction',
			'inlineChoiceInteraction',
		]);
		expect(getStandardBlockInteractionModules().some((module) => module.type === 'choiceInteraction')).toBe(true);
		expect(isStandardInlineInteractionType('textEntryInteraction')).toBe(true);
		expect(isStandardInlineInteractionTagName('qti-inline-choice-interaction')).toBe(true);
		expect(isStandardBlockInteractionType('choiceInteraction')).toBe(true);
		expect(isStandardBlockInteractionType('textEntryInteraction')).toBe(false);
	});

	test('drives Player interaction extraction for representative block and inline interactions', () => {
		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="inventory" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="TEXT" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="INLINE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
    <p>
      Enter <textEntryInteraction responseIdentifier="TEXT" expectedLength="5"/> and choose
      <inlineChoiceInteraction responseIdentifier="INLINE">
        <inlineChoice identifier="A">A</inlineChoice>
      </inlineChoiceInteraction>.
    </p>
  </itemBody>
</assessmentItem>`;

		const interactions = new Player({ itemXml }).getInteractionData();
		expect(interactions.map((interaction) => interaction.type).sort()).toEqual([
			'choiceInteraction',
			'inlineChoiceInteraction',
			'textEntryInteraction',
		]);
	});
});
