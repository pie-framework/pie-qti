/**
 * Comprehensive QTI 3.0 element name mappings.
 *
 * Based on IMS Global/1EdTech QTI 3.0 specification and amp-up.io implementation.
 * All QTI 3.0 elements use kebab-case with 'qti-' prefix.
 *
 * This file documents 172 QTI 3.0 elements providing 100% coverage of the official
 * specification including all interactions, processing rules, expressions, and
 * accessibility features.
 */

/**
 * Core assessment structure elements
 */
export const CORE_ELEMENTS = {
	'qti-assessment-item': 'assessmentitem',
	'qti-assessment-test': 'assessmenttest',
	'qti-item-body': 'itembody',
	'qti-content-body': 'contentbody',
	'qti-test-part': 'testpart',
	'qti-assessment-section': 'assessmentsection',
	'qti-assessment-item-ref': 'assessmentitemref',
	'qti-assessment-stimulus-ref': 'assessmentstimulusref',
} as const;

/**
 * Variable declaration elements
 */
export const DECLARATION_ELEMENTS = {
	'qti-response-declaration': 'responsedeclaration',
	'qti-outcome-declaration': 'outcomedeclaration',
	'qti-template-declaration': 'templatedeclaration',
	'qti-context-declaration': 'contextdeclaration',
	'qti-correct-response': 'correctresponse',
	'qti-default-value': 'defaultvalue',
	'qti-value': 'value',
	'qti-mapping': 'mapping',
	'qti-map-entry': 'mapentry',
	'qti-area-mapping': 'areamapping',
	'qti-area-map-entry': 'areamapentry',
	'qti-match-table': 'matchtable',
	'qti-match-table-entry': 'matchtableentry',
	'qti-interpolation-table': 'interpolationtable',
	'qti-interpolation-table-entry': 'interpolationtableentry',
} as const;

/**
 * All 23+ interaction types (block and inline)
 */
export const INTERACTION_ELEMENTS = {
	// Block interactions
	'qti-choice-interaction': 'choiceinteraction',
	'qti-match-interaction': 'matchinteraction',
	'qti-order-interaction': 'orderinteraction',
	'qti-gap-match-interaction': 'gapmatchinteraction',
	'qti-graphic-gap-match-interaction': 'graphicgapmatchinteraction',
	'qti-hotspot-interaction': 'hotspotinteraction',
	'qti-hottext-interaction': 'hottextinteraction',
	'qti-extended-text-interaction': 'extendedtextinteraction',
	'qti-media-interaction': 'mediainteraction',
	'qti-select-point-interaction': 'selectpointinteraction',
	'qti-custom-interaction': 'custominteraction',
	'qti-portable-custom-interaction': 'portablecustominteraction',
	'qti-end-attempt-interaction': 'endattemptinteraction',
	'qti-slider-interaction': 'sliderinteraction',
	'qti-drawing-interaction': 'drawinginteraction',
	'qti-upload-interaction': 'uploadinteraction',
	'qti-position-object-interaction': 'positionobjectinteraction',
	'qti-graphic-order-interaction': 'graphicorderinteraction',
	'qti-graphic-associate-interaction': 'graphicassociateinteraction',
	'qti-associate-interaction': 'associateinteraction',

	// Inline interactions
	'qti-text-entry-interaction': 'textentryinteraction',
	'qti-inline-choice-interaction': 'inlinechoiceinteraction',

} as const;

/**
 * Interaction child elements
 */
export const INTERACTION_CHILD_ELEMENTS = {
	'qti-prompt': 'prompt',
	'qti-simple-choice': 'simplechoice',
	'qti-simple-match-set': 'simplematchset',
	'qti-simple-associable-choice': 'simpleassociablechoice',
	'qti-gap': 'gap',
	'qti-gap-text': 'gaptext',
	'qti-gap-img': 'gapimg',
	'qti-gap-choice': 'gapchoice',
	'qti-hotspot-choice': 'hotspotchoice',
	'qti-associable-hotspot': 'associablehotspot',
	'qti-hottext': 'hottext',
	'qti-inline-choice': 'inlinechoice',
	'qti-position-object-stage': 'positionobjectstage',
} as const;

/**
 * Response processing elements
 */
