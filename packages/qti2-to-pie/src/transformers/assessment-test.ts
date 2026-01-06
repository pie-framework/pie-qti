/**
 * QTI 2.1/2.2 assessmentTest to PIE assessment transformer
 *
 * Transforms QTI test definitions into PIE assessment format.
 * Assessments are pure reference structures that link to items, passages, and sections.
 */

import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { createMissingElementError } from '../utils/qti-errors.js';

export interface PieAssessment {
  id: string;
  title: string;
  identifier: string;
  description?: string;
  /**
   * Lossless XML for assessment-level outcomeProcessing (QTI expression/rule set).
   * Required for full QTI-conformant test processing.
   */
  outcomeProcessingXml?: string;
  /**
   * Lossless XML for outcome declarations (test-level variables).
   * Defines test-level variables like SCORE, PASS, etc.
   */
  outcomeDeclarationsXml?: string[];
  /**
   * Lossless XML for template declarations (test-level templates).
   * Defines template variables used in adaptive tests.
   */
  templateDeclarationsXml?: string[];
  /**
   * Lossless XML for template processing rules.
   * Initializes template variables before test starts.
   */
  templateProcessingXml?: string;
  /**
   * Test feedback content shown based on outcome conditions.
   * Array of feedback blocks with identifiers and content.
   */
  testFeedback?: Array<{
    identifier: string;
    outcomeIdentifier: string;
    showHide: 'show' | 'hide';
    access: 'atEnd' | 'during';
    /** Lossless XML for complete testFeedback element */
    xml: string;
  }>;
  metadata: {
    source: 'qti22';
    qtiIdentifier: string;
    navigationMode?: 'linear' | 'nonlinear';
    submissionMode?: 'individual' | 'simultaneous';
  };
  sections: AssessmentSection[];
  timeLimits?: {
    maxTime?: number; // seconds
    allowLateSubmission?: boolean;
  };
}

export interface AssessmentSection {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  visible: boolean;
  fixed: boolean; // items cannot be reordered
  shuffle: boolean; // items should be shuffled
  itemRefs: ItemReference[];
  subsections?: AssessmentSection[]; // nested sections
  selection?: {
    select: number; // number of items to select
    withReplacement?: boolean;
    fromBank?: string; // reference to item bank identifier
  };
  ordering?: {
    shuffle: boolean;
  };
  rubricRefs?: string[]; // references to rubric blocks
  timeLimits?: {
    maxTime?: number;
    allowLateSubmission?: boolean;
  };
  /** Lossless XML for section-level preCondition (when present). */
  preCondition?: { xml: string };
}

export interface ItemReference {
  identifier: string;
  href: string; // path to item XML file
  category?: string[];
  required?: boolean;
  fixed?: boolean;
  /** Lossless XML for item-level preCondition (when present). */
  preCondition?: { xml: string };
  branchRule?: {
    target: string;
    /** Lossless XML for branchRule condition <expression> (when present). */
    conditionXml?: string;
  }[];
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
  weight?: number; // for scoring
}

export interface AssessmentTestOptions {
  /** Whether to include timing information */
  includeTimeLimits?: boolean;
  /** Whether to include branching rules */
  includeBranchRules?: boolean;
  /** Whether to include item session controls */
  includeItemControls?: boolean;
}

/**
 * Transform QTI assessmentTest to PIE assessment
 */
