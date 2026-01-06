/**
 * Assessment Generator
 *
 * Generates QTI assessmentTest from PIE assessment models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { escapeXml, QtiBuilder } from '../utils/qti-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

interface AssessmentSection {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  visible: boolean;
  fixed: boolean;
  shuffle: boolean;
  itemRefs: ItemReference[];
  subsections?: AssessmentSection[];
  selection?: {
    select: number;
    withReplacement?: boolean;
  };
  ordering?: {
    shuffle: boolean;
  };
  timeLimits?: {
    maxTime?: number;
    allowLateSubmission?: boolean;
  };
}

interface ItemReference {
  identifier: string;
  href: string;
  category?: string[];
  required?: boolean;
  fixed?: boolean;
  itemSessionControl?: {
    maxAttempts?: number;
    showFeedback?: boolean;
    allowReview?: boolean;
    showSolution?: boolean;
    allowComment?: boolean;
    allowSkipping?: boolean;
    validateResponses?: boolean;
  };
  timeLimits?: {
    maxTime?: number;
    allowLateSubmission?: boolean;
  };
  weight?: number;
  branchRule?: Array<{ xml: string }>;
  preCondition?: Array<{ xml: string }>;
}

/**
 * Generator for PIE Assessment (multi-item test)
 *
 * PIE Assessment Structure:
 * {
 *   id: 'test-1',
 *   title: 'Final Exam',
 *   description: 'End of unit assessment',
 *   metadata: {
 *     navigationMode: 'linear' | 'nonlinear',
 *     submissionMode: 'individual' | 'simultaneous'
 *   },
 *   sections: [
 *     {
 *       id: 'section-1',
 *       identifier: 'section-1',
 *       title: 'Section 1',
 *       visible: true,
 *       fixed: false,
 *       shuffle: false,
 *       itemRefs: [
 *         { identifier: 'item-1', href: 'item-1.xml', required: true }
 *       ]
 *     }
 *   ],
 *   timeLimits: {
 *     maxTime: 3600,
 *     allowLateSubmission: false
 *   }
 * }
 *
 * QTI Output: assessmentTest with testPart and assessmentSection elements
 */
export class AssessmentGenerator extends BaseGenerator {
  readonly id = 'pie-assessment';
  readonly name = 'Assessment';
  readonly version = '1.0.0';

