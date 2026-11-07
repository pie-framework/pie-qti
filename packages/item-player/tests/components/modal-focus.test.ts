/**
 * The feedback dialog opens as a real modal where the browser has `showModal()` (falling back to
 * an in-place dialog where it does not, as in jsdom), and focus goes back to where it was — or to
 * the player when that control can no longer take it.
 */

import { describe, expect, test } from 'bun:test';
import {
	closeModalDialog,
	deepActiveElement,
	focusContainer,
	openModalDialog,
	restoreFocus,
} from '../../src/components/utils/focus.js';

function fakeDialog({ withShowModal }: { withShowModal: boolean }) {
	const calls: string[] = [];
	const attributes = new Map<string, string>();
	const dialog = {
		open: false,
		setAttribute(name: string, value: string) {
			attributes.set(name, value);
			if (name === 'open') this.open = true;
		},
		removeAttribute(name: string) {
			attributes.delete(name);
			if (name === 'open') this.open = false;
		},
		close() {
			calls.push('close');
			this.open = false;
		},
		...(withShowModal
			? {
					showModal() {
						calls.push('showModal');
						dialog.open = true;
					},
				}
			: {}),
	};
	return { dialog: dialog as unknown as HTMLDialogElement, calls, attributes };
}

describe('openModalDialog', () => {
	test('opens with showModal, which makes the page behind it inert', () => {
		const { dialog, calls } = fakeDialog({ withShowModal: true });
		expect(openModalDialog(dialog)).toBe('modal');
		expect(calls).toEqual(['showModal']);
		expect(dialog.open).toBe(true);
	});

	test('falls back to opening in place where showModal is missing', () => {
		const { dialog, attributes } = fakeDialog({ withShowModal: false });
		expect(openModalDialog(dialog)).toBe('non-modal');
		expect(attributes.has('open')).toBe(true);
	});

	test('closes an open dialog and leaves a closed one alone', () => {
		const { dialog, calls } = fakeDialog({ withShowModal: true });
		closeModalDialog(dialog);
		expect(calls).toEqual([]);
		openModalDialog(dialog);
		closeModalDialog(dialog);
		expect(calls).toEqual(['showModal', 'close']);
		expect(dialog.open).toBe(false);
	});
});

function fakeDocument() {
	const document = {
		activeElement: null as unknown,
		body: {} as unknown,
		documentElement: {} as unknown,
	};
	const element = (focusable = true) => {
		const attributes = new Map<string, string>();
		const listeners = new Map<string, () => void>();
		const node = {
			isConnected: true,
			ownerDocument: document,
			shadowRoot: null,
			focus() {
				if (focusable || attributes.has('tabindex')) document.activeElement = node;
			},
			hasAttribute: (name: string) => attributes.has(name),
			setAttribute: (name: string, value: string) => attributes.set(name, value),
			removeAttribute: (name: string) => attributes.delete(name),
			addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
			blur() {
				listeners.get('blur')?.();
			},
			attributes,
		};
		return node;
	};
	return { document, element };
}

describe('restoreFocus', () => {
	test('returns focus to the control that had it', () => {
		const { element } = fakeDocument();
		const button = element();
		expect(restoreFocus(button as unknown as Element)).toBe(true);
	});

	test('reports when the control can no longer take focus', () => {
		const { document, element } = fakeDocument();
		const disabled = element(false);
		expect(restoreFocus(disabled as unknown as Element)).toBe(false);
		const removed = { ...element(), isConnected: false };
		expect(restoreFocus(removed as unknown as Element)).toBe(false);
		expect(restoreFocus(document.body as Element)).toBe(false);
		expect(restoreFocus(null)).toBe(false);
	});

	test('a container takes focus only while it holds it', () => {
		const { document, element } = fakeDocument();
		const player = element(false);
		focusContainer(player as unknown as HTMLElement);
		expect(document.activeElement).toBe(player);
		expect(player.attributes.get('tabindex')).toBe('-1');
		player.blur();
		expect(player.attributes.has('tabindex')).toBe(false);
	});

	test('finds focus inside open shadow roots', () => {
		const inner = { shadowRoot: null };
		const host = { shadowRoot: { activeElement: inner } };
		expect(deepActiveElement({ activeElement: host } as unknown as Document)).toBe(inner as unknown as Element);
	});
});
