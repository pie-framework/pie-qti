/**
 * PIE Extension Utilities
 *
 * Utilities for detecting and extracting PIE extensions from QTI XML.
 * Enables lossless round-trip transformation (PIE → QTI → PIE).
 */

import { HTMLElement, parse } from 'node-html-parser';

export const PIE_NAMESPACE = 'https://github.com/pie-framework/pie-elements';
export const PIE_PREFIX = 'pie';

/**
 * QTI root element types that can contain PIE extensions
 */
const QTI_ROOT_ELEMENTS = [
  'assessmentItem',
  'assessmentTest',
  'assessmentPassage',
  'assessmentStimulus',
] as const;

export interface PieExtensionMetadata {
  /** Generator package and version */
  generator?: {
    package: string;
    version: string;
  };
  /** Original PIE element type */
  elementType?: string;
  /** Timestamp of transformation */
  timestamp?: Date;
  /** Additional custom metadata */
  [key: string]: any;
}

export interface PieExtensionData {
  /** Full PIE model from sourceModel */
  sourceModel: any;
  /** Metadata from pie:metadata element */
  metadata?: PieExtensionMetadata;
  /** Whether the extension was found */
  hasExtension: boolean;
}

/**
 * Check if QTI XML contains PIE namespace extension
 */
export function hasPieExtension(qtiXml: string): boolean {
  return (
    qtiXml.includes(`xmlns:${PIE_PREFIX}="${PIE_NAMESPACE}"`) &&
    qtiXml.includes(`<${PIE_PREFIX}:sourceModel>`)
  );
}

/**
 * Extract PIE extension data from QTI XML
 *
 * @param qtiXml - QTI XML string
 * @returns PIE extension data including source model and metadata
 */
export function extractPieExtension(qtiXml: string): PieExtensionData {
  if (!hasPieExtension(qtiXml)) {
    return {
      sourceModel: null,
      hasExtension: false,
    };
  }

  try {
    const doc = parse(qtiXml, {
      lowerCaseTagName: false,
      comment: false,
    });

    // Find the root element - try all supported QTI root element types
    // Note: Use getElementsByTagName since querySelector doesn't work well with case-sensitive tags
    let root: HTMLElement | null = null;
    for (const elementType of QTI_ROOT_ELEMENTS) {
      root = doc.getElementsByTagName(elementType)[0];
      if (root) break;
    }

    if (!root) {
      return {
        sourceModel: null,
        hasExtension: false,
      };
    }

    // Extract sourceModel
    const sourceModel = extractSourceModel(root);
    if (!sourceModel) {
      return {
        sourceModel: null,
        hasExtension: false,
      };
    }

    // Extract metadata
    const metadata = extractMetadata(root);

    return {
      sourceModel,
      metadata,
      hasExtension: true,
    };
  } catch (error) {
    console.error('Failed to extract PIE extension:', error);
    return {
      sourceModel: null,
      hasExtension: false,
    };
  }
}

/**
 * Extract PIE source model from CDATA
 */
function extractSourceModel(root: HTMLElement): any {
  // Try both with and without namespace prefix
  const sourceModelElement =
    findElementByTagName(root, `${PIE_PREFIX}:sourceModel`) ||
    findElementByTagName(root, 'sourceModel') ||
    root.querySelector(`${PIE_PREFIX}\\:sourceModel`) ||
    root.querySelector('sourceModel');

  if (!sourceModelElement) {
    return null;
  }

  try {
    // Get raw text content (includes CDATA wrapper)
    const rawText = sourceModelElement.rawText || sourceModelElement.text;
    if (!rawText) {
      return null;
    }

    // Remove CDATA wrapper: <![CDATA[...]]>
    let json = rawText.trim();
    if (json.startsWith('<![CDATA[') && json.endsWith(']]>')) {
      json = json.substring(9, json.length - 3); // Remove <![CDATA[ and ]]>
    }

    // Parse JSON
    return JSON.parse(json.trim());
  } catch (error) {
    console.error('Failed to parse PIE sourceModel JSON:', error, {
      rawText: sourceModelElement.rawText?.substring(0, 200),
      text: sourceModelElement.text?.substring(0, 200),
    });
    return null;
  }
}

/**
 * Extract PIE metadata
 */
function extractMetadata(root: HTMLElement): PieExtensionMetadata | undefined {
  const metadataElement =
    root.querySelector(`${PIE_PREFIX}\\:metadata`) ||
    root.querySelector('metadata') ||
    findElementByTagName(root, `${PIE_PREFIX}:metadata`) ||
    findElementByTagName(root, 'metadata');

  if (!metadataElement) {
    return undefined;
  }

  const metadata: PieExtensionMetadata = {};

  // Extract all child elements as metadata fields generically
  for (const child of metadataElement.childNodes) {
    if (!(child instanceof HTMLElement)) continue;

    // Get the element name without namespace prefix
    const elementName = child.rawTagName?.replace(`${PIE_PREFIX}:`, '') || child.tagName;

    // Handle known metadata fields with special processing
    if (elementName === 'generator') {
      metadata.generator = {
        package: child.text || '',
        version: child.getAttribute('version') || '',
      };
    } else if (elementName === 'elementType') {
      metadata.elementType = child.text;
    } else if (elementName === 'timestamp') {
      const timestamp = child.text;
      if (timestamp) {
        metadata.timestamp = new Date(timestamp);
      }
    } else {
      // Store any other metadata fields generically
      const value = child.text;
      if (value) {
        // Try to parse as JSON for structured data, otherwise store as string
        try {
          metadata[elementName] = JSON.parse(value);
        } catch {
          metadata[elementName] = value;
        }
      }
    }
  }

  return metadata;
}

/**
 * Helper to find element by tag name (handles namespaced elements)
 */
function findElementByTagName(root: HTMLElement, tagName: string): HTMLElement | null {
  const children = root.childNodes;
  for (const child of children) {
    if (child instanceof HTMLElement) {
      if (child.rawTagName === tagName || child.tagName === tagName.toLowerCase()) {
        return child;
      }
    }
  }
  return null;
}

/**
 * Extract data-* attributes from QTI elements for partial metadata preservation
 *
 * @param element - HTML element to extract attributes from
 * @returns Object with extracted data attributes
 */
export function extractDataAttributes(element: HTMLElement): Record<string, any> {
  const dataAttrs: Record<string, any> = {};
  const attrs = element.attributes || {};

  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('data-pie-')) {
      const pieKey = key.replace('data-pie-', '');
      // Try to parse as JSON for boolean/number values
      try {
        dataAttrs[pieKey] = JSON.parse(value);
      } catch {
        dataAttrs[pieKey] = value;
      }
    }
  }

  return dataAttrs;
}
