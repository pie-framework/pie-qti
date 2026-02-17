import type { AttributeNameMapper } from './AttributeNameMapper';

/**
 * QTI 3.0 attribute name mappings from kebab-case to camelCase.
 *
 * Based on QTI 3.0 specification where all attributes use kebab-case.
 * This provides comprehensive mappings for all standard QTI attributes.
 */
const QTI3_ATTRIBUTE_MAPPINGS: Record<string, string> = {
	// Core identifiers
	identifier: 'identifier',
	'response-identifier': 'responseIdentifier',
	'outcome-identifier': 'outcomeIdentifier',
	'template-identifier': 'templateIdentifier',
	'context-identifier': 'contextIdentifier',

	// Types and cardinality
	'base-type': 'baseType',
	cardinality: 'cardinality',

	// Choice/selection attributes
	'max-choices': 'maxChoices',
	'min-choices': 'minChoices',
	shuffle: 'shuffle',
	fixed: 'fixed',
	orientation: 'orientation',
	required: 'required',

	// Match/association attributes
	'match-max': 'matchMax',
	'match-min': 'matchMin',
	'max-associations': 'maxAssociations',
	'min-associations': 'minAssociations',

	// Text interaction attributes
	'expected-length': 'expectedLength',
	'expected-lines': 'expectedLines',
	'pattern-mask': 'patternMask',
	'placeholder-text': 'placeholderText',
	format: 'format',
	'string-identifier': 'stringIdentifier',
	'min-strings': 'minStrings',
	'max-strings': 'maxStrings',

	// Slider attributes
	'lower-bound': 'lowerBound',
	'upper-bound': 'upperBound',
	step: 'step',
	'step-label': 'stepLabel',
	reverse: 'reverse',

	// Hotspot/graphic attributes
	shape: 'shape',
	coords: 'coords',
	'hotspot-label': 'hotspotLabel',
	'min-hotspots': 'minHotspots',
	'max-hotspots': 'maxHotspots',

	// Media attributes
	autostart: 'autostart',
	'min-plays': 'minPlays',
	'max-plays': 'maxPlays',
	loop: 'loop',
	controls: 'controls',

	// Feedback attributes
	'show-hide': 'showHide',
	'outcome-value': 'outcomeValue',
	access: 'access',
	view: 'view',

	// Outcome/result attributes
	'normal-maximum': 'normalMaximum',
	'normal-minimum': 'normalMinimum',
	'mastery-value': 'masteryValue',
	interpretation: 'interpretation',
	'long-interpretation': 'longInterpretation',

	// Template attributes
	'math-variable': 'mathVariable',
	'param-variable': 'paramVariable',

	// Assessment/test attributes
	'time-dependent': 'timeDependent',
	adaptive: 'adaptive',
	title: 'title',
	label: 'label',

	// Test structure attributes
	'navigation-mode': 'navigationMode',
	'submission-mode': 'submissionMode',
	'item-session-control': 'itemSessionControl',
	'time-limits': 'timeLimits',

	// Time limits
	'min-time': 'minTime',
	'max-time': 'maxTime',
	'allow-late-submission': 'allowLateSubmission',

	// Item session control
	'max-attempts': 'maxAttempts',
	'show-feedback': 'showFeedback',
	'allow-review': 'allowReview',
	'show-solution': 'showSolution',
	'allow-comment': 'allowComment',
	'allow-skipping': 'allowSkipping',
	'validate-responses': 'validateResponses',

	// Processing attributes
	template: 'template',
	'template-location': 'templateLocation',

	// Expression attributes
	'field-identifier': 'fieldIdentifier',
	'base-value': 'baseValue',
	'tolerance-mode': 'toleranceMode',
	'include-category': 'includeCategory',
	'exclude-category': 'excludeCategory',
	'section-identifier': 'sectionIdentifier',
	'weight-identifier': 'weightIdentifier',

	// Mapping attributes
	'map-key': 'mapKey',
	'mapped-value': 'mappedValue',
	'case-sensitive': 'caseSensitive',
	'default-value': 'defaultValue',
	// Note: lower-bound and upper-bound already defined above (used in slider and mapping contexts)

	// Interpolation attributes
	'source-value': 'sourceValue',
	'target-value': 'targetValue',
	'include-boundary': 'includeBoundary',

	// Ordering attributes
	'keep-together': 'keepTogether',

	// Selection attributes
	select: 'select',
	'with-replacement': 'withReplacement',

	// Pre-conditions and branching
	'pre-condition': 'preCondition',
	'branch-rule': 'branchRule',

	// Catalog/accessibility attributes
	'data-catalog-idref': 'dataCatalogIdref',
	support: 'support',
	'card-idref': 'cardIdref',

	// PCI attributes
	hook: 'hook',
	module: 'module',
	'entry-point': 'entryPoint',

	// Object attributes
	data: 'data',
	type: 'type',
	width: 'width',
	height: 'height',
	codetype: 'codetype',
	codebase: 'codebase',
	archive: 'archive',

	// Param attributes
	name: 'name',
	value: 'value',
	valuetype: 'valuetype',

	// Stylesheet attributes
	href: 'href',
	media: 'media',

	// Math operator attributes
	operator: 'operator',

	// Stats operator attributes
	'stats-operator': 'statsOperator',

	// Rounding attributes
	'rounding-mode': 'roundingMode',
	figures: 'figures',

	// Variable matching
	'variable-identifier': 'variableIdentifier',

	// Index attributes
	n: 'n',

	// String matching
	'substring-match': 'substringMatch',

	// Container attributes
	'ordered-container': 'orderedContainer',

	// Custom operator
	class: 'class',
	definition: 'definition',

	// Standard XML attributes (pass through)
	lang: 'lang',
	'xml:lang': 'xml:lang',
	'xml:base': 'xml:base',
	id: 'id',
	xmlns: 'xmlns',
} as const;

