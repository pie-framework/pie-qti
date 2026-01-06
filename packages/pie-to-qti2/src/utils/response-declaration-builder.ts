/**
 * Response Declaration Builder
 *
 * Utilities for building QTI responseDeclaration elements
 */

import type { ResponseDeclarationOptions } from '../types/index.js';
import { escapeXml } from './qti-builder.js';

/**
 * Build a responseDeclaration element
 */
export function buildResponseDeclaration(options: ResponseDeclarationOptions): string {
  const { identifier, cardinality, baseType, correctResponse, mapping } = options;

  let content = '';

  // Build correctResponse
  if (correctResponse && correctResponse.length > 0) {
    const values = correctResponse
      .map(v => `      <value>${escapeXml(v)}</value>`)
      .join('\n');
    content += `
    <correctResponse>
${values}
    </correctResponse>`;
  }

  // Build mapping (for partial credit)
  if (mapping && mapping.length > 0) {
    const entries = mapping
      .map(m => `      <mapEntry mapKey="${escapeXml(m.mapKey)}" mappedValue="${m.mappedValue}"/>`)
      .join('\n');
    content += `
    <mapping defaultValue="0">
${entries}
    </mapping>`;
  }

  return `<responseDeclaration identifier="${escapeXml(identifier)}" cardinality="${cardinality}" baseType="${baseType}">${content}
  </responseDeclaration>`;
}

/**
 * Build an outcome declaration element
 */
export function buildOutcomeDeclaration(
  identifier: string,
  cardinality: 'single' | 'multiple' | 'ordered' | 'record',
  baseType: string,
  defaultValue?: string | number
): string {
  let content = '';

  if (defaultValue !== undefined) {
    content = `
    <defaultValue>
      <value>${escapeXml(String(defaultValue))}</value>
    </defaultValue>`;
  }

  return `<outcomeDeclaration identifier="${escapeXml(identifier)}" cardinality="${cardinality}" baseType="${baseType}">${content}
  </outcomeDeclaration>`;
}

/**
 * Build response processing for simple match correct template
 */
export function buildSimpleMatchCorrectResponseProcessing(): string {
  return `<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>`;
}

/**
 * Build response processing for map response template
 */
export function buildMapResponseProcessing(): string {
  return `<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>`;
}
