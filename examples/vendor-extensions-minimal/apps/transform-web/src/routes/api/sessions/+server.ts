import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sessionStorage } from '$lib/server/storage/session-storage';

/**
 * GET /api/sessions - List all sessions
 */
export const GET: RequestHandler = async () => {
	const sessions = sessionStorage.getAllSessions();
	return json({ sessions });
};

/**
 * POST /api/sessions - Create a new session
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const vendor = body.vendor ?? null;

	const session = sessionStorage.createSession(vendor);

	return json({ session }, { status: 201 });
};
