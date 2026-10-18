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

describe('ChoiceInteraction answer masking', () => {
	it('renders a reveal button in place of a masked choice in both choice branches', () => {
		expect(source).toContain('answerMasking?: boolean;');
		expect(source.match(/\{@render maskedChoice\(choice\.identifier, index\)\}/g)).toHaveLength(2);
		expect(source).toContain("i18n?.t('interactions.choice.revealChoice', { index: index + 1 })");
		expect(source).toContain('data-masked={isMasked(choice.identifier)');
	});
});
