/**
 * Session Assessment Tests List Endpoint
 * Returns a list of all QTI assessment tests in a session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readSessionXml } from '$lib/server/utils/path-utils';

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

		async function findAssessmentTestPaths(rootDir: string, limit = 5): Promise<string[]> {
			const found: string[] = [];
			const stack: string[] = [rootDir];

			while (stack.length > 0 && found.length < limit) {
				const dir = stack.pop()!;

				let entries: string[] = [];
				try {
					if (!(await storage.exists(dir))) continue;
					if (!storage.listFiles) continue;
					entries = await storage.listFiles(dir);
				} catch {
					continue;
				}

				for (const entryName of entries) {
					const fullPath = `${dir}/${entryName}`;

					// Check if it's a directory by trying to list it
					let isDirectory = false;
					try {
						if (storage.listFiles) {
							await storage.listFiles(fullPath);
							isDirectory = true;
						}
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

		// Helper to parse assessment metadata from XML
		interface AssessmentMetadata {
			identifier: string;
			title: string;
			navigationMode: 'linear' | 'nonlinear';
			submissionMode: 'individual' | 'simultaneous';
			sectionCount: number;
			itemCount: number;
		}

		function parseAssessmentMetadata(xml: string): AssessmentMetadata {
			const identifierMatch = xml.match(/assessmentTest[^>]+identifier="([^"]+)"/);
			const titleMatch = xml.match(/assessmentTest[^>]+title="([^"]+)"/);
			const navigationMatch = xml.match(/testPart[^>]+navigationMode="([^"]+)"/);
			const submissionMatch = xml.match(/testPart[^>]+submissionMode="([^"]+)"/);

			const sectionMatches = xml.match(/<assessmentSection/g);
			const itemMatches = xml.match(/<assessmentItemRef/g);

			return {
				identifier: identifierMatch?.[1] || 'unknown',
				title: titleMatch?.[1] || 'Untitled Assessment',
				navigationMode: (navigationMatch?.[1] as 'linear' | 'nonlinear') || 'nonlinear',
				submissionMode: (submissionMatch?.[1] as 'individual' | 'simultaneous') || 'simultaneous',
				sectionCount: sectionMatches?.length || 0,
				itemCount: itemMatches?.length || 0,
			};
		}

		// Build list of assessment tests from analysis results
		const assessments: Array<{
			id: string;
			title: string;
			filePath: string;
			itemCount: number;
			xml: string;
			items: Record<string, string>;
			identifier: string;
			navigationMode: 'linear' | 'nonlinear';
			submissionMode: 'individual' | 'simultaneous';
			sectionCount: number;
		}> = [];

		// Track seen assessments to prevent duplicates across packages
		const seenAssessments = new Set<string>();

		for (const pkg of session.analysis.packages) {
			// Get assessment test samples - deduplicate results from both paths
			const testPaths =
				(pkg.samples as any)?.tests?.length
					? (pkg.samples as any).tests
					: pkg.testCount > 0
						? Array.from(new Set([
								...(await findAssessmentTestPaths(extractedPath, 5)),
								...(await findAssessmentTestPaths(uploadsPath, 5)),
							]))
						: [];

			for (const testPath of testPaths) {
				// Normalize path for deduplication (remove extracted/uploads prefix)
				const normalizedPath = testPath.replace(/^.*\/(extracted|uploads)\//, '');

				// Skip if we've already processed this assessment
				if (seenAssessments.has(normalizedPath)) {
					continue;
				}
				seenAssessments.add(normalizedPath);

				// Read the assessment test XML
				const testXml = await readSessionXml(testPath, storage, extractedPath, uploadsPath);

				// Extract filename from path
				const fileName = testPath.split('/').pop() || 'unknown';
				const fileId = fileName.replace(/\.xml$/i, '');

				// Parse assessment metadata
				const metadata = parseAssessmentMetadata(testXml);

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
					const itemXml = await readSessionXml(itemPath, storage, extractedPath, uploadsPath);
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
					title: metadata.title || fileId.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
					filePath: fileName,
					itemCount: itemFiles.size,
					xml: testXml,
					items,
					identifier: metadata.identifier,
					navigationMode: metadata.navigationMode,
					submissionMode: metadata.submissionMode,
					sectionCount: metadata.sectionCount,
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