  canHandle(model: any): boolean {
    // Assessments are at the PIE item level, not model level
    // Check if this is an assessment by looking for sections
    return !!(model.sections && Array.isArray(model.sections));
  }

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem } = context;

    this.debug(context, 'Generating assessmentTest');

    // PIE assessments are at the item level
    const assessment = pieItem as any;

    // Validate
    if (!assessment.sections || assessment.sections.length === 0) {
      throw new Error('assessment requires sections array with at least one section');
    }

    // Generate test identifier
    const testId = generateIdentifier(assessment.id || assessment.identifier);

    // Build assessment test XML
    const xml = this.buildAssessmentTest(assessment, testId);

    const qti = QtiBuilder.format(xml);

    const warnings = [
      'PIE assessment generated as QTI assessmentTest',
      'Item references (href) should point to valid QTI assessmentItem files',
    ];

    // Add warning if outcomeProcessing is missing
    if (!assessment.outcomeProcessingXml) {
      warnings.push('No outcomeProcessing found - scoring logic may need to be configured');
    }

    this.debug(context, `Successfully generated assessmentTest with ${assessment.sections.length} sections`);

    return this.createResult(qti, warnings);
  }

  /**
   * Build assessmentTest XML
   */
  private buildAssessmentTest(assessment: any, testId: string): string {
    const title = assessment.title || testId;
    const navigationMode = assessment.metadata?.navigationMode || 'nonlinear';
    const submissionMode = assessment.metadata?.submissionMode || 'individual';

    // Build outcome declarations if present (preserved from QTI → PIE transformation)
    const outcomeDeclarationsXml = assessment.outcomeDeclarationsXml && assessment.outcomeDeclarationsXml.length > 0
      ? assessment.outcomeDeclarationsXml.map((xml: string) => `\n  ${xml.trim()}`).join('')
      : '';

    // Build template declarations if present (preserved from QTI → PIE transformation)
    const templateDeclarationsXml = assessment.templateDeclarationsXml && assessment.templateDeclarationsXml.length > 0
      ? assessment.templateDeclarationsXml.map((xml: string) => `\n  ${xml.trim()}`).join('')
      : '';

    // Build time limits if present
    const timeLimitsXml = assessment.timeLimits
      ? `\n  ${this.buildTimeLimits(assessment.timeLimits)}`
      : '';

    // Build test part with sections
    const sectionsXml = assessment.sections
      .map((section: AssessmentSection) => this.buildSection(section, 2))
      .join('\n');

    // Build outcome processing if present (preserved from QTI → PIE transformation)
    const outcomeProcessingXml = assessment.outcomeProcessingXml
      ? `\n  ${assessment.outcomeProcessingXml.trim()}`
      : '';

    // Build template processing if present (preserved from QTI → PIE transformation)
    const templateProcessingXml = assessment.templateProcessingXml
      ? `\n  ${assessment.templateProcessingXml.trim()}`
      : '';

    // Build test feedback if present (preserved from QTI → PIE transformation)
    const testFeedbackXml = assessment.testFeedback && assessment.testFeedback.length > 0
      ? assessment.testFeedback.map((fb: any) => `\n  ${fb.xml.trim()}`).join('')
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="${escapeXml(testId)}"
  title="${escapeXml(title)}">${outcomeDeclarationsXml}${templateDeclarationsXml}${timeLimitsXml}
  <testPart identifier="testPart1" navigationMode="${navigationMode}" submissionMode="${submissionMode}">
${sectionsXml}
  </testPart>${outcomeProcessingXml}${templateProcessingXml}${testFeedbackXml}
</assessmentTest>`;
  }

  /**
   * Build assessmentSection XML (recursive for subsections)
   */
  private buildSection(section: AssessmentSection, indent: number): string {
    const spaces = '  '.repeat(indent);
    const visible = section.visible !== false ? 'true' : 'false';
    const fixed = section.fixed ? 'true' : 'false';

    // Build selection if present
    const selectionXml = section.selection
      ? `\n${spaces}  <selection select="${section.selection.select}" ${section.selection.withReplacement ? 'withReplacement="true"' : ''}/>`
      : '';

    // Build ordering if present
    const orderingXml = section.ordering && section.ordering.shuffle
      ? `\n${spaces}  <ordering shuffle="true"/>`
      : '';

    // Build time limits if present
    const timeLimitsXml = section.timeLimits
      ? `\n${spaces}  ${this.buildTimeLimits(section.timeLimits)}`
      : '';

    // Build item references
    const itemRefsXml = section.itemRefs && section.itemRefs.length > 0
      ? section.itemRefs
          .map((itemRef) => this.buildItemRef(itemRef, indent + 1))
          .join('\n')
      : '';

    // Build subsections (recursive)
    const subsectionsXml = section.subsections && section.subsections.length > 0
      ? section.subsections
          .map((subsection) => this.buildSection(subsection, indent + 1))
          .join('\n')
      : '';

    return `${spaces}<assessmentSection identifier="${escapeXml(section.identifier)}" title="${escapeXml(section.title)}" visible="${visible}" fixed="${fixed}">${selectionXml}${orderingXml}${timeLimitsXml}
${itemRefsXml}${subsectionsXml}
${spaces}</assessmentSection>`;
  }

  /**
   * Build assessmentItemRef XML
   */
  private buildItemRef(itemRef: ItemReference, indent: number): string {
    const spaces = '  '.repeat(indent);
    const required = itemRef.required ? 'true' : 'false';
    const fixed = itemRef.fixed ? 'true' : 'false';

    // Build preConditions if present (preserved from QTI → PIE transformation)
    const preConditionsXml = itemRef.preCondition && itemRef.preCondition.length > 0
      ? itemRef.preCondition
          .map((pc) => `\n${spaces}  ${pc.xml.trim()}`)
          .join('')
      : '';

    // Build branchRules if present (preserved from QTI → PIE transformation)
    const branchRulesXml = itemRef.branchRule && itemRef.branchRule.length > 0
      ? itemRef.branchRule
          .map((br) => `\n${spaces}  ${br.xml.trim()}`)
          .join('')
      : '';

    // Build categories if present
    const categoriesXml = itemRef.category && itemRef.category.length > 0
      ? itemRef.category
          .map((cat) => `\n${spaces}  <category>${escapeXml(cat)}</category>`)
          .join('')
      : '';

    // Build item session control if present
    const sessionControlXml = itemRef.itemSessionControl
      ? this.buildItemSessionControl(itemRef.itemSessionControl, indent + 1)
      : '';

    // Build time limits if present
    const timeLimitsXml = itemRef.timeLimits
      ? `\n${spaces}  ${this.buildTimeLimits(itemRef.timeLimits)}`
      : '';

    // Build weight if present
    const weightXml = itemRef.weight !== undefined
      ? `\n${spaces}  <weight identifier="SCORE" value="${itemRef.weight}"/>`
      : '';

    const hasChildren = preConditionsXml || branchRulesXml || categoriesXml || sessionControlXml || timeLimitsXml || weightXml;

    if (hasChildren) {
      return `${spaces}<assessmentItemRef identifier="${escapeXml(itemRef.identifier)}" href="${escapeXml(itemRef.href)}" required="${required}" fixed="${fixed}">${preConditionsXml}${branchRulesXml}${categoriesXml}${sessionControlXml}${timeLimitsXml}${weightXml}
${spaces}</assessmentItemRef>`;
    } else {
      return `${spaces}<assessmentItemRef identifier="${escapeXml(itemRef.identifier)}" href="${escapeXml(itemRef.href)}" required="${required}" fixed="${fixed}"/>`;
    }
  }

  /**
   * Build itemSessionControl XML
   */
  private buildItemSessionControl(control: any, indent: number): string {
    const spaces = '  '.repeat(indent);
    const attrs: string[] = [];

    if (control.maxAttempts !== undefined) attrs.push(`maxAttempts="${control.maxAttempts}"`);
    if (control.showFeedback !== undefined) attrs.push(`showFeedback="${control.showFeedback}"`);
    if (control.allowReview !== undefined) attrs.push(`allowReview="${control.allowReview}"`);
    if (control.showSolution !== undefined) attrs.push(`showSolution="${control.showSolution}"`);
    if (control.allowComment !== undefined) attrs.push(`allowComment="${control.allowComment}"`);
    if (control.allowSkipping !== undefined) attrs.push(`allowSkipping="${control.allowSkipping}"`);
    if (control.validateResponses !== undefined) attrs.push(`validateResponses="${control.validateResponses}"`);

    return `\n${spaces}<itemSessionControl ${attrs.join(' ')}/>`;
  }

  /**
   * Build timeLimits XML
   */
  private buildTimeLimits(limits: { maxTime?: number; allowLateSubmission?: boolean }): string {
    const attrs: string[] = [];

    if (limits.maxTime !== undefined) attrs.push(`maxTime="${limits.maxTime}"`);
    if (limits.allowLateSubmission !== undefined) attrs.push(`allowLateSubmission="${limits.allowLateSubmission}"`);

    return `<timeLimits ${attrs.join(' ')}/>`;
  }
}

/**
 * Factory function for creating the generator
 */
export function createAssessmentGenerator(): AssessmentGenerator {
  return new AssessmentGenerator();
}
