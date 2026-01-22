import type { PageServerLoad } from './$types';
import { sessionStorage } from '$lib/server/storage/session-storage';

export const load: PageServerLoad = async () => {
	// Get recent sessions (last 5)
	const allSessions = sessionStorage.getAllSessions();
	const sessions = allSessions.slice(0, 5);

	// Sample files metadata
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

	return {
		sessions,
		samples
	};
};
