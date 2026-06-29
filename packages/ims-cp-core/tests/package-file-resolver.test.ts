import { describe, expect, test } from 'bun:test';
import {
	buildPackageFileIndex,
	resolvePackageReference,
} from '../src/package-file-resolver';
import { STRICT_QTI_CONFIG } from '../src/qti-heuristics';

describe('package file resolver', () => {
	test('resolves checked source-relative refs while preserving query and fragment', () => {
		const fileIndex = buildPackageFileIndex([
			'items/item.xml',
			'items/images/chart.png',
		]);

		const result = resolvePackageReference({
			fileIndex,
			sourcePath: 'items/item.xml',
			rawHref: ' images\\chart.png?version=1#label ',
			referenceKind: 'media-asset',
		});

		expect(result.status).toBe('resolved');
		if (result.status !== 'resolved') return;
		expect(result.resolvedPath).toBe('items/images/chart.png');
		expect(result.renderHref).toBe('items/images/chart.png?version=1#label');
		expect(result.strategy).toBe('source-relative');
		expect(result.heuristic).toBe(false);
	});

	test('uses unique path-segment suffix heuristics for media assets', () => {
		const fileIndex = buildPackageFileIndex([
			'items/item.xml',
			'shared/graphics/diagram.png',
		]);

		const result = resolvePackageReference({
			fileIndex,
			sourcePath: 'items/item.xml',
			rawHref: 'graphics/diagram.png',
			referenceKind: 'media-asset',
		});

		expect(result.status).toBe('resolved');
		if (result.status !== 'resolved') return;
		expect(result.resolvedPath).toBe('shared/graphics/diagram.png');
		expect(result.strategy).toBe('unique-suffix');
		expect(result.heuristic).toBe(true);
	});

	test('uses case-insensitive suffix heuristics for lenient media assets', () => {
		const fileIndex = buildPackageFileIndex([
			'items/item.xml',
			'shared/graphics/Diagram.PNG',
		]);

		const result = resolvePackageReference({
			fileIndex,
			sourcePath: 'items/item.xml',
			rawHref: 'graphics/diagram.png',
			referenceKind: 'media-asset',
		});

		expect(result.status).toBe('resolved');
		if (result.status !== 'resolved') return;
		expect(result.resolvedPath).toBe('shared/graphics/Diagram.PNG');
		expect(result.strategy).toBe('unique-suffix');
		expect(result.heuristic).toBe(true);
	});

	test('uses unique basename heuristics only for media-like asset refs', () => {
		const fileIndex = buildPackageFileIndex([
			'items/item.xml',
			'items/testitems/QUESTION_1_Q/578832.gif',
		]);

		const mediaResult = resolvePackageReference({
			fileIndex,
			sourcePath: 'items/item.xml',
			rawHref: 'testitems/578832.gif',
			referenceKind: 'media-asset',
		});
		const sourceResult = resolvePackageReference({
			fileIndex,
			sourcePath: 'items/item.xml',
			rawHref: 'testitems/578832.gif',
			referenceKind: 'source-xml',
		});

		expect(mediaResult.status).toBe('resolved');
		if (mediaResult.status === 'resolved') {
			expect(mediaResult.resolvedPath).toBe('items/testitems/QUESTION_1_Q/578832.gif');
			expect(mediaResult.strategy).toBe('unique-basename');
		}
		expect(sourceResult.status).toBe('missing');
	});

	test('does not treat one-segment suffixes as source XML recovery', () => {
		const fileIndex = buildPackageFileIndex(['content/bank/items/item2.xml']);

		const result = resolvePackageReference({
			fileIndex,
			sourcePath: 'content/tests/test.xml',
			rawHref: 'item2.xml',
			referenceKind: 'source-xml',
			manifestEvidencePaths: new Set(['content/bank/items/item2.xml']),
		});

		expect(result.status).toBe('missing');
	});

	test('does not treat one-segment suffixes as stylesheet recovery', () => {
		const fileIndex = buildPackageFileIndex(['shared/styles/theme.css']);

		const result = resolvePackageReference({
			fileIndex,
			sourcePath: 'content/items/item.xml',
			rawHref: 'theme.css',
			referenceKind: 'stylesheet',
		});

		expect(result.status).toBe('missing');
	});

	test('does not use suffix or basename heuristics in strict mode', () => {
		const fileIndex = buildPackageFileIndex(['shared/graphics/diagram.png']);

		const result = resolvePackageReference({
			fileIndex,
			sourcePath: 'items/item.xml',
			rawHref: 'graphics/diagram.png',
			referenceKind: 'media-asset',
			heuristicsConfig: STRICT_QTI_CONFIG,
		});

		expect(result.status).toBe('missing');
		expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
			'IMS_CP_REFERENCE_HEURISTIC_DISABLED'
		);
	});

	test('keeps ambiguous suffix and basename matches unresolved', () => {
		const fileIndex = buildPackageFileIndex([
			'shared/a/diagram.png',
			'shared/b/diagram.png',
		]);

		const result = resolvePackageReference({
			fileIndex,
			sourcePath: 'items/item.xml',
			rawHref: 'diagram.png',
			referenceKind: 'media-asset',
		});

		expect(result.status).toBe('ambiguous');
		expect(result.candidatePaths).toEqual(['shared/a/diagram.png', 'shared/b/diagram.png']);
		expect(result.diagnostics[0]?.code).toBe('IMS_CP_REFERENCE_AMBIGUOUS');
	});

	test('treats root escape attempts as terminal even when basename would match', () => {
		const fileIndex = buildPackageFileIndex(['safe/secret.png']);

		const result = resolvePackageReference({
			fileIndex,
			sourcePath: 'item.xml',
			rawHref: '../secret.png',
			referenceKind: 'media-asset',
		});

		expect(result.status).toBe('unsafe');
		expect(result.diagnostics[0]?.code).toBe('IMS_CP_REFERENCE_UNSAFE');
	});

	test('treats encoded traversal and separator attempts as terminal', () => {
		const fileIndex = buildPackageFileIndex(['safe/secret.png']);

		for (const rawHref of ['%2e%2e/secret.png', '..%2fsecret.png', '..%5csecret.png', '%252e%252e/secret.png']) {
			const result = resolvePackageReference({
				fileIndex,
				sourcePath: 'item.xml',
				rawHref,
				referenceKind: 'media-asset',
			});

			expect(result.status).toBe('unsafe');
			expect(result.diagnostics[0]?.code).toBe('IMS_CP_REFERENCE_UNSAFE');
		}
	});

	test('diagnoses unsafe file index entries and canonical collisions', () => {
		const fileIndex = buildPackageFileIndex([
			'images/chart.png',
			'images/./chart.png',
			'/absolute.png',
			'../outside.png',
			'%252e%252e/secret.png',
			'..%2fsecret.png',
		]);

		expect(fileIndex.exactPaths).toEqual(new Set(['images/chart.png']));
		expect(fileIndex.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
			'IMS_CP_FILE_INDEX_COLLISION',
			'IMS_CP_FILE_INDEX_UNSAFE_PATH',
			'IMS_CP_FILE_INDEX_UNSAFE_PATH',
			'IMS_CP_FILE_INDEX_UNSAFE_PATH',
			'IMS_CP_FILE_INDEX_UNSAFE_PATH',
		]);
	});
});
