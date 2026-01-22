// See https://svelte.dev/docs/kit/types#app.d.ts

import type { StorageBackend, SessionStorage } from '@pie-qti/storage';
import type { TransformEngine } from '@pie-qti/transform-core';
import type { AppSessionStorage } from '$lib/server/storage/app-session-storage';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			storage: StorageBackend;
			sessionStorage: SessionStorage;
			appSessionStorage: AppSessionStorage;
			transformEngine: TransformEngine;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
