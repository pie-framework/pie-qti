/**
 * Acme Asset Resolver
 *
 * Resolves assets from Acme-specific locations (CDN, custom protocols)
 * Demonstrates the AssetResolver extension point
 *
 * This is a no-op implementation for demo purposes - logs resolution attempts
 * but doesn't actually fetch assets. In production, this would fetch from:
 * - Acme CDN (https://cdn.acme.com/...)
 * - Acme custom protocol (acme://assets/...)
 * - Acme asset service API
 */

import type { AssetResolver, ResolvedAsset } from '@pie-qti/to-pie';

/**
 * Resolves assets from Acme-specific sources
 *
 * Handles:
 * - acme:// protocol URLs
 * - https://cdn.acme.com/ CDN URLs
 * - https://assets.acme.com/ asset service URLs
 */
export class AcmeAssetResolver implements AssetResolver {
  readonly name = 'acme-asset-resolver';

  canResolve(assetType: string, assetUrl: string): boolean {
    const canHandle =
      assetUrl.startsWith('acme://') ||
      assetUrl.includes('cdn.acme.com') ||
      assetUrl.includes('assets.acme.com');

    if (canHandle) {
      console.log(`[AcmeAssetResolver] ✅ Can resolve ${assetType}: ${assetUrl}`);
    }

    return canHandle;
  }

  async resolve(
    assetType: 'stylesheet' | 'html' | 'audio' | 'image' | 'video' | string,
    assetUrl: string,
    baseDir: string
  ): Promise<ResolvedAsset> {
    console.log('[AcmeAssetResolver] ========================================');
    console.log('[AcmeAssetResolver] Resolving Acme asset');
    console.log('[AcmeAssetResolver] ========================================');
    console.log(`[AcmeAssetResolver] Asset type: ${assetType}`);
    console.log(`[AcmeAssetResolver] Asset URL: ${assetUrl}`);
    console.log(`[AcmeAssetResolver] Base directory: ${baseDir}`);

    // Determine MIME type based on asset type
    const mimeTypeMap: Record<string, string> = {
      stylesheet: 'text/css',
      html: 'text/html',
      audio: 'audio/mpeg',
      image: 'image/png',
      video: 'video/mp4',
    };
    const mimeType = mimeTypeMap[assetType] || 'application/octet-stream';

    console.log(`[AcmeAssetResolver] MIME type: ${mimeType}`);

    // In a real implementation, we would:
    // 1. Parse the custom protocol (acme://)
    // 2. Make an HTTP request to the CDN or asset service
    // 3. Handle authentication if needed
    // 4. Return the actual asset content

    // For demo purposes, return placeholder content
    let content = '';
    let buffer: Buffer | undefined;

    if (assetType === 'stylesheet') {
      content = `/* Acme stylesheet: ${assetUrl} */\n.acme-theme { color: #007bff; }\n`;
      console.log('[AcmeAssetResolver] Generated placeholder CSS');
    } else if (assetType === 'html') {
      content = `<!-- Acme HTML asset: ${assetUrl} -->\n<div class="acme-content">Placeholder content</div>\n`;
      console.log('[AcmeAssetResolver] Generated placeholder HTML');
    } else {
      // For binary assets, create a small placeholder buffer
      buffer = Buffer.from(`Placeholder binary data for ${assetUrl}`, 'utf-8');
      console.log('[AcmeAssetResolver] Generated placeholder binary data');
    }

    console.log('[AcmeAssetResolver] ✅ Asset resolved successfully');
    console.log('[AcmeAssetResolver] ========================================');

    return {
      url: assetUrl,
      content: content || undefined,
      buffer,
      mimeType,
      filePath: undefined, // Not a local file
    };
  }
}
