import type { ElementNameMapper } from './ElementNameMapper.js';

/**
 * Element name mapper for QTI 3.0.
 *
 * QTI 3.0 uses kebab-case element names with 'qti-' prefix:
 * - qti-assessment-item, qti-item-body, qti-response-declaration
 * - qti-choice-interaction, qti-simple-choice
 * - qti-response-processing, qti-set-outcome-value
 *
 * This mapper converts to/from lowercase canonical form (without prefix) for internal processing.
 */
export class Qti3ElementNameMapper implements ElementNameMapper {
	readonly version = '3.0';
	private readonly PREFIX = 'qti-';

	/**
	 * Convert QTI 3.0 kebab-case name to canonical lowercase.
	 * Removes 'qti-' prefix and converts to lowercase.
	 *
	 * @param elementName - kebab-case element name with qti- prefix
	 * @returns lowercase canonical name without prefix
	 */
	toCanonical(elementName: string): string {
		// Remove 'qti-' prefix and convert to lowercase (already lowercase but ensure it)
		const withoutPrefix = elementName.startsWith(this.PREFIX)
			? elementName.slice(this.PREFIX.length)
			: elementName;

		// Remove hyphens to get canonical form
		// 'choice-interaction' => 'choiceinteraction'
		return withoutPrefix.replace(/-/g, '').toLowerCase();
	}

	/**
	 * Convert canonical lowercase to QTI 3.0 kebab-case with qti- prefix.
	 *
	 * This converts canonical names like 'choiceinteraction' to 'qti-choice-interaction'.
	 *
	 * @param canonicalName - lowercase canonical name
	 * @returns kebab-case element name with qti- prefix
	 */
	toNative(canonicalName: string): string {
		// Convert camelCase/lowercase to kebab-case
		// 'choiceinteraction' needs to become 'choice-interaction'
		// We need to insert hyphens before transitions from lowercase to uppercase
		// But canonical names are already lowercase, so we need a different approach

		// Use a simple mapping for common patterns
		const kebabCase = this.toKebabCase(canonicalName);
		return this.PREFIX + kebabCase;
	}

	/**
	 * Validate QTI 3.0 element name pattern.
	 * QTI 3.0 uses kebab-case with 'qti-' prefix.
	 *
	 * @param elementName - Element name to validate
	 * @returns true if valid kebab-case pattern with qti- prefix
	 */
	isValidElementName(elementName: string): boolean {
		// QTI 3.0: 'qti-' prefix followed by kebab-case
		// Examples: qti-assessment-item, qti-choice-interaction, qti-simple-choice
		// Must not have double hyphens or end with hyphen
		if (!elementName.startsWith(this.PREFIX)) return false;
		if (elementName === this.PREFIX) return false;
		if (elementName.includes('--')) return false;
		if (elementName.endsWith('-')) return false;
		return /^qti-[a-z][a-z0-9-]*$/.test(elementName);
	}

