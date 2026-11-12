import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { SUBMIT_DIALOG_ACTION_RULE } from '../src/components/submitDialogAction.js';

/**
 * The dialog action buttons' rule family (`.submit-dialog-action`) lives in one
 * source, `src/components/submitDialogAction.ts`. It was copied across the
 * submit confirmation, the resume prompt and the leave-part warning, and the
 * copies drifted apart; this test fails if a dialog grows its own copy again.
 */

const COMPONENTS = new URL('../src/components/', import.meta.url).pathname;

/** Selectors the shared rule must carry, and a declaration each. */
const FAMILY: ReadonlyArray<[selector: string, declaration: string]> = [
	['.submit-dialog-action {', 'box-sizing: border-box'],
	['.submit-dialog-action:hover:not', 'background: var(--pie-qti-base-200, oklch(98% 0 0))'],
	['.submit-dialog-action:focus-visible', 'outline: 2px solid var(--pie-qti-focus, #4338ca)'],
	[".submit-dialog-action[aria-disabled='true']", 'cursor: not-allowed'],
	['.submit-dialog-action.primary {', 'border-color: var(--pie-qti-primary'],
	['.submit-dialog-action.primary:hover:not', 'color-mix(in oklab, var(--pie-qti-primary'],
	['.submit-dialog-action.danger {', 'border-color: var(--pie-qti-error-text'],
	['.submit-dialog-action.danger:hover:not', 'color-mix(in oklab, var(--pie-qti-error-text'],
];

describe('the dialog action styles have one source', () => {
	test('the shared module carries the whole family', () => {
		for (const [selector, declaration] of FAMILY) {
			expect(SUBMIT_DIALOG_ACTION_RULE).toContain(selector);
			expect(SUBMIT_DIALOG_ACTION_RULE).toContain(declaration);
		}
	});

	test.each([
		'SubmitConfirmDialog.svelte',
		'ResumeDialog.svelte',
		'LeavePartDialog.svelte',
	])('%s renders the shared class and injects the shared rule instead of a copy', (file) => {
		const source = readFileSync(`${COMPONENTS}${file}`, 'utf8');
		expect(source).toContain('class="submit-dialog-action');
		expect(source).toContain('ensureSubmitDialogActionStyles');
		// A private copy compiles to a tab-indented scoped style rule inside the
		// component's <style> block; the class attribute in the markup never does.
		expect(source).not.toMatch(/^\t+\.submit-dialog-action[\s.{:[]/m);
	});
});
