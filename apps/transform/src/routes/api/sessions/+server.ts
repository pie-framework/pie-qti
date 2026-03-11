/**
 * Sessions API endpoint
 * List all sessions
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { appSessionStorage } = locals;
	const sessions = await appSessionStorage.listSessions();

	return json({
		success: true,
		sessions: sessions.map((s) => ({
			id: s.id,
			createdAt: s.createdAt,
			status: s.status,
			packageCount: s.analysis?.packages?.length || 0,
			hasAnalysis: !!s.analysis,
			hasTransformation: !!s.transformation,
		})),
	});
};
