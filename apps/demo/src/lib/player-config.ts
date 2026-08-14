/**
 * Player Configuration Utilities
 *
 * Provides common configuration objects for the QTI Player that handle
 * deployment-specific concerns like asset URL resolution.
 */

import { base } from '$app/paths';
import type { PlayerSecurityConfig } from '@pie-qti/item-player';

/**
 * Get the asset base URL for the current deployment.
 * This handles the SvelteKit base path in production (e.g., /pie-qti/examples)
 * while working correctly in development (empty base).
 *
 * @returns The full base URL for resolving relative asset paths in QTI XML
 */
export function getAssetBaseUrl(): string {
	if (typeof window === 'undefined') return '';
	return `${window.location.origin}${base}/`;
}

/**
 * Get security configuration for the current deployment.
 *
 * Returns a PlayerSecurityConfig object that configures asset URL resolution
 * for the current deployment path (e.g., GitHub Pages subpath routing).
 *
 * Note: Despite the name, this primarily configures URL resolution via
 * `urlPolicy.assetBaseUrl` rather than security filtering.
 *
 * @returns PlayerSecurityConfig with urlPolicy.assetBaseUrl configured
 */
export function getSecurityConfig(): PlayerSecurityConfig {
	// Relative asset URLs are resolved against `assetBaseUrl` and then re-checked against the
	// scheme allowlist, which rejects http by default. Over http — `bun run dev`, or a preview
	// served without TLS — that silently blanks every relative asset in every item, so allow
	// http exactly when the app itself is served over it.
	const servedOverHttp = typeof window !== 'undefined' && window.location.protocol === 'http:';
	return {
		urlPolicy: {
			assetBaseUrl: getAssetBaseUrl(),
			...(servedOverHttp ? { allowHttp: true } : {}),
		},
	};
}
