import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/samples - List available sample files
 */
export const GET: RequestHandler = async () => {
	const samples = [
		{
			id: 'examplecorp',
			name: 'ExampleCorp Sample',
			description: 'Biology question with partial credit, hints, and standards alignment',
			icon: '🧬',
			vendor: 'examplecorp'
		},
		{
			id: 'standard',
			name: 'Standard QTI Sample',
			description: 'Basic multiple choice question without vendor extensions',
			icon: '📝',
			vendor: null
		}
	];

	return json({ success: true, samples });
};
