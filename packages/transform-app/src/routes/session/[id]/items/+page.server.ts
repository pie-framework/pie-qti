import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;
	const { appSessionStorage } = locals;

	const session = await appSessionStorage.getSession(id);

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
