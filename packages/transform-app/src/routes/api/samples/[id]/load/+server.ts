/**
 * Load sample package endpoint
 * Copies a sample package to a new session
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	try {
		const samplePath = join(process.cwd(), 'static', 'samples', id);

		// Verify sample exists
		try {
			await stat(samplePath);
		} catch {
			throw svelteError(404, `Sample package '${id}' not found`);
		}

		const { storage, sessionStorage } = locals;

		// Generate session ID
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 10);
		const sessionId = `${timestamp}-${random}`;

		// Create session directories
		await storage.createDirectory(sessionStorage.getSessionPath(sessionId));
		await storage.createDirectory(sessionStorage.getUploadsPath(sessionId));
		await storage.createDirectory(sessionStorage.getExtractedPath(sessionId));
		await storage.createDirectory(sessionStorage.getOutputsPath(sessionId));

		// Scan files to get total size
		const files = await readdir(samplePath);
		let totalSize = 0;

		const fileList: string[] = [];
		for (const file of files) {
			const sourcePath = join(samplePath, file);
			const fileStats = await stat(sourcePath);
			if (fileStats.isFile()) {
				totalSize += fileStats.size;
				fileList.push(file);
			}
		}

		// Copy files to the session's uploads directory
		const uploadsPath = sessionStorage.getUploadsPath(sessionId);

		for (const file of fileList) {
			const sourcePath = join(samplePath, file);
			const destPath = join(uploadsPath, file);

			const content = await readFile(sourcePath);
			await storage.writeBuffer(destPath, content);
			console.log(`Copied ${file} to ${destPath}`);
		}

		// Create session metadata
		const session = {
			id: sessionId,
			createdAt: new Date().toISOString(),
			lastAccessedAt: new Date().toISOString(),
			status: 'ready' as const,
			extractedFiles: fileList,
		};

		await sessionStorage.writeSessionMetadata(sessionId, session);

		return json({
			success: true,
			sessionId: session.id,
			sampleId: id,
			message: `Sample '${id}' loaded successfully`,
		});
	} catch (err) {
		console.error('Load sample error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw svelteError(500, err instanceof Error ? err.message : 'Failed to load sample');
	}
};
