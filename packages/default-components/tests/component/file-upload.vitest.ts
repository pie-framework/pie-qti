import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import FileUpload from '../../src/shared/components/FileUpload.svelte';
import { settle, waitFor } from './helpers';

interface Harness {
	changes: unknown[];
	errorText: () => string | undefined;
	input: HTMLInputElement;
	host: HTMLElement;
	instance: Record<string, unknown>;
}

function mountFileUpload(props: Record<string, unknown> = {}): Harness {
	const changes: unknown[] = [];
	const host = document.createElement('div');
	document.body.appendChild(host);
	const instance = mount(FileUpload, {
		target: host,
		props: {
			responseId: 'RESPONSE',
			onChange: (value: unknown) => changes.push(value),
			...props,
		},
	}) as unknown as Record<string, unknown>;
	return {
		changes,
		errorText: () => host.querySelector('[role="alert"]')?.textContent ?? undefined,
		input: host.querySelector<HTMLInputElement>('input[type="file"]')!,
		host,
		instance,
	};
}

async function chooseFile(input: HTMLInputElement, file: File): Promise<void> {
	Object.defineProperty(input, 'files', { value: [file], configurable: true });
	input.dispatchEvent(new Event('change', { bubbles: true }));
	await settle();
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('FileUpload', () => {
	test('accepting a file within the cap produces a data-url response', async () => {
		const harness = mountFileUpload({ maxFileSizeBytes: 1024 });
		await chooseFile(harness.input, new File(['hello'], 'answer.txt', { type: 'text/plain' }));
		await waitFor(() => harness.changes.length > 0);

		expect(harness.changes).toHaveLength(1);
		const response = harness.changes[0] as { name: string; type: string; dataUrl: string };
		expect(response.name).toBe('answer.txt');
		expect(response.type).toBe('text/plain');
		expect(response.dataUrl).toMatch(/^data:/);
		expect(harness.errorText()).toBeUndefined();
		unmount(harness.instance as never);
	});

	test('rejects an oversized file before conversion and reports why', async () => {
		const harness = mountFileUpload({ maxFileSizeBytes: 10 });
		await chooseFile(
			harness.input,
			new File(['this file is definitely larger than ten bytes'], 'big.txt', { type: 'text/plain' }),
		);

		expect(harness.changes).toEqual([null]);
		expect(harness.errorText()).toContain('big.txt');
		expect(harness.errorText()).toContain('Maximum size is 10 bytes');
	});

	test('rejects files whose type is not allowed', async () => {
		const harness = mountFileUpload({ fileTypes: ['.pdf', 'application/pdf'] });
		await chooseFile(harness.input, new File(['nope'], 'virus.exe', { type: 'application/octet-stream' }));

		expect(harness.changes).toEqual([null]);
		expect(harness.errorText()).toContain('.pdf');
	});

	test('accepting an empty file list clears the response', async () => {
		const harness = mountFileUpload();
		Object.defineProperty(harness.input, 'files', { value: [], configurable: true });
		harness.input.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();

		expect(harness.changes).toEqual([null]);
	});

	const value = {
		name: 'answer.txt',
		type: 'text/plain',
		size: 5,
		lastModified: 0,
		dataUrl: 'data:text/plain;base64,aGVsbG8=',
	};

	function findRemove(host: HTMLElement): HTMLButtonElement {
		return Array.from(host.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === 'Remove file',
		)!;
	}

	test('removing the file resets the input and keeps focus on it (round 6)', async () => {
		const harness = mountFileUpload({ value });
		const remove = findRemove(harness.host);
		expect(remove).not.toBeNull();

		// Choose a file so the native input holds a filename, then remove it.
		await chooseFile(harness.input, new File(['later'], 'later.txt', { type: 'text/plain' }));
		await waitFor(() => harness.changes.length > 0);
		harness.changes.length = 0;

		remove.focus();
		remove.click();
		await settle();

		// The response cleared, the native input reset (re-choosing the same file works),
		// and focus landed on the input instead of the document body.
		expect(harness.changes).toEqual([null]);
		expect(harness.input.value).toBe('');
		expect(document.activeElement).toBe(harness.input);
	});

	test('the removal is announced politely (round 6)', async () => {
		const harness = mountFileUpload({ value });
		const remove = findRemove(harness.host);
		remove.click();
		await settle();

		const live = harness.host.querySelector('[aria-live="polite"]');
		expect(live?.textContent).toContain('File removed.');
	});

	test('re-choosing the same file after a removal works (round 6)', async () => {
		const harness = mountFileUpload({ value });
		const file = () => new File(['same'], 'same.txt', { type: 'text/plain' });
		await chooseFile(harness.input, file());
		await waitFor(() => harness.changes.length > 0);

		findRemove(harness.host).click();
		await settle();
		expect(harness.changes.at(-1)).toBeNull();

		// The native input keeps no value, so re-choosing the same file fires a change.
		await chooseFile(harness.input, file());
		await waitFor(() => harness.changes.length > 2);
		expect((harness.changes.at(-1) as { name: string }).name).toBe('same.txt');
	});

	test('candidate-visible strings never fall back to raw catalog keys (round 6)', async () => {
		const harness = mountFileUpload({ value });
		const text = harness.host.textContent ?? '';
		expect(text).not.toContain('interactions.upload.');
		expect(text).toContain('Upload a file');
		expect(text).toContain('Selected:');
		expect(text).toContain('Remove file');

		// The oversize error carries its English fallback, not the key.
		const limited = mountFileUpload({ maxFileSizeBytes: 5 });
		await chooseFile(limited.input, new File(['way more than five bytes'], 'big.txt', { type: 'text/plain' }));
		expect(limited.errorText()).toContain('Maximum size is 5 bytes');
		expect(limited.errorText()).not.toContain('interactions.upload.');
	});
});
