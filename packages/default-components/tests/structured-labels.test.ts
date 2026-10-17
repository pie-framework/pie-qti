import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('PNP structured labels (G-13)', () => {
	it('choice: announces the answer set as one group named by the prompt', () => {
		const source = read('../src/plugins/choice/ChoiceInteraction.svelte');
		expect(source).toContain('structuredLabelSupport?: boolean;');
		// The group references the prompt's id, so its name follows the question.
		expect(source).toContain('{...interactionAria(parsedInteraction)} {...structuredAria}');
		expect(source).toContain("if (parsedInteraction.prompt) return { role: 'group', 'aria-labelledby': promptId ?? '' };");
		expect(source).toContain("t('interactions.choice.groupLabel', 'Answer choices')");
		// The prompt renders with the id the group references.
		expect(source).toContain('<div id={promptId} part="prompt"');
		// An authored accessible name still wins over the generic label.
		expect(source).toContain('parsedInteraction.accessibility?.label');
	});

	it('match: announces the answer set as one group named by the prompt', () => {
		const source = read('../src/plugins/match/MatchInteraction.svelte');
		expect(source).toContain('structuredLabelSupport?: boolean;');
		expect(source).toContain('{...interactionAria(parsedInteraction)} {...structuredAria}');
		expect(source).toContain("if (parsedInteraction.prompt) return { role: 'group', 'aria-labelledby': promptId ?? '' };");
		expect(source).toContain("i18n?.t('interactions.match.groupLabel') ?? 'Matching items'");
		expect(source).toContain('<div id={promptId} part="prompt"');
		expect(source).toContain('structuredLabels={structuredLabelSupport}');
	});

	it('match columns: their visible headings name the groups when structured labels are on', () => {
		const source = read('../src/shared/components/MatchDragDrop.svelte');
		expect(source).toContain('structuredLabels?: boolean;');
		expect(source).toContain("aria-labelledby={structuredLabels ? 'qti-match-source-heading' : undefined}");
		expect(source).toContain("aria-labelledby={structuredLabels ? 'qti-match-target-heading' : undefined}");
		expect(source).toContain('id="qti-match-source-heading"');
		expect(source).toContain('id="qti-match-target-heading"');
	});
});
