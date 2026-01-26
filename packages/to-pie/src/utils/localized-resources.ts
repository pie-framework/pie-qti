/**
 * Localized Resource Utilities for IMS Content Packages
 *
 * Provides generic locale-aware utilities for QTI content packages. Resources can optionally
 * use locale-suffixed identifiers (e.g., "item.en-US", "item.es-ES") and IMS LOM language
 * metadata for multilingual support.
 *
 * **Works with both single-locale and multilingual packages:**
 * - Non-localized packages: Resources without locale suffixes are treated as the default locale
 * - Multilingual packages: Resources with locale suffixes enable per-locale selection
 *
 * **Generic fallback system:**
 * When requesting a locale variant, the system tries:
 * 1. Exact match (es-ES)
 * 2. Language-only match (es)
 * 3. Default locale (typically en-US)
 * 4. First available variant
 *
 * This means requesting "es-ES" from a non-localized English package will gracefully
 * fall back to the English content - no special handling needed.
 *
 * @example
 * ```typescript
 * // Works with any manifest (single or multilingual)
 * const manifest = parseManifest(xml);
 * const localized = buildLocalizedManifest(manifest, 'en-US');
 *
 * // Get item with automatic fallback
 * const item = getLocalizedItem(localized, 'simple-choice', 'es-ES');
 * // → Returns Spanish variant if available, otherwise falls back to English
 * ```
 */

import type { ManifestResource, ParsedManifest } from './manifest-parser.js';

/**
 * Base identifier without locale suffix
 * @example "simple-choice", "math-problem-1"
 */
export type BaseIdentifier = string;

/**
 * Locale code (BCP 47 format)
 * @example "en-US", "es-ES", "fr-FR", "en", "es"
 */
export type LocaleCode = string;

/**
 * A manifest resource with parsed locale information
 */
export interface LocalizedResource extends ManifestResource {
  /** Base identifier without locale suffix */
  baseId: BaseIdentifier;
  /** Locale code extracted from identifier or metadata */
  locale: LocaleCode;
  /** Original full identifier from manifest */
  identifier: string;
}

/**
 * A group of resource variants for the same base content in different locales
 */
export interface LocalizedResourceGroup {
  /** Base identifier shared by all variants */
  baseId: BaseIdentifier;
  /** All available locales for this resource */
  availableLocales: LocaleCode[];
  /** Map of locale to resource variant */
  variants: Map<LocaleCode, LocalizedResource>;
  /** Default/fallback locale for this group */
  defaultLocale: LocaleCode;
}

/**
 * A manifest with resources organized by base identifier and locale
 */
export interface LocalizedManifest {
  /** Original parsed manifest */
  manifest: ParsedManifest;
  /** Item resources grouped by base ID */
  itemGroups: Map<BaseIdentifier, LocalizedResourceGroup>;
  /** Passage resources grouped by base ID */
  passageGroups: Map<BaseIdentifier, LocalizedResourceGroup>;
  /** Test/assessment resources grouped by base ID */
  testGroups: Map<BaseIdentifier, LocalizedResourceGroup>;
  /** All locales available across all resources */
  availableLocales: Set<LocaleCode>;
}

/**
 * Locale identifier pattern - supports dot, dash, or underscore separators
 * Matches patterns like:
 * - "item.en-US"
 * - "item-en-US"
 * - "item_en_US"
 * - "item.en"
 */
const LOCALE_PATTERN = /[._-]([a-z]{2}(?:[_-][A-Z]{2})?)$/;

/**
 * Extract locale code from a resource identifier.
 *
 * Supports multiple separator styles:
 * - Dot: "item.en-US"
 * - Dash: "item-en-US"
 * - Underscore: "item_en_US"
 *
 * @param identifier Resource identifier (e.g., "simple-choice.en-US")
 * @returns Locale code if found, undefined otherwise
 *
 * @example
 * extractLocaleFromIdentifier("simple-choice.en-US") // "en-US"
 * extractLocaleFromIdentifier("simple-choice-es-ES") // "es-ES"
 * extractLocaleFromIdentifier("simple-choice_fr_FR") // "fr-FR"
 * extractLocaleFromIdentifier("simple-choice") // undefined
 */
export function extractLocaleFromIdentifier(identifier: string): LocaleCode | undefined {
  const match = identifier.match(LOCALE_PATTERN);
  if (!match) return undefined;

  // Normalize underscore separators to hyphens (en_US -> en-US)
  return match[1].replace('_', '-');
}

