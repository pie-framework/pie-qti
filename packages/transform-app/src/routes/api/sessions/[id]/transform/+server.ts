import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import { TransformEngine } from '@pie-qti/transform-core';
import { json } from '@sveltejs/kit';
import { getStorage } from '$lib/server/storage/FileStorage';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const { id } = params;
	const body = await request.json();
	const { itemIds, assessmentIds } = body; // Optional: transform specific items

	const sessionManager = getSessionManager();
	const storage = getStorage();
	const extractedPath = storage.getExtractedPath(id);
	const uploadsPath = storage.getUploadsPath(id);
	const extractedRoot = resolve(extractedPath);
	const uploadsRoot = resolve(uploadsPath);

	function normalizePossiblyAbsolutePath(p: string): string {
		// Some analysis data may have lost the leading '/' (e.g. "Users/…") when serialized.
		if (!isAbsolute(p) && (p.startsWith('Users/') || p.startsWith('home/'))) {
			return `/${p}`;
		}
		return p;
	}

	async function readSessionXml(samplePath: string): Promise<string> {
		const normalized = normalizePossiblyAbsolutePath(samplePath);
		const candidates: string[] = [];

		if (isAbsolute(normalized)) {
			candidates.push(normalized);
		} else {
			candidates.push(join(extractedPath, normalized));
			candidates.push(join(uploadsPath, normalized));
			const baseName = normalized.split('/').pop();
			if (baseName && baseName !== normalized) {
				candidates.push(join(uploadsPath, baseName));
				candidates.push(join(extractedPath, baseName));
			}
		}

		for (const candidate of candidates) {
			const resolved = resolve(candidate);
			const inSession = resolved.startsWith(extractedRoot) || resolved.startsWith(uploadsRoot);
			if (!inSession) continue;
			if (!existsSync(resolved)) continue;
			return await readFile(resolved, 'utf-8');
		}

		throw new Error(`ENOENT: no such file or directory, open '${candidates[0] || samplePath}'`);
	}

	async function findAssessmentTestPaths(rootDir: string, limit = 50): Promise<string[]> {
		const found: string[] = [];
		const stack: string[] = [rootDir];

		while (stack.length > 0 && found.length < limit) {
			const dir = stack.pop()!;
			if (!existsSync(dir)) continue;

			let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
			try {
				entries = (await readdir(dir, { withFileTypes: true })) as any;
			} catch {
				continue;
			}

			for (const entry of entries) {
				const fullPath = join(dir, entry.name);
				if (entry.isDirectory()) {
					stack.push(fullPath);
					continue;
				}
				if (!entry.name.toLowerCase().endsWith('.xml')) continue;

				try {
					const xml = await readFile(fullPath, 'utf-8');
					if (xml.toLowerCase().includes('<assessmenttest')) {
						found.push(fullPath);
						if (found.length >= limit) break;
					}
				} catch {
					// ignore unreadable file
				}
			}
		}

		return found;
	}

	function titleFromId(fileId: string): string {
		return fileId.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function firstOrAll(items: unknown[]) {
		return items.length === 1 ? items[0] : items;
	}

	function errorMessage(e: unknown): string {
		return e instanceof Error ? e.message : String(e);
	}

	const session = await sessionManager.getSession(id);

	if (!session) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	if (!session.analysis) {
		return json({ error: 'Session not analyzed yet' }, { status: 400 });
	}

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
	await sessionManager.saveTransformation(id, results);

	return json(results);
};
