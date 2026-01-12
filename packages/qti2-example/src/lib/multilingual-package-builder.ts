/**
 * Multilingual Package Builder
 *
 * Builds in-memory IMS Content Packages with multilingual QTI items
 * for demonstration and testing purposes.
 */

// @ts-expect-error - TypeScript can't resolve subpath exports in workspace packages, but Vite handles it correctly at runtime
import { generateMultilingualManifest } from '@pie-qti/pie-to-qti2/generators/manifest-generator';
import {
  MULTILINGUAL_ITEMS,
  getAvailableLocales,
  type MultilingualSampleItem,
} from './sample-items-i18n.js';

/**
 * Multilingual package structure (in-memory)
 */
export interface MultilingualPackage {
  /** Generated imsmanifest.xml content */
  manifest: string;
  /** Map of resource identifier to XML content */
  items: Map<string, string>;
  /** All available locales in this package */
  availableLocales: string[];
  /** All base item IDs */
  baseItemIds: string[];
}

/**
 * Build a multilingual IMS Content Package from sample items.
 *
 * Creates an in-memory package structure with:
 * - Generated imsmanifest.xml with IMS LOM language metadata
 * - Item XML content indexed by locale-suffixed identifiers
 * - Metadata about available locales and items
 *
 * @returns Multilingual package structure
 *
 * @example
 * ```typescript
 * const pkg = buildMultilingualPackage();
 *
 * // Access manifest
 * console.log(pkg.manifest);
 *
 * // Get specific item variant
 * const itemXml = pkg.items.get('simple-choice-math.es-ES');
 *
 * // List available locales
 * console.log(pkg.availableLocales); // ["en-US", "es-ES", "fr-FR"]
 * ```
 */
export function buildMultilingualPackage(): MultilingualPackage {
  const items = new Map<string, string>();
  const baseItemIds: string[] = [];

  // Build item map and collect base IDs
  for (const multilingualItem of MULTILINGUAL_ITEMS) {
    baseItemIds.push(multilingualItem.baseId);

    for (const [locale, data] of Object.entries(multilingualItem.locales)) {
      if (data) {
        const identifier = `${multilingualItem.baseId}.${locale}`;
        items.set(identifier, data.xml);
      }
    }
  }

  // Generate manifest with locale-specific resources
  const manifest = generateMultilingualManifest({
    baseItems: MULTILINGUAL_ITEMS.map((item) => ({
      baseId: item.baseId,
      locales: Object.fromEntries(
        Object.keys(item.locales).map((locale) => [
          locale,
          { filePath: `items/${item.baseId}.${locale}.xml` },
        ])
      ),
    })),
    options: {
      packageId: 'multilingual-demo-package',
      title: 'Multilingual QTI Demo Package',
      metadata: {
        title: 'Multilingual QTI Demo Package',
        description: 'Demonstration package with items in English, Spanish, and French',
      },
    },
  });

  return {
    manifest,
    items,
    availableLocales: getAvailableLocales(),
    baseItemIds,
  };
}

/**
 * Get item XML by identifier (with locale suffix).
 *
 * @param pkg Package structure
 * @param identifier Full item identifier with locale suffix (e.g., "simple-choice-math.en-US")
 * @returns Item XML, or undefined if not found
 */
export function getItemXml(pkg: MultilingualPackage, identifier: string): string | undefined {
  return pkg.items.get(identifier);
}

/**
 * Get all locale variants for a base item.
 *
 * @param pkg Package structure
 * @param baseId Base item identifier
 * @returns Map of locale to XML content
 */
export function getItemVariants(
  pkg: MultilingualPackage,
  baseId: string
): Map<string, string> {
  const variants = new Map<string, string>();

  for (const locale of pkg.availableLocales) {
    const identifier = `${baseId}.${locale}`;
    const xml = pkg.items.get(identifier);
    if (xml) {
      variants.set(locale, xml);
    }
  }

  return variants;
}
