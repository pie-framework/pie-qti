/**
 * Session Assessment Tests List Endpoint
 * Returns a list of all QTI assessment tests in a session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	try {
		const { storage, sessionStorage, appSessionStorage } = locals;

		// Get session with analysis
		const session = await appSessionStorage.getSession(id);
		if (!session) {
			throw svelteError(404, 'Session not found');
		}

		// Check if analysis is available
		if (!session.analysis) {
			throw svelteError(400, 'Session has not been analyzed yet');
		}

		const extractedPath = sessionStorage.getExtractedPath(id);
		const uploadsPath = sessionStorage.getUploadsPath(id);

		function normalizePossiblyAbsolutePath(p: string): string {
			if (p.startsWith('Users/') || p.startsWith('home/')) {
				return `/${p}`;
			}
			return p;
		}

		function isAbsolutePath(p: string): boolean {
			return p.startsWith('/');
		}

		async function readSessionXml(samplePath: string): Promise<string> {
			const normalized = normalizePossiblyAbsolutePath(samplePath);
			const candidates: string[] = [];

			if (isAbsolutePath(normalized)) {
				const pathWithoutLeadingSlash = normalized.substring(1);
				candidates.push(pathWithoutLeadingSlash);
			} else {
				candidates.push(`${extractedPath}/${normalized}`);
				candidates.push(`${uploadsPath}/${normalized}`);
				const baseName = normalized.split('/').pop();
				if (baseName && baseName !== normalized) {
					candidates.push(`${uploadsPath}/${baseName}`);
					candidates.push(`${extractedPath}/${baseName}`);
				}
			}

			for (const candidate of candidates) {
				try {
					if (await storage.exists(candidate)) {
						return await storage.readText(candidate);
					}
				} catch {
					continue;
				}
			}

			throw new Error(`ENOENT: no such file or directory, open '${candidates[0] || samplePath}'`);
		}

		async function findAssessmentTestPaths(rootDir: string, limit = 5): Promise<string[]> {
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

		// Build list of assessment tests from analysis results
		const assessments: Array<{
			id: string;
			title: string;
			filePath: string;
			itemCount: number;
			xml: string;
			items: Record<string, string>;
		}> = [];

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
					if (Array.isArray(filePaths)) {
						for (const filePath of filePaths) {
							itemFiles.add(filePath);
						}
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
