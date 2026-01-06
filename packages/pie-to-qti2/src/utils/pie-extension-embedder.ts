/**
 * PIE Extension Embedder
 *
 * Utilities for embedding PIE source models in QTI XML for lossless round-trips
 */

import { parse } from 'node-html-parser';
import type { PieExtensionMetadata } from '../types/index.js';
import { PIE_NAMESPACE, PIE_PREFIX } from '../types/index.js';

/**
 * Embed PIE sourceModel in QTI XML for lossless round-trip
 */
export function embedPieExtension(
  qtiXml: string,
  pieModel: any,
  metadata?: PieExtensionMetadata
): string {
  try {
    // Find the root element opening tag and add PIE namespace if not present
    const rootElementPattern = /<(assessmentItem|assessmentTest|assessmentSection|assessmentStimulus)([^>]*)>/;
    const match = qtiXml.match(rootElementPattern);

    if (!match) {
      console.warn('Could not find QTI root element, returning original XML');
      return qtiXml;
    }

    const [fullMatch, tagName, attributes] = match;
    let modifiedXml = qtiXml;

    // Add PIE namespace if not already present
    if (!attributes.includes(`xmlns:${PIE_PREFIX}`)) {
      const newOpeningTag = fullMatch.replace(
        '>',
        ` xmlns:${PIE_PREFIX}="${PIE_NAMESPACE}">`
      );
      modifiedXml = qtiXml.replace(fullMatch, newOpeningTag);
    }

    // Create <pie:sourceModel> with CDATA
    const jsonStr = JSON.stringify(pieModel, null, 2);
    const sourceModelElement = `\n  <${PIE_PREFIX}:sourceModel><![CDATA[${jsonStr}]]></${PIE_PREFIX}:sourceModel>`;

    // Create <pie:metadata> (optional)
    const metadataElement = metadata ? '\n  ' + createMetadataElement(metadata) : '';

    // Inject before closing tag
    const closingTag = `</${tagName}>`;
    const lastClosingTagIndex = modifiedXml.lastIndexOf(closingTag);

    if (lastClosingTagIndex === -1) {
      console.warn('Could not find closing tag, returning original XML');
      return qtiXml;
    }

    const qtiWithExtension =
      modifiedXml.substring(0, lastClosingTagIndex) +
      sourceModelElement +
      metadataElement +
      '\n' +
      modifiedXml.substring(lastClosingTagIndex);

    return qtiWithExtension;
  } catch (error) {
    console.error('Error embedding PIE extension:', error);
    return qtiXml;
  }
}

/**
 * Extract PIE sourceModel from QTI XML
 */
export function extractPieExtension(qtiXml: string): { sourceModel: any; metadata?: PieExtensionMetadata } | null {
  try {
    const doc = parse(qtiXml, { lowerCaseTagName: false, comment: false });

    // Find <pie:sourceModel> element
    const sourceModelElement = doc.querySelector(`${PIE_PREFIX}\\:sourceModel`) ||
                               doc.querySelector('sourceModel');

    if (!sourceModelElement) {
      return null;
    }

    // Extract JSON from CDATA
    const cdataContent = sourceModelElement.text;
    const sourceModel = JSON.parse(cdataContent);

    // Extract metadata if present
    const metadataElement = doc.querySelector(`${PIE_PREFIX}\\:metadata`) ||
                           doc.querySelector('metadata');

    let metadata: PieExtensionMetadata | undefined;
    if (metadataElement) {
      metadata = parseMetadataElement(metadataElement.toString());
    }

    return { sourceModel, metadata };
  } catch (error) {
    console.error('Error extracting PIE extension:', error);
    return null;
  }
}

/**
 * Check if QTI XML has embedded PIE source
 */
export function hasPieExtension(qtiXml: string): boolean {
  return qtiXml.includes(`<${PIE_PREFIX}:sourceModel>`) ||
         qtiXml.includes('<sourceModel>');
}

/**
 * Create metadata element
 */
function createMetadataElement(metadata: PieExtensionMetadata): string {
  const parts: string[] = [`<${PIE_PREFIX}:metadata>`];

  if (metadata.generator) {
    parts.push(
      `  <${PIE_PREFIX}:generator version="${metadata.generator.version}">${metadata.generator.package}</${PIE_PREFIX}:generator>`
    );
  }

  if (metadata.elementType) {
    parts.push(`  <${PIE_PREFIX}:elementType>${metadata.elementType}</${PIE_PREFIX}:elementType>`);
  }

  if (metadata.timestamp) {
    const timestamp = metadata.timestamp instanceof Date
      ? metadata.timestamp.toISOString()
      : metadata.timestamp;
    parts.push(`  <${PIE_PREFIX}:timestamp>${timestamp}</${PIE_PREFIX}:timestamp>`);
  }

  parts.push(`</${PIE_PREFIX}:metadata>`);
  return parts.join('\n  ');
}

/**
 * Parse metadata element
 */
function parseMetadataElement(metadataXml: string): PieExtensionMetadata {
  const doc = parse(metadataXml, { lowerCaseTagName: false });
  const metadata: PieExtensionMetadata = {};

  const generatorEl = doc.querySelector('generator');
  if (generatorEl) {
    metadata.generator = {
      package: generatorEl.text,
      version: generatorEl.getAttribute('version') || '1.0.0'
    };
  }

  const elementTypeEl = doc.querySelector('elementType');
  if (elementTypeEl) {
    metadata.elementType = elementTypeEl.text;
  }

  const timestampEl = doc.querySelector('timestamp');
  if (timestampEl) {
    metadata.timestamp = new Date(timestampEl.text);
  }

  return metadata;
}
