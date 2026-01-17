import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import type { Actions } from './$types';

export const load = async ({ locals }) => {
	const { appSessionStorage } = locals;
	const sessions = await appSessionStorage.listSessions();

	let samples: any[] = [];
	try {
		const metadataPath = join(process.cwd(), 'static', 'samples', 'samples-metadata.json');
		const content = await readFile(metadataPath, 'utf-8');
		const metadata = JSON.parse(content);
		samples = metadata?.samples ?? [];
	} catch (error) {
		console.error('Failed to load samples metadata:', error);
	}

	return {
		sessions: sessions
			.map((s) => ({
				id: s.id,
				created: s.createdAt,
				status: s.status,
				packageCount: s.extractedFiles?.length || 0,
				hasAnalysis: !!s.analysis,
				hasTransformation: !!s.transformation,
			}))
			.slice(0, 5),
		samples,
	};
};

export const actions = {
	transform: async ({ request }) => {
		const data = await request.formData();
		const qtiXml = data.get('qtiXml') as string;

		if (!qtiXml || qtiXml.trim() === '') {
			return {
				error: 'Please provide QTI XML content'
			};
		}

		try {
			const plugin = new Qti22ToPiePlugin();

			// Check if plugin can handle this content
			const canHandle = await plugin.canHandle({ content: qtiXml, format: 'qti22' });
			if (!canHandle) {
				return {
					error: 'The provided content does not appear to be valid QTI 2.2 XML'
				};
			}

			// Transform
			const result = await plugin.transform(
				{ content: qtiXml, format: 'qti22' },
				{ logger: console }
			);

			if (result.errors && result.errors.length > 0) {
				return {
					error: result.errors[0].message || 'Transformation failed'
				};
			}

			if (!result.items || result.items.length === 0) {
				return {
					error: 'Transformation produced no items'
				};
			}

			// Get the first item (PIE config)
			const pieItem = result.items[0];

			return {
				success: true,
				pieItem: pieItem,
				warnings: result.warnings,
				metadata: result.metadata
			};
		} catch (error: any) {
			console.error('Transformation error:', error);
			return {
				error: `Transformation error: ${error.message}`
			};
		}
	}
} satisfies Actions;
