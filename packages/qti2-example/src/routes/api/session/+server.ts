/**
 * API endpoint for session persistence
 * POST /api/session - Save session
 * GET /api/session?id={sessionId} - Load session
 */

export const prerender = false;

import { json, type RequestEvent } from '@sveltejs/kit';

// In-memory session store (in production use a database, etc.)
const sessions = new Map<string, any>();

/**
 * Generate a simple session ID
 */
function generateSessionId(): string {
	return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Save session data
 */
export async function POST({ request }: RequestEvent) {
	try {
		const body = await request.json();
		const { sessionId, data } = body;

		if (!data || typeof data !== 'object') {
			return json({ error: 'data must be an object' }, { status: 400 });
		}

		// Use provided sessionId or generate new one
		const id = sessionId || generateSessionId();

		// Store session with timestamp
		sessions.set(id, {
			...data,
			updatedAt: new Date().toISOString(),
		});

		return json({
			success: true,
			sessionId: id,
		});
	} catch (error: any) {
		console.error('Session save error:', error);
		return json(
			{
				error: error.message || 'Failed to save session',
			},
			{ status: 500 }
		);
	}
}

/**
 * Load session data
 */
export async function GET({ url }: RequestEvent) {
	try {
		const sessionId = url.searchParams.get('id');

		if (!sessionId) {
			return json({ error: 'sessionId is required' }, { status: 400 });
		}

		const sessionData = sessions.get(sessionId);

		if (!sessionData) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		return json({
			success: true,
			data: sessionData,
		});
	} catch (error: any) {
		console.error('Session load error:', error);
		return json(
			{
				error: error.message || 'Failed to load session',
			},
			{ status: 500 }
		);
	}
}
