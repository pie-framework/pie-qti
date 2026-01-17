/**
 * Session transformation endpoint
 * Transforms QTI items and assessments to PIE format
 */

import { json } from '@sveltejs/kit';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import { TransformEngine } from '@pie-qti/transform-core';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { id } = params;
	const body = await request.json();
	const { itemIds, assessmentIds } = body; // Optional: transform specific items

	const { storage, sessionStorage, appSessionStorage } = locals;
	const extractedPath = sessionStorage.getExtractedPath(id);
	const uploadsPath = sessionStorage.getUploadsPath(id);

	/**
	 * Normalize paths that may have lost leading slash during serialization
	 */
	function normalizePossiblyAbsolutePath(p: string): string {
		if (p.startsWith('Users/') || p.startsWith('home/')) {
			return `/${p}`;
		}
		return p;
	}

	/**
	 * Check if a path is absolute (storage paths are relative)
	 */
	function isAbsolutePath(p: string): boolean {
		return p.startsWith('/');
	}

	/**
	 * Read XML file from session storage with path resolution fallbacks
	 */
	async function readSessionXml(samplePath: string): Promise<string> {
		const normalized = normalizePossiblyAbsolutePath(samplePath);
		const candidates: string[] = [];

		if (isAbsolutePath(normalized)) {
			// Absolute path - try to resolve relative to session directories
			const pathWithoutLeadingSlash = normalized.substring(1);
			candidates.push(pathWithoutLeadingSlash);
		} else {
			// Relative path - try different base directories
			candidates.push(`${extractedPath}/${normalized}`);
			candidates.push(`${uploadsPath}/${normalized}`);

			const baseName = normalized.split('/').pop();
			if (baseName && baseName !== normalized) {
				candidates.push(`${uploadsPath}/${baseName}`);
				candidates.push(`${extractedPath}/${baseName}`);
			}
		}

		// Try each candidate path
		for (const candidate of candidates) {
			try {
				if (await storage.exists(candidate)) {
					return await storage.readText(candidate);
				}
			} catch {
				// Try next candidate
				continue;
			}
		}

		throw new Error(`ENOENT: no such file or directory, open '${candidates[0] || samplePath}'`);
	}

	/**
	 * Recursively find all assessment test XML files in a directory
	 */
	async function findAssessmentTestPaths(rootDir: string, limit = 50): Promise<string[]> {
		const found: string[] = [];
		const stack: string[] = [rootDir];

		while (stack.length > 0 && found.length < limit) {
			const dir = stack.pop()!;

			let entries: string[] = [];
			try {
				if (!(await storage.exists(dir))) continue;
				entries = await storage.listFiles(dir);
			} catch {
				continue;
			}

			for (const entryName of entries) {
				const fullPath = `${dir}/${entryName}`;

				// Check if it's a directory by trying to list it
				let isDirectory = false;
				try {
					await storage.listFiles(fullPath);
					isDirectory = true;
				} catch {
					isDirectory = false;
				}

				if (isDirectory) {
					stack.push(fullPath);
					continue;
				}

				if (!entryName.toLowerCase().endsWith('.xml')) continue;

				try {
					const xml = await storage.readText(fullPath);
					if (xml.toLowerCase().includes('<assessmenttest')) {
						found.push(fullPath);
						if (found.length >= limit) break;
					}
				} catch {
					// Ignore unreadable file
				}
			}
		}

		return found;
	}

	/**
	 * Convert file ID to title by replacing separators with spaces
	 */
	function titleFromId(fileId: string): string {
		return fileId.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/**
	 * Return single item if array has one element, otherwise return full array
	 */
	function firstOrAll(items: unknown[]) {
		return items.length === 1 ? items[0] : items;
	}

	/**
	 * Extract error message from unknown error type
	 */
	function errorMessage(e: unknown): string {
		return e instanceof Error ? e.message : String(e);
	}

	// Get session metadata with analysis
	const session = await appSessionStorage.getSession(id);

	if (!session) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	if (!session.analysis) {
		return json({ error: 'Session not analyzed yet' }, { status: 400 });
	}

	// Create transform engine with QTI to PIE plugin
	const engine = new TransformEngine();
	engine.use(new Qti22ToPiePlugin());

	const results = {
		items: [] as Array<{
			identifier: string;
			title: string;
			pieConfig: unknown;
			warnings: unknown[];
		}>,
		assessments: [] as Array<{
			identifier: string;
			title: string;
			pieConfig: unknown;
			warnings: unknown[];
		}>,
		errors: [] as Array<{ identifier: string; error: string }>,
	};

	// Transform items
	const itemIdSet: Set<string> | null =
		Array.isArray(itemIds) && itemIds.length > 0 ? new Set<string>(itemIds) : null;

	const itemsToTransform: Array<{ id: string; title: string; sourcePath: string; xml: string }> = [];
	const seenSourcePaths = new Set<string>();

	for (const pkg of session.analysis.packages) {
		for (const [_interactionType, filePaths] of Object.entries(pkg.samples.interactions)) {
			for (const sourcePath of filePaths) {
				if (seenSourcePaths.has(sourcePath)) continue;
				seenSourcePaths.add(sourcePath);

				const fileName = sourcePath.split('/').pop() || 'unknown';
				const fileId = fileName.replace(/\.xml$/i, '');
				if (itemIdSet && !itemIdSet.has(fileId)) continue;

				const xml = await readSessionXml(sourcePath);
				itemsToTransform.push({
					id: fileId,
					title: titleFromId(fileId),
					sourcePath,
					xml,
				});
			}
		}
	}

	// Execute item transformations
	for (const item of itemsToTransform) {
		try {
			const result = await engine.transform(item.xml, { sourceFormat: 'qti22', targetFormat: 'pie' });
			results.items.push({
				identifier: item.id,
				title: item.title,
				pieConfig: firstOrAll(result.items),
				warnings: result.warnings ?? [],
			});
		} catch (error: unknown) {
			results.errors.push({
				identifier: item.id,
				error: errorMessage(error),
			});
		}
	}

	// Transform assessments (if requested)
	if (Array.isArray(assessmentIds) && assessmentIds.length > 0) {
		const assessmentIdSet = new Set<string>(assessmentIds);
		const paths = [
			...new Set<string>([
				...(await findAssessmentTestPaths(extractedPath, 50)),
				...(await findAssessmentTestPaths(uploadsPath, 50)),
			]),
		];

		for (const path of paths) {
			const fileName = path.split('/').pop() || 'unknown';
			const fileId = fileName.replace(/\.xml$/i, '');
			if (!assessmentIdSet.has(fileId)) continue;

			try {
				const xml = await readSessionXml(path);
				const result = await engine.transform(xml, { sourceFormat: 'qti22', targetFormat: 'pie' });
				results.assessments.push({
					identifier: fileId,
					title: titleFromId(fileId),
					pieConfig: firstOrAll(result.items),
					warnings: result.warnings ?? [],
				});
			} catch (error: unknown) {
				results.errors.push({
					identifier: fileId,
					error: errorMessage(error),
				});
			}
		}
	}

	// Save transformation results
	const transformationResult = {
		sessionId: id,
		status: (results.errors.length === 0 ? 'success' : results.errors.length < results.items.length ? 'partial' : 'failed') as 'success' | 'partial' | 'failed',
		startTime: new Date(),
		endTime: new Date(),
		duration: 0,
		packages: [{
			packageName: 'default',
			items: results.items.map(item => ({
				sourceId: item.identifier,
				sourcePath: item.identifier,
				outputPath: '',
				type: 'item' as const,
				success: true,
				warnings: item.warnings.map(w => ({ message: String(w) })),
				metadata: { interactions: [], pieElements: [] },
			})),
			errors: results.errors.map(e => ({
				file: e.identifier,
				error: e.error,
				packagePath: 'default',
			})),
		}],
		summary: {
			totalItems: results.items.length + results.errors.length,
			successfulItems: results.items.length,
			failedItems: results.errors.length,
			totalAssessments: results.assessments.length,
			successfulAssessments: results.assessments.length,
			totalPassages: 0,
			successfulPassages: 0,
		},
		// Include flattened arrays for UI
		items: results.items,
		assessments: results.assessments,
		errors: results.errors,
	};

	await appSessionStorage.saveTransformation(id, transformationResult);

	return json(results);
};
