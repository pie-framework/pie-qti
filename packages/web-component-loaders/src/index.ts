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
 * Idempotently loads (registers) the PIE QTI 2 player web components.
 * Safe to call multiple times; the underlying import will only happen once.
 */
export async function loadPieQtiPlayerElements(): Promise<void> {
	if (typeof globalThis.window === 'undefined') return;
	const store = getStore();

	store.pieQtiPlayerElements ??= import('@pie-qti/qti2-player-elements/register').then(async () => {
		const win = globalThis.window as Window & { customElements?: CustomElementRegistry };
		if (!win || typeof win.customElements === 'undefined') return;
		await Promise.allSettled([
			win.customElements.whenDefined('pie-qti2-item-player'),
			win.customElements.whenDefined('pie-qti2-assessment-player'),
		]);
	});

	return store.pieQtiPlayerElements;
}

export type { };


