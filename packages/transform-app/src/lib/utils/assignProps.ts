export type AssignPropsOptions = {
	skipUndefined?: boolean;
};

export function assignProps(node: HTMLElement, props: Record<string, unknown>, options: AssignPropsOptions = {}) {
	const { skipUndefined = true } = options;
	for (const [key, value] of Object.entries(props)) {
		if (skipUndefined && value === undefined) continue;
		(node as any)[key] = value;
	}
}

