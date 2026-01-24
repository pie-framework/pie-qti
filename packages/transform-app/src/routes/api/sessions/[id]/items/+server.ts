/**
 * Session Items List Endpoint
 * Returns a list of all QTI items in a session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readSessionXml } from '$lib/server/utils/path-utils';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	try {
		const { storage, sessionStorage, appSessionStorage } = locals;
		const extractedPath = sessionStorage.getExtractedPath(id);
		const uploadsPath = sessionStorage.getUploadsPath(id);

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
					const xmlContent = await readSessionXml(filePath, storage, extractedPath, uploadsPath);

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
					const xmlContent = await readSessionXml(passagePath, storage, extractedPath, uploadsPath);

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