/**
 * QTI 3.0 attribute name mapper.
 *
 * QTI 3.0 uses kebab-case for attribute names. This mapper converts
 * between kebab-case (QTI 3.0) and camelCase (internal canonical form).
 *
 * @example
 * const mapper = new Qti3AttributeNameMapper();
 * mapper.toCanonical('response-identifier'); // => 'responseIdentifier'
 * mapper.toCanonical('max-choices'); // => 'maxChoices'
 * mapper.toNative('responseIdentifier'); // => 'response-identifier'
 * mapper.toNative('maxChoices'); // => 'max-choices'
 */
export class Qti3AttributeNameMapper implements AttributeNameMapper {
	readonly version = '3.0';

	// Reverse mapping cache (camelCase -> kebab-case)
	private reverseMap: Map<string, string> | null = null;

	/**
	 * Convert QTI 3.0 kebab-case attribute to canonical camelCase.
	 */
	toCanonical(attributeName: string): string {
		// Direct lookup
		const canonical = QTI3_ATTRIBUTE_MAPPINGS[attributeName];
		if (canonical) {
			return canonical;
		}

		// If already in camelCase (no hyphens), return as-is
		if (!attributeName.includes('-')) {
			return attributeName;
		}

		// Fallback: convert kebab-case to camelCase programmatically
		return this.kebabToCamelCase(attributeName);
	}

	/**
	 * Convert canonical camelCase to QTI 3.0 kebab-case.
	 */
	toNative(canonicalName: string): string {
		// Build reverse map on first use
		if (!this.reverseMap) {
			this.reverseMap = new Map();
			for (const [kebab, camel] of Object.entries(QTI3_ATTRIBUTE_MAPPINGS)) {
				this.reverseMap.set(camel, kebab);
			}
		}

		// Direct lookup
		const native = this.reverseMap.get(canonicalName);
		if (native) {
			return native;
		}

		// If already in kebab-case, return as-is
		if (canonicalName.includes('-')) {
			return canonicalName;
		}

		// Fallback: convert camelCase to kebab-case programmatically
		return this.camelToKebabCase(canonicalName);
	}

	/**
	 * Check if attribute name is valid kebab-case.
	 */
	isValidAttributeName(attributeName: string): boolean {
		// Standard XML attributes are always valid
		if (
			attributeName.startsWith('xml:') ||
			attributeName.startsWith('xmlns') ||
			attributeName === 'id'
		) {
			return true;
		}

		// QTI 3.0 attributes should be kebab-case (lowercase with hyphens)
		// or simple lowercase (like 'shuffle', 'type', 'value')
		return /^[a-z][a-z0-9-]*$/.test(attributeName);
	}

	/**
	 * Convert kebab-case to camelCase.
	 * @private
	 */
	private kebabToCamelCase(str: string): string {
		return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
	}

	/**
	 * Convert camelCase to kebab-case.
	 * @private
	 */
	private camelToKebabCase(str: string): string {
		return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
	}
}

/**
 * Get all QTI 3.0 attribute names (kebab-case).
 */
export function getQti3AttributeNames(): readonly string[] {
	return Object.keys(QTI3_ATTRIBUTE_MAPPINGS);
}

/**
 * Get canonical name for a QTI 3.0 attribute.
 */
export function getCanonicalAttributeName(qti3AttributeName: string): string | undefined {
	return QTI3_ATTRIBUTE_MAPPINGS[qti3AttributeName];
}

/**
 * Check if an attribute name is a valid QTI 3.0 attribute.
 */
export function isQti3Attribute(attributeName: string): boolean {
	return attributeName in QTI3_ATTRIBUTE_MAPPINGS;
}