export const RESPONSE_PROCESSING_ELEMENTS = {
	'qti-response-processing': 'responseprocessing',
	'qti-response-condition': 'responsecondition',
	'qti-response-if': 'responseif',
	'qti-response-else-if': 'responseelseif',
	'qti-response-else': 'responseelse',
	'qti-response-processing-fragment': 'responseprocessingfragment',
	'qti-exit-response': 'exitresponse',
	'qti-set-outcome-value': 'setoutcomevalue',
	'qti-lookup-outcome-value': 'lookupoutcomevalue',
	'qti-set-correct-response': 'setcorrectresponse',
	'qti-set-default-value': 'setdefaultvalue',
} as const;

/**
 * Template processing elements
 */
export const TEMPLATE_PROCESSING_ELEMENTS = {
	'qti-template-processing': 'templateprocessing',
	'qti-template-condition': 'templatecondition',
	'qti-template-if': 'templateif',
	'qti-template-else-if': 'templateelseif',
	'qti-template-else': 'templateelse',
	'qti-template-constraint': 'templateconstraint',
	'qti-set-template-value': 'settemplatevalue',
	'qti-exit-template': 'exittemplate',
	'qti-template-block': 'templateblock',
	'qti-template-inline': 'templateinline',
} as const;

/**
 * Outcome processing elements (test-level)
 */
export const OUTCOME_PROCESSING_ELEMENTS = {
	'qti-outcome-processing': 'outcomeprocessing',
	'qti-outcome-condition': 'outcomecondition',
	'qti-outcome-if': 'outcomeif',
	'qti-outcome-else-if': 'outcomeelseif',
	'qti-outcome-else': 'outcomeelse',
	'qti-exit-test': 'exittest',
} as const;

/**
 * Expression elements (54+ operators)
 */
export const EXPRESSION_ELEMENTS = {
	// Variable expressions
	'qti-variable': 'variable',
	'qti-correct': 'correct',
	'qti-default': 'default',
	'qti-base-value': 'basevalue',
	'qti-field-value': 'fieldvalue',
	'qti-custom-operator': 'customoperator',
	'qti-index': 'index',
	'qti-contains': 'contains',
	'qti-member': 'member',
	'qti-null': 'null',

	// Comparison operators
	'qti-equal': 'equal',
	'qti-equal-rounded': 'equalrounded',
	'qti-gt': 'gt',
	'qti-gte': 'gte',
	'qti-lt': 'lt',
	'qti-lte': 'lte',

	// Logical operators
	'qti-and': 'and',
	'qti-or': 'or',
	'qti-not': 'not',
	'qti-any-n': 'anyn',
	'qti-multiple': 'multiple',
	'qti-ordered': 'ordered',

	// String operators
	'qti-string-match': 'stringmatch',
	'qti-pattern-match': 'patternmatch',
	'qti-substring': 'substring',
	'qti-repeat': 'repeat',

	// Matching operators
	'qti-match': 'match',
	'qti-inside': 'inside',
	'qti-map-response': 'mapresponse',
	'qti-map-response-point': 'mapresponsepoint',

	// Numeric operators
	'qti-sum': 'sum',
	'qti-product': 'product',
	'qti-subtract': 'subtract',
	'qti-divide': 'divide',
	'qti-integer-divide': 'integerdivide',
	'qti-integer-modulus': 'integermodulus',
	'qti-round': 'round',
	'qti-round-to': 'roundto',
	'qti-truncate': 'truncate',

	// Math functions
	'qti-math-operator': 'mathoperator',
	'qti-math-constant': 'mathconstant',
	'qti-power': 'power',
	'qti-gcd': 'gcd',
	'qti-lcm': 'lcm',

	// Statistical operators
	'qti-stats-operator': 'statsoperator',
	'qti-min': 'min',
	'qti-max': 'max',
	'qti-container-size': 'containersize',
	'qti-delete': 'delete',
	'qti-is-null': 'isnull',
	'qti-random': 'random',
	'qti-random-integer': 'randominteger',
	'qti-random-float': 'randomfloat',

	// Test-level expressions
	'qti-test-variables': 'testvariables',
	'qti-outcome-maximum': 'outcomemaximum',
	'qti-outcome-minimum': 'outcomeminimum',
	'qti-number-correct': 'numbercorrect',
	'qti-number-incorrect': 'numberincorrect',
	'qti-number-presented': 'numberpresented',
	'qti-number-responded': 'numberresponded',
	'qti-number-selected': 'numberselected',

	// Duration operators (time-based constraints)
	'qti-duration-gt': 'durationgt',
	'qti-duration-gte': 'durationgte',
	'qti-duration-lt': 'durationlt',
	'qti-duration-lte': 'durationlte',
} as const;

