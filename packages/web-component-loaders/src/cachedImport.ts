/**
 * Single-flight dynamic import keyed in a shared store. While pending,
 * concurrent callers share one promise. If the import rejects — a transient
 * chunk failure such as a blocked network or a stale-deploy 404 — the entry is
 * cleared so a later call retries the import instead of replaying the same
 * rejection for the rest of the page's lifetime.
 *
 * Internal loading primitive: imported by tests directly, not listed in the
 * package's exports map.
 */
export function cachedImport(
	store: Record<string, Promise<void>>,
	key: string,
	load: () => Promise<void>
): Promise<void> {
	const existing = store[key];
	if (existing) return existing;
	const pending = load().catch((error: unknown) => {
		// Only clear our own entry: a concurrent replacement (not possible with
		// the single-flight guarantee, but cheap to guard) must survive.
		if (store[key] === pending) delete store[key];
		throw error;
	});
	store[key] = pending;
	return pending;
}
