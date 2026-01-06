import { error, json } from '@sveltejs/kit';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { RequestHandler } from './$types';

/**
 * GET /api/sessions/:id/transformation
 *
 * Retrieve the transformation results for a session
 */
export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	try {
		const sessionManager = getSessionManager();

		// Verify session exists
		const sessionExists = await sessionManager.sessionExists(id);
		if (!sessionExists) {
			throw error(404, { message: `Session ${id} not found` });
		}

		// Get transformation results
		const transformation = await sessionManager.getTransformation(id);
		if (!transformation) {
			throw error(404, { message: `No transformation results found for session ${id}` });
		}

		return json(transformation);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}

		console.error('Failed to get transformation results:', err);
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to get transformation results'
		});
	}
};
