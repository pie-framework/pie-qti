import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sessionStorage } from '$lib/server/storage/session-storage';
import { ExampleCorpPlugin } from '@pie-qti-examples/vendor-examplecorp-plugin';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';

/**
 * POST /api/sessions/:id/transform - Transform QTI to PIE
 */
export const POST: RequestHandler = async ({ params }) => {
	const session = sessionStorage.getSession(params.id);

	if (!session) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	if (!session.qti) {
		return json({ error: 'No QTI content in session' }, { status: 400 });
	}

	try {
		const content = session.qti.content;
		const vendor = session.vendor;

		// Initialize plugins
		const plugins = [
			new ExampleCorpPlugin(), // Priority 550
			new Qti22ToPiePlugin()   // Priority 100
		];

		// Step 1: Detect which plugin can handle this content
		let selectedPlugin = null;
		let detectedVendor: string | undefined = vendor ?? undefined;

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

		// Store result
		sessionStorage.setTransformResult(params.id, {
			success: result.errors ? result.errors.length === 0 : true,
			output: JSON.stringify(result.items, null, 2),
			pluginUsed: selectedPlugin.name,
			pluginPriority: (selectedPlugin as any).priority ?? 100,
			detectedVendor,
			confidence: detectedVendor === 'examplecorp' ? 1.0 : undefined
		});

		return json({ success: true, result: session.transform });
	} catch (error) {
		console.error('Transform error:', error);

		const errorMessage = error instanceof Error ? error.message : 'Transform failed';

		// Store error
		sessionStorage.setTransformResult(params.id, {
			success: false,
			output: '',
			error: errorMessage
		});

		return json({ error: errorMessage }, { status: 500 });
	}
};
