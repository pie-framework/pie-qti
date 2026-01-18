/**
 * SvelteKit Server Hooks
 * Initializes storage backend and injects it into request context
 */

import type { Handle } from '@sveltejs/kit';
import type { StorageBackend, SessionStorage } from '@pie-qti/storage';
import { SessionStorageImpl } from '@pie-qti/storage';
import { createStorageBackend, loadConfig } from '$lib/server/config';
import { AppSessionStorage } from '$lib/server/storage/app-session-storage';

let storageBackend: StorageBackend | null = null;
let sessionStorage: SessionStorage | null = null;
let appSessionStorage: AppSessionStorage | null = null;

/**
 * Initialize storage backend on first request
 */
async function initializeStorage(): Promise<void> {
	if (storageBackend && sessionStorage && appSessionStorage) {
		return;
	}

	try {
		// Load configuration
		await loadConfig();

		// Create storage backend
		storageBackend = await createStorageBackend();
		await storageBackend.initialize();

		// Create session storage wrapper
		sessionStorage = new SessionStorageImpl(storageBackend, {
			basePath: 'sessions',
		});

		// Create app session storage (with analysis/transformation metadata)
		appSessionStorage = new AppSessionStorage(storageBackend, sessionStorage);

		console.log(`[Transform App] Storage initialized: ${storageBackend.name}`);
	} catch (error) {
		console.error('[Transform App] Failed to initialize storage:', error);
		throw error;
	}
}

/**
 * SvelteKit handle hook
 * Injects storage and session storage into request locals
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Initialize storage on first request
	await initializeStorage();

	// Inject into request context
	if (storageBackend && sessionStorage && appSessionStorage) {
		event.locals.storage = storageBackend;
		event.locals.sessionStorage = sessionStorage;
		event.locals.appSessionStorage = appSessionStorage;
	} else {
		throw new Error('Storage not initialized');
	}

	return resolve(event);
};
