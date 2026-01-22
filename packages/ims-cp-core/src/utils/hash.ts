/**
 * Universal SHA-256 hashing utility
 * Works in both browser (Web Crypto API) and Node.js (crypto module)
 */

/**
 * Generate SHA-256 hash of content
 *
 * In browsers, uses the Web Crypto API (crypto.subtle.digest).
 * In Node.js, uses the crypto module (createHash).
 *
 * @param content String content to hash
 * @returns Hex-encoded hash string (64 characters)
 *
 * @example
 * ```typescript
 * const hash = await sha256('hello world');
 * console.log(hash); // "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
 * ```
 */
export async function sha256(content: string): Promise<string> {
	// Browser environment: Use Web Crypto API
	if (typeof crypto !== 'undefined' && crypto.subtle) {
		const encoder = new TextEncoder();
		const data = encoder.encode(content);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}

	// Node.js environment: Use crypto module
	const { createHash } = await import('crypto');
	return createHash('sha256').update(content).digest('hex');
}
