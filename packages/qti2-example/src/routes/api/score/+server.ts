/**
 * API endpoint for server-side scoring
 * POST /api/score
 */

export const prerender = false;

import { Player } from '@pie-qti/qti2-item-player/server';
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

		// Create player instance
		const player = new Player({
			itemXml,
			role: 'scorer',
			responses,
		});

		// Process responses and get scoring result
		const scoringResult = player.processResponses();

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
