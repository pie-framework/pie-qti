/**
 * Passage Generator
 *
 * Generates QTI-compliant passage/stimulus XML files
 */

import type { PieModel, PiePassageStimulus } from '@pie-qti/transform-types';
import type { GeneratedPassageFile, ResolvedPassage } from '../types/passages.js';

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
 * Generate QTI passage XML from PIE passage model
 *
 * Generates a standalone QTI assessment item that contains only stimulus material.
 * This follows the QTI 2.2 pattern for reusable stimulus/passage content.
 *
 * ID Selection Logic:
 * - QTI identifier: baseId (if present), otherwise id
 * - Metadata: sourceSystemId = "pie", externalId = identifier value
 */
export function generatePassageXml(passage: PieModel | ResolvedPassage): string {
  let passageId: string;
  let baseId: string | undefined;
  let title: string | undefined;
  let content: string;

  // Handle different passage sources
  if ('element' in passage) {
    // PIE passage model from config.models[]
    passageId = passage.id || 'passage';
    baseId = (passage as any).baseId;
    // externalId could be extracted but not currently used
    // const externalId = (passage as any).externalId;
    const passageData = passage.passages || [];

    if (passageData.length > 0) {
      const firstPassage = passageData[0];
      title = firstPassage.title;
      content = firstPassage.text || '';
    } else {
      content = '';
    }
  } else {
    // Resolved passage from PassageResolver
    passageId = passage.id;
    baseId = passage.baseId;
    // externalId could be used but not currently needed
    // const externalId = passage.externalId;
    title = passage.title;
    content = passage.content;
  }

  // Determine QTI identifier: baseId (if present), otherwise id
  const qtiIdentifier = baseId || passageId;

  // Generate metadata fields
  const metadataFields: string[] = [];
  metadataFields.push('<qti-metadata-field name="sourceSystemId" value="pie"/>');
  metadataFields.push(`<qti-metadata-field name="externalId" value="${escapeXml(qtiIdentifier)}"/>`);

  const metadata = `  <qti-metadata>\n    ${metadataFields.join('\n    ')}\n  </qti-metadata>\n`;

  // Build passage XML
  const titleElement = title ? `<h2>${escapeXml(title)}</h2>\n    ` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2
                                    http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
                identifier="${escapeXml(qtiIdentifier)}"
                title="${escapeXml(title || 'Passage')}"
                adaptive="false"
                timeDependent="false">
${metadata}  <!-- Standalone passage/stimulus item -->
  <itemBody>
    <div class="stimulus">
      ${titleElement}${content}
    </div>
  </itemBody>
</assessmentItem>
`;
}

/**
 * Generate passage file for IMS Content Package
 *
 * Creates a GeneratedPassageFile with path and content
 * Uses baseId (if present) for file naming, otherwise falls back to id
 */
export function generatePassageFile(
  passage: PieModel | ResolvedPassage,
  options: {
    basePath?: string;
    metadata?: Record<string, any>;
  } = {}
): GeneratedPassageFile {
  // Extract IDs
  const passageId = 'element' in passage ? passage.id : passage.id;
  const baseId = 'element' in passage
    ? (passage as any).baseId
    : (passage as ResolvedPassage).baseId;

  // Use baseId for QTI identifier and file naming (if present)
  const qtiIdentifier = baseId || passageId;
  const basePath = options.basePath || 'passages';

  return {
    id: qtiIdentifier,  // Use stable ID
    filePath: `${basePath}/${qtiIdentifier}.xml`,
    xml: generatePassageXml(passage),
    metadata: options.metadata,
  };
}

/**
 * Generate passage from PiePassageStimulus
 *
 * Converts full PIE passage stimulus to QTI passage XML
 */
export function generatePassageFromStimulus(stimulus: PiePassageStimulus): GeneratedPassageFile {
  const passageId = stimulus.id || stimulus.externalId || 'passage';

  // Extract passage content from config.models
  let title: string | undefined;
  let content = '';

  if (stimulus.config && stimulus.config.models) {
    for (const model of stimulus.config.models) {
      if (model.passages && model.passages.length > 0) {
        const firstPassage = model.passages[0];
        title = firstPassage.title;
        content = firstPassage.text || '';
        break;
      }
    }
  }

  const resolved: ResolvedPassage = {
    id: passageId,
    baseId: stimulus.baseId,
    externalId: stimulus.externalId,
    title,
    content,
    metadata: stimulus.searchMetaData,
    piePassage: stimulus,
  };

  return generatePassageFile(resolved, {
    metadata: stimulus.searchMetaData,
  });
}

/**
 * Generate <object> tag for external passage reference
 *
 * Creates QTI object element that references an external passage file
 */
export function generatePassageObjectTag(passageId: string, href: string): string {
  return `<object data="${escapeXml(href)}" type="text/html" data-pie-passage-id="${escapeXml(passageId)}">
      <p>Passage content not available</p>
    </object>`;
}

/**
 * Insert passage object reference into QTI itemBody
 *
 * Adds <object> tag at the start of itemBody
 */
export function insertPassageObjectReference(
  qtiXml: string,
  passageId: string,
  href: string,
  logger?: any
): string {
  const itemBodyMatch = qtiXml.match(/(<itemBody>)([\s\S]*?)(<\/itemBody>)/);

  if (!itemBodyMatch) {
    logger?.warn('Could not find itemBody in QTI XML - skipping passage object insertion');
    return qtiXml;
  }

  const [, openTag, bodyContent, closeTag] = itemBodyMatch;
  const objectTag = generatePassageObjectTag(passageId, href);

  // Insert object reference at start of itemBody
  const newBodyContent = `\n    ${objectTag}\n    ${bodyContent.trim()}`;

  return qtiXml.replace(
    /(<itemBody>)[\s\S]*?(<\/itemBody>)/,
    `${openTag}${newBodyContent}\n  ${closeTag}`
  );
}
