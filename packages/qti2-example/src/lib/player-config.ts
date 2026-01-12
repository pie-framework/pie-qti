/**
 * Player Configuration Utilities
 *
 * Provides common configuration objects for the QTI Player that handle
 * deployment-specific concerns like asset URL resolution.
 */

import { base } from '$app/paths';
import type { PlayerConfig } from '@pie-qti/qti2-item-player';

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
export function getSecurityConfig(): NonNullable<PlayerConfig['security']> {
	return {
		urlPolicy: {
			assetBaseUrl: getAssetBaseUrl(),
		},
	};
}
