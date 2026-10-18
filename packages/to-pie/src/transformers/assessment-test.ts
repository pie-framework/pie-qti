/**
 * QTI 2.1/2.2 assessmentTest to PIE assessment transformer
 *
 * Transforms QTI test definitions into PIE assessment format.
 * Assessments are pure reference structures that link to items, passages, and sections.
 */

import type { TransformWarning } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { createMissingElementError } from '../utils/qti-errors.js';

// QTI 3.0 Type Definitions

export interface TestPart {
  identifier: string;
  navigationMode: 'linear' | 'nonlinear';
  submissionMode: 'individual' | 'simultaneous';
  sections: AssessmentSection[];
}

export interface ContextDeclaration {
  identifier: string;
  baseType: 'boolean' | 'integer' | 'float' | 'string' | 'identifier' |
            'point' | 'pair' | 'directedPair' | 'duration' | 'file' | 'uri';
  cardinality: 'single' | 'multiple' | 'ordered' | 'record';
  defaultValue?: any;
}

/** The QTI `view` roles, which PIE players read from a rubric block as an array. */
export type RubricBlockView =
  | 'author'
  | 'candidate'
  | 'proctor'
  | 'scorer'
  | 'testConstructor'
  | 'tutor';

const RUBRIC_BLOCK_VIEWS = new Set<string>([
  'author',
  'candidate',
  'proctor',
  'scorer',
  'testConstructor',
  'tutor',
]);

const RUBRIC_BLOCK_CLASSES = new Set<string>(['stimulus', 'instructions', 'rubric']);

/** A section's rubric block, in the shape PIE players render section rubric blocks in. */
export interface RubricBlock {
  /** The block's QTI `id`. */
  identifier?: string;
  view: RubricBlockView[];
  /** QTI's `use` when it names one of these, else the first `class` token that does. */
  class?: 'stimulus' | 'instructions' | 'rubric';
  /** The block's content as authored. */
  content: string;
}

export interface PieAssessment {
  id: string;
  title: string;
  identifier: string;
  description?: string;

  /** QTI version detected from the source assessmentTest. */
  qtiVersion: '2.1' | '2.2' | '3.0' | 'unknown';

  /** QTI 3.0 test structure: testParts → sections → items */
  testParts: TestPart[];

  /** QTI 3.0: Context declarations (global shared variables) */
  contextDeclarations?: ContextDeclaration[];

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
  /** The section's own rubric blocks; a stimulus is one of class `stimulus`. */
  rubricBlocks?: RubricBlock[];
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
  /** Receives a warning for each construct the transform does not carry. */
  warnings?: TransformWarning[];
}

/**
 * Direct element children with the given tag name, matched case-insensitively.
 * Sections and item refs must be read from direct children only: a deep scan
 * would attribute a nested section's items and rules to its parent. The
 * `tagName` getter uppercases, so match on `rawTagName`.
 */
function childElements(parent: HTMLElement, tagName: string): HTMLElement[] {
  const target = tagName.toLowerCase();
  const children: HTMLElement[] = [];
  for (const node of parent.childNodes) {
    if (node.nodeType !== 1) continue;
    const element = node as HTMLElement;
    if ((element.rawTagName ?? '').toLowerCase() === target) {
      children.push(element);
    }
  }
  return children;
}

/**
 * Total item references in the assessment, counting nested sections.
 */
export function countAssessmentItems(assessment: PieAssessment): number {
  const countSection = (section: AssessmentSection): number =>
    section.itemRefs.length +
    (section.subsections ?? []).reduce((total, subsection) => total + countSection(subsection), 0);
  return assessment.testParts.reduce(
    (total, testPart) => total + testPart.sections.reduce((sum, section) => sum + countSection(section), 0),
    0
  );
}

/**
 * Transform QTI assessmentTest to PIE assessment
 */
export function transformAssessmentTest(
  qtiXml: string,
  assessmentId: string,
  options?: AssessmentTestOptions
): PieAssessment {  const document = parse(qtiXml, { lowerCaseTagName: false });
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
  const qtiVersion = detectQtiVersion(qtiXml);

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
  const testPartElements = assessmentTest.getElementsByTagName('testPart');
  const testParts: TestPart[] = [];

  // QTI 3.0 requires at least one testPart
  if (testPartElements.length === 0) {
    throw createMissingElementError('testPart', {
      itemId: assessmentId,
      details: 'QTI 3.0 requires at least one <testPart> element. The test structure must follow: test → testPart → section → items.',
    });
  }

  for (const testPartElement of Array.from(testPartElements)) {
    const testPartIdentifier = testPartElement.getAttribute('identifier') || 'default-part';
    const navigationMode = (testPartElement.getAttribute('navigationMode') as 'linear' | 'nonlinear') || 'nonlinear';
    const submissionMode = (testPartElement.getAttribute('submissionMode') as 'individual' | 'simultaneous') || 'individual';

    // Top-level sections only; nested sections are handled recursively below.
    const testPartSections: AssessmentSection[] = [];

    for (const section of childElements(testPartElement, 'assessmentSection')) {
      const transformedSection = transformSection(section, options);
      if (transformedSection) {
        testPartSections.push(transformedSection);
      }
    }

    // Build QTI 3.0 testPart structure
    testParts.push({
      identifier: testPartIdentifier,
      navigationMode,
      submissionMode,
      sections: testPartSections,
    });
  }

  // Extract QTI 3.0 context declarations
  const contextDeclarations = extractContextDeclarations(assessmentTest);

  const pnpElementName = findCandidateProfile(assessmentTest);
  if (pnpElementName) {
    options?.warnings?.push({
      itemId: assessmentId,
      code: 'QTI_PNP_IN_CONTENT',
      message: `assessmentTest "${identifier}" carries a <${pnpElementName}>, which is not converted: a personal needs profile is a per-candidate AfA PNP 3.0 document the player takes at session start.`,
    });
  }

  const assessment: PieAssessment = {
    id: uuid(),
    title,
    identifier,
    qtiVersion,
    testParts,
    contextDeclarations: contextDeclarations.length > 0 ? contextDeclarations : undefined,
    outcomeProcessingXml,
    outcomeDeclarationsXml: outcomeDeclarationsXml.length > 0 ? outcomeDeclarationsXml : undefined,
    templateDeclarationsXml: templateDeclarationsXml.length > 0 ? templateDeclarationsXml : undefined,
    templateProcessingXml,
    testFeedback: testFeedback.length > 0 ? testFeedback : undefined,
  };

  return assessment;
}

