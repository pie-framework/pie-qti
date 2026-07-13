import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(
	new URL('../src/plugins/extended-text/ExtendedTextInteraction.svelte', import.meta.url),
	'utf8',
);

describe('ExtendedTextInteraction rendering', () => {
	test('renders one independently editable region per container string', () => {
		expect(source).toContain('{#each editorValues as editorValue, index}');
		expect(source).toContain('part="add-string"');
		expect(source).toContain('part="remove-string"');
		expect(source).toContain('parsedInteraction.maxStrings');
		expect(source).toContain('Math.max(1, parsedInteraction.minStrings)');
	});

	test('uses plain textareas unless XHTML rich text was authored', () => {
		expect(source).toContain("parsedInteraction.format === 'xhtml'");
		expect(source).toContain('<textarea');
		expect(source).toContain('<RichTextEditor');
	});

	test('emits both the typed response and the stringIdentifier companion response', () => {
		expect(source).toContain('createExtendedTextResponse(strings, parsedInteraction)');
		expect(source).toContain('parsedInteraction.stringIdentifier');
		expect(source).toContain('createExtendedTextStringResponse(');
		expect(source).toContain('stringResponse != null');
		expect(source).toContain('stringResponse = lexicalResponse');
	});
});
