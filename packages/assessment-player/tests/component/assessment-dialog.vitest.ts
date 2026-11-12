import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentDialog from '../../src/components/AssessmentDialog.svelte';
import { mountInto, press, settle, type Mounted } from './helpers';
import { reactiveProps } from './reactive-props.svelte';

const mounted: Mounted[] = [];
const nativeShowModal = HTMLDialogElement.prototype.showModal;
const nativeClose = HTMLDialogElement.prototype.close;

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	for (const node of Array.from(document.body.children)) node.remove();
	HTMLDialogElement.prototype.showModal = nativeShowModal;
	HTMLDialogElement.prototype.close = nativeClose;
});

function trigger(): HTMLButtonElement {
	const button = document.createElement('button');
	button.textContent = 'Submit assessment';
	document.body.appendChild(button);
	button.focus();
	return button;
}

async function openDialog(props: Record<string, unknown>) {
	const state = reactiveProps({ open: true, title: 'Submit your answers?', ...props });
	const m = mountInto(AssessmentDialog, state);
	mounted.push(m);
	await settle();
	const dialog = m.host.querySelector('dialog')!;
	return { m, state, dialog };
}

/** jsdom has no showModal(); emulate the native contract to cover that path. */
function installNativeDialog() {
	const calls = { showModal: 0, close: 0 };
	HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
		calls.showModal += 1;
		this.setAttribute('open', '');
	};
	HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
		calls.close += 1;
		this.removeAttribute('open');
		this.dispatchEvent(new Event('close'));
	};
	return calls;
}

describe('AssessmentDialog', () => {
	test('is named by its title and described by its description', async () => {
		const { dialog } = await openDialog({ description: 'You cannot change answers afterwards.' });

		const title = dialog.querySelector('h2')!;
		expect(title.textContent).toBe('Submit your answers?');
		expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
		const description = document.getElementById(dialog.getAttribute('aria-describedby')!);
		expect(description?.textContent).toBe('You cannot change answers afterwards.');
	});

	test('without showModal it opens as a modal fallback, focuses the title and returns focus on Escape', async () => {
		const opener = trigger();
		const onCancel = vi.fn();
		const onClose = vi.fn();
		const { state, dialog } = await openDialog({ onCancel, onClose });

		expect(dialog.hasAttribute('open')).toBe(true);
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		expect(document.activeElement).toBe(dialog.querySelector('h2'));

		press(dialog, 'Escape');
		await settle();

		expect(onCancel).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledWith('cancel');
		expect(state.open).toBe(false);
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(document.activeElement).toBe(opener);
	});

	test('uses showModal when available; the native cancel request cancels and restores focus', async () => {
		const calls = installNativeDialog();
		const opener = trigger();
		const onClose = vi.fn();
		const { state, dialog } = await openDialog({ onClose });

		expect(calls.showModal).toBe(1);
		expect(dialog.getAttribute('aria-modal')).toBeNull();

		const cancel = new Event('cancel', { cancelable: true });
		dialog.dispatchEvent(cancel);
		await settle();

		expect(cancel.defaultPrevented).toBe(true);
		expect(onClose).toHaveBeenCalledWith('cancel');
		expect(state.open).toBe(false);
		expect(calls.close).toBe(1);
		expect(document.activeElement).toBe(opener);
	});

	test('a dialog the browser closes on its own reports a cancel', async () => {
		installNativeDialog();
		const onClose = vi.fn();
		const { state, dialog } = await openDialog({ onClose });

		dialog.removeAttribute('open');
		dialog.dispatchEvent(new Event('close'));
		await settle();

		expect(state.open).toBe(false);
		expect(onClose).toHaveBeenCalledWith('cancel');
	});

	test('a non-dismissible dialog ignores Escape', async () => {
		const onClose = vi.fn();
		const { state, dialog } = await openDialog({ dismissible: false, onClose });

		press(dialog, 'Escape');
		await settle();

		expect(state.open).toBe(true);
		expect(onClose).not.toHaveBeenCalled();
	});

	test('confirm runs onConfirm, then closes with reason "confirm"', async () => {
		const onConfirm = vi.fn();
		const onClose = vi.fn();
		const { state, m } = await openDialog({ confirmLabel: 'Submit', cancelLabel: 'Go back', onConfirm, onClose });

		const confirm = m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!;
		expect(confirm.textContent?.trim()).toBe('Submit');
		confirm.click();
		await settle();

		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledWith('confirm');
		expect(state.open).toBe(false);
	});

	test('closeOnConfirm=false keeps the dialog open for the caller to close', async () => {
		const onConfirm = vi.fn();
		const { state, m } = await openDialog({ closeOnConfirm: false, onConfirm });

		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!.click();
		await settle();

		expect(onConfirm).toHaveBeenCalledOnce();
		expect(state.open).toBe(true);
	});

	test('a confirm handler that unmounts the dialog does not touch torn-down state', async () => {
		const onClose = vi.fn();
		// A host may swap the whole shell (and this dialog with it) while onConfirm runs.
		const { state, m } = await openDialog({
			onClose,
			onConfirm: () => {
				m.destroy();
			},
		});

		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!.click();
		await settle();

		expect(state.open).toBe(true);
		expect(onClose).not.toHaveBeenCalled();
	});

	test('busy actions stay focusable but unavailable, and ignore activation', async () => {
		const onConfirm = vi.fn();
		const { m } = await openDialog({ busy: true, onConfirm });

		const confirm = m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!;
		expect(confirm.getAttribute('aria-disabled')).toBe('true');
		expect(confirm.disabled).toBe(false);
		confirm.click();
		await settle();

		expect(onConfirm).not.toHaveBeenCalled();
	});

	test('initialFocus "cancel" focuses the cancel action', async () => {
		const { m } = await openDialog({ initialFocus: 'cancel' });
		expect(document.activeElement).toBe(m.host.querySelector('[data-testid="assessment-dialog-cancel"]'));
	});

	test('Tab wraps inside the fallback dialog', async () => {
		const { dialog, m } = await openDialog({ initialFocus: 'confirm' });
		const cancel = m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-cancel"]')!;
		const confirm = m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!;
		expect(document.activeElement).toBe(confirm);

		const forward = press(dialog, 'Tab');
		expect(forward.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(cancel);

		const backward = press(dialog, 'Tab', { shiftKey: true });
		expect(backward.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(confirm);
	});

	test('opening again later moves focus into the dialog again', async () => {
		const opener = trigger();
		const { state, dialog } = await openDialog({});
		press(dialog, 'Escape');
		await settle();
		expect(document.activeElement).toBe(opener);

		state.open = true;
		await settle();
		expect(dialog.hasAttribute('open')).toBe(true);
		expect(document.activeElement).toBe(dialog.querySelector('h2'));
	});

	test('a close event queued by an earlier close does not shut the reopened dialog', async () => {
		// Browsers fire `close` from a queued task, and Chromium runs input (the click that
		// reopens the dialog) before it, so the stale event can arrive after the reopen.
		HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
			this.setAttribute('open', '');
		};
		HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
			this.removeAttribute('open');
			setTimeout(() => this.dispatchEvent(new Event('close')), 20);
		};
		const onClose = vi.fn();
		const { state, dialog } = await openDialog({ onClose });

		state.open = false;
		await settle();
		expect(dialog.hasAttribute('open')).toBe(false);
		state.open = true;
		await settle();
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(state.open).toBe(true);
		expect(dialog.hasAttribute('open')).toBe(true);
		expect(onClose).not.toHaveBeenCalled();
	});
});
