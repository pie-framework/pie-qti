import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import type { ExtendedTextInteractionData } from '@pie-qti/item-player';

// The real MathLive needs layout and font APIs jsdom lacks; the dialog only needs
// a focusable <math-field> with a value, so a stand-in element is registered.
vi.mock('mathlive', () => ({}));

import { openMathLiveEditor } from '../../src/shared/extensions/MathLiveEditor';
import ExtendedTextInteraction from '../../src/plugins/extended-text/ExtendedTextInteraction.svelte';
import { cleanupInteraction, type MountedInteraction, mountInteraction, q, settle, waitFor } from './helpers';

class FakeMathfield extends HTMLElement {
	value = '';
	executeCommand = vi.fn();
	connectedCallback() {
		if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
	}
}

beforeAll(() => {
	if (!customElements.get('math-field')) customElements.define('math-field', FakeMathfield);
});

const mounted: MountedInteraction[] = [];
const openDialogs: Array<() => void> = [];

/** Open the editor and remember how to close it, so no dialog outlives its test. */
async function open(options: Parameters<typeof openMathLiveEditor>[0]) {
	const close = await openMathLiveEditor(options);
	openDialogs.push(close);
	return close;
}

afterEach(() => {
	for (const close of openDialogs.splice(0)) close();
	cleanupInteraction(...mounted.splice(0));
	for (const node of Array.from(document.body.children)) node.remove();
	document.body.style.overflow = '';
});

function dialog(): HTMLElement {
	return document.querySelector<HTMLElement>('[role="dialog"]')!;
}

function byId(id: string | null): HTMLElement | null {
	return id ? document.getElementById(id) : null;
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...init });
	target.dispatchEvent(event);
	return event;
}

function trigger(label = 'Insert inline math'): HTMLButtonElement {
	const button = document.createElement('button');
	button.type = 'button';
	button.textContent = label;
	document.body.appendChild(button);
	button.focus();
	return button;
}

