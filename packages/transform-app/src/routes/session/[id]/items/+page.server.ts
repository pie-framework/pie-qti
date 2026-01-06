import { error } from '@sveltejs/kit';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const sessionManager = getSessionManager();
	const session = await sessionManager.getSession(id);

	if (!session) {
		throw error(404, 'Session not found');
	}

	if (!session.analysis) {
		throw error(400, 'Session has not been analyzed yet');
	}

	return {
		session
	};
};
