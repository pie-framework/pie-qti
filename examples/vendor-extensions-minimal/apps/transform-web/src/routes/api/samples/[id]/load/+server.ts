import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sessionStorage } from '$lib/server/storage/session-storage';

const sampleFiles: Record<string, { filename: string; vendor: string | null }> = {
	examplecorp: { filename: 'realistic-example.xml', vendor: 'examplecorp' },
	standard: { filename: 'sample-standard.xml', vendor: null }
};

/**
 * POST /api/samples/:id/load - Load a sample file into a new session
 */
export const POST: RequestHandler = async ({ params }) => {
	const sampleId = params.id;

	if (!sampleFiles[sampleId]) {
		return json({ error: 'Sample not found' }, { status: 404 });
	}

	try {
		const fixturesPath = resolve(process.cwd(), '../../packages/vendor-examplecorp-plugin/fixtures');
		const filePath = resolve(fixturesPath, sampleFiles[sampleId].filename);
		const content = readFileSync(filePath, 'utf-8');

		// Create session
		const session = sessionStorage.createSession(sampleFiles[sampleId].vendor);

		// Store QTI content
		sessionStorage.setQtiContent(session.id, {
			filename: sampleFiles[sampleId].filename,
			content,
			vendor: sampleFiles[sampleId].vendor ?? undefined
		});

		return json({ sessionId: session.id }, { status: 201 });
	} catch (error) {
		console.error('Failed to load sample:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to load sample' },
			{ status: 500 }
		);
	}
};
