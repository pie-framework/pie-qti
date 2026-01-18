import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;
	const { appSessionStorage } = locals;

	// Get session with transformation results
	const session = await appSessionStorage.getSession(id);
	if (!session) {
		throw error(404, { message: `Session ${id} not found` });
	}

	if (!session.transformation) {
		throw error(404, {
			message: `No transformation results found. Please run transformation first.`
		});
	}

	return {
		session,
		transformation: session.transformation
	};
};
