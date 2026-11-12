import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import EndAttemptInteraction from '../../src/plugins/end-attempt/EndAttemptInteraction.svelte';
import type { EndAttemptInteractionData } from '@pie-qti/item-player';
import {
	mountInteraction,
	pressKey,
	q,
	settle,
} from './helpers';

function endAttemptData(overrides: Partial<EndAttemptInteractionData> = {}): EndAttemptInteractionData {
	return {
		type: 'endAttemptInteraction',
		responseId: 'END_ATTEMPT',
		title: "I don't know",
		countAttempt: true,
		prompt: null,
		...overrides,
	};
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('EndAttemptInteraction (pie-qti-end-attempt)', () => {
	test('renders the authored title as the visible (and only) accessible name', async () => {
		const mounted = mountInteraction(EndAttemptInteraction, {
			interaction: endAttemptData(),
		});
		await settle();

		const button = q<HTMLButtonElement>(mounted, 'button[part="button"]')!;
		expect(button.textContent).toContain("I don't know");
		// The visible text is the name; an aria-label that stops matching it breaks WCAG 2.5.3.
		expect(button.getAttribute('aria-label')).toBeNull();
	});

	test('a counted attempt requires confirmation before the response is emitted', async () => {
		const mounted = mountInteraction(EndAttemptInteraction, {
			interaction: endAttemptData(),
			response: null,
		});
		await settle();

		q<HTMLButtonElement>(mounted, 'button[part="button"]')!.click();
		await settle();

		// No response yet — the inline confirmation step is shown instead.
		expect(mounted.instance.response).toBeNull();
		expect(mounted.events).toHaveLength(0);
		const confirm = q<HTMLButtonElement>(mounted, 'button[part="confirm-button"]')!;
		expect(confirm.textContent).toContain('Yes, end attempt');
		expect(q(mounted, '[part="confirm"]')?.textContent).toContain('Are you sure you want to end your attempt?');
		// Focus moved to the confirm button.
		expect(document.activeElement).toBe(confirm);
	});

	test('Escape cancels the confirmation and returns focus to the end button', async () => {
		const mounted = mountInteraction(EndAttemptInteraction, {
			interaction: endAttemptData(),
		});
		await settle();

		q<HTMLButtonElement>(mounted, 'button[part="button"]')!.click();
		await settle();
		pressKey(q(mounted, '.qti-end-attempt-interaction')!, 'Escape');
		await settle();

		expect(q(mounted, '[part="confirm"]')).toBeNull();
		expect(document.activeElement?.getAttribute('part')).toBe('button');
		expect(mounted.events).toHaveLength(0);

		// The interaction is still armed: confirming after cancelling works.
		q<HTMLButtonElement>(mounted, 'button[part="button"]')!.click();
		await settle();
		q<HTMLButtonElement>(mounted, 'button[part="confirm-button"]')!.click();
		await settle();
		expect(mounted.events).toHaveLength(1);
	});

	test('confirming ends the attempt exactly once, emits value true, and moves focus to the announced status', async () => {
		const mounted = mountInteraction(EndAttemptInteraction, {
			interaction: endAttemptData(),
		});
		await settle();

		q<HTMLButtonElement>(mounted, 'button[part="button"]')!.click();
		await settle();
		q<HTMLButtonElement>(mounted, 'button[part="confirm-button"]')!.click();
		await settle();

		expect(mounted.instance.response).toBe(true);
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.detail).toMatchObject({ responseId: 'END_ATTEMPT', value: true });

		// The button disabled itself; focus was moved to the status message.
		const status = q<HTMLElement>(mounted, '[part~="status"]')!;
		expect(status.getAttribute('role')).toBe('status');
		expect(status.getAttribute('tabindex')).toBe('-1');
		expect(document.activeElement).toBe(status);
		expect(status.textContent).toContain('Your attempt has ended.');

		// The ended button keeps its visible label as its name and cannot re-fire.
		const button = q<HTMLButtonElement>(mounted, 'button[part="button"]')!;
		expect(button.disabled).toBe(true);
		expect(button.textContent).toContain('Attempt Ended');
		expect(q(mounted, '[part="confirm"]')).toBeNull();

		button.click();
		await settle();
		expect(mounted.events).toHaveLength(1);
	});

	test('countAttempt=false ends immediately without a confirmation step', async () => {
		const mounted = mountInteraction(EndAttemptInteraction, {
			interaction: endAttemptData({ countAttempt: false }),
		});
		await settle();

		q<HTMLButtonElement>(mounted, 'button[part="button"]')!.click();
		await settle();

		expect(mounted.instance.response).toBe(true);
		expect(mounted.events).toHaveLength(1);
		expect(q(mounted, '[part="confirm"]')).toBeNull();
		expect(document.activeElement?.getAttribute('part')).toContain('status');
	});

	test('an externally restored response=true shows the ended state without emitting', async () => {
		const mounted = mountInteraction(EndAttemptInteraction, {
			interaction: endAttemptData(),
			response: true,
		});
		await settle();

		expect(mounted.events).toHaveLength(0);
		const button = q<HTMLButtonElement>(mounted, 'button[part="button"]')!;
		expect(button.disabled).toBe(true);
		expect(button.textContent).toContain('Attempt Ended');
		expect(q(mounted, '[part~="status"]')?.getAttribute('role')).toBe('status');
	});

	test('an external reset to null re-arms the interaction', async () => {
		const mounted = mountInteraction(EndAttemptInteraction, {
			interaction: endAttemptData(),
			response: true,
		});
		await settle();

		mounted.instance.response = null;
		await settle();

		const button = q<HTMLButtonElement>(mounted, 'button[part="button"]')!;
		expect(button.disabled).toBe(false);
		expect(button.textContent).toContain("I don't know");
		expect(q(mounted, '[part~="status"]')).toBeNull();

		button.click();
		await settle();
		q<HTMLButtonElement>(mounted, 'button[part="confirm-button"]')!.click();
		await settle();
		expect(mounted.events).toHaveLength(1);
	});

	test('disabled blocks ending entirely', async () => {
		const mounted = mountInteraction(EndAttemptInteraction, {
			interaction: endAttemptData(),
			disabled: true,
		});
		await settle();

		const button = q<HTMLButtonElement>(mounted, 'button[part="button"]')!;
		expect(button.disabled).toBe(true);
		button.click();
		await settle();

		expect(mounted.events).toHaveLength(0);
		expect(q(mounted, '[part="confirm"]')).toBeNull();
	});
});

// jsdom does not compute shadow styles, so the CSS contracts are asserted against
// the component source (same approach as tests/pnp-styles.test.ts).
describe('EndAttemptInteraction style contracts', () => {
	const source = readFileSync(resolve(process.cwd(), 'src/plugins/end-attempt/EndAttemptInteraction.svelte'), 'utf8');

	test('controls are self-contained token-styled targets of at least 44px', () => {
		expect(source).toContain('min-height: 2.75rem');
		expect(source).toContain('var(--pie-qti-border-strong, #767676)');
		expect(source).toContain('var(--pie-qti-warning-text, #92400e)');
		expect(source).not.toContain('btn-error');
		expect(source).not.toContain('alert-warning');
	});
});
