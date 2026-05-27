declare global {
	// eslint-disable-next-line no-var
	var __pieQtiWebComponentLoaders__: undefined | Record<string, Promise<void>>;
}

const DEFAULT_INTERACTION_TAGS = [
	'pie-qti-choice',
	'pie-qti-slider',
	'pie-qti-order',
	'pie-qti-match',
	'pie-qti-associate',
	'pie-qti-gap-match',
	'pie-qti-hotspot',
	'pie-qti-hottext',
	'pie-qti-media',
	'pie-qti-custom',
	'pie-qti-end-attempt',
	'pie-qti-position-object',
	'pie-qti-graphic-gap-match',
	'pie-qti-graphic-order',
	'pie-qti-graphic-associate',
	'pie-qti-select-point',
	'pie-qti-extended-text',
	'pie-qti-upload',
	'pie-qti-drawing',
	'pie-qti-catalog-popup',
] as const;

function getStore(): Record<string, Promise<void>> {
	const g = globalThis as typeof globalThis & {
		__pieQtiWebComponentLoaders__?: Record<string, Promise<void>>;
	};
	if (!g.__pieQtiWebComponentLoaders__) g.__pieQtiWebComponentLoaders__ = {};
	return g.__pieQtiWebComponentLoaders__;
}

/**
 * Idempotently loads the PIE QTI player and default interaction web components.
 * Safe to call multiple times; the underlying import will only happen once.
 */
export async function loadPieQtiPlayerElements(): Promise<void> {
	if (typeof globalThis.window === 'undefined') return;
	const store = getStore();

	store.pieQtiPlayerElements ??= Promise.all([
		import('@pie-qti/player-elements/register'),
		import('@pie-qti/default-components/plugins'),
	]).then(async () => {
		const win = globalThis.window as Window & { customElements?: CustomElementRegistry };
		if (!win || typeof win.customElements === 'undefined') return;
		await Promise.allSettled([
			win.customElements.whenDefined('pie-qti-item-player'),
			win.customElements.whenDefined('pie-qti-assessment-player'),
			...DEFAULT_INTERACTION_TAGS.map((tagName) => win.customElements!.whenDefined(tagName)),
		]);
	});

	return store.pieQtiPlayerElements;
}

export type { };


