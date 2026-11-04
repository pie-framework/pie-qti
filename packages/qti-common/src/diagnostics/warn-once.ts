/**
 * One-time console diagnostics for host setup mistakes.
 *
 * These fire only when something is actually misconfigured (a message would
 * render as a raw key, an attribute would be a no-op, a default endpoint is
 * assumed), so they are not environment-gated: a warning that only appears
 * because a host forgot wiring is useful in production too, and gating on
 * NODE_ENV/import.meta is unreliable across the tsc- and vite-built outputs
 * this workspace ships.
 */

const warned = new Set<string>();

/**
 * Emit `message` via console.warn at most once per unique `key` per page.
 */
export function warnOnce(key: string, message: string): void {
	if (warned.has(key)) return;
	warned.add(key);
	console.warn(`[pie-qti] ${message}`);
}