export function transformAssessmentTest(
  qtiXml: string,
  assessmentId: string,
  options?: AssessmentTestOptions
): PieAssessment {
  const document = parse(qtiXml, { lowerCaseTagName: false });
  const assessmentTest = document.querySelector('assessmentTest') ||
                        document.getElementsByTagName('assessmentTest')[0];

  if (!assessmentTest) {
    throw createMissingElementError('assessmentTest', {
      itemId: assessmentId,
      details: 'The <assessmentTest> element is required for test-level transformations. This element defines the test structure, sections, and item references.',
    });
  }

  const identifier = assessmentTest.getAttribute('identifier') || assessmentId;
  const title = assessmentTest.getAttribute('title') || identifier;

  // Extract outcome processing
  const outcomeProcessingEl =
    (assessmentTest.querySelector('outcomeProcessing') as any as HTMLElement | null) ||
    (assessmentTest.getElementsByTagName('outcomeProcessing')[0] as any as HTMLElement | undefined) ||
    null;
  const outcomeProcessingXml = outcomeProcessingEl ? outcomeProcessingEl.toString() : undefined;

  // Extract outcome declarations
  const outcomeDeclarationsXml = extractOutcomeDeclarations(assessmentTest);

  // Extract template declarations
  const templateDeclarationsXml = extractTemplateDeclarations(assessmentTest);

  // Extract template processing
  const templateProcessingXml = extractTemplateProcessing(assessmentTest);

  // Extract test feedback
  const testFeedback = extractTestFeedback(assessmentTest);

  // Get test parts (typically one testPart per assessment)
  const testParts = assessmentTest.getElementsByTagName('testPart');
  const sections: AssessmentSection[] = [];

  for (const testPart of Array.from(testParts)) {
    // Note: navigationMode and submissionMode could be extracted here for future use
    // const navigationMode = testPart.getAttribute('navigationMode') as 'linear' | 'nonlinear' | undefined;
    // const submissionMode = testPart.getAttribute('submissionMode') as 'individual' | 'simultaneous' | undefined;

    // Extract assessment sections from test part
    const assessmentSections = testPart.getElementsByTagName('assessmentSection');

    for (const section of Array.from(assessmentSections)) {
      // Skip nested sections (they'll be handled recursively)
      if (section.parentNode?.tagName === 'assessmentSection') {
        continue;
      }

      const transformedSection = transformSection(section, options);
      if (transformedSection) {
        sections.push(transformedSection);
      }
    }

    // Note: timeLimits and other testPart-level settings could be stored
    // in the assessment metadata if needed in the future
  }

  const assessment: PieAssessment = {
    id: uuid(),
    title,
    identifier,
    outcomeProcessingXml,
    outcomeDeclarationsXml: outcomeDeclarationsXml.length > 0 ? outcomeDeclarationsXml : undefined,
    templateDeclarationsXml: templateDeclarationsXml.length > 0 ? templateDeclarationsXml : undefined,
    templateProcessingXml,
    testFeedback: testFeedback.length > 0 ? testFeedback : undefined,
    metadata: {
      source: 'qti22',
      qtiIdentifier: identifier,
    },
    sections,
  };

  return assessment;
}

/**
 * Transform an assessment section
 */
function transformSection(
  section: HTMLElement,
  options?: AssessmentTestOptions
): AssessmentSection | null {
  const identifier = section.getAttribute('identifier');
  if (!identifier) return null;

  const title = section.getAttribute('title') || identifier;
  const visible = section.getAttribute('visible') !== 'false';
  const fixed = section.getAttribute('fixed') === 'true';

  // Get ordering/shuffle settings
  const orderingElement = section.querySelector('ordering') ||
                         section.getElementsByTagName('ordering')[0];
  const shuffle = orderingElement?.getAttribute('shuffle') === 'true';

  // Get item references
  const itemRefs: ItemReference[] = [];
  const assessmentItemRefs = section.getElementsByTagName('assessmentItemRef');

  for (const itemRef of Array.from(assessmentItemRefs)) {
    // Skip if this is in a nested section
    if (itemRef.parentNode?.tagName === 'assessmentSection' &&
        itemRef.parentNode !== section) {
      continue;
    }

    const ref = transformItemReference(itemRef, options);
    if (ref) {
      itemRefs.push(ref);
    }
  }

  // Get nested sections
  const subsections: AssessmentSection[] = [];
  const childSections = section.getElementsByTagName('assessmentSection');

  for (const childSection of Array.from(childSections)) {
    // Only process direct children
    if (childSection.parentNode === section) {
      const transformed = transformSection(childSection, options);
      if (transformed) {
        subsections.push(transformed);
      }
    }
  }

  // Get selection rules
  const selection = extractSelectionRules(section);

  // Get rubric references
  const rubricRefs = extractRubricRefs(section);

  // Get time limits
  const timeLimits = options?.includeTimeLimits
    ? extractTimeLimits(section)
    : undefined;

  // Get pre-condition
  const preConditionXml = extractPreCondition(section);

  const result: AssessmentSection = {
    id: uuid(),
    identifier,
    title,
    visible,
    fixed,
    shuffle,
    itemRefs,
    subsections: subsections.length > 0 ? subsections : undefined,
    selection,
    ordering: { shuffle },
    rubricRefs: rubricRefs.length > 0 ? rubricRefs : undefined,
    timeLimits,
  };

  if (preConditionXml) {
    (result as any).preCondition = { xml: preConditionXml };
  }

  return result;
}