describe('MathLive editor dialog', () => {
	test('is a named, described modal dialog with a labelled math field that receives focus', async () => {
		const opener = trigger();
		await open({ onConfirm: vi.fn(), onCancel: vi.fn(), mode: 'insert' });

		const modal = dialog();
		expect(modal.getAttribute('aria-modal')).toBe('true');
		expect(byId(modal.getAttribute('aria-labelledby'))?.textContent).toBe('Insert inline math');
		expect(byId(modal.getAttribute('aria-describedby'))?.textContent).toBe(
			'Type the expression, or open the math keyboard. Press Escape to cancel.',
		);

		const field = modal.querySelector<HTMLElement>('math-field')!;
		const label = modal.querySelector<HTMLLabelElement>('label')!;
		expect(label.htmlFor).toBe(field.id);
		expect(field.getAttribute('aria-labelledby')).toBe(label.id);
		expect(label.textContent).toBe('Math expression');
		expect(document.activeElement).toBe(field);

		// The empty-source hint is localized text, not hardcoded English in the code path.
		expect(modal.querySelector('code')?.textContent).toBe('LaTeX will appear here');
		const buttons = Array.from(modal.querySelectorAll('button')).map((button) => button.textContent);
		expect(buttons).toEqual(['Math keyboard', 'Cancel', 'Insert']);
		expect(modal.querySelector('button')!.getAttribute('aria-pressed')).toBe('false');
		expect(document.body.style.overflow).toBe('hidden');
		expect(opener.isConnected).toBe(true);
	});

	test('Escape cancels and returns focus to the control that opened it', async () => {
		const opener = trigger();
		const onCancel = vi.fn();
		const onConfirm = vi.fn();
		document.body.style.overflow = 'auto';
		await open({ onConfirm, onCancel, initialLatex: 'x^2', mode: 'insert' });

		const field = dialog().querySelector('math-field')!;
		// Caught before the editor (MathLive maps Escape to its LaTeX mode) can claim it.
		const escapeKey = press(field, 'Escape');

		expect(escapeKey.defaultPrevented).toBe(true);
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(opener);
		expect(document.body.style.overflow).toBe('auto');
	});

	test('Escape during IME composition belongs to the input method', async () => {
		trigger();
		const onCancel = vi.fn();
		await open({ onConfirm: vi.fn(), onCancel });

		press(dialog().querySelector('math-field')!, 'Escape', { isComposing: true });

		expect(onCancel).not.toHaveBeenCalled();
		expect(dialog()).not.toBeNull();
	});

	test('Tab and Shift+Tab stay inside the dialog', async () => {
		trigger();
		await open({ onConfirm: vi.fn(), onCancel: vi.fn() });

		const modal = dialog();
		const field = modal.querySelector<HTMLElement>('math-field')!;
		const confirm = Array.from(modal.querySelectorAll('button')).at(-1)!;

		confirm.focus();
		expect(press(confirm, 'Tab').defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(field);

		expect(press(field, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(confirm);
	});

	test('focus moved outside by other means comes back to the dialog', async () => {
		trigger();
		const outside = document.createElement('button');
		document.body.appendChild(outside);
		await open({ onConfirm: vi.fn(), onCancel: vi.fn() });

		outside.focus();

		expect(dialog().contains(document.activeElement)).toBe(true);
	});

	test('Insert confirms with the field value, after returning focus to the opener', async () => {
		const opener = trigger();
		let focusedAtConfirm: Element | null = null;
		const onConfirm = vi.fn(() => {
			focusedAtConfirm = document.activeElement;
		});
		await open({ onConfirm, onCancel: vi.fn(), mode: 'insert' });

		const modal = dialog();
		const field = modal.querySelector('math-field') as unknown as FakeMathfield;
		field.value = '\\sqrt{2}';
		field.dispatchEvent(new Event('input'));
		expect(modal.querySelector('code')?.textContent).toBe('\\sqrt{2}');

		Array.from(modal.querySelectorAll('button')).at(-1)!.click();

		expect(onConfirm).toHaveBeenCalledWith('\\sqrt{2}');
		expect(focusedAtConfirm).toBe(opener);
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	test('if the math field cannot take focus, focus still lands inside the dialog', async () => {
		trigger();
		// A field that never upgraded (MathLive failed to load) cannot be focused.
		const inert = document.createElement('div');
		const panel = document.createElement('div');
		panel.setAttribute('role', 'dialog');
		const first = document.createElement('button');
		first.textContent = 'Math keyboard';
		panel.append(inert, first);
		document.body.appendChild(panel);
		const { createModalDialog } = await import('../../src/shared/extensions/modalDialog');
		const modal = createModalDialog(panel, { initialFocus: inert });

		modal.ensureFocusInside();

		expect(document.activeElement).toBe(first);
		modal.release({ restoreFocus: false });
	});

	test('a dialog its host removed stops trapping focus', async () => {
		trigger();
		await open({ onConfirm: vi.fn(), onCancel: vi.fn() });
		dialog().parentElement!.remove();

		const outside = document.createElement('button');
		document.body.appendChild(outside);
		outside.focus();
		expect(press(outside, 'Tab').defaultPrevented).toBe(false);
		expect(document.activeElement).toBe(outside);
	});

	test('editing existing math says so in the title and the confirm button', async () => {
		trigger();
		await open({ onConfirm: vi.fn(), onCancel: vi.fn(), initialLatex: 'a+b', isBlock: true });

		const modal = dialog();
		expect(byId(modal.getAttribute('aria-labelledby'))?.textContent).toBe('Edit block math');
		expect(Array.from(modal.querySelectorAll('button')).at(-1)!.textContent).toBe('Update');
	});

	test('a click on the backdrop cancels; the returned function closes silently', async () => {
		trigger();
		const onCancel = vi.fn();
		await open({ onConfirm: vi.fn(), onCancel });
		const backdrop = dialog().parentElement!;
		backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(onCancel).toHaveBeenCalledTimes(1);

		const onSecondCancel = vi.fn();
		const close = await open({ onConfirm: vi.fn(), onCancel: onSecondCancel });
		close();
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(onSecondCancel).not.toHaveBeenCalled();
	});

	test('all candidate-visible strings come from the interactions.mathInput catalog', async () => {
		trigger();
		const messages: Record<string, string> = {
			'interactions.mathInput.insertBlockTitle': 'Wiskundeblok invoegen',
			'interactions.mathInput.instructions': 'Typ de expressie.',
			'interactions.mathInput.fieldLabel': 'Wiskundige expressie',
			'interactions.mathInput.latexEmpty': 'De LaTeX-code verschijnt hier',
			'interactions.mathInput.toggleKeyboard': 'Wiskundetoetsenbord',
			'interactions.mathInput.insert': 'Invoegen',
			'common.cancel': 'Annuleren',
		};
		const i18n = { t: (key: string, fallback?: string) => messages[key] ?? fallback ?? key };
		await open({ onConfirm: vi.fn(), onCancel: vi.fn(), isBlock: true, mode: 'insert', i18n });

		const modal = dialog();
		expect(byId(modal.getAttribute('aria-labelledby'))?.textContent).toBe('Wiskundeblok invoegen');
		expect(byId(modal.getAttribute('aria-describedby'))?.textContent).toBe('Typ de expressie.');
		expect(modal.querySelector('label')?.textContent).toBe('Wiskundige expressie');
		expect(modal.querySelector('code')?.textContent).toBe('De LaTeX-code verschijnt hier');
		expect(Array.from(modal.querySelectorAll('button')).map((button) => button.textContent)).toEqual([
			'Wiskundetoetsenbord',
			'Annuleren',
			'Invoegen',
		]);
	});
});

describe('Rich text editor math insertion', () => {
	const data: ExtendedTextInteractionData = {
		type: 'extendedTextInteraction',
		responseId: 'RESPONSE',
		cardinality: 'single',
		base: 10,
		baseType: 'string',
		minStrings: 0,
		maxStrings: 0,
		expectedLines: 3,
		expectedLength: 0,
		prompt: '<p>Show your working.</p>',
		placeholderText: '',
		format: 'xhtml',
	};

	test('cancelling the dialog returns focus to the toolbar button that opened it', async () => {
		const m = mountInteraction(ExtendedTextInteraction, { interaction: data });
		mounted.push(m);
		await settle();

		const insertInline = Array.from(m.host.querySelectorAll<HTMLButtonElement>('button[part="toolbar-button"]')).find(
			(button) => button.textContent?.trim() === 'Insert inline math',
		)!;
		insertInline.focus();
		insertInline.click();
		await waitFor(() => document.querySelector('[role="dialog"]') !== null);

		expect(document.querySelector('[role="dialog"] math-field')).toBe(document.activeElement);
		press(document.activeElement!, 'Escape');
		await settle();

		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(insertInline);
		expect(q(m, '[contenteditable]')).not.toBeNull();
	});
});
