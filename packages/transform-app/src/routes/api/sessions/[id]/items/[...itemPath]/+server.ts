/**
 * QTI Item File Serving Endpoint
 * Serves individual QTI XML files and related resources from a session
 */

import { error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id, itemPath } = params;

	try {
		const { storage, sessionStorage } = locals;

		// Get the uploads + extracted paths for this session
		const uploadsPath = sessionStorage.getUploadsPath(id);
		const extractedPath = sessionStorage.getExtractedPath(id);

		// Construct the full path to the requested file
		// itemPath might be "choice_simple.xml" or "subfolder/item.xml"
		const uploadsCandidate = `${uploadsPath}/${itemPath}`;
		const extractedCandidate = `${extractedPath}/${itemPath}`;

		// Try to find the file in either location
		let filePath: string | null = null;
		if (await storage.exists(uploadsCandidate)) {
			filePath = uploadsCandidate;
		} else if (await storage.exists(extractedCandidate)) {
			filePath = extractedCandidate;
		}

		// Check if file exists
		if (!filePath) {
			throw svelteError(404, 'File not found');
		}

		// Read the file content
		const content = await storage.readText(filePath);

		// Determine content type based on file extension
		const ext = filePath.split('.').pop()?.toLowerCase();
		let contentType = 'application/octet-stream';

		switch (ext) {
			case 'xml':
				contentType = 'application/xml';
				break;
			case 'html':
			case 'htm':
				contentType = 'text/html';
				break;
			case 'css':
				contentType = 'text/css';
				break;
			case 'js':
				contentType = 'application/javascript';
				break;
			case 'json':
				contentType = 'application/json';
				break;
			case 'png':
				contentType = 'image/png';
				break;
			case 'jpg':
			case 'jpeg':
				contentType = 'image/jpeg';
				break;
			case 'gif':
				contentType = 'image/gif';
				break;
			case 'svg':
				contentType = 'image/svg+xml';
				break;
		}

		return new Response(content, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=3600',
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (err) {
		console.error('Item file serving error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw svelteError(500, err instanceof Error ? err.message : 'Failed to serve item file');
	}
};
