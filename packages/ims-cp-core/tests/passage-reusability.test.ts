import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
	createStablePassageIdGenerator,
	generateStablePassageId,
	parseObjectReference,
} from '../src/passage-reusability.js';

function objectElement(attributes: Record<string, string>) {
	return {
		getAttribute: (name: string) => attributes[name],
	};
}

describe('generateStablePassageId', () => {
	test('uses the QTI identifier directly', async () => {
		expect(
			await generateStablePassageId({ qtiIdentifier: 'urn:example.com:passage:12345' })
		).toBe('urn:example.com:passage:12345');
	});

	test('normalizes a file path under the prefix', async () => {
		expect(await generateStablePassageId({ filePath: './passages/reading.xml' })).toBe(
			'passage-passages-reading'
		);
		expect(await generateStablePassageId({ filePath: '../shared/passage.html' })).toBe(
			'passage-shared-passage'
		);
	});

	test('hashes inline content into a 12-hex-character suffix', async () => {
		const id = await generateStablePassageId({ content: '  shared body  ' });
		const expected = createHash('sha256').update('shared body').digest('hex').substring(0, 12);
		expect(id).toBe(`passage-content-${expected}`);
	});

	test('rejects a call without any ID source', async () => {
		expect(generateStablePassageId({})).rejects.toThrow(/qtiIdentifier, filePath, or content/);
	});
});

describe('createStablePassageIdGenerator', () => {
	const generate = createStablePassageIdGenerator((content) =>
		createHash('sha256').update(content).digest('hex')
	);

	test('matches the async generator for every strategy', async () => {
		const cases = [
			{ qtiIdentifier: 'stim-industrial-revolution' },
			{ filePath: './stimuli/passage.xml' },
			{ filePath: '../shared/reading.html', prefix: 'stim' },
			{ content: 'The Industrial Revolution reshaped manufacturing.' },
		];
		for (const options of cases) {
			expect(generate(options)).toBe(await generateStablePassageId(options));
		}
	});

	test('rejects a call without any ID source', () => {
		expect(() => generate({})).toThrow(/qtiIdentifier, filePath, or content/);
	});
});

describe('parseObjectReference', () => {
	test('parses a text-typed object', () => {
		expect(parseObjectReference(objectElement({ data: 'passages/p-1.xml', type: 'text/html' })))
			.toEqual({
				id: 'passage-passages-p-1',
				source: 'file',
				filePath: 'passages/p-1.xml',
				isReusable: false,
			});
	});

	test('parses an untyped object naming a markup document', () => {
		expect(
			parseObjectReference(objectElement({ data: 'passages/p-1.html' }))?.filePath
		).toBe('passages/p-1.html');
		expect(
			parseObjectReference(objectElement({ data: 'passages/p-1.xhtml?a=1' }))?.filePath
		).toBe('passages/p-1.xhtml?a=1');
	});

	test('rejects an untyped object that is not markup, and non-text types', () => {
		expect(parseObjectReference(objectElement({ data: 'figures/figure.png' }))).toBeNull();
		expect(parseObjectReference(objectElement({ data: 'figures/figure.svg', type: 'image/svg+xml' }))).toBeNull();
		expect(parseObjectReference(objectElement({ type: 'text/html' }))).toBeNull();
	});
});