function detectQtiVersion(qtiXml: string): PieAssessment['qtiVersion'] {
  if (qtiXml.includes('imsqtiasi_v3p0') || qtiXml.includes('imsqti_v3p0')) return '3.0';
  if (qtiXml.includes('imsqti_v2p2')) return '2.2';
  if (qtiXml.includes('imsqti_v2p1')) return '2.1';
  return 'unknown';
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
  const orderingElement = childElements(section, 'ordering')[0];
  const shuffle = orderingElement?.getAttribute('shuffle') === 'true';

  // Get item references
  const itemRefs: ItemReference[] = [];

  for (const itemRef of childElements(section, 'assessmentItemRef')) {
    const ref = transformItemReference(itemRef, options);
    if (ref) {
      itemRefs.push(ref);
    }
  }

  // Get nested sections
  const subsections: AssessmentSection[] = [];

  for (const childSection of childElements(section, 'assessmentSection')) {
    const transformed = transformSection(childSection, options);
    if (transformed) {
      subsections.push(transformed);
    }
  }

  // Get selection rules
  const selection = extractSelectionRules(section);

  const rubricBlocks = extractRubricBlocks(section);

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
    rubricBlocks: rubricBlocks.length > 0 ? rubricBlocks : undefined,
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
  const selection = childElements(section, 'selection')[0];

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

/** The section's own rubric blocks; a nested section's are its own. */
function extractRubricBlocks(section: HTMLElement): RubricBlock[] {
  const blocks: RubricBlock[] = [];
  for (const child of section.childNodes) {
    if (child.nodeType !== 1 || (child as HTMLElement).rawTagName !== 'rubricBlock') continue;
    const rubric = child as HTMLElement;
    const view = (rubric.getAttribute('view') ?? '')
      .split(/\s+/)
      .filter((role): role is RubricBlockView => RUBRIC_BLOCK_VIEWS.has(role));
    const identifier = rubric.getAttribute('id');
    const blockClass = [
      rubric.getAttribute('use') ?? '',
      ...(rubric.getAttribute('class') ?? '').split(/\s+/),
    ].find((token) => RUBRIC_BLOCK_CLASSES.has(token)) as RubricBlock['class'];
    blocks.push({
      ...(identifier ? { identifier } : {}),
      view,
      ...(blockClass ? { class: blockClass } : {}),
      content: rubric.innerHTML.trim(),
    });
  }
  return blocks;
}

/**
 * Extract time limits
 */
function extractTimeLimits(element: HTMLElement): { maxTime?: number; allowLateSubmission?: boolean } | undefined {
  const timeLimits = childElements(element, 'timeLimits')[0];

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
  const preCondition = childElements(element, 'preCondition')[0];

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

/**
 * Extract QTI 3.0 context declarations (global shared variables)
 */
function extractContextDeclarations(assessmentTest: HTMLElement): ContextDeclaration[] {
  const declarations: ContextDeclaration[] = [];
  const contextDeclarations = assessmentTest.getElementsByTagName('contextDeclaration');

  for (const declaration of Array.from(contextDeclarations)) {
    // Skip if nested inside other elements
    if (declaration.parentNode === assessmentTest) {
      const identifier = declaration.getAttribute('identifier');
      const baseType = declaration.getAttribute('baseType');
      const cardinality = declaration.getAttribute('cardinality');

      if (identifier && baseType && cardinality) {
        const contextDecl: ContextDeclaration = {
          identifier,
          baseType: baseType as ContextDeclaration['baseType'],
          cardinality: cardinality as ContextDeclaration['cardinality'],
        };

        // Extract default value if present
        const defaultValue = declaration.querySelector('defaultValue') ||
                           declaration.getElementsByTagName('defaultValue')[0];
        if (defaultValue) {
          const valueElement = defaultValue.querySelector('value') ||
                             defaultValue.getElementsByTagName('value')[0];
          if (valueElement) {
            contextDecl.defaultValue = valueElement.textContent?.trim();
          }
        }

        declarations.push(contextDecl);
      }
    }
  }

  return declarations;
}

/**
 * The name of a personal needs profile element inside the test, whether AfA's or the
 * `personalNeedsProfile` some exports invent. Neither belongs in content.
 */
function findCandidateProfile(parent: HTMLElement): string | undefined {
  for (const child of parent.childNodes) {
    if (child.nodeType !== 1) continue;
    const el = child as HTMLElement;
    const name = el.rawTagName ?? '';
    const local = name.slice(name.indexOf(':') + 1);
    if (local === 'personalNeedsProfile' || local === 'access-for-all-pnp') return name;
    const nested = findCandidateProfile(el);
    if (nested) return nested;
  }
  return undefined;
}
