/**
 * SvelteKit Server Hooks
 * Initializes storage backend, plugins, and injects them into request context
 */

import type { Handle } from '@sveltejs/kit';
import type { StorageBackend, SessionStorage } from '@pie-qti/storage';
import { SessionStorageImpl } from '@pie-qti/storage';
import { TransformEngine } from '@pie-qti/transform-core';
import { loadAndRegisterPlugins } from '@pie-qti/transform-core/config/plugin-loader.js';
import { QtiToPiePlugin } from '@pie-qti/to-pie';
import { createStorageBackend, loadConfig } from '$lib/server/config';
import { AppSessionStorage } from '$lib/server/storage/app-session-storage';

let storageBackend: StorageBackend | null = null;
let sessionStorage: SessionStorage | null = null;
let appSessionStorage: AppSessionStorage | null = null;
let transformEngine: TransformEngine | null = null;

/**
 * Initialize storage backend and transform engine on first request
 */
async function initializeStorage(): Promise<void> {
	if (storageBackend && sessionStorage && appSessionStorage && transformEngine) {
		return;
	}

	try {
		// Load configuration
		const config = await loadConfig();

		// Create storage backend
		storageBackend = await createStorageBackend();
		await storageBackend.initialize();

		// Create session storage wrapper
		sessionStorage = new SessionStorageImpl(storageBackend, {
			basePath: 'sessions',
		});

		// Create app session storage (with analysis/transformation metadata)
		appSessionStorage = new AppSessionStorage(storageBackend, sessionStorage);

		// Initialize transform engine
		transformEngine = new TransformEngine();

		// Register core QTI plugin
		transformEngine.use(new QtiToPiePlugin());

		// Load and register additional plugins from config (if any)
		if (config.plugins && Object.keys(config.plugins).length > 0) {
			try {
				await loadAndRegisterPlugins(transformEngine, config.plugins);
				console.log(`[Transform App] Loaded ${Object.keys(config.plugins).length} additional plugin(s)`);
			} catch (error) {
				console.warn('[Transform App] Failed to load plugins from config:', error);
				// Continue with just the core plugin
			}
		}

		console.log(`[Transform App] Storage initialized: ${storageBackend.name}`);
		console.log(`[Transform App] Transform engine initialized with plugins`);
	} catch (error) {
		console.error('[Transform App] Failed to initialize storage:', error);
		throw error;
	}
}

/**
 * SvelteKit handle hook
 * Injects storage, session storage, and transform engine into request locals
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Initialize storage and engine on first request
	await initializeStorage();

	// Inject into request context
	if (storageBackend && sessionStorage && appSessionStorage && transformEngine) {
		event.locals.storage = storageBackend;
		event.locals.sessionStorage = sessionStorage;
		event.locals.appSessionStorage = appSessionStorage;
		event.locals.transformEngine = transformEngine;
	} else {
		throw new Error('Storage or transform engine not initialized');
	}

	return resolve(event);
};
