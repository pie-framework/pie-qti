/**
 * Session Transformation Results Endpoint
 * Retrieves the transformation results for a session
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	try {
		const { appSessionStorage } = locals;

		// Get transformation results
		const transformation = await appSessionStorage.getTransformation(id);
		if (!transformation) {
			throw error(404, { message: `No transformation results found for session ${id}` });
		}

		return json(transformation);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		console.error('Failed to get transformation results:', err);
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to get transformation results'
		});
	}
};
