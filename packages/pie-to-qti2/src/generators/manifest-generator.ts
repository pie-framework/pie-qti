/**
 * IMS Content Package Manifest Generator
 *
 * Generates imsmanifest.xml files for IMS Content Packages
 * Follows IMS Content Packaging v1.1.4 and QTI 2.2 specifications
 */

import { v4 as uuid } from 'uuid';
import type {
  ImsManifest,
  ManifestGenerationOptions,
  ManifestInput,
  Resource,
  ResourceDependency,
} from '../types/manifest.js';

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

  // Build resources
  const resources: Resource[] = [];

  // Add passage resources first (items depend on them)
  if (input.passages && input.passages.length > 0) {
    for (const passage of input.passages) {
      resources.push({
        identifier: passage.id,
        type: passage.type || 'imsqti_item_xmlv2p2',
        href: passage.filePath,
        metadata: passage.metadata,
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

    resources.push({
      identifier: item.id,
      type: item.type || 'imsqti_item_xmlv2p2',
      href: item.filePath,
      metadata: item.metadata,
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

      resources.push({
        identifier: assessment.id,
        type: assessment.type || 'imsqti_assessment_xmlv2p2',
        href: assessment.filePath,
        metadata: assessment.metadata,
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
  };
}

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

  // Manifest root element
  lines.push(
    '<manifest identifier="' + escapeXml(manifest.identifier) + '"',
    '          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"',
    '          xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"',
    '          xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p2"',
    '          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1',
    '                              http://www.imsglobal.org/xsd/qti/qtiv2p2/qtiv2p2_imscpv1p2_v1p0.xsd',
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

    // Metadata (if provided)
    if (resource.metadata) {
      lines.push('      <metadata>');
      for (const [key, value] of Object.entries(resource.metadata)) {
        lines.push(`        <imsmd:${key}>${escapeXml(String(value))}</imsmd:${key}>`);
      }
      lines.push('      </metadata>');
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
  items: Array<{ id: string; filePath: string; dependencies?: string[] }>,
  passages: Array<{ id: string; filePath: string }>,
  options?: ManifestGenerationOptions
): string {
  const input: ManifestInput = {
    items: items.map(item => ({
      id: item.id,
      filePath: item.filePath,
      dependencies: item.dependencies,
    })),
    passages: passages.map(p => ({
      id: p.id,
      filePath: p.filePath,
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
  items: Array<{ id: string; filePath: string; dependencies?: string[] }>,
  passages: Array<{ id: string; filePath: string }> = [],
  options?: ManifestGenerationOptions
): string {
  const itemIds = items.map(item => item.id);

  const input: ManifestInput = {
    items: items.map(item => ({
      id: item.id,
      filePath: item.filePath,
      dependencies: item.dependencies,
    })),
    passages: passages.map(p => ({
      id: p.id,
      filePath: p.filePath,
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
