/**
 * Session Items List Endpoint
 * Returns a list of all QTI items in a session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	try {
		const { storage, sessionStorage, appSessionStorage } = locals;
		const extractedPath = sessionStorage.getExtractedPath(id);
		const uploadsPath = sessionStorage.getUploadsPath(id);

		function isAbsolutePath(p: string): boolean {
			// Windows absolute path (C:\, D:\, etc.)
			if (/^[A-Za-z]:[\\/]/.test(p)) {
				return true;
			}
			// Unix absolute path
			return p.startsWith('/');
		}

		function convertAbsoluteToStorageRelative(absolutePath: string): string | null {
			// Normalize Windows backslashes to forward slashes
			const normalized = absolutePath.replace(/\\/g, '/');
			
			// Try to extract the storage-relative part
			const uploadsMatch = normalized.match(/\/uploads\/(sessions\/.+)/);
			if (uploadsMatch) {
				return uploadsMatch[1];
			}
			
			const sessionsMatch = normalized.match(/(sessions\/.+)/);
			if (sessionsMatch) {
				return sessionsMatch[1];
			}
			
			const storageRoot = (storage as any).rootDir || process.cwd() + '/uploads';
			const normalizedRoot = storageRoot.replace(/\\/g, '/');
			if (normalized.startsWith(normalizedRoot + '/')) {
				return normalized.substring(normalizedRoot.length + 1);
			}
			
			return null;
		}

		async function readSessionXml(samplePath: string): Promise<string> {
			const candidates: string[] = [];

			if (isAbsolutePath(samplePath)) {
				// Absolute path - convert to storage-relative path
				const storageRelative = convertAbsoluteToStorageRelative(samplePath);
				if (storageRelative) {
					candidates.push(storageRelative);
				}
				
				// Also try extracting just the filename
				const fileName = samplePath.split(/[\\/]/).pop();
				if (fileName) {
					candidates.push(`${extractedPath}/${fileName}`);
					candidates.push(`${uploadsPath}/${fileName}`);
				}
			} else {
				candidates.push(`${extractedPath}/${samplePath}`);
				candidates.push(`${uploadsPath}/${samplePath}`);
				const baseName = samplePath.split('/').pop();
				if (baseName && baseName !== samplePath) {
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

		// Get session with analysis
		const session = await appSessionStorage.getSession(id);
		if (!session) {
			throw svelteError(404, 'Session not found');
		}

		// Check if analysis is available
		if (!session.analysis) {
			throw svelteError(400, 'Session has not been analyzed yet');
		}

		// Build list of items from analysis results
		const items: Array<{
			id: string;
			title: string;
			filePath: string;
			sourcePath: string;
			interactions: string[];
			url: string;
			xml?: string;
		}> = [];

		// Iterate through packages and their samples
		for (const pkg of session.analysis.packages) {
			// Get items from interaction samples
			const interactionSamples = pkg.samples.interactions;

			// Create a Set to track unique file paths
			const seenFiles = new Set<string>();

			for (const [interactionType, filePaths] of Object.entries(interactionSamples)) {
				if (!Array.isArray(filePaths)) continue;

				for (const filePath of filePaths) {
					if (seenFiles.has(filePath)) {
						// If we've already processed this file, just add the interaction type
						const existingItem = items.find((item) => item.sourcePath === filePath);
						if (existingItem && !existingItem.interactions.includes(interactionType)) {
							existingItem.interactions.push(interactionType);
						}
						continue;
					}

					seenFiles.add(filePath);

					// Extract filename from path
					const fileName = filePath.split('/').pop() || 'unknown';
					const fileId = fileName.replace(/\.xml$/i, '');

					// Construct URL to serve this item
					const url = `/api/sessions/${id}/items/${fileName}`;

					// Read the XML content
					const xmlContent = await readSessionXml(filePath);

					items.push({
						id: fileId,
						title: fileId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
						filePath: fileName,
						sourcePath: filePath,
						interactions: [interactionType],
						url,
						xml: xmlContent
					});
				}
			}

			// Add passage samples if any
			for (const passagePath of pkg.samples.passages) {
				const fileName = passagePath.split('/').pop() || 'unknown';
				const fileId = fileName.replace(/\.xml$/i, '');
				const url = `/api/sessions/${id}/items/${fileName}`;

				if (!seenFiles.has(passagePath)) {
					// Read the XML content
					const xmlContent = await readSessionXml(passagePath);

					items.push({
						id: fileId,
						title: `Passage: ${fileId.replace(/_/g, ' ')}`,
						filePath: fileName,
						sourcePath: passagePath,
						interactions: ['passage'],
						url,
						xml: xmlContent
					});
				}
			}
		}

		return json({
			success: true,
			sessionId: id,
			items,
			totalItems: items.length
		});
	} catch (err) {
		console.error('List items error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw svelteError(500, err instanceof Error ? err.message : 'Failed to list items');
	}
};
