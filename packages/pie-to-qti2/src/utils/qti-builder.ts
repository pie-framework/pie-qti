/**
 * QTI Builder Utilities
 *
 * Utilities for constructing well-formed QTI 2.2 XML documents
 */

import formatXml from 'xml-formatter';
import type { AssessmentItemOptions } from '../types/index.js';

/**
 * QTI Builder - utilities for constructing QTI XML
 */
export class QtiBuilder {
  /**
   * Format XML for human readability
   */
  static format(xml: string, options?: { indentation?: string; maxLineLength?: number }): string {
    try {
      return formatXml(xml, {
        indentation: options?.indentation || '  ',  // 2 spaces
        collapseContent: true,
        lineSeparator: '\n',
        whiteSpaceAtEndOfSelfclosingTag: false
      });
    } catch (error) {
      // If formatting fails, return original
      console.warn('Failed to format XML:', error);
      return xml;
    }
  }

  /**
   * Create assessmentItem wrapper with optional comments
   */
  static createAssessmentItem(
    identifier: string,
    responseDeclarations: string[],
    itemBody: string,
    options?: AssessmentItemOptions
  ): string {
    const comment = options?.pieElement
      ? `<!-- Generated from ${options.pieElement} -->\n  `
      : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="${escapeXml(identifier)}"
  ${options?.title ? `title="${escapeXml(options.title)}"` : ''}
  ${options?.label ? `label="${escapeXml(options.label)}"` : ''}
  adaptive="${options?.adaptive ?? false}"
  timeDependent="${options?.timeDependent ?? false}">
  ${comment}${responseDeclarations.join('\n  ')}
  <itemBody>
    ${itemBody}
  </itemBody>
</assessmentItem>`;

    return QtiBuilder.format(xml);
  }

  /**
   * Create interaction element with data-pie-* attributes
   */
  static createInteraction(
    type: string,
    responseIdentifier: string,
    attributes: Record<string, string | number | boolean>,
    content: string,
    pieAttributes?: Record<string, any>
  ): string {
    const qtiAttrs = Object.entries(attributes)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}="${escapeXml(String(value))}"`)
      .join(' ');

    // Add data-pie-* attributes for unmappable features
    const pieAttrs = pieAttributes
      ? Object.entries(pieAttributes)
          .map(([key, value]) => `data-pie-${key}="${escapeXml(JSON.stringify(value))}"`)
          .join(' ')
      : '';

    const allAttrs = [
      `responseIdentifier="${escapeXml(responseIdentifier)}"`,
      qtiAttrs,
      pieAttrs
    ].filter(Boolean).join(' ');

    return `<${type} ${allAttrs}>${content}</${type}>`;
  }

  /**
   * Create customInteraction for non-standard PIE elements
   */
  static createCustomInteraction(
    responseIdentifier: string,
    pieElementType: string,
    pieModel: any
  ): string {
    return `<customInteraction responseIdentifier="${escapeXml(responseIdentifier)}" type="${escapeXml(pieElementType)}">
  <!-- Embedded PIE model for custom interaction -->
  <div class="pie-custom-interaction" data-pie-model="${escapeXml(JSON.stringify(pieModel))}">
    This item requires a PIE-compatible player to display correctly.
  </div>
</customInteraction>`;
  }

  /**
   * Create a simple choice element
   */
  static createSimpleChoice(identifier: string, content: string, fixed?: boolean): string {
    const fixedAttr = fixed ? ' fixed="true"' : '';
    return `<simpleChoice identifier="${escapeXml(identifier)}"${fixedAttr}>${content}</simpleChoice>`;
  }

  /**
   * Create a prompt element
   */
  static createPrompt(content: string): string {
    return `<prompt>${content}</prompt>`;
  }

  /**
   * Wrap content in a div with optional class
   */
  static createDiv(content: string, className?: string): string {
    const classAttr = className ? ` class="${escapeXml(className)}"` : '';
    return `<div${classAttr}>${content}</div>`;
  }
}

/**
 * Escape XML special characters
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Unescape XML special characters
 */
export function unescapeXml(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}
