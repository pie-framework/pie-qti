export interface TypesetActionParams {
	/**
	 * Typeset function provided by the host app (KaTeX, MathJax, etc).
	 * It should be idempotent or at least safe to call repeatedly on updates.
	 */
	typeset: (root: HTMLElement) => void | Promise<void>;

	/**
	 * Observe subtree changes and re-typeset automatically.
	 * Default: true
	 */
	observe?: boolean;
}

/**
 * Generic Svelte action that calls `params.typeset(node)` initially and on DOM updates.
 *
 * This is intentionally dependency-free so the player/components can be used
 * outside the example app without pulling in a math engine.
 */
export function typesetAction(node: HTMLElement, params: TypesetActionParams) {
	const isBrowser = typeof window !== 'undefined' && typeof MutationObserver !== 'undefined';
	if (!isBrowser) return { update() {}, destroy() {} };

	let disposed = false;
	let scheduled = false;
	let observer: MutationObserver | null = null;
	let current = params;

	const schedule = () => {
		if (disposed || scheduled) return;
		scheduled = true;
		requestAnimationFrame(async () => {
			scheduled = false;
			if (disposed) return;
			try {
				await current.typeset(node);
			} catch {
				// ignore typesetting errors; keep raw text
			}
		});
	};

	const startObserver = () => {
		if (observer) return;
		observer = new MutationObserver(() => schedule());
		observer.observe(node, { childList: true, subtree: true, characterData: true });
	};

	const stopObserver = () => {
		observer?.disconnect();
		observer = null;
	};

	// initial
	schedule();
	if (current.observe !== false) startObserver();

	return {
		update(next: TypesetActionParams) {
			current = next;
			if (current.observe === false) stopObserver();
			else startObserver();
			schedule();
		},
		destroy() {
			disposed = true;
			stopObserver();
		},
	};
}


