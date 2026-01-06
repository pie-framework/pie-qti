/**
 * Session Assessment Tests List Endpoint
 * Returns a list of all QTI assessment tests in a session
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { json, error as svelteError } from '@sveltejs/kit';
import { getStorage } from '$lib/server/storage/FileStorage';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	try {
		const sessionManager = getSessionManager();

		// Get session
		const session = await sessionManager.getSession(id);
		if (!session) {
			throw svelteError(404, 'Session not found');
		}

		// Check if analysis is available
		if (!session.analysis) {
			throw svelteError(400, 'Session has not been analyzed yet');
		}

		// Build list of assessment tests from analysis results
		const assessments: Array<{
			id: string;
			title: string;
			filePath: string;
			itemCount: number;
			xml: string;
			items: Record<string, string>;
		}> = [];

		// Iterate through packages
		const storage = getStorage();
		const extractedPath = storage.getExtractedPath(id);
		const uploadsPath = storage.getUploadsPath(id);
		const extractedRoot = resolve(extractedPath);
		const uploadsRoot = resolve(uploadsPath);

		function normalizePossiblyAbsolutePath(p: string): string {
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

		async function findAssessmentTestPaths(rootDir: string, limit = 5): Promise<string[]> {
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

		for (const pkg of session.analysis.packages) {
			// Get assessment test samples
			const testPaths =
				(pkg.samples as any)?.tests?.length
					? (pkg.samples as any).tests
					: pkg.testCount > 0
						? [
								...(await findAssessmentTestPaths(extractedPath, 5)),
								...(await findAssessmentTestPaths(uploadsPath, 5)),
							]
						: [];

			for (const testPath of testPaths) {
				// Read the assessment test XML
				const testXml = await readSessionXml(testPath);

				// Extract filename from path
				const fileName = testPath.split('/').pop() || 'unknown';
				const fileId = fileName.replace(/\.xml$/i, '');

				// Collect all item XMLs from this package
				const items: Record<string, string> = {};
				const itemFiles = new Set<string>();

				// Gather all item file paths from various sources
				for (const [_interactionType, filePaths] of Object.entries(pkg.samples.interactions)) {
					for (const filePath of filePaths) {
						itemFiles.add(filePath);
					}
				}

				// Read all item XMLs
				for (const itemPath of itemFiles) {
					const itemXml = await readSessionXml(itemPath);
					const itemFileName = itemPath.split('/').pop() || '';
					// Store by both filename and identifier
					items[itemFileName] = itemXml;
					items[itemPath] = itemXml;
					// Also store by filename without extension as identifier
					const itemId = itemFileName.replace(/\.xml$/i, '');
					items[itemId] = itemXml;
				}

				assessments.push({
					id: fileId,
					title: fileId.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
					filePath: fileName,
					itemCount: itemFiles.size,
					xml: testXml,
					items
				});
			}
		}

		return json({
			success: true,
			sessionId: id,
			assessments,
			totalAssessments: assessments.length
		});
	} catch (err) {
		console.error('List assessments error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw svelteError(500, err instanceof Error ? err.message : 'Failed to list assessments');
	}
};
