import { error as svelteError } from '@sveltejs/kit';
import { getSessionManager } from '$lib/server/storage/SessionManager';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const sessionManager = getSessionManager();
	const session = await sessionManager.getSession(id);

	if (!session) {
		throw svelteError(404, 'Session not found');
	}

	return {
		session
	};
};
