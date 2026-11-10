/**
 * The one visually hidden (`.sr-only`) rule.
 *
 * Every element the components render for assistive technology only — live
 * regions, instructions, state sentences — hides through this single rule. It
 * is injected into the document (light DOM) once on import, and into each
 * component's shadow root by ShadowBaseStyles, so a host needs neither
 * Tailwind nor any other stylesheet for hidden content to stay hidden.
 *
 * An element opts in with the shared `sr-only` class, or with its
 * interaction's own hook listed below (live regions keep their names: tests
 * and themes target them). A new hook is added to `HIDDEN_CLASSES`, never as
 * a private copy of the declarations.
 */

/** The shared class any visually hidden element can carry. */
export const SR_ONLY_CLASS = 'sr-only';

/** Class hooks that name a visually hidden element beside the shared class. */
const HIDDEN_CLASSES: readonly string[] = [
	SR_ONLY_CLASS,
	// Confirmation live regions (order, graphic order)
	'qti-order-confirmation-live',
	'qti-go-confirmation-live',
	// Per-interaction sr-only hooks and live regions (graphic interactions, match family)
	'qti-go-sr-only',
	'qti-ga-sr-only',
	'qti-ga-live-region',
	'qti-hotspot-sr-only',
	'qti-hotspot-live-region',
	'qti-sp-sr-only',
	'qti-po-sr-only',
	'qti-associate-live-region',
	'qti-gm-live-region',
	// Shared components' live regions (order subset, minimum hint, upload)
	'qti-subset-live',
	'qti-min-hint-live',
	'qti-upload-live-region',
];

const DECLARATIONS = [
	'position: absolute',
	'width: 1px',
	'height: 1px',
	'padding: 0',
	'margin: -1px',
	'overflow: hidden',
	'clip: rect(0, 0, 0, 0)',
	'white-space: nowrap',
	'border-width: 0',
];

/** The rule text, injected verbatim into the document and into shadow roots. */
export const SR_ONLY_RULE = `${HIDDEN_CLASSES.map((hook) => `.${hook}`).join(',\n')} {
	${DECLARATIONS.join(';\n\t')};
}`;

const STYLE_ATTRIBUTE = 'data-sr-only-source';
const STYLE_SOURCE = 'pie-qti';

/**
 * Inject the rule into the document once. Safe to call repeatedly (and called
 * on import): later calls are no-ops when the rule is already present.
 */
export function ensureSrOnlyStyles(): void {
	if (typeof document === 'undefined') return;
	if (document.querySelector(`style[${STYLE_ATTRIBUTE}="${STYLE_SOURCE}"]`)) return;
	const style = document.createElement('style');
	style.setAttribute(STYLE_ATTRIBUTE, STYLE_SOURCE);
	style.textContent = SR_ONLY_RULE;
	document.head.appendChild(style);
}

ensureSrOnlyStyles();
