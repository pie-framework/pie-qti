import { error } from '@sveltejs/kit';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const sessionManager = getSessionManager();

	// Get session
	const session = await sessionManager.getSession(id);
	if (!session) {
		throw error(404, { message: `Session ${id} not found` });
	}

	// Get transformation results
	const transformation = await sessionManager.getTransformation(id);
	if (!transformation) {
		throw error(404, {
			message: `No transformation results found. Please run transformation first.`
		});
	}

	return {
		session,
		transformation
	};
};
