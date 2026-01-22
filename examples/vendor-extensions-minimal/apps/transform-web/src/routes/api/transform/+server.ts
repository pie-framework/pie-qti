/**
 * Transform API Endpoint
 * Demonstrates using the transform engine with vendor plugins
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ExampleCorpPlugin } from '@pie-qti-examples/vendor-examplecorp-plugin';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content, vendor } = await request.json();

		if (!content) {
			return json({ error: 'No content provided' }, { status: 400 });
		}

		// Initialize plugins
		const plugins = [
			new ExampleCorpPlugin(), // Priority 550
			new Qti22ToPiePlugin()   // Priority 100
		];

		// Step 1: Detect which plugin can handle this content
		let selectedPlugin = null;
		let detectedVendor: string | undefined = vendor;

		if (!vendor || vendor === 'auto') {
			// Sort by priority (highest first) and find first plugin that can handle
			const sorted = plugins.sort((a, b) => ((b as any).priority ?? 100) - ((a as any).priority ?? 100));

			for (const plugin of sorted) {
				const canHandle = await plugin.canHandle({ content });
				if (canHandle) {
					selectedPlugin = plugin;
					// For ExampleCorp plugin, set vendor
					if (plugin.id === 'vendor-examplecorp') {
						detectedVendor = 'examplecorp';
					}
					break;
				}
			}

			// Default to standard QTI plugin if none can handle
			if (!selectedPlugin) {
				selectedPlugin = new Qti22ToPiePlugin();
			}
		} else {
			// Use specified vendor
			if (vendor === 'examplecorp') {
				selectedPlugin = new ExampleCorpPlugin();
				detectedVendor = 'examplecorp';
			} else {
				selectedPlugin = new Qti22ToPiePlugin();
			}
		}

		// Step 2: Transform with selected plugin
		const result = await selectedPlugin.transform(
			{ content },
			{ vendor: detectedVendor }
		);

		// Step 3: Format response
		return json({
			success: result.errors ? result.errors.length === 0 : true,
			output: result.items,
			format: result.format,
			detectedVendor,
			pluginUsed: selectedPlugin.name,
			pluginPriority: (selectedPlugin as any).priority ?? 100,
			metadata: {
				...result.metadata,
				timestamp: result.metadata.timestamp.toISOString()
			},
			warnings: result.warnings,
			errors: result.errors
		});
	} catch (error) {
		console.error('Transform error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
