import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { transformEngine, storage } = locals;

	try {
		// Get all registered plugins
		const plugins = transformEngine.getPlugins().map((p: any) => ({
			id: p.id,
			name: p.name,
			version: p.version,
			sourceFormat: p.sourceFormat,
			targetFormat: p.targetFormat,
			priority: p.priority || 100,
			status: 'active'
		}));

		// Get vendor extensions count (placeholder - will be updated when QtiToPiePlugin is enhanced)
		const vendorExtensions = {
			detectors: 0,
			transformers: 0,
			assetResolvers: 0,
			cssClassExtractors: 0,
			metadataExtractors: 0
		};

		// Get storage backend info
		const storageInfo = {
			backend: storage.name,
			type: storage.constructor.name
		};

		// Get extension points (documented capabilities)
		const extensionPoints = {
			storageBackends: ['filesystem', 's3', 'database', 'custom'],
			transformFormats: ['qti22', 'pie', 'custom'],
			vendorExtensionTypes: [
				'detectors',
				'transformers',
				'assetResolvers',
				'cssClassExtractors',
				'metadataExtractors'
			],
			themes: ['light', 'dark', 'cupcake', 'cyberpunk'],
			locales: ['en-US', 'es-ES', 'fr-FR', 'nl-NL', 'ro-RO', 'th-TH', 'zh-CN', 'ar-SA']
		};

		return json({
			success: true,
			plugins,
			vendorExtensions,
			storageInfo,
			extensionPoints
		});
	} catch (error) {
		console.error('[Admin API] Failed to get plugin info:', error);
		return json(
			{
				success: false,
				error: 'Failed to retrieve plugin information',
				plugins: [],
				vendorExtensions: {},
				storageInfo: {},
				extensionPoints: {}
			},
			{ status: 500 }
		);
	}
};
