import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SectionMenu from '../../src/components/SectionMenu.svelte';
import { mountInto, press, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

const sections = [
	{ id: 's1', title: 'Fractions', index: 0, navigable: true, answered: 3, total: 4, isCurrent: true },
	{ id: 's2', title: 'Geometry', index: 1, navigable: true, answered: 0, total: 2, isCurrent: false },
	{ id: 's3', title: 'Locked part', index: 2, navigable: false, answered: 1, total: 5, isCurrent: false },
];

async function renderMenu(props: Record<string, unknown> = {}) {
	const i18n = props.i18n ?? new DefaultI18nProvider('en-US');
	const m = mountInto(SectionMenu, { sections, i18n, onSectionSelect: vi.fn(), ...props });
	mounted.push(m);
	await settle();
	return m as ReturnType<typeof mountInto> & { props: Record<string, unknown> };
}

describe('SectionMenu disclosure', () => {
	test('is a disclosure button, not a role=menu', async () => {
		const m = await renderMenu();
		const toggle = m.host.querySelector<HTMLButtonElement>('.section-menu-toggle')!;
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		// While closed the list is not in the DOM: aria-controls is dropped rather than
		// left dangling; it names the list only while the menu is open.
		expect(toggle.getAttribute('aria-controls')).toBeNull();
		expect(m.host.querySelector('[role="menu"]')).toBeNull();
		expect(m.host.querySelector('[role="menuitemradio"]')).toBeNull();
	});

	test('opens on click, focuses the current section and shows answered counts', async () => {
		const m = await renderMenu();
		const toggle = m.host.querySelector<HTMLButtonElement>('.section-menu-toggle')!;
		toggle.click();
		await settle();

		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		const list = m.host.querySelector('ul.section-list')!;
		expect(list.id).toBe(toggle.getAttribute('aria-controls'));
		const items = Array.from(m.host.querySelectorAll<HTMLButtonElement>('.section-item'));
		expect(items).toHaveLength(3);
		// Focus lands on the current section.
		expect(document.activeElement).toBe(items[0]);
		expect(items[0]!.getAttribute('aria-current')).toBe('true');
		// Status counts per section, visible next to each title.
		const statuses = items.map((item) => item.querySelector('.section-status')?.textContent);
		expect(statuses).toEqual(['3 of 4 answered', '0 of 2 answered', '1 of 5 answered']);
	});

	test('only legal jump targets are enabled', async () => {
		const m = await renderMenu();
		m.host.querySelector<HTMLButtonElement>('.section-menu-toggle')!.click();
		await settle();
		const items = Array.from(m.host.querySelectorAll<HTMLButtonElement>('.section-item'));
		expect(items[0]!.disabled).toBe(false);
		expect(items[1]!.disabled).toBe(false);
		expect(items[2]!.disabled).toBe(true);
	});

	test('Escape closes and returns focus to the toggle', async () => {
		const m = await renderMenu();
		const toggle = m.host.querySelector<HTMLButtonElement>('.section-menu-toggle')!;
		toggle.click();
		await settle();
		expect(toggle.getAttribute('aria-expanded')).toBe('true');

		press(m.host.querySelector('.section-item')!, 'Escape');
		await settle();

		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(toggle);
	});

	test('ArrowDown opens the menu too', async () => {
		const m = await renderMenu();
		const toggle = m.host.querySelector<HTMLButtonElement>('.section-menu-toggle')!;
		press(toggle, 'ArrowDown');
		await settle();
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
	});

	test('choosing a section reports it and closes', async () => {
		const onSectionSelect = vi.fn();
		const m = await renderMenu({ onSectionSelect });
		m.host.querySelector<HTMLButtonElement>('.section-menu-toggle')!.click();
		await settle();
		m.host.querySelectorAll<HTMLButtonElement>('.section-item')[1]!.click();
		await settle();

		expect(onSectionSelect).toHaveBeenCalledWith(1);
		expect(m.host.querySelector('.section-menu-toggle')!.getAttribute('aria-expanded')).toBe('false');
	});

	test('a pointer press outside the open menu closes it without stealing focus', async () => {
		const m = await renderMenu();
		const toggle = m.host.querySelector<HTMLButtonElement>('.section-menu-toggle')!;
		toggle.click();
		await settle();

		const outside = document.createElement('button');
		document.body.appendChild(outside);
		outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await settle();
		outside.remove();

		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).not.toBe(toggle);
	});

	test('strings localize through the provider', async () => {
		const french = new DefaultI18nProvider('fr-FR');
		await french.loadLocale('fr-FR');
		const m = await renderMenu({ i18n: french });
		m.host.querySelector<HTMLButtonElement>('.section-menu-toggle')!.click();
		await settle();
		const statuses = Array.from(m.host.querySelectorAll('.section-status')).map((node) => node.textContent);
		expect(statuses).toEqual(['3 sur 4 répondues', '0 sur 2 répondues', '1 sur 5 répondues']);
	});

	test('renders nothing for a single section', async () => {
		const m = await renderMenu({ sections: [sections[0]] });
		expect(m.host.querySelector('.section-menu')).toBeNull();
	});
});
