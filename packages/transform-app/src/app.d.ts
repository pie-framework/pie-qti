// See https://svelte.dev/docs/kit/types#app.d.ts

import type { StorageBackend, SessionStorage } from '@pie-qti/storage';
import type { AppSessionStorage } from '$lib/server/storage/app-session-storage';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			storage: StorageBackend;
			sessionStorage: SessionStorage;
			appSessionStorage: AppSessionStorage;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
