/**
 * IMS Content Package Manifest Generator
 *
 * Generates imsmanifest.xml files for IMS Content Packages
 * Follows IMS Content Packaging v1.1.4 with the QTI 2.2 or QTI 3.0 content-packaging profile
 */

import { v4 as uuid } from 'uuid';
import type {
  AssessmentResource,
  ImsManifest,
  ItemResource,
  ManifestGenerationOptions,
  ManifestInput,
  PassageResource,
  Resource,
  ResourceDependency,
} from '../types/manifest.js';
import { LOM_NAMESPACE, LOM_SCHEMA_LOCATION, renderResourceLom } from '../utils/lom.js';

/**
 * Generate IMS manifest XML from input
 *
 * @param input Manifest input with items and passages
 * @returns XML string for imsmanifest.xml
 */
export function generateManifest(input: ManifestInput): string {
  const manifest = buildManifest(input);
  return manifestToXml(manifest);
}

/**
 * Build manifest structure from input
 *
 * @param input Manifest input
 * @returns Structured manifest object
 */
export function buildManifest(input: ManifestInput): ImsManifest {
  const options = input.options || {};
  const packageId = options.packageId || `pkg-${uuid()}`;
  const qtiVersion = options.qtiVersion ?? '2.2';
  const types = RESOURCE_TYPES[qtiVersion];

  // Build resources
  const resources: Resource[] = [];

  // Add passage resources first (items depend on them)
  if (input.passages && input.passages.length > 0) {
    for (const passage of input.passages) {
      // Add language metadata if locale is specified
      const metadata = passage.locale
        ? { ...passage.metadata, language: passage.locale }
        : passage.metadata;

      resources.push({
        identifier: passage.id,
        type: passage.type || types.passage,
        href: passage.filePath,
        metadata,
        baseId: passage.baseId,
        searchMetaData: passage.searchMetaData,
        files: passage.files?.map(f => ({ href: f })),
      });
    }
  }

  // Add item resources (assessments may depend on them)
  for (const item of input.items) {
    const dependencies: ResourceDependency[] = [];

    // Add dependencies on passages
    if (item.dependencies && item.dependencies.length > 0) {
      for (const depId of item.dependencies) {
        dependencies.push({ identifierref: depId });
      }
    }

    // Add language metadata if locale is specified
    const metadata = item.locale
      ? { ...item.metadata, language: item.locale }
      : item.metadata;

    resources.push({
      identifier: item.id,
      type: item.type || types.item,
      href: item.filePath,
      metadata,
      baseId: item.baseId,
      searchMetaData: item.searchMetaData,
      files: item.files?.map(f => ({ href: f })),
      dependencies: dependencies.length > 0 ? dependencies : undefined,
    });
  }

  // Add assessment resources (assessmentTest)
  if (input.assessments && input.assessments.length > 0) {
    for (const assessment of input.assessments) {
      const dependencies: ResourceDependency[] = [];

      // Add dependencies on items referenced by the assessment
      if (assessment.dependencies && assessment.dependencies.length > 0) {
        for (const depId of assessment.dependencies) {
          dependencies.push({ identifierref: depId });
        }
      }

      // Add language metadata if locale is specified
      const metadata = assessment.locale
        ? { ...assessment.metadata, language: assessment.locale }
        : assessment.metadata;

      resources.push({
        identifier: assessment.id,
        type: assessment.type || types.assessment,
        href: assessment.filePath,
        metadata,
        files: assessment.files?.map(f => ({ href: f })),
        dependencies: dependencies.length > 0 ? dependencies : undefined,
      });
    }
  }

  return {
    identifier: packageId,
    schemaVersion: options.schemaVersion || '1.1',
    metadata: options.metadata,
    resources,
    qtiVersion,
  };
}

/** Default resource types per QTI version. QTI 2.2 packages a passage as an interaction-less item. */
const RESOURCE_TYPES = {
  '2.2': { passage: 'imsqti_item_xmlv2p2', item: 'imsqti_item_xmlv2p2', assessment: 'imsqti_assessment_xmlv2p2' },
  '3.0': { passage: 'imsqti_stimulus_xmlv3p0', item: 'imsqti_item_xmlv3p0', assessment: 'imsqti_test_xmlv3p0' },
} as const;

export const QTI3_CP_NAMESPACE = 'http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1';
const QTI3_CP_SCHEMA_LOCATION = 'https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqtiv3p0_imscpv1p2_v1p0.xsd';

/**
 * Convert manifest structure to XML
 *
 * @param manifest Manifest structure
 * @returns XML string
 */
