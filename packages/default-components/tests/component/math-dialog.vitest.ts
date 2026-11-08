import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import type { ExtendedTextInteractionData } from '@pie-qti/item-player';

// The real MathLive needs layout and font APIs jsdom lacks; the dialog only needs
// a focusable <math-field> with a value, so a stand-in element is registered.
vi.mock('mathlive', () => ({}));

import { openMathLiveEditor } from '../../src/shared/extensions/MathLiveEditor';
import { getFocusableElements } from '../../src/shared/extensions/modalDialog';
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

/** An element outside the dialog that can take focus (a host overlay's heading). */
function outsideTarget(text: string): HTMLElement {
	const heading = document.createElement('h3');
	heading.tabIndex = -1;
	heading.textContent = text;
	document.body.appendChild(heading);
	return heading;
}

/** What the assessment shell dispatches on a proctor pause. */
function closeTransientUi() {
	document.dispatchEvent(new CustomEvent('pie-qti-close-transient-ui', { detail: { reason: 'pause' } }));
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
		// The candidate's own cancel: not an interruption.
		expect(onCancel).toHaveBeenCalledWith({ interrupted: false, latex: 'x^2' });
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

	test('a host closing transient UI (proctor pause) cancels the dialog and releases its focus trap', async () => {
		const opener = trigger();
		const onCancel = vi.fn();
		const onConfirm = vi.fn();
		document.body.style.overflow = 'auto';
		await open({ onConfirm, onCancel, initialLatex: 'x^2', mode: 'insert' });
		expect(document.activeElement).toBe(dialog().querySelector('math-field'));

		closeTransientUi();

		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(onCancel).toHaveBeenCalledTimes(1);
		// Reported as an interruption, with what was typed, so the opener can offer it again.
		expect(onCancel).toHaveBeenCalledWith({ interrupted: true, latex: 'x^2' });
		expect(onConfirm).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(opener);
		expect(document.body.style.overflow).toBe('auto');

		// The trap is gone: focus moved elsewhere (the pause overlay) stays there.
		const pauseHeading = outsideTarget('Paused');
		pauseHeading.focus();
		expect(document.activeElement).toBe(pauseHeading);
		// The listener went with the dialog: a later request finds nothing to close.
		closeTransientUi();
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	test('a dialog closed any other way stops listening for transient-UI closes', async () => {
		trigger();
		const onCancel = vi.fn();
		await open({ onConfirm: vi.fn(), onCancel });
		const removeListener = vi.spyOn(document, 'removeEventListener');

		Array.from(dialog().querySelectorAll('button'))
			.find((button) => button.textContent === 'Cancel')!
			.click();

		expect(removeListener).toHaveBeenCalledWith('pie-qti-close-transient-ui', expect.any(Function));
		removeListener.mockRestore();
		closeTransientUi();
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	test('a transient-UI close while MathLive loads cancels before the dialog opens', async () => {
		const opener = trigger();
		const onCancel = vi.fn();
		const pending = openMathLiveEditor({ onConfirm: vi.fn(), onCancel, initialLatex: 'y', mode: 'insert' });

		closeTransientUi();
		const close = await pending;

		expect(onCancel).toHaveBeenCalledTimes(1);
		// Nothing was typed yet: the initial value is what the opener keeps.
		expect(onCancel).toHaveBeenCalledWith({ interrupted: true, latex: 'y' });
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(opener);
		expect(document.body.style.overflow).toBe('');
		close();
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	test('the focus trap never chases focus that another containment takes straight back', async () => {
		trigger();
		await open({ onConfirm: vi.fn(), onCancel: vi.fn() });
		const modal = dialog();
		const pauseHeading = outsideTarget('Paused');
		let redirectsIn = 0;
		modal.addEventListener('focusin', () => redirectsIn++);

		// A host's pause containment, like the shell's: focus that lands outside its overlay
		// goes straight back to its heading, synchronously, from a window listener.
		const contain = (event: FocusEvent) => {
			if (event.target !== pauseHeading) pauseHeading.focus();
		};
		window.addEventListener('focusin', contain);
		try {
			pauseHeading.focus();
		} finally {
			window.removeEventListener('focusin', contain);
		}

		// One bounded attempt (the field, then each control, then the dialog), never recursion.
		expect(redirectsIn).toBeGreaterThan(0);
		expect(redirectsIn).toBeLessThanOrEqual(getFocusableElements(modal).length + 1);
		expect(document.activeElement).toBe(pauseHeading);

		// Without the competition, the trap works again.
		const outside = outsideTarget('Elsewhere');
		outside.focus();
		expect(modal.contains(document.activeElement)).toBe(true);
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

	/** The toolbar button that opens the inline insert dialog. */
	function insertInlineButton(m: MountedInteraction): HTMLButtonElement {
		return Array.from(m.host.querySelectorAll<HTMLButtonElement>('button[part="toolbar-button"]')).find(
			(button) => button.textContent?.trim() === 'Insert inline math',
		)!;
	}

	/** Open the insert dialog from the toolbar and return its math field. */
	async function openInsertDialog(button: HTMLButtonElement): Promise<FakeMathfield> {
		button.focus();
		button.click();
		await waitFor(() => document.querySelector('[role="dialog"] math-field') !== null);
		return document.querySelector('[role="dialog"] math-field') as unknown as FakeMathfield;
	}

	function typeLatex(field: FakeMathfield, latex: string) {
		field.value = latex;
		field.dispatchEvent(new Event('input'));
	}

	test('a proctor pause keeps the typed expression: reopening the insert dialog offers it again', async () => {
		const m = mountInteraction(ExtendedTextInteraction, { interaction: data });
		mounted.push(m);
		await settle();
		const insertInline = insertInlineButton(m);

		const field = await openInsertDialog(insertInline);
		expect(field.value).toBe('\\frac{a}{b}');
		typeLatex(field, '\\sqrt{2}');
		closeTransientUi();
		await settle();
		expect(document.querySelector('[role="dialog"]')).toBeNull();

		// After the pause: the field, and its LaTeX source preview, hold what was typed.
		const reopened = await openInsertDialog(insertInline);
		expect(reopened.value).toBe('\\sqrt{2}');
		expect(document.querySelector('[role="dialog"] code')?.textContent).toBe('\\sqrt{2}');

		// A second pause keeps it again, including edits made since.
		typeLatex(reopened, '\\sqrt{3}');
		closeTransientUi();
		await settle();
		expect((await openInsertDialog(insertInline)).value).toBe('\\sqrt{3}');
	});

	test("the candidate's own cancel discards a kept expression", async () => {
		const m = mountInteraction(ExtendedTextInteraction, { interaction: data });
		mounted.push(m);
		await settle();
		const insertInline = insertInlineButton(m);

		typeLatex(await openInsertDialog(insertInline), 'x^2');
		closeTransientUi();
		await settle();

		const restored = await openInsertDialog(insertInline);
		expect(restored.value).toBe('x^2');
		press(restored, 'Escape');
		await settle();

		expect((await openInsertDialog(insertInline)).value).toBe('\\frac{a}{b}');
	});

	test('a kept expression belongs to its own response field', async () => {
		const first = mountInteraction(ExtendedTextInteraction, { interaction: data });
		const second = mountInteraction(ExtendedTextInteraction, { interaction: { ...data, responseId: 'RESPONSE_2' } });
		mounted.push(first, second);
		await settle();

		typeLatex(await openInsertDialog(insertInlineButton(first)), 'a^2+b^2');
		closeTransientUi();
		await settle();

		const other = await openInsertDialog(insertInlineButton(second));
		expect(other.value).toBe('\\frac{a}{b}');
		press(other, 'Escape');
		await settle();
		expect((await openInsertDialog(insertInlineButton(first))).value).toBe('a^2+b^2');
	});
});
