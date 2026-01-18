import { error as svelteError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;
	const { appSessionStorage } = locals;

	const session = await appSessionStorage.getSession(id);

	if (!session) {
		throw svelteError(404, 'Session not found');
	}

	return {
		session
	};
};
