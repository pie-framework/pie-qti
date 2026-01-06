/**
 * Deterministic pseudo-random number generator helpers.
 *
 * We keep this tiny and dependency-free so tests (and optionally consumers)
 * can run template processing deterministically.
 */

/**
 * Mulberry32 PRNG.
 * Returns a function that yields a float in [0, 1).
 */
export function createSeededRng(seed: number): () => number {
	// Ensure 32-bit unsigned int
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}


