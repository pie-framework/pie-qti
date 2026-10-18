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
});
