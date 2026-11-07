import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentHeader from '../../src/components/AssessmentHeader.svelte';
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
	const m = mountInto(NavigationBar, { i18n, ...props });
	mounted.push(m);
	await settle();
	return m;
}

describe('NavigationBar', () => {
	test('is a labelled navigation landmark with Previous, the position and Next', async () => {
		const m = await renderNav({ navState: navState() });

		const nav = m.host.querySelector('nav')!;
		expect(nav.getAttribute('aria-label')).toBe('Assessment navigation');
		expect(m.host.querySelector('[data-testid="assessment-prev"]')?.textContent).toContain('Previous');
		expect(m.host.querySelector('[data-testid="assessment-next"]')?.textContent).toContain('Next');
		expect(m.host.querySelector('.progress-question')?.textContent).toBe('Question 2 of 5');
		expect(m.host.querySelector('progress')?.getAttribute('aria-label')).toBe('Progress: 40%: Question 2 of 5');
	});

	test('names an untitled section by its real position, never "of 0"', async () => {
		const m = await renderNav({
			navState: navState({ currentSection: { id: 's2', index: 1 }, totalSections: 3 }),
		});
		expect(m.host.querySelector('.progress-section-title')?.textContent).toBe('Section 2 of 3');
		expect(m.host.textContent).not.toContain('of 0');
	});

	test('shows a section title as given and nothing for a lone untitled section', async () => {
		const titled = await renderNav({
			navState: navState({ currentSection: { id: 's1', index: 0, title: 'Fractions' }, totalSections: 2 }),
		});
		expect(titled.host.querySelector('.progress-section-title')?.textContent).toBe('Fractions');

		const lone = await renderNav({
			navState: navState({ currentSection: { id: 's1', index: 0, title: '  ' }, totalSections: 1 }),
		});
		expect(lone.host.querySelector('.progress-section-title')).toBeNull();
	});

	test('offers Submit on the last item', async () => {
		const onSubmit = vi.fn();
		const m = await renderNav({ navState: navState({ currentIndex: 4, canNext: false }), onSubmit });

		expect(m.host.querySelector('[data-testid="assessment-next"]')).toBeNull();
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]')!.click();
		expect(onSubmit).toHaveBeenCalledOnce();
	});

	test('disables Previous where navigation forbids it', async () => {
		const m = await renderNav({ navState: navState({ canPrevious: false }) });
		expect(m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-prev"]')!.disabled).toBe(true);
	});

	test('while a transition is in flight the buttons stay focusable and ignore activation', async () => {
		const onNext = vi.fn();
		const m = await renderNav({ navState: navState({ isLoading: true }), onNext });

		const next = m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-next"]')!;
		expect(next.disabled).toBe(false);
		expect(next.getAttribute('aria-disabled')).toBe('true');
		expect(m.host.querySelector('nav')?.getAttribute('aria-busy')).toBe('true');
		next.click();
		expect(onNext).not.toHaveBeenCalled();
	});

	test('arrow icons are sized by the component and marked to mirror right-to-left', async () => {
		const m = await renderNav({ navState: navState() });
		const icons = m.host.querySelectorAll('svg.nav-icon-directional');
		expect(icons).toHaveLength(2);
		for (const icon of icons) {
			// Attribute sizes keep the icon small even before any stylesheet applies.
			expect(icon.getAttribute('width')).toBe('20');
			expect(icon.getAttribute('height')).toBe('20');
			expect(icon.getAttribute('aria-hidden')).toBe('true');
		}
	});
});

describe('AssessmentHeader', () => {
	test('renders the title at the requested heading level with the given id', async () => {
		const m = mountInto(AssessmentHeader, { title: 'Life Cycles Assessment', titleId: 'title-1', headingLevel: 1 });
		mounted.push(m);
		await settle();

		const heading = m.host.querySelector('h1')!;
		expect(heading.textContent).toBe('Life Cycles Assessment');
		expect(heading.id).toBe('title-1');
		expect(m.host.querySelector('header')).not.toBeNull();
	});

	test('defaults to a level-2 title and localizes the section menu', async () => {
		const m = mountInto(AssessmentHeader, {
			title: 'Assessment',
			i18n,
			sections: [
				{ id: 'a', index: 0, title: 'One' },
				{ id: 'b', index: 1, title: 'Two' },
			],
			currentSectionIndex: 0,
		});
		mounted.push(m);
		await settle();

		expect(m.host.querySelector('h2')?.textContent).toBe('Assessment');
		expect(m.host.querySelector('.section-menu > button')?.textContent).toContain('Sections');
	});
});
