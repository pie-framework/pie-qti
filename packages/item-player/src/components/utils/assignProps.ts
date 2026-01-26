export type AssignPropsOptions = {
	/**
	 * When true (default), keys with `undefined` values are skipped.
	 * This prevents accidentally overwriting existing values on the element.
	 *
	 * Note: `null` is still assigned (it is often a meaningful value).
	 */
	skipUndefined?: boolean;
};

/**
 * Assign a set of JS properties onto a DOM element.
 *
 * This is the preferred way to pass values into our custom elements, especially
 * Svelte custom elements, where camelCase props do not map cleanly via HTML attributes.
 */
export function assignProps(node: HTMLElement, props: Record<string, unknown>, options: AssignPropsOptions = {}) {
	const { skipUndefined = true } = options;
	for (const [key, value] of Object.entries(props)) {
		if (skipUndefined && value === undefined) continue;
		(node as any)[key] = value;
	}
}

