/**
 * Tests for helper functions
 */

import { describe, expect, test } from 'bun:test';
import {
	parseQtiItem,
	createQtiWrapper,
	createResponseDeclaration,
	createOutcomeDeclaration,
	createChoiceInteraction,
	parseElement,
} from '../src/index.js';

describe('QTI Helpers', () => {
	describe('createQtiWrapper', () => {
		test('creates basic wrapper', () => {
			const qti = createQtiWrapper('<itemBody>test</itemBody>');

			expect(qti).toContain('<?xml version="1.0"');
			expect(qti).toContain('<assessmentItem');
			expect(qti).toContain('identifier="test-item"');
			expect(qti).toContain('title="Test Item"');
			expect(qti).toContain('<itemBody>test</itemBody>');
		});

		test('creates wrapper with custom id and title', () => {
			const qti = createQtiWrapper(
				'<itemBody>test</itemBody>',
				'custom-id',
				'Custom Title',
			);

			expect(qti).toContain('identifier="custom-id"');
			expect(qti).toContain('title="Custom Title"');
		});

		test('includes QTI namespace', () => {
			const qti = createQtiWrapper('<itemBody>test</itemBody>');

			expect(qti).toContain('xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"');
		});
	});

	describe('parseQtiItem', () => {
		test('parses QTI XML', () => {
			const qti = createQtiWrapper('<itemBody>test</itemBody>');
			const element = parseQtiItem(qti);

			expect(element).toBeDefined();
			expect(element.rawTagName).toBe('assessmentItem');
			expect(element.getAttribute('identifier')).toBe('test-item');
		});

		test('throws when no assessmentItem found', () => {
			expect(() => parseQtiItem('<div>not qti</div>')).toThrow(
				'No assessmentItem element found',
			);
		});
	});

	describe('createResponseDeclaration', () => {
		test('creates single cardinality declaration', () => {
			const decl = createResponseDeclaration('RESPONSE', 'single', ['A']);

			expect(decl).toContain('<responseDeclaration');
			expect(decl).toContain('identifier="RESPONSE"');
			expect(decl).toContain('cardinality="single"');
			expect(decl).toContain('baseType="identifier"');
			expect(decl).toContain('<value>A</value>');
		});

		test('creates multiple cardinality declaration', () => {
			const decl = createResponseDeclaration('RESPONSE', 'multiple', [
				'A',
				'B',
				'C',
			]);

			expect(decl).toContain('cardinality="multiple"');
			expect(decl).toContain('<value>A</value>');
			expect(decl).toContain('<value>B</value>');
			expect(decl).toContain('<value>C</value>');
		});

		test('creates declaration with custom baseType', () => {
			const decl = createResponseDeclaration('RESPONSE', 'single', ['42'], 'integer');

			expect(decl).toContain('baseType="integer"');
			expect(decl).toContain('<value>42</value>');
		});
	});

	describe('createOutcomeDeclaration', () => {
		test('creates outcome without default', () => {
			const decl = createOutcomeDeclaration('SCORE', 'float');

			expect(decl).toContain('<outcomeDeclaration');
			expect(decl).toContain('identifier="SCORE"');
			expect(decl).toContain('baseType="float"');
			expect(decl).not.toContain('defaultValue');
		});

		test('creates outcome with default value', () => {
			const decl = createOutcomeDeclaration('SCORE', 'float', '0');

			expect(decl).toContain('<defaultValue>');
			expect(decl).toContain('<value>0</value>');
		});
	});

	describe('createChoiceInteraction', () => {
		test('creates basic choice interaction', () => {
			const interaction = createChoiceInteraction('RESPONSE', [
				{ id: 'A', text: 'Choice A' },
				{ id: 'B', text: 'Choice B' },
			]);

			expect(interaction).toContain('<choiceInteraction');
			expect(interaction).toContain('responseIdentifier="RESPONSE"');
			expect(interaction).toContain('shuffle="false"');
			expect(interaction).toContain('maxChoices="1"');
			expect(interaction).toContain('<simpleChoice identifier="A">Choice A</simpleChoice>');
			expect(interaction).toContain('<simpleChoice identifier="B">Choice B</simpleChoice>');
		});

		test('creates shuffled interaction', () => {
			const interaction = createChoiceInteraction(
				'RESPONSE',
				[{ id: 'A', text: 'Choice A' }],
				true,
			);

			expect(interaction).toContain('shuffle="true"');
		});

		test('includes prompt', () => {
			const interaction = createChoiceInteraction('RESPONSE', [
				{ id: 'A', text: 'Choice A' },
			]);

			expect(interaction).toContain('<prompt>Select the correct answer:</prompt>');
		});
	});

	describe('parseElement', () => {
		test('parses XML element', () => {
			const element = parseElement('<div class="test">content</div>');

			expect(element).toBeDefined();
			expect(element.rawTagName).toBe('div');
			expect(element.getAttribute('class')).toBe('test');
			expect(element.textContent).toContain('content');
		});

		test('parses self-closing elements', () => {
			const element = parseElement('<br />');

			expect(element).toBeDefined();
			expect(element.rawTagName).toBe('br');
		});
	});
});

describe('Complete QTI Example', () => {
	test('creates and parses complete QTI item', () => {
		const qti = createQtiWrapper(
			`
      ${createResponseDeclaration('RESPONSE', 'single', ['A'])}
      ${createOutcomeDeclaration('SCORE', 'float', '0')}
      ${createChoiceInteraction('RESPONSE', [
				{ id: 'A', text: 'Correct Answer' },
				{ id: 'B', text: 'Wrong Answer' },
			])}
    `,
			'complete-item',
			'Complete Test Item',
		);

		const element = parseQtiItem(qti);

		expect(element.getAttribute('identifier')).toBe('complete-item');
		expect(element.getAttribute('title')).toBe('Complete Test Item');

		// Verify response declaration
		const responseDecl = element.getElementsByTagName('responseDeclaration')[0];
		expect(responseDecl).toBeDefined();
		expect(responseDecl.getAttribute('identifier')).toBe('RESPONSE');

		// Verify outcome declaration
		const outcomeDecl = element.getElementsByTagName('outcomeDeclaration')[0];
		expect(outcomeDecl).toBeDefined();
		expect(outcomeDecl.getAttribute('identifier')).toBe('SCORE');

		// Verify interaction
		const interaction = element.getElementsByTagName('choiceInteraction')[0];
		expect(interaction).toBeDefined();

		const choices = interaction.getElementsByTagName('simpleChoice');
		expect(choices.length).toBe(2);
	});
});
