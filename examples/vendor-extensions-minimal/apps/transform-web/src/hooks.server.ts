/**
 * SvelteKit Server Hooks
 * Initializes storage, transform engine, and registers vendor plugins
 */

import type { Handle } from '@sveltejs/kit';
import type { StorageBackend } from '@pie-qti/storage';
import { FilesystemBackend } from '@pie-qti/storage';
import { TransformEngine } from '@pie-qti/transform-core';
import { QtiToPiePlugin } from '@pie-qti/to-pie';
import { ExampleCorpPlugin } from '@pie-qti-examples/vendor-examplecorp-plugin';

let storageBackend: StorageBackend | null = null;
let transformEngine: TransformEngine | null = null;

/**
 * Initialize storage backend and transform engine on first request
 */
async function initialize(): Promise<void> {
	if (storageBackend && transformEngine) {
		return;
	}

	try {
		// Create filesystem storage backend (using ./uploads directory)
		storageBackend = new FilesystemBackend({
			rootDir: './uploads'
		});
		await storageBackend.initialize();

		// Initialize transform engine
		transformEngine = new TransformEngine();

		// Register core QTI plugin (priority 100)
		transformEngine.use(new QtiToPiePlugin());

		// Register ExampleCorp vendor plugin (priority 550)
		// This will override the core plugin when ExampleCorp content is detected
		transformEngine.use(new ExampleCorpPlugin());

		console.log('[Example App] Initialized with plugins:');
		console.log('  - QtiToPiePlugin (priority 100)');
		console.log('  - ExampleCorpPlugin (priority 550)');
		console.log(`[Example App] Storage: ${storageBackend.name}`);
	} catch (error) {
		console.error('[Example App] Failed to initialize:', error);
		throw error;
	}
}

/**
 * SvelteKit handle hook
 * Injects storage and transform engine into request locals
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Initialize on first request
	await initialize();

	// Inject into request context
	if (storageBackend && transformEngine) {
		event.locals.storage = storageBackend;
		event.locals.transformEngine = transformEngine;
	} else {
		throw new Error('Storage or transform engine not initialized');
	}

	return resolve(event);
};