	/**
	 * Convert a canonical name to kebab-case.
	 * This is a best-effort conversion based on known QTI element patterns.
	 *
	 * @param name - Canonical lowercase name
	 * @returns kebab-case version
	 * @private
	 */
	private toKebabCase(name: string): string {
		// For canonical names like 'choiceinteraction', 'simplechoice', 'responseprocessing'
		// we need to identify word boundaries and insert hyphens

		// Special cases that need direct mapping (multi-word compounds)
		const specialCases: Record<string, string> = {
			// Core structure
			'itembody': 'item-body',
			'contentbody': 'content-body',
			'testpart': 'test-part',
			'assessmentitem': 'assessment-item',
			'assessmenttest': 'assessment-test',
			'assessmentsection': 'assessment-section',
			'assessmentitemref': 'assessment-item-ref',
			'assessmentstimulusref': 'assessment-stimulus-ref',

			// Feedback
			'rubricblock': 'rubric-block',
			'modalfeedback': 'modal-feedback',
			'modalfeedbackok': 'modal-feedback-ok',
			'feedbackblock': 'feedback-block',
			'feedbackinline': 'feedback-inline',

			// Other multi-word
			'stylesheet': 'style-sheet',
			'printedvariable': 'printed-variable',
			'contextvariable': 'context-variable',
			'templatevariable': 'template-variable',
			'companionmaterialsinfo': 'companion-materials-info',

			// Interaction-specific
			'textentryinteraction': 'text-entry-interaction',
			'extendedtextinteraction': 'extended-text-interaction',
			'inlinechoiceinteraction': 'inline-choice-interaction',
			'gapmatchinteraction': 'gap-match-interaction',
			'graphicgapmatchinteraction': 'graphic-gap-match-interaction',
			'selectpointinteraction': 'select-point-interaction',
			'endattemptinteraction': 'end-attempt-interaction',
			'positionobjectinteraction': 'position-object-interaction',
			'graphicorderinteraction': 'graphic-order-interaction',
			'graphicassociateinteraction': 'graphic-associate-interaction',
			'portablecustominteraction': 'portable-custom-interaction',

			// Interaction children
			'simplechoice': 'simple-choice',
			'simplematchset': 'simple-match-set',
			'simpleassociablechoice': 'simple-associable-choice',
			'gaptext': 'gap-text',
			'gapimg': 'gap-img',
			'gapchoice': 'gap-choice',
			'hotspotchoice': 'hotspot-choice',
			'associablehotspot': 'associable-hotspot',
			'inlinechoice': 'inline-choice',

			// Declarations
			'responsedeclaration': 'response-declaration',
			'outcomedeclaration': 'outcome-declaration',
			'templatedeclaration': 'template-declaration',
			'contextdeclaration': 'context-declaration',
			'correctresponse': 'correct-response',
			'defaultvalue': 'default-value',

			// Mapping
			'areamapping': 'area-mapping',
			'areamapentry': 'area-map-entry',
			'mapentry': 'map-entry',
			'matchtable': 'match-table',
			'matchtableentry': 'match-table-entry',
			'interpolationtable': 'interpolation-table',
			'interpolationtableentry': 'interpolation-table-entry',

			// Processing
			'responseprocessing': 'response-processing',
			'responsecondition': 'response-condition',
			'responseif': 'response-if',
			'responseelseif': 'response-else-if',
			'responseelse': 'response-else',
			'responseprocessingfragment': 'response-processing-fragment',
			'exitresponse': 'exit-response',
			'setoutcomevalue': 'set-outcome-value',
			'lookupoutcomevalue': 'lookup-outcome-value',
			'setcorrectresponse': 'set-correct-response',
			'setdefaultvalue': 'set-default-value',

			'templateprocessing': 'template-processing',
			'templatecondition': 'template-condition',
			'templateif': 'template-if',
			'templateelseif': 'template-else-if',
			'templateelse': 'template-else',
			'templateconstraint': 'template-constraint',
			'settemplatevalue': 'set-template-value',
			'exittemplate': 'exit-template',
			'templateblock': 'template-block',
			'templateinline': 'template-inline',

			'outcomeprocessing': 'outcome-processing',
			'outcomecondition': 'outcome-condition',
			'outcomeif': 'outcome-if',
			'outcomeelseif': 'outcome-else-if',
			'outcomeelse': 'outcome-else',
			'exittest': 'exit-test',

			// Expressions
			'basevalue': 'base-value',
			'fieldvalue': 'field-value',
			'customoperator': 'custom-operator',
			'equalrounded': 'equal-rounded',
			'stringmatch': 'string-match',
			'patternmatch': 'pattern-match',
			'mapresponse': 'map-response',
			'mapresponsepoint': 'map-response-point',
			'integerdivide': 'integer-divide',
			'integermodulus': 'integer-modulus',
			'roundto': 'round-to',
			'mathoperator': 'math-operator',
			'mathconstant': 'math-constant',
			'statsoperator': 'stats-operator',
			'containersize': 'container-size',
			'isnull': 'is-null',
			'randominteger': 'random-integer',
			'randomfloat': 'random-float',
			'testvariables': 'test-variables',
			'outcomemaximum': 'outcome-maximum',
			'outcomeminimum': 'outcome-minimum',
			'numbercorrect': 'number-correct',
			'numberincorrect': 'number-incorrect',
			'numberpresented': 'number-presented',
			'numberresponded': 'number-responded',
			'numberselected': 'number-selected',

			// PCI
			'interactionmodules': 'interaction-modules',
			'interactionmodule': 'interaction-module',
			'interactionmarkup': 'interaction-markup',

			// Catalog
			'cataloginfo': 'catalog-info',
			'cardentry': 'card-entry',
			'htmlcontent': 'html-content',
			'filehref': 'file-href',
		};

		if (specialCases[name]) {
			return specialCases[name];
		}

		// Fallback: apply pattern-based conversion for unmapped cases
		let result = name;

		// Handle compound cases (prefix + suffix) first
		result = result.replace(/^(response|outcome|assessment|template)(processing|declaration|condition)$/, '$1-$2');

		// Handle prefix + interaction/choice
		result = result.replace(/^(simple|graphic|extended|inline|custom|portable)(interaction|choice)$/, '$1-$2');

		// If not already handled, check for prefixes (but only if followed by something else)
		if (!result.includes('-')) {
			result = result.replace(/^(response|outcome|assessment|simple|graphic|extended|inline|custom|portable|template)(.+)/, '$1-$2');
		}

		// If still no hyphen, check for common suffixes
		if (!result.includes('-')) {
			result = result.replace(/(.+)(interaction|processing|declaration|condition|feedback|template|choice|value|operator|variable|attempt)$/, '$1-$2');
		}

		return result;
	}
}