/**
 * Transform an item reference
 */
function transformItemReference(
  itemRef: HTMLElement,
  options?: AssessmentTestOptions
): ItemReference | null {
  const identifier = itemRef.getAttribute('identifier');
  const href = itemRef.getAttribute('href');

  if (!identifier || !href) return null;

  const ref: ItemReference = {
    identifier,
    href,
  };

  // Get categories
  const categories: string[] = [];
  const categoryElements = itemRef.getElementsByTagName('category');
  for (const cat of Array.from(categoryElements)) {
    const catValue = cat.textContent?.trim();
    if (catValue) categories.push(catValue);
  }
  if (categories.length > 0) {
    ref.category = categories;
  }

  // Get required flag
  ref.required = itemRef.getAttribute('required') === 'true';
  ref.fixed = itemRef.getAttribute('fixed') === 'true';

  // Get item session control
  if (options?.includeItemControls) {
    const sessionControl = extractItemSessionControl(itemRef);
    if (sessionControl) {
      ref.itemSessionControl = sessionControl;
    }
  }

  // Get time limits
  if (options?.includeTimeLimits) {
    const timeLimits = extractTimeLimits(itemRef);
    if (timeLimits) {
      ref.timeLimits = timeLimits;
    }
  }

  // Get branch rules
  if (options?.includeBranchRules) {
    const branchRules = extractBranchRules(itemRef);
    if (branchRules && branchRules.length > 0) {
      ref.branchRule = branchRules;
    }
  }

  // Get weight for scoring
  const weights = itemRef.getElementsByTagName('weight');
  if (weights.length > 0) {
    const weightValue = parseFloat(weights[0].getAttribute('value') || '1');
    if (!Number.isNaN(weightValue)) {
      ref.weight = weightValue;
    }
  }

  // Get pre-condition
  const preConditionXml = extractPreCondition(itemRef);
  if (preConditionXml) {
    ref.preCondition = { xml: preConditionXml };
  }

  return ref;
}

/**
 * Extract selection rules from section
 */
function extractSelectionRules(section: HTMLElement): AssessmentSection['selection'] | undefined {
  const selection = section.querySelector('selection') ||
                   section.getElementsByTagName('selection')[0];

  if (!selection) return undefined;

  const select = parseInt(selection.getAttribute('select') || '0', 10);
  if (select === 0) return undefined;

  const fromBank = selection.getAttribute('fromBank') || undefined;

  return {
    select,
    withReplacement: selection.getAttribute('withReplacement') === 'true',
    fromBank,
  };
}

/**
 * Extract rubric references
 */
function extractRubricRefs(element: HTMLElement): string[] {
  const refs: string[] = [];
  const rubricBlocks = element.getElementsByTagName('rubricBlock');

  for (const rubric of Array.from(rubricBlocks)) {
    const view = rubric.getAttribute('view');
    const identifier = rubric.getAttribute('identifier');

    if (identifier) {
      refs.push(identifier);
    } else if (view) {
      // Use view as identifier if no explicit ID
      refs.push(`rubric-${view}`);
    }
  }

  return refs;
}

/**
 * Extract time limits
 */
function extractTimeLimits(element: HTMLElement): { maxTime?: number; allowLateSubmission?: boolean } | undefined {
  const timeLimits = element.querySelector('timeLimits') ||
                    element.getElementsByTagName('timeLimits')[0];

  if (!timeLimits) return undefined;

  const maxTime = parseInt(timeLimits.getAttribute('maxTime') || '0', 10);
  const allowLateSubmission = timeLimits.getAttribute('allowLateSubmission') === 'true';

  if (maxTime === 0 && !allowLateSubmission) return undefined;

  return {
    maxTime: maxTime > 0 ? maxTime : undefined,
    allowLateSubmission,
  };
}

/**
 * Extract item session control settings
 */
