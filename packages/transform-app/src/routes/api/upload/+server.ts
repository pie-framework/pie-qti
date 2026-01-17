/**
 * File upload API endpoint
 * Accepts ZIP files and creates a new session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = ['application/zip', 'application/x-zip-compressed'];

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
	return `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const formData = await request.formData();
		// Accept both 'files' (plural) and 'file' (singular) for backwards compatibility
		let files = formData.getAll('files');
		if (files.length === 0) {
			files = formData.getAll('file');
		}

		if (files.length === 0) {
			throw svelteError(400, 'No files provided');
		}

		const { storage, sessionStorage } = locals;

		// Create session first to get session ID
		const sessionId = generateSessionId();
		const uploadsPath = sessionStorage.getUploadsPath(sessionId);

		// Ensure uploads directory exists
		await storage.createDirectory(uploadsPath);

		// Track uploaded files for response
		const uploadedFiles: Array<{ id: string; name: string; size: number }> = [];

		// Process each uploaded file
		for (const file of files) {
			if (!(file instanceof File)) {
				continue;
			}

			// Validate file type
			if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.zip')) {
				throw svelteError(
					400,
					`Invalid file type: ${file.type}. Only ZIP files are allowed.`,
				);
			}

			// Validate file size
			if (file.size > MAX_FILE_SIZE) {
				throw svelteError(
					400,
					`File too large: ${file.name}. Maximum size is 500MB.`,
				);
			}

			// Generate package ID and save file
			const packageId = `pkg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
			const fileName = file.name;
			const filePath = `${uploadsPath}/${fileName}`;

			// Read file as buffer and write to storage
			const buffer = Buffer.from(await file.arrayBuffer());
			await storage.writeBuffer(filePath, buffer);

			uploadedFiles.push({
				id: packageId,
				name: fileName,
				size: file.size,
			});
		}

		// Create session with package info
		const session = {
			id: sessionId,
			createdAt: new Date().toISOString(),
			status: 'uploading' as const,
		};

		await sessionStorage.writeSessionMetadata(sessionId, session);

		return json({
			success: true,
			sessionId: session.id,
			packages: uploadedFiles,
		});
	} catch (err) {
		console.error('Upload error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}

		throw svelteError(
			500,
			err instanceof Error ? err.message : 'Upload failed',
		);
	}
};
