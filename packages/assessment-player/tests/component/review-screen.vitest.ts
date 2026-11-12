import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ReviewScreen from '../../src/components/ReviewScreen.svelte';
import type { ReviewItemView } from '../../src/core/reviewState.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

function item(overrides: Partial<ReviewItemView> & { index: number }): ReviewItemView {
	return {
		identifier: `q${overrides.index}`,
		index: overrides.index,
		number: overrides.index + 1,
		sectionId: 's1',
		status: 'unanswered',
		flagged: false,
		visited: false,
		jumpAllowed: true,
		isCurrent: false,
		...overrides,
	};
}

async function renderReview(props: Record<string, unknown> = {}) {
	const m = mountInto(ReviewScreen, { i18n, answeredCount: 2, totalItems: 4, flaggedCount: 0, onJump: vi.fn(), ...props });
	mounted.push(m);
	await settle();
	return m;
}

const NONLINEAR_GROUP = {
	id: 's1',
	index: 0,
	title: 'Fractions',
	navigable: true,
	items: [
		item({ index: 0, status: 'answered', visited: true, isCurrent: true }),
		item({ index: 1, status: 'partiallyAnswered', visited: true }),
		item({ index: 2, status: 'unanswered', visited: true }),
		item({ index: 3, status: 'unanswered', visited: false, flagged: true }),
	],
};

describe('ReviewScreen', () => {
	test('summarizes answered and flagged counts', async () => {
		const m = await renderReview({ groups: [NONLINEAR_GROUP], flaggedCount: 1 });
		expect(m.host.querySelector('[data-testid="review-answered-summary"]')?.textContent).toBe('2 of 4 answered');
		expect(m.host.querySelector('[data-testid="review-flagged-summary"]')?.textContent).toBe('1 flagged for review');
	});

	test('names every state in text next to an icon, never colour alone', async () => {
		const m = await renderReview({ groups: [NONLINEAR_GROUP] });
		const statuses = Array.from(m.host.querySelectorAll('.review-status')).map((node) => node.textContent?.trim());
		expect(statuses).toEqual(['Answered', 'Partially answered', 'Not answered', 'Not yet visited']);
		for (const node of m.host.querySelectorAll('.review-status')) {
			expect(node.querySelector('.review-status-icon')).not.toBeNull();
		}
	});

	test('offers a jump button per reachable item and marks the current one', async () => {
		const onJump = vi.fn();
		const m = await renderReview({ groups: [NONLINEAR_GROUP], onJump });

		const jumps = Array.from(m.host.querySelectorAll<HTMLButtonElement>('button.review-jump'));
		expect(jumps.map((button) => button.textContent)).toEqual([
			'Go to question 1',
			'Go to question 2',
			'Go to question 3',
			'Go to question 4',
		]);
		expect(jumps[0]!.getAttribute('aria-current')).toBe('true');
		expect(jumps[1]!.getAttribute('aria-current')).toBeNull();
		expect(m.host.querySelector('.review-current-badge')?.textContent).toBe('Current question');

		jumps[1]!.click();
		expect(onJump).toHaveBeenCalledWith(1);
	});

	test('disables jump buttons while a transition is in flight', async () => {
		const onJump = vi.fn();
		const m = await renderReview({ groups: [NONLINEAR_GROUP], onJump, busy: true });
		const jump = m.host.querySelector<HTMLButtonElement>('button.review-jump')!;
		expect(jump.disabled).toBe(true);
		jump.click();
		expect(onJump).not.toHaveBeenCalled();
	});

	test('linear parts render status only, with a note that explains why', async () => {
		const linearGroup = {
			id: 's1',
			index: 0,
			title: 'Part One',
			navigable: false,
			items: [
				item({ index: 0, visited: true, status: 'answered', jumpAllowed: false }),
				item({ index: 1, jumpAllowed: false }),
			],
		};
		const m = await renderReview({ groups: [linearGroup] });

		expect(m.host.querySelector('.review-note')?.textContent).toContain('you can only move forward');
		expect(m.host.querySelector('button.review-jump')).toBeNull();
		const statics = Array.from(m.host.querySelectorAll('.review-jump-static')).map((node) => node.textContent);
		expect(statics).toEqual(['Question 1 of 4', 'Question 2 of 4']);
	});

	test('groups by section title and marks the flagged item', async () => {
		const m = await renderReview({ groups: [NONLINEAR_GROUP] });
		expect(m.host.querySelector('.review-group-title')?.textContent).toBe('Fractions');
		const flagged = m.host.querySelector('.review-flag');
		expect(flagged?.textContent).toContain('Flagged');
	});

	test('renders accessible structure: a titled region, group headings and lists', async () => {
		const m = await renderReview({ groups: [NONLINEAR_GROUP], headingLevel: 2 });
		const region = m.host.querySelector('section.review-screen')!;
		expect(region.getAttribute('aria-labelledby')).toBe(region.querySelector('.review-title')!.id);
		expect(region.querySelector('.review-group')!.getAttribute('aria-labelledby')).toBe(
			region.querySelector('.review-group-title')!.id,
		);
		expect(m.host.querySelector('.review-list')).not.toBeNull();
	});
});
