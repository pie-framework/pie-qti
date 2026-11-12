// Importing each dialog runs its module script, which asks for the one shared
// action-button rule; jsdom hosts the document the rule lands in.
import { describe, expect, test } from 'vitest';
import '../../src/components/ResumeDialog.svelte';
import '../../src/components/SubmitConfirmDialog.svelte';
import '../../src/components/LeavePartDialog.svelte';

const injectedStyles = () => document.querySelectorAll('style[data-submit-dialog-action-source]');

describe('the shared dialog action rule', () => {
	test('lands once per document, no matter how many dialogs ask for it', () => {
		expect(injectedStyles().length).toBe(1);
	});

	test('carries the family the dialog buttons wear', () => {
		const rule = injectedStyles()[0]?.textContent ?? '';
		for (const selector of [
			'.submit-dialog-action {',
			".submit-dialog-action:hover:not([aria-disabled='true'])",
			'.submit-dialog-action:focus-visible',
			".submit-dialog-action[aria-disabled='true']",
			'.submit-dialog-action.primary {',
			'.submit-dialog-action.danger {',
		]) {
			expect(rule).toContain(selector);
		}
	});
});
