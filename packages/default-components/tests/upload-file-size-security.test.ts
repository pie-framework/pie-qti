import { expect, test } from 'bun:test';

const fileUpload = await Bun.file(
	new URL('../src/shared/components/FileUpload.svelte', import.meta.url),
).text();
const uploadInteraction = await Bun.file(
	new URL('../src/plugins/upload/UploadInteraction.svelte', import.meta.url),
).text();

test('FileUpload rejects oversized files before FileReader/base64 conversion', () => {
	const limitCheck = fileUpload.indexOf('if (file.size > effectiveMaxFileSizeBytes)');
	const conversion = fileUpload.indexOf('await fileToResponse(file)');

	expect(fileUpload).toContain('const DEFAULT_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024');
	expect(fileUpload).toContain('Number.isFinite(maxFileSizeBytes)');
	expect(limitCheck).toBeGreaterThan(-1);
	expect(conversion).toBeGreaterThan(limitCheck);
	expect(fileUpload.slice(limitCheck, conversion)).toContain('onChange(null)');
});

test('the public upload interaction forwards its configurable byte cap', () => {
	expect(uploadInteraction).toContain('maxFileSizeBytes?: number');
	expect(uploadInteraction).toContain('{maxFileSizeBytes}');
});
