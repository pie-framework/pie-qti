/**
 * The one visually hidden (`.sr-only`) rule for the shell's own chrome.
 *
 * The announcer's live regions and the timer's announcement regions carry the
 * shared `sr-only` class and hide through this single rule. It is injected into
 * the document once (light DOM: the shell and its chrome render no shadow
 * roots), after the idiom of default-components' `shared/styles/srOnly.ts` and
 * this package's `submitDialogAction.ts`. The shell cannot lean on the
 * default-components injection: that rule is an import side effect of a package
 * this one does not depend on, and a host that registers its own interactions
 * never loads it.
 *
 * The declarations are identical to the canonical rule the default components
 * inject, so with default-components loaded the two rules agree and the hidden
 * state is the same whichever landed first. A component needing a differently
 * scoped variant (the timer's phone-width toggle label) keeps its own
 * media-query rule; an always-hidden element joins this rule, never a private
 * copy of the declarations.
 */

/** The shared class any visually hidden element carries. */
export const SR_ONLY_CLASS = 'sr-only';

/** The declarations, identical to the canonical rule the default components inject. */
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

/** The rule text, injected verbatim into the document. */
export const SR_ONLY_RULE = `.${SR_ONLY_CLASS} {
	${DECLARATIONS.join(';\n\t')};
}`;

const STYLE_ATTRIBUTE = 'data-assessment-sr-only-source';
const STYLE_SOURCE = 'pie-qti';

/**
 * Inject the rule into the document once. Safe to call repeatedly (the
 * announcer and the timer call it from their module scripts): later calls are
 * no-ops when the rule is already present.
 */
export function ensureSrOnlyStyles(): void {
	if (typeof document === 'undefined') return;
	if (document.querySelector(`style[${STYLE_ATTRIBUTE}="${STYLE_SOURCE}"]`)) return;
	const style = document.createElement('style');
	style.setAttribute(STYLE_ATTRIBUTE, STYLE_SOURCE);
	style.textContent = SR_ONLY_RULE;
	document.head.appendChild(style);
}