/**
 * Extract base identifier by removing locale suffix.
 *
 * @param identifier Resource identifier
 * @returns Base identifier without locale suffix
 *
 * @example
 * extractBaseIdentifier("simple-choice.en-US") // "simple-choice"
 * extractBaseIdentifier("simple-choice") // "simple-choice"
 */
export function extractBaseIdentifier(identifier: string): BaseIdentifier {
  const match = identifier.match(LOCALE_PATTERN);
  if (!match) return identifier;
  return identifier.slice(0, match.index);
}

/**
 * Extract language code from IMS LOM metadata.
 *
 * Looks for language information in the metadata object, typically
 * from <imsmd:language> elements in the manifest.
 *
 * @param metadata Resource metadata object
 * @returns Locale code if found, undefined otherwise
 *
 * @example
 * extractLanguageFromMetadata({ language: "en-US" }) // "en-US"
 * extractLanguageFromMetadata({ title: "Test" }) // undefined
 */
export function extractLanguageFromMetadata(
  metadata?: { language?: string; [key: string]: any }
): LocaleCode | undefined {
  return metadata?.language;
}

/**
 * Determine the locale for a resource using multiple detection methods.
 *
 * This is the core function that enables the generic locale system to work with both
 * localized and non-localized packages. Resources without locale information are
 * simply assigned the default locale - no special handling needed.
 *
 * Priority order:
 * 1. Identifier suffix (e.g., "item.en-US") - most explicit
 * 2. IMS LOM language metadata - explicit metadata
 * 3. Default locale - implicit for non-localized content
 *
 * @param resource Manifest resource
 * @param defaultLocale Default locale to use as fallback
 * @returns Detected locale code
 *
 * @example
 * determineResourceLocale({ identifier: "item.es-ES", ... }, "en-US") // "es-ES"
 * determineResourceLocale({ identifier: "item", metadata: { language: "fr" } }, "en-US") // "fr"
 * determineResourceLocale({ identifier: "item" }, "en-US") // "en-US" (non-localized → default)
 */
export function determineResourceLocale(
  resource: ManifestResource,
  defaultLocale: LocaleCode
): LocaleCode {
  // Try identifier first (most explicit)
  const fromId = extractLocaleFromIdentifier(resource.identifier);
  if (fromId) return fromId;

  // Try metadata
  const fromMetadata = extractLanguageFromMetadata(resource.metadata);
  if (fromMetadata) return fromMetadata;

  // Fall back to default
  return defaultLocale;
}

/**
 * Generate locale fallback chain for resource selection.
 *
 * Creates a prioritized list of locales to try when selecting a resource variant.
 *
 * Fallback logic:
 * 1. Exact match (es-ES)
 * 2. Language-only (es)
 * 3. Default locale (en-US)
 * 4. Default language-only (en)
 *
 * @param requestedLocale User's requested locale
 * @param defaultLocale Default/fallback locale
 * @returns Array of locale codes in priority order
 *
 * @example
 * getLocaleFallbackChain("es-MX", "en-US")
 * // ["es-MX", "es", "en-US", "en"]
 *
 * getLocaleFallbackChain("fr-CA", "en-US")
 * // ["fr-CA", "fr", "en-US", "en"]
 */
export function getLocaleFallbackChain(
  requestedLocale: LocaleCode,
  defaultLocale: LocaleCode
): LocaleCode[] {
  const chain: LocaleCode[] = [];

  // 1. Exact requested locale
  chain.push(requestedLocale);

  // 2. Language-only from requested locale (es-ES -> es)
  const requestedLang = requestedLocale.split(/[-_]/)[0];
  if (requestedLang !== requestedLocale) {
    chain.push(requestedLang);
  }

  // 3. Default locale (if different from requested)
  if (defaultLocale !== requestedLocale) {
    chain.push(defaultLocale);
  }

  // 4. Language-only from default locale (en-US -> en)
  const defaultLang = defaultLocale.split(/[-_]/)[0];
  if (defaultLang !== defaultLocale && defaultLang !== requestedLang) {
    chain.push(defaultLang);
  }

  return chain;
}

