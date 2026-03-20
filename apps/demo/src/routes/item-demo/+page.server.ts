import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	throw redirect(302, `${base}/item-demo/simple-choice`);
};
