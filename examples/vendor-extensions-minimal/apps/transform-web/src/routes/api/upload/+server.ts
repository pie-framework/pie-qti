import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sessionStorage } from '$lib/server/storage/session-storage';

/**
 * POST /api/upload - Upload QTI XML file
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const vendor = formData.get('vendor') as string | null;

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		if (!file.name.endsWith('.xml') && !file.name.endsWith('.qti')) {
			return json({ error: 'File must be XML or QTI format' }, { status: 400 });
		}

		// Read file content
		const content = await file.text();

		// Create session
		const session = sessionStorage.createSession(vendor);

		// Store QTI content
		sessionStorage.setQtiContent(session.id, {
			filename: file.name,
			content,
			vendor: vendor ?? undefined
		});

		return json({ sessionId: session.id }, { status: 201 });
	} catch (error) {
		console.error('Upload error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Upload failed' },
			{ status: 500 }
		);
	}
};