/**
 * Select the best matching resource variant from a group.
 *
 * Uses fallback chain to find the most appropriate variant:
 * 1. Try exact locale match
 * 2. Try language-only match
 * 3. Try default locale
 * 4. Use first available variant
 *
 * @param group Resource group with multiple locale variants
 * @param requestedLocale User's requested locale
 * @param defaultLocale Default/fallback locale
 * @returns Best matching resource, or undefined if group is empty
 *
 * @example
 * const group = {
 *   baseId: "simple-choice",
 *   availableLocales: ["en-US", "es-ES"],
 *   variants: new Map([
 *     ["en-US", enResource],
 *     ["es-ES", esResource]
 *   ]),
 *   defaultLocale: "en-US"
 * };
 *
 * selectLocalizedResource(group, "es-MX", "en-US") // esResource (fallback es-ES -> es)
 * selectLocalizedResource(group, "fr-FR", "en-US") // enResource (fallback to default)
 */
export function selectLocalizedResource(
  group: LocalizedResourceGroup,
  requestedLocale: LocaleCode,
  defaultLocale: LocaleCode
): LocalizedResource | undefined {
  if (group.variants.size === 0) return undefined;

  const fallbackChain = getLocaleFallbackChain(requestedLocale, defaultLocale);

  // Try each locale in fallback chain
  for (const locale of fallbackChain) {
    const resource = group.variants.get(locale);
    if (resource) return resource;
  }

  // Last resort: return first available variant
  return group.variants.values().next().value;
}

/**
 * Group resources by base identifier and locale.
 *
 * Takes a flat array of resources and organizes them into groups where
 * each group contains all locale variants of the same base content.
 *
 * @param resources Array of manifest resources
 * @param defaultLocale Default locale to assign to resources without locale info
 * @returns Map of base identifier to resource group
 *
 * @example
 * const resources = [
 *   { identifier: "item.en-US", ... },
 *   { identifier: "item.es-ES", ... },
 *   { identifier: "other.en-US", ... }
 * ];
 *
 * const groups = groupResourcesByLocale(resources, "en-US");
 * // Map {
 * //   "item" => { baseId: "item", availableLocales: ["en-US", "es-ES"], ... },
 * //   "other" => { baseId: "other", availableLocales: ["en-US"], ... }
 * // }
 */
export function groupResourcesByLocale(
  resources: ManifestResource[],
  defaultLocale: LocaleCode
): Map<BaseIdentifier, LocalizedResourceGroup> {
  const groups = new Map<BaseIdentifier, LocalizedResourceGroup>();

  for (const resource of resources) {
    const locale = determineResourceLocale(resource, defaultLocale);
    const baseId = extractBaseIdentifier(resource.identifier);

    const localizedResource: LocalizedResource = {
      ...resource,
      baseId,
      locale,
    };

    let group = groups.get(baseId);
    if (!group) {
      group = {
        baseId,
        availableLocales: [],
        variants: new Map(),
        defaultLocale,
      };
      groups.set(baseId, group);
    }

    group.variants.set(locale, localizedResource);
    if (!group.availableLocales.includes(locale)) {
      group.availableLocales.push(locale);
    }
  }

  return groups;
}

/**
 * Build a localized manifest structure from a parsed manifest.
 *
 * Organizes all resources (items, passages, tests) by base identifier and locale,
 * enabling easy lookup and locale-aware resource selection.
 *
 * @param manifest Parsed manifest
 * @param defaultLocale Default locale for resources without locale info
 * @returns Localized manifest with grouped resources
 *
 * @example
 * const manifest = parseManifest(manifestXml);
 * const localized = buildLocalizedManifest(manifest, "en-US");
 *
 * console.log(localized.availableLocales); // Set { "en-US", "es-ES", "fr-FR" }
 * console.log(localized.itemGroups.get("simple-choice")); // Group with all locale variants
 */
export function buildLocalizedManifest(
  manifest: ParsedManifest,
  defaultLocale: LocaleCode = 'en-US'
): LocalizedManifest {
  const itemGroups = groupResourcesByLocale(manifest.items, defaultLocale);
  const passageGroups = groupResourcesByLocale(manifest.passages, defaultLocale);
  const testGroups = groupResourcesByLocale(manifest.tests, defaultLocale);

  // Collect all unique locales
  const availableLocales = new Set<LocaleCode>();
  for (const group of [
    ...itemGroups.values(),
    ...passageGroups.values(),
    ...testGroups.values(),
  ]) {
    for (const locale of group.availableLocales) {
      availableLocales.add(locale);
    }
  }

  return {
    manifest,
    itemGroups,
    passageGroups,
    testGroups,
    availableLocales,
  };
}

