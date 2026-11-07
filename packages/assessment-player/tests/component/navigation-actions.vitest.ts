import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import NavigationBar from '../../src/components/NavigationBar.svelte';
import type { NavigationState } from '../../src/types/index.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

function navState(overrides: Partial<NavigationState> = {}): NavigationState {
	return {
		currentIndex: 1,
		totalItems: 5,
		canNext: true,
		canPrevious: true,
		isLoading: false,
		...overrides,
	};
}

async function renderNav(props: Record<string, unknown>) {
	const m = mountInto(NavigationBar, { i18n, navState: navState(), ...props });
	mounted.push(m);
	await settle();
	return m;
}

describe('NavigationBar answered counts and item actions', () => {
	test('shows the answered count with the progress and in the bar name', async () => {
		const m = await renderNav({ answeredCount: 3 });
		expect(m.host.querySelector('[data-testid="assessment-answered-count"]')?.textContent).toBe('3 of 5 answered');
		expect(m.host.querySelector('progress')?.getAttribute('aria-label')).toBe(
			'Progress: 40%: Question 2 of 5. 3 of 5 answered',
		);
	});

	test('the flag toggle carries a visible label and the pressed state', async () => {
		const onToggleFlag = vi.fn();
		const m = await renderNav({ onToggleFlag });
		const flag = m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-flag"]')!;
		expect(flag.textContent).toContain('Flag for review');
		expect(flag.getAttribute('aria-pressed')).toBe('false');
		flag.click();
		expect(onToggleFlag).toHaveBeenCalledOnce();

		const pressed = await renderNav({ onToggleFlag, flagged: true });
		expect(
			pressed.host.querySelector<HTMLButtonElement>('[data-testid="assessment-flag"]')!.getAttribute('aria-pressed'),
		).toBe('true');
	});

	test('the review button toggles its label and reports open state', async () => {
		const onToggleReview = vi.fn();
		const m = await renderNav({ showReview: true, onToggleReview });
		const review = m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-review"]')!;
		expect(review.textContent).toContain('Review questions');
		expect(review.getAttribute('aria-expanded')).toBe('false');
		review.click();
		expect(onToggleReview).toHaveBeenCalledOnce();

		const open = await renderNav({ showReview: true, onToggleReview, reviewOpen: true });
		expect(open.host.querySelector<HTMLButtonElement>('[data-testid="assessment-review"]')!.textContent).toContain(
			'Back to question',
		);
		expect(open.host.querySelector('[data-testid="assessment-review"]')!.getAttribute('aria-expanded')).toBe('true');
	});

	test('the final submit is styled apart from the primary Next and keeps its label', async () => {
		const m = await renderNav({ navState: navState({ currentIndex: 4, canNext: false }), onSubmit: vi.fn() });
		const submit = m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]')!;
		expect(submit.className).toContain('submit-button');
		expect(submit.className).not.toContain('primary');
		expect(submit.querySelector('.nav-button-label')?.textContent).toBe('Submit');
		expect(submit.querySelector('svg')).not.toBeNull();
		expect(m.host.querySelector('[data-testid="assessment-next"]')).toBeNull();
	});

	test('flag and review ignore activation while a transition is in flight', async () => {
		const onToggleFlag = vi.fn();
		const onToggleReview = vi.fn();
		const m = await renderNav({
			navState: navState({ isLoading: true }),
			onToggleFlag,
			showReview: true,
			onToggleReview,
		});
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-flag"]')!.click();
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-review"]')!.click();
		expect(onToggleFlag).not.toHaveBeenCalled();
		expect(onToggleReview).not.toHaveBeenCalled();
	});
});
