import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { transformEngine, storage } = locals;

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

	// Get vendor extensions count
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

	// Get extension points
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

	return {
		plugins,
		vendorExtensions,
		storageInfo,
		extensionPoints
	};
};