export function manifestToXml(manifest: ImsManifest): string {
  const lines: string[] = [];

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  if (manifest.qtiVersion === '3.0') {
    // The QTI 3.0 profile requires the manifest metadata and fixes its values.
    lines.push(
      `<manifest identifier="${escapeXml(manifest.identifier)}"`,
      `          xmlns="${QTI3_CP_NAMESPACE}"`,
      `          xmlns:imsmd="${LOM_NAMESPACE}"`,
      '          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      `          xsi:schemaLocation="${QTI3_CP_NAMESPACE} ${QTI3_CP_SCHEMA_LOCATION}`,
      `                              ${LOM_NAMESPACE} ${LOM_SCHEMA_LOCATION}">`,
      '  <metadata>',
      '    <schema>QTI Package</schema>',
      '    <schemaversion>3.0.0</schemaversion>',
      '  </metadata>'
    );
  } else {
    lines.push(
      '<manifest identifier="' + escapeXml(manifest.identifier) + '"',
      '          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"',
      `          xmlns:imsmd="${LOM_NAMESPACE}"`,
      '          xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p2"',
      '          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      '          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1',
      '                              http://www.imsglobal.org/xsd/qti/qtiv2p2/qtiv2p2_imscpv1p2_v1p0.xsd',
      `                              ${LOM_NAMESPACE} ${LOM_SCHEMA_LOCATION}`,
      '                              http://www.imsglobal.org/xsd/imsqti_v2p2',
      '                              http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd">',
    );

    // Metadata (if provided)
    if (manifest.metadata) {
      lines.push('  <metadata>');
      lines.push('    <schema>IMS Content</schema>');
      lines.push('    <schemaversion>' + escapeXml(manifest.schemaVersion || '1.1') + '</schemaversion>');
      lines.push('  </metadata>');
    }
  }

  // Organizations (empty by default, as QTI items don't require navigation structure)
  lines.push('  <organizations/>');

  // Resources
  lines.push('  <resources>');

  for (const resource of manifest.resources) {
    const resourceAttrs = [
      `identifier="${escapeXml(resource.identifier)}"`,
      `type="${escapeXml(resource.type)}"`,
      `href="${escapeXml(resource.href)}"`,
    ];

    lines.push('    <resource ' + resourceAttrs.join(' ') + '>');

    // IEEE LOM, the metadata both QTI packaging profiles admit on a resource
    const lom = renderResourceLom(
      {
        baseId: resource.baseId,
        title: optionalString(resource.metadata?.title),
        description: optionalString(resource.metadata?.description),
        language: optionalString(resource.metadata?.language),
        searchMetaData: resource.searchMetaData,
      },
      '        '
    );
    if (lom.length > 0) {
      lines.push('      <metadata>', ...lom, '      </metadata>');
    }

    // Main file
    lines.push(`      <file href="${escapeXml(resource.href)}"/>`);

    // Additional files
    if (resource.files && resource.files.length > 0) {
      for (const file of resource.files) {
        lines.push(`      <file href="${escapeXml(file.href)}"/>`);
      }
    }

    // Dependencies
    if (resource.dependencies && resource.dependencies.length > 0) {
      for (const dep of resource.dependencies) {
        lines.push(`      <dependency identifierref="${escapeXml(dep.identifierref)}"/>`);
      }
    }

    lines.push('    </resource>');
  }

  lines.push('  </resources>');
  lines.push('</manifest>');

  return lines.join('\n') + '\n';
}

function optionalString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate manifest for single item transformation
 *
 * Convenience function for generating manifest when transforming a single item
 *
 * @param itemId Item identifier
 * @param itemPath Item file path
 * @param passageIds Passage IDs this item depends on
 * @param passagePaths Map of passage IDs to file paths
 * @param options Generation options
 * @returns Manifest XML string
 */
export function generateSingleItemManifest(
  itemId: string,
  itemPath: string,
  passageIds: string[] = [],
  passagePaths: Map<string, string> = new Map(),
  options?: ManifestGenerationOptions
): string {
  const input: ManifestInput = {
    items: [
      {
        id: itemId,
        filePath: itemPath,
        dependencies: passageIds,
      },
    ],
    passages: passageIds.map(id => ({
      id,
      filePath: passagePaths.get(id) || `passages/${id}.xml`,
    })),
    options,
  };

  return generateManifest(input);
}

/**
 * Generate manifest for batch transformation
 *
 * Convenience function for generating manifest when transforming multiple items
 *
 * @param items Array of item resources
 * @param passages Array of passage resources (deduplicated)
 * @param options Generation options
 * @returns Manifest XML string
 */
export function generateBatchManifest(
  items: Array<Pick<ItemResource, 'id' | 'filePath' | 'dependencies' | 'baseId' | 'searchMetaData'>>,
  passages: Array<Pick<PassageResource, 'id' | 'filePath' | 'baseId' | 'searchMetaData'>>,
  options?: ManifestGenerationOptions
): string {
  const input: ManifestInput = {
    items: items.map(item => ({
      id: item.id,
      filePath: item.filePath,
      dependencies: item.dependencies,
      baseId: item.baseId,
      searchMetaData: item.searchMetaData,
    })),
    passages: passages.map(p => ({
      id: p.id,
      filePath: p.filePath,
      baseId: p.baseId,
      searchMetaData: p.searchMetaData,
    })),
    options,
  };

  return generateManifest(input);
}

