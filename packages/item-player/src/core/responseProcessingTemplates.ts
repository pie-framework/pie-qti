/**
 * Fixed response-processing templates (`responseProcessing@template`) the player executes
 * natively, identified by the file name of the template URI: the QTI standard templates
 * (`match_correct`, `map_response`, `map_response_point`, `no_response_processing`), their
 * Common Cartridge aliases, and the `match_nothing` compatibility templates. Each scoring name is
 * regression-tested against the corresponding XML program (docs/SPEC-GAPS-PLAN.md G-19).
 */
export const SUPPORTED_RESPONSE_PROCESSING_TEMPLATES = [
	'match_correct',
	'map_response',
	'map_response_point',
	'no_response_processing',
	'cc2_match',
	'cc2_match_basic',
	'cc2_map_response',
	'cc2_map_response_point',
	'match_nothing',
	'cc2_match_nothing',
] as const;

export type ResponseProcessingTemplateName = (typeof SUPPORTED_RESPONSE_PROCESSING_TEMPLATES)[number];

const SUPPORTED = new Set<string>(SUPPORTED_RESPONSE_PROCESSING_TEMPLATES);

/** The supported template a `responseProcessing@template` URI names, or null. */
export function resolveResponseProcessingTemplate(templateUri: string): ResponseProcessingTemplateName | null {
	const name = templateUri.split('/').pop()?.toLowerCase().replace(/\.xml$/, '');
	return name && SUPPORTED.has(name) ? (name as ResponseProcessingTemplateName) : null;
}

/**
 * The item's response processing is only a template reference, and the player has no built-in
 * program for that template. QTI lets a delivery engine use the template's rules in place of the
 * item's; this player does not fetch templates (`templateLocation` is ignored), so scoring the
 * item would silently produce default outcomes. Thrown when the item is compiled.
 */
export class UnsupportedResponseProcessingTemplateError extends Error {
	readonly code = 'unsupported-response-processing-template';
	readonly templateUri: string;
	readonly itemIdentifier?: string;

	constructor(templateUri: string, itemIdentifier?: string) {
		super(
			`[QTI Player] Unsupported response processing template "${templateUri}"` +
				`${itemIdentifier ? ` in item "${itemIdentifier}"` : ''}. Supported templates: ` +
				`${SUPPORTED_RESPONSE_PROCESSING_TEMPLATES.join(', ')}. Inline the template's rules in ` +
				'responseProcessing to score this item.',
		);
		this.name = 'UnsupportedResponseProcessingTemplateError';
		this.templateUri = templateUri;
		if (itemIdentifier) this.itemIdentifier = itemIdentifier;
	}
}