function extractItemSessionControl(itemRef: HTMLElement): ItemReference['itemSessionControl'] | undefined {
  const sessionControl = itemRef.querySelector('itemSessionControl') ||
                        itemRef.getElementsByTagName('itemSessionControl')[0];

  if (!sessionControl) return undefined;

  const maxAttempts = parseInt(sessionControl.getAttribute('maxAttempts') || '0', 10);
  const showFeedback = sessionControl.getAttribute('showFeedback') === 'true';
  const allowReview = sessionControl.getAttribute('allowReview') === 'true';
  const showSolution = sessionControl.getAttribute('showSolution') === 'true';
  const allowComment = sessionControl.getAttribute('allowComment') === 'true';
  const allowSkipping = sessionControl.getAttribute('allowSkipping') === 'true';
  const validateResponses = sessionControl.getAttribute('validateResponses') === 'true';

  return {
    maxAttempts: maxAttempts > 0 ? maxAttempts : undefined,
    showFeedback,
    allowReview,
    showSolution,
    allowComment,
    allowSkipping,
    validateResponses,
  };
}

/**
 * Extract branch rules
 */
function extractBranchRules(itemRef: HTMLElement): ItemReference['branchRule'] {
  const rules: ItemReference['branchRule'] = [];
  const branchRules = itemRef.getElementsByTagName('branchRule');

  for (const rule of Array.from(branchRules)) {
    const target = rule.getAttribute('target');
    if (!target) continue;

    // Get condition expression if present (lossless XML)
    const expression =
      (rule.querySelector('expression') as any as HTMLElement | null) ||
      (rule.getElementsByTagName('expression')[0] as any as HTMLElement | undefined) ||
      null;
    const conditionXml = expression ? expression.toString() : undefined;

    rules.push({
      target,
      conditionXml,
    });
  }

  return rules;
}

/**
 * Extract pre-condition from element
 */
function extractPreCondition(element: HTMLElement): string | undefined {
  const preCondition =
    (element.querySelector('preCondition') as any as HTMLElement | null) ||
    (element.getElementsByTagName('preCondition')[0] as any as HTMLElement | undefined) ||
    null;

  if (!preCondition) return undefined;
  return preCondition.toString();
}

/**
 * Extract outcome declarations (test-level variables)
 */
function extractOutcomeDeclarations(assessmentTest: HTMLElement): string[] {
  const declarations: string[] = [];
  const outcomeDeclarations = assessmentTest.getElementsByTagName('outcomeDeclaration');

  for (const declaration of Array.from(outcomeDeclarations)) {
    // Skip if this is nested inside a template or other element
    if (declaration.parentNode === assessmentTest) {
      declarations.push(declaration.toString());
    }
  }

  return declarations;
}

/**
 * Extract template declarations (test-level templates)
 */
function extractTemplateDeclarations(assessmentTest: HTMLElement): string[] {
  const declarations: string[] = [];
  const templateDeclarations = assessmentTest.getElementsByTagName('templateDeclaration');

  for (const declaration of Array.from(templateDeclarations)) {
    // Skip if this is nested inside a template or other element
    if (declaration.parentNode === assessmentTest) {
      declarations.push(declaration.toString());
    }
  }

  return declarations;
}

/**
 * Extract template processing rules
 */
function extractTemplateProcessing(assessmentTest: HTMLElement): string | undefined {
  const templateProcessing =
    (assessmentTest.querySelector('templateProcessing') as any as HTMLElement | null) ||
    (assessmentTest.getElementsByTagName('templateProcessing')[0] as any as HTMLElement | undefined) ||
    null;

  if (!templateProcessing) return undefined;
  return templateProcessing.toString();
}

/**
 * Extract test feedback elements
 */
function extractTestFeedback(assessmentTest: HTMLElement): Array<{
  identifier: string;
  outcomeIdentifier: string;
  showHide: 'show' | 'hide';
  access: 'atEnd' | 'during';
  xml: string;
}> {
  const feedbackList: Array<{
    identifier: string;
    outcomeIdentifier: string;
    showHide: 'show' | 'hide';
    access: 'atEnd' | 'during';
    xml: string;
  }> = [];

  const testFeedbacks = assessmentTest.getElementsByTagName('testFeedback');

  for (const feedback of Array.from(testFeedbacks)) {
    const identifier = feedback.getAttribute('identifier');
    const outcomeIdentifier = feedback.getAttribute('outcomeIdentifier');
    const showHide = feedback.getAttribute('showHide') as 'show' | 'hide' | null;
    const access = feedback.getAttribute('access') as 'atEnd' | 'during' | null;

    if (identifier && outcomeIdentifier && showHide && access) {
      feedbackList.push({
        identifier,
        outcomeIdentifier,
        showHide,
        access,
        xml: feedback.toString(),
      });
    }
  }

  return feedbackList;
}