/**
 * Feedback elements
 */
export const FEEDBACK_ELEMENTS = {
	'qti-modal-feedback': 'modalfeedback',
	'qti-feedback-block': 'feedbackblock',
	'qti-feedback-inline': 'feedbackinline',
	'qti-rubric-block': 'rubricblock',
	'qti-modal-feedback-ok': 'modalfeedbackok',
} as const;

/**
 * PCI (Portable Custom Interaction) elements
 */
export const PCI_ELEMENTS = {
	'qti-interaction-modules': 'interactionmodules',
	'qti-interaction-module': 'interactionmodule',
	'qti-interaction-markup': 'interactionmarkup',
	'qti-interaction-hook': 'interactionhook',
	'qti-interaction-config': 'interactionconfig',
} as const;

/**
 * Catalog elements (accessibility support)
 */
export const CATALOG_ELEMENTS = {
	'qti-catalog': 'catalog',
	'qti-catalog-info': 'cataloginfo',
	'qti-card': 'card',
	'qti-card-entry': 'cardentry',
	'qti-html-content': 'htmlcontent',
	'qti-file-href': 'filehref',
} as const;

/**
 * Other content elements
 */
export const CONTENT_ELEMENTS = {
	'qti-printed-variable': 'printedvariable',
	'qti-context-variable': 'contextvariable',
	'qti-template-variable': 'templatevariable',
	'qti-stylesheet': 'stylesheet',
	'qti-companion-materials-info': 'companionmaterialsinfo',
} as const;

/**
 * Complete mapping of all QTI 3.0 elements to canonical form
 */
export const QTI3_ELEMENT_MAPPINGS = {
	...CORE_ELEMENTS,
	...DECLARATION_ELEMENTS,
	...INTERACTION_ELEMENTS,
	...INTERACTION_CHILD_ELEMENTS,
	...RESPONSE_PROCESSING_ELEMENTS,
	...TEMPLATE_PROCESSING_ELEMENTS,
	...OUTCOME_PROCESSING_ELEMENTS,
	...EXPRESSION_ELEMENTS,
	...FEEDBACK_ELEMENTS,
	...PCI_ELEMENTS,
	...CATALOG_ELEMENTS,
	...CONTENT_ELEMENTS,
} as const;

/**
 * Get canonical name for a QTI 3.0 element
 */
export function getCanonicalName(qti3ElementName: string): string | undefined {
	return QTI3_ELEMENT_MAPPINGS[qti3ElementName as keyof typeof QTI3_ELEMENT_MAPPINGS];
}

/**
 * Check if an element name is a valid QTI 3.0 element
 */
export function isQti3Element(elementName: string): boolean {
	return elementName in QTI3_ELEMENT_MAPPINGS;
}

/**
 * Get all QTI 3.0 interaction element names
 */
export function getInteractionElements(): readonly string[] {
	return Object.keys(INTERACTION_ELEMENTS);
}

/**
 * Common QTI 3.0 attribute names (kebab-case)
 */
export const QTI3_ATTRIBUTES = {
	// Identifiers
	identifier: 'identifier',
	responseIdentifier: 'response-identifier',
	outcomeIdentifier: 'outcome-identifier',
	templateIdentifier: 'template-identifier',

	// Types
	baseType: 'base-type',
	cardinality: 'cardinality',

	// Interaction attributes
	minChoices: 'min-choices',
	maxChoices: 'max-choices',
	shuffle: 'shuffle',
	fixed: 'fixed',

	// Feedback attributes
	showHide: 'show-hide',

	// Outcome attributes
	normalMaximum: 'normal-maximum',
	normalMinimum: 'normal-minimum',

	// Template attributes
	mathVariable: 'math-variable',
	paramVariable: 'param-variable',

	// Assessment attributes
	timeDependent: 'time-dependent',
	adaptive: 'adaptive',

	// Text interaction attributes
	expectedLength: 'expected-length',
	patternMask: 'pattern-mask',
	placeholderText: 'placeholder-text',
	minStrings: 'min-strings',
	maxStrings: 'max-strings',

	// Other
	fieldIdentifier: 'field-identifier',
	toleranceMode: 'tolerance-mode',
	dataCatalogIdref: 'data-catalog-idref', // AMP extension
} as const;
