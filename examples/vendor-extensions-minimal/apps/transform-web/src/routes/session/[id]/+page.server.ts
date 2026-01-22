import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { sessionStorage } from '$lib/server/storage/session-storage';

export const load: PageServerLoad = async ({ params }) => {
	const session = sessionStorage.getSession(params.id);

	if (!session) {
		throw error(404, 'Session not found');
	}

	return {
		session
	};
};