/**
 * Generate manifest for assessment transformation
 *
 * Convenience function for generating manifest when transforming an assessment (QTI assessmentTest)
 * with its referenced items and passages.
 *
 * @param assessmentId Assessment identifier
 * @param assessmentPath Assessment file path
 * @param items Array of item resources referenced by the assessment
 * @param passages Array of passage resources referenced by items
 * @param options Generation options
 * @returns Manifest XML string
 */
export function generateAssessmentManifest(
  assessmentId: string,
  assessmentPath: string,
  items: Array<Pick<ItemResource, 'id' | 'filePath' | 'dependencies' | 'baseId' | 'searchMetaData'>>,
  passages: Array<Pick<PassageResource, 'id' | 'filePath' | 'baseId' | 'searchMetaData'>> = [],
  options?: ManifestGenerationOptions
): string {
  const itemIds = items.map(item => item.id);

  const input: ManifestInput = {
    items: items.map(item => ({
      id: item.id,
      filePath: item.filePath,
      dependencies: item.dependencies,
      baseId: item.baseId,
      searchMetaData: item.searchMetaData,
    })),
    passages: passages.map(p => ({
      id: p.id,
      filePath: p.filePath,
      baseId: p.baseId,
      searchMetaData: p.searchMetaData,
    })),
    assessments: [
      {
        id: assessmentId,
        filePath: assessmentPath,
        dependencies: itemIds,
      },
    ],
    options,
  };

  return generateManifest(input);
}
/**
 * Generate manifest for multilingual content package
 *
 * Convenience function that expands base identifiers into locale-suffixed resources.
 * This is purely a helper - you can achieve the same result by calling `generateManifest()`
 * directly with locale-suffixed identifiers. The locale system works generically with
 * any identifier pattern.
 *
 * Each generated resource:
 * - Gets a locale-suffixed identifier (e.g., "item.en-US", "item.es-ES")
 * - Automatically receives IMS LOM language metadata
 * - Works with the same fallback system as manually-created resources
 *
 * @param input Multilingual manifest input
 * @returns Manifest XML string
 *
 * @example
 * ```typescript
 * // Using convenience function
 * const manifest = generateMultilingualManifest({
 *   baseItems: [{
 *     baseId: "simple-choice",
 *     locales: {
 *       "en-US": { filePath: "items/simple-choice.en-US.xml" },
 *       "es-ES": { filePath: "items/simple-choice.es-ES.xml" }
 *     }
 *   }]
 * });
 *
 * // Equivalent manual approach (no special multilingual mode)
 * const manifest = generateManifest({
 *   items: [
 *     { id: "simple-choice.en-US", filePath: "items/simple-choice.en-US.xml", locale: "en-US" },
 *     { id: "simple-choice.es-ES", filePath: "items/simple-choice.es-ES.xml", locale: "es-ES" }
 *   ]
 * });
 * ```
 */
export function generateMultilingualManifest(input: {
  baseItems: Array<{
    baseId: string;
    locales: Record<string, { filePath: string; dependencies?: string[] }>;
  }>;
  basePassages?: Array<{
    baseId: string;
    locales: Record<string, { filePath: string }>;
  }>;
  baseAssessments?: Array<{
    baseId: string;
    locales: Record<string, { filePath: string; dependencies?: string[] }>;
  }>;
  options?: ManifestGenerationOptions;
}): string {
  const items: ItemResource[] = [];
  const passages: PassageResource[] = [];
  const assessments: AssessmentResource[] = [];

  // Expand passages with locale variants
  if (input.basePassages) {
    for (const basePassage of input.basePassages) {
      for (const [locale, data] of Object.entries(basePassage.locales)) {
        passages.push({
          id: `${basePassage.baseId}.${locale}`,
          filePath: data.filePath,
          locale,
        });
      }
    }
  }

  // Expand items with locale variants
  for (const baseItem of input.baseItems) {
    for (const [locale, data] of Object.entries(baseItem.locales)) {
      // Map dependencies to locale-specific identifiers if they exist
      const dependencies = data.dependencies?.map(depId => `${depId}.${locale}`);

      items.push({
        id: `${baseItem.baseId}.${locale}`,
        filePath: data.filePath,
        dependencies,
        locale,
      });
    }
  }

  // Expand assessments with locale variants
  if (input.baseAssessments) {
    for (const baseAssessment of input.baseAssessments) {
      for (const [locale, data] of Object.entries(baseAssessment.locales)) {
        // Map dependencies to locale-specific identifiers
        const dependencies = data.dependencies?.map(depId => `${depId}.${locale}`);

        assessments.push({
          id: `${baseAssessment.baseId}.${locale}`,
          filePath: data.filePath,
          dependencies,
          locale,
        });
      }
    }
  }

  const manifestInput: ManifestInput = {
    items,
    passages,
    assessments: assessments.length > 0 ? assessments : undefined,
    options: input.options,
  };

  return generateManifest(manifestInput);
}
