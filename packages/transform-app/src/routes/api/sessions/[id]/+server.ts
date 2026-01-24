/**
 * Single session API endpoint
 * Get or delete a specific session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id } = params;
	const { appSessionStorage } = locals;

	const session = await appSessionStorage.getSession(id);
	if (!session) {
		throw svelteError(404, 'Session not found');
	}

	return json({
		success: true,
		session,
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { id } = params;
	const { appSessionStorage, storage } = locals;

	console.log(`[DELETE] Attempting to delete session: ${id}`);

	const session = await appSessionStorage.getSession(id);
	if (!session) {
		console.log(`[DELETE] Session not found: ${id}`);
		throw svelteError(404, 'Session not found');
	}

	// Get storage path information
	const sessionPath = appSessionStorage.getSessionPath(id);
	let storagePath = sessionPath;
	let storageBackend = storage.name || 'unknown';

	// For filesystem backend, get absolute path
	if (storage.name === 'filesystem' && typeof (storage as any).getAbsolutePath === 'function') {
		storagePath = (storage as any).getAbsolutePath(sessionPath);
	}

	console.log(`[DELETE] Storage backend: ${storageBackend}`);
	console.log(`[DELETE] Storage path: ${storagePath}`);
	console.log(`[DELETE] Deleting session: ${id}`);

	await appSessionStorage.deleteSession(id);

	console.log(`[DELETE] Session deleted successfully: ${id}`);
	console.log(`[DELETE] Verify deletion - checking if path still exists...`);
	const stillExists = await storage.exists(sessionPath);
	console.log(`[DELETE] Path still exists: ${stillExists}`);

	return json({
		success: true,
		message: 'Session deleted',
		storageBackend,
		storagePath,
		verified: !stillExists,
	});
};
