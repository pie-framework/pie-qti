import { describe, expect, test } from 'bun:test';
import { parse } from 'node-html-parser';
import {
	createChoiceInteraction,
	createQtiWrapper,
	createResponseDeclaration,
	SilentLogger,
} from '@pie-qti/test-utils';
import { createDefaultQtiToPieRegistry } from '../src/registry/qti-to-pie-registry';

const choiceQti = createQtiWrapper(
	`
  ${createResponseDeclaration('RESPONSE', 'single', ['choiceA'])}
  <itemBody>
    <p>What is 2 + 2?</p>
    ${createChoiceInteraction('RESPONSE', [
			{ id: 'choiceA', text: '4' },
			{ id: 'choiceB', text: '3' },
		])}
  </itemBody>
`,
	'choice-registry',
	'Registry Choice'
);

describe('QtiToPieRegistry', () => {
	test('routes standard interaction types to built-in handlers', async () => {
		const registry = createDefaultQtiToPieRegistry();
		const handler = registry.getHandlerForInteraction('choiceInteraction');
		const doc = parse(choiceQti, { lowerCaseTagName: false, comment: false });

		expect(handler?.id).toBe('builtin.choice');

		const result = await registry.transform({
			interactionType: 'choiceInteraction',
			qtiXml: choiceQti,
			itemId: 'choice-registry',
			assessmentItem: doc.getElementsByTagName('assessmentItem')[0],
			logger: new SilentLogger(),
		});

		expect(result.kind).toBe('pie-item');
		expect(result.content.id).toBe('choice-registry');
	});

	test('creates delegates that can call named built-in handlers', async () => {
		const registry = createDefaultQtiToPieRegistry();
		const doc = parse(choiceQti, { lowerCaseTagName: false, comment: false });
		const delegate = registry.createDelegate({
			interactionType: 'choiceInteraction',
			qtiXml: choiceQti,
			itemId: 'choice-registry',
			assessmentItem: doc.getElementsByTagName('assessmentItem')[0],
			logger: new SilentLogger(),
		});

		const result = await delegate.transformWithBuiltIn('builtin.choice');

		expect(result.kind).toBe('pie-item');
		expect(result.content.id).toBe('choice-registry');
		await expect(delegate.transformWithBuiltIn('builtin.missing')).rejects.toThrow(/Unknown built-in/);
	});
});
