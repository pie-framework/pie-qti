/** A deeply reactive props object, so a test can change props after mounting. */
export function reactiveProps<T extends Record<string, unknown>>(initial: T): T {
	const props = $state(initial);
	return props;
}
