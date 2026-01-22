// See https://svelte.dev/docs/kit/types#app.d.ts

import type { StorageBackend } from '@pie-qti/storage';
import type { TransformEngine } from '@pie-qti/transform-core';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			storage: StorageBackend;
			transformEngine: TransformEngine;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
