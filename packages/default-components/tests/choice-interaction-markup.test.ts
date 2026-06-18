import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(
	new URL('../src/plugins/choice/ChoiceInteraction.svelte', import.meta.url),
	'utf8'
);

describe('ChoiceInteraction markup', () => {
	it('renders rich choice text in a block container with normalized child margins', () => {
		expect(source).toContain('part="text" class="qti-choice-text qti-rich-content label-text"');
		expect(source).not.toContain('<span part="text" class="qti-choice-text label-text">');
		expect(source).toContain('aria-labelledby={textId}');
		expect(source).toContain('qti-rich-content');
	});
});
