/**
 * Passage Generator
 *
 * Generates QTI-compliant passage/stimulus XML files
 */

import type { PieModel, PiePassageStimulus } from '@pie-qti/transform-types';
import type { GeneratedPassageFile, ResolvedPassage } from '../types/passages.js';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { toQtiXhtml } from '../utils/xhtml.js';

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

interface PassageParts {
  /** The QTI identifier: baseId when present, else id. */
  identifier: string;
  title?: string;
  content: string;
}

function passageParts(passage: PieModel | ResolvedPassage): PassageParts {
  if ('element' in passage) {
    // PIE passage model from config.models[]
    const [first] = passage.passages || [];
    return {
      identifier: (passage as any).baseId || passage.id || 'passage',
      title: first?.title,
      content: first?.text || '',
    };
  }
  // Resolved passage from PassageResolver
  return { identifier: passage.baseId || passage.id, title: passage.title, content: passage.content };
}

function stimulusDiv({ title, content }: PassageParts): string {
  const titleElement = title ? `<h2>${escapeXml(title)}</h2>\n    ` : '';
  return `<div class="stimulus">
      ${titleElement}${toQtiXhtml(content ?? '')}
    </div>`;
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
  const parts = passageParts(passage);
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2
                                    http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
                identifier="${escapeXml(parts.identifier)}"
                title="${escapeXml(parts.title || 'Passage')}"
                adaptive="false"
                timeDependent="false">
  <!-- Standalone passage/stimulus item -->
  <itemBody>
    ${stimulusDiv(parts)}
  </itemBody>
</assessmentItem>
`;
}

/**
 * Generate a QTI 3.0 `qti-assessment-stimulus` for a passage. It is written in QTI 2.2's
 * vocabulary and renamed, like every QTI 3.0 document the export writes.
 */
export function generatePassageStimulusXml(passage: PieModel | ResolvedPassage): string {
  const parts = passageParts(passage);
  return convertQti2ToQti3(`<?xml version="1.0" encoding="UTF-8"?>
<assessmentStimulus xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                    xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2
                                        http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
                    identifier="${escapeXml(parts.identifier)}"
                    title="${escapeXml(parts.title || 'Passage')}">
  <stimulusBody>
    ${stimulusDiv(parts)}
  </stimulusBody>
</assessmentStimulus>
`);
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
    /** `3.0` writes a `qti-assessment-stimulus`; `2.2`, the default, an interaction-less item. */
    targetVersion?: '2.2' | '3.0';
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
    xml: options.targetVersion === '3.0' ? generatePassageStimulusXml(passage) : generatePassageXml(passage),
    metadata: options.metadata,
  };
}

/**
 * Generate passage from PiePassageStimulus
 *
 * Converts full PIE passage stimulus to QTI passage XML
 */
export function generatePassageFromStimulus(
  stimulus: PiePassageStimulus,
  targetVersion: '2.2' | '3.0' = '2.2'
): GeneratedPassageFile {
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
    targetVersion,
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

/**
 * Insert an `assessmentStimulusRef` to an external passage, in QTI 2.2's vocabulary for the
 * QTI 3.0 rename: it precedes the item's stylesheets and body.
 */
export function insertStimulusReference(qtiXml: string, passageId: string, href: string): string {
  const at = qtiXml.search(/<(?:companionMaterialsInfo|stylesheet|itemBody)[\s/>]/);
  if (at === -1) return qtiXml;
  const ref = `<assessmentStimulusRef identifier="${escapeXml(passageId)}" href="${escapeXml(href)}" data-pie-passage-id="${escapeXml(passageId)}"/>\n  `;
  return `${qtiXml.slice(0, at)}${ref}${qtiXml.slice(at)}`;
}