/**
 * Get a specific item resource in the requested locale.
 *
 * Uses fallback chain to find the best matching locale variant.
 *
 * @param localizedManifest Localized manifest
 * @param baseId Base identifier of the item
 * @param requestedLocale User's requested locale
 * @returns Localized resource, or undefined if item not found
 *
 * @example
 * const item = getLocalizedItem(manifest, "simple-choice", "es-MX");
 * // Returns Spanish variant (es-ES) if available, otherwise falls back
 */
export function getLocalizedItem(
  localizedManifest: LocalizedManifest,
  baseId: BaseIdentifier,
  requestedLocale: LocaleCode
): LocalizedResource | undefined {
  const group = localizedManifest.itemGroups.get(baseId);
  if (!group) return undefined;

  return selectLocalizedResource(group, requestedLocale, group.defaultLocale);
}

/**
 * Get a specific passage resource in the requested locale.
 *
 * @param localizedManifest Localized manifest
 * @param baseId Base identifier of the passage
 * @param requestedLocale User's requested locale
 * @returns Localized resource, or undefined if passage not found
 */
export function getLocalizedPassage(
  localizedManifest: LocalizedManifest,
  baseId: BaseIdentifier,
  requestedLocale: LocaleCode
): LocalizedResource | undefined {
  const group = localizedManifest.passageGroups.get(baseId);
  if (!group) return undefined;

  return selectLocalizedResource(group, requestedLocale, group.defaultLocale);
}

/**
 * Get a specific test resource in the requested locale.
 *
 * @param localizedManifest Localized manifest
 * @param baseId Base identifier of the test
 * @param requestedLocale User's requested locale
 * @returns Localized resource, or undefined if test not found
 */
export function getLocalizedTest(
  localizedManifest: LocalizedManifest,
  baseId: BaseIdentifier,
  requestedLocale: LocaleCode
): LocalizedResource | undefined {
  const group = localizedManifest.testGroups.get(baseId);
  if (!group) return undefined;

  return selectLocalizedResource(group, requestedLocale, group.defaultLocale);
}

/**
 * Get all items available in the requested locale.
 *
 * Returns all items, using fallback chain to select the best variant
 * for each item when exact locale match is not available.
 *
 * @param localizedManifest Localized manifest
 * @param requestedLocale User's requested locale
 * @returns Array of localized resources
 *
 * @example
 * const items = getAllItemsForLocale(manifest, "es-ES");
 * // Returns Spanish variants where available, falls back to default for others
 */
export function getAllItemsForLocale(
  localizedManifest: LocalizedManifest,
  requestedLocale: LocaleCode
): LocalizedResource[] {
  const items: LocalizedResource[] = [];

  for (const group of localizedManifest.itemGroups.values()) {
    const resource = selectLocalizedResource(group, requestedLocale, group.defaultLocale);
    if (resource) {
      items.push(resource);
    }
  }

  return items;
}

/**
 * Get all passages available in the requested locale.
 *
 * @param localizedManifest Localized manifest
 * @param requestedLocale User's requested locale
 * @returns Array of localized resources
 */
export function getAllPassagesForLocale(
  localizedManifest: LocalizedManifest,
  requestedLocale: LocaleCode
): LocalizedResource[] {
  const passages: LocalizedResource[] = [];

  for (const group of localizedManifest.passageGroups.values()) {
    const resource = selectLocalizedResource(group, requestedLocale, group.defaultLocale);
    if (resource) {
      passages.push(resource);
    }
  }

  return passages;
}

/**
 * Get all tests available in the requested locale.
 *
 * @param localizedManifest Localized manifest
 * @param requestedLocale User's requested locale
 * @returns Array of localized resources
 */
export function getAllTestsForLocale(
  localizedManifest: LocalizedManifest,
  requestedLocale: LocaleCode
): LocalizedResource[] {
  const tests: LocalizedResource[] = [];

  for (const group of localizedManifest.testGroups.values()) {
    const resource = selectLocalizedResource(group, requestedLocale, group.defaultLocale);
    if (resource) {
      tests.push(resource);
    }
  }

  return tests;
}
