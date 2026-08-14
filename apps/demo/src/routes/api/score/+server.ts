/**
 * API endpoint for server-side scoring
 * POST /api/score
 */

export const prerender = false;

import { createAssessmentItemDefinition } from '@pie-qti/item-player/server';
import { json, type RequestEvent } from '@sveltejs/kit';

export async function POST({ request }: RequestEvent) {
	try {
		const body = await request.json();
		const { itemXml, responses } = body;

		if (!itemXml) {
			return json({ error: 'itemXml is required' }, { status: 400 });
		}

		if (!responses || typeof responses !== 'object') {
			return json({ error: 'responses must be an object' }, { status: 400 });
		}

		const definition = createAssessmentItemDefinition({
			itemXml,
			role: 'scorer',
		});
		const session = definition.openSession({ responses });
		let scoringResult;
		try {
			scoringResult = session.dispatch({
				action: 'endAttempt',
				countAttempt: false,
				validateResponses: false,
			}).result?.scoring;
			if (!scoringResult) throw new Error('QTI scoring produced no result');
		} finally {
			session.dispose();
		}

		return json({
			success: true,
			result: scoringResult,
		});
	} catch (error: any) {
		console.error('Scoring error:', error);
		return json(
			{
				error: error.message || 'Failed to score responses',
			},
			{ status: 500 }
		);
	}
}
