import { cachedImport } from './cachedImport.js';

declare global {
	// eslint-disable-next-line no-var
	var __pieQtiWebComponentLoaders__: undefined | Record<string, Promise<void>>;
}

function getStore(): Record<string, Promise<void>> {
	const g = globalThis as typeof globalThis & {
		__pieQtiWebComponentLoaders__?: Record<string, Promise<void>>;
	};
	if (!g.__pieQtiWebComponentLoaders__) g.__pieQtiWebComponentLoaders__ = {};
	return g.__pieQtiWebComponentLoaders__;
}

/**
 * Idempotently loads the PIE QTI player and default interaction web components.
 * Safe to call multiple times; the underlying import happens once — and once
 * more after a failed attempt, so a transient chunk failure is not permanent.
 *
 * No `customElements.whenDefined` wait on top of the import: the register
 * module registers every element as a synchronous side effect of its module
 * graph's evaluation, so by the time its import resolves all of the elements
 * it defines are already defined. Awaiting a separately maintained tag
 * inventory would add nothing when correct and could only hang forever on
 * drift (one renamed tag would leave a `whenDefined` that never settles).
 */
export function loadPieQtiPlayerElements(): Promise<void> {
	if (typeof globalThis.window === 'undefined') return Promise.resolve();
	return cachedImport(getStore(), 'pieQtiPlayerElements', async () => {
		await import('@pie-qti/player-elements/register');
	});
}
