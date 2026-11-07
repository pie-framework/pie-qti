import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { INTERACTION_DESCRIPTION_ID, interactionAria } from '../src/shared/utils/interactionAria';

const sharedCss = readFileSync(
	new URL('../src/shared/styles/qti-shared-vocabulary.css', import.meta.url),
	'utf8',
);

describe('shared vocabulary stylesheet', () => {
	it.each([
		'.qti-display-table-cell',
		'.qti-width-1-12',
		'.qti-width-11-12',
		'.qti-width-full',
		'.qti-fullwidth',
		'.qti-height-px',
		'.qti-height-5-6',
		'.qti-height-auto',
		'.qti-text-indent-32',
		'.qti-flex-direction-column',
		'.qti-flex-grow-1',
		'.qti-float-left',
		'.qti-float-clear-both',
		'.qti-float-clearfix::after',
		'.qti-writing-mode-vertical-rl',
		'.qti-text-orientation-mixed',
		'.qti-text-orientation-sideways',
		'.qti-text-combine-upright-all',
		'.qti-list-style-type-none',
		'.qti-list-style-type-cjk-ideographic',
		'.qti-list-style-type-urdu',
	])('styles %s', (selector) => {
		expect(sharedCss).toContain(selector);
	});

	it('draws qti-well from theme tokens so it follows dark themes and PNP schemes', () => {
		const well = /\.qti-well\s*\{([^}]*)\}/.exec(sharedCss)?.[1] ?? '';
		expect(well).toContain('border: 1px solid var(--pie-qti-border-strong, #767676);');
		expect(well).toContain('background-color: var(--pie-qti-base-200, #f9f9f9);');
		expect(well).not.toMatch(/#ccc\b/);
	});
});

describe('interaction accessible names', () => {
	it('labels a group from the authored accessibility', () => {
		expect(interactionAria({ accessibility: { label: 'Planets', description: 'Pick two.' } })).toEqual({
			role: 'group',
			'aria-label': 'Planets',
			'aria-describedby': INTERACTION_DESCRIPTION_ID,
		});
		expect(interactionAria({ accessibility: { description: 'Pick two.' } })).toEqual({
			role: 'group',
			'aria-describedby': INTERACTION_DESCRIPTION_ID,
		});
	});

	it('adds nothing without authored accessibility', () => {
		expect(interactionAria({})).toEqual({});
		expect(interactionAria(undefined)).toEqual({});
	});
});
