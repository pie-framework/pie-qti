import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sessionStorage } from '$lib/server/storage/session-storage';

/**
 * GET /api/sessions/:id - Get session details
 */
export const GET: RequestHandler = async ({ params }) => {
	const session = sessionStorage.getSession(params.id);

	if (!session) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	return json({ session });
};

/**
 * DELETE /api/sessions/:id - Delete a session
 */
export const DELETE: RequestHandler = async ({ params }) => {
	const deleted = sessionStorage.deleteSession(params.id);

	if (!deleted) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	return json({ success: true });
};
