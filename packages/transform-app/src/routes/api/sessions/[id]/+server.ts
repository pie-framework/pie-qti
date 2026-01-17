/**
 * Single session API endpoint
 * Get or delete a specific session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id } = params;
	const { sessionStorage } = locals;

	const session = await sessionStorage.readSessionMetadata(id);
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
	const { sessionStorage } = locals;

	const session = await sessionStorage.readSessionMetadata(id);
	if (!session) {
		throw svelteError(404, 'Session not found');
	}

	await sessionStorage.deleteSession(id);

	return json({
		success: true,
		message: 'Session deleted',
	});
};
