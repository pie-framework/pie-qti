import type { ResolvedItemDeliveryContext, ResolvedQtiStylesheetRef } from '@pie-qti/ims-cp-core';
import { isBlockedStylesheetCss } from '@pie-qti/ims-cp-core';

export function buildScopedStylesheetCss(
	deliveryContext: ResolvedItemDeliveryContext | undefined,
	scopeSelector = '[data-qti-item-body-scope]'
): string {
	if (!deliveryContext) return '';
	return deliveryContext.stylesheets
		.map((stylesheet) => stylesheetToScopedCss(stylesheet, scopeSelector))
		.filter(Boolean)
		.join('\n');
}

function stylesheetToScopedCss(stylesheet: ResolvedQtiStylesheetRef, scopeSelector: string): string {
	const css = stylesheet.cssText?.trim();
	if (!css || isBlockedStylesheetCss(css)) return '';
	const stylesheetScope = getStylesheetScopeSelector(stylesheet, scopeSelector);
	const scoped = scopeCssRules(css, stylesheetScope);
	if (!scoped) return '';
	return scoped;
}

/**
 * At-rules whose block contains nested *rules*, so scoping recurses into the
 * block while the prelude is preserved verbatim.
 *
 * Anything not listed here is passed through untouched. That is the safe
 * default both ways: at-rules whose block holds declarations rather than rules
 * (`@font-face`, `@page`, `@property`, `@counter-style`) or non-selector keys
 * (`@keyframes` percentages) must not be scoped, and an at-rule this list has
 * never heard of is more safely left alone than guessed at.
 */
const NESTED_RULE_AT_RULES = new Set(['media', 'supports', 'container', 'layer', 'scope']);

/** Matches a leading `:root`, `html` or `body` not followed by more name characters. */
const DOCUMENT_ROOT_PREFIX = /^(?::root|html|body)(?![\w-])/;

/** Matches an at-rule name, with any vendor prefix, at the start of a prelude. */
const AT_RULE_NAME = /^@(?:-[a-z]+-)?([\w-]+)/i;

type StyleNode =
	/** A `;`-terminated at-rule with no block, such as `@layer a;`. */
	| { kind: 'statement'; text: string; end: number }
	/** A prelude plus a `{ ... }` block: a style rule or a block at-rule. */
	| { kind: 'rule'; prelude: string; block: string; end: number }
	/** Trailing text with no rule in it, kept so nothing is silently dropped. */
	| { kind: 'trailing'; text: string; end: number };

/**
 * Confine every selector in `css` to `scopeSelector`.
 *
 * This walks the stylesheet brace-by-brace. It used to be a single regex over
 * `([^{}@]+)\{([^{}]*)\}`, which handled flat selector rules and silently
 * destroyed at-rules. Because `@` was excluded from the selector pattern rather
 * than *understood*, an `@media` block never matched as a unit, so the inner
 * rules matched on their own and were emitted **without the condition** — the
 * media query was dropped and its rules applied unconditionally, so a
 * print-only or narrow-viewport rule took effect everywhere. `@keyframes`
 * degraded the same way, with its percentage selectors scoped into
 * `[scope] 0%` and the animation name discarded, and `@font-face` became
 * `[scope] font-face`.
 *
 * A CSS parser would be the textbook answer and is deliberately not added:
 * scoping needs rule boundaries only, not property grammar, and this runs in
 * the delivery path.
 *
 * Note that `isBlockedStylesheetCss` rejects any stylesheet containing `url(`
 * or `@import` before this is reached, so `@font-face` with a real `src` never
 * arrives here in practice. `@media`, `@supports` and `@keyframes` do.
 */
export function scopeCssRules(css: string, scopeSelector = '[data-qti-item-body-scope]'): string {
	if (!css) return '';
	const scope = scopeSelector?.trim();
	if (!scope) return css;
	return scopeRuleList(stripComments(css), scope).trim();
}

function scopeRuleList(css: string, scope: string): string {
	let out = '';
	let index = 0;
	while (index < css.length) {
		const node = readNode(css, index);
		if (node.end <= index) break;
		out += renderNode(node, scope);
		index = node.end;
	}
	return out;
}

function renderNode(node: StyleNode, scope: string): string {
	if (node.kind === 'statement') {
		const text = node.text.trim();
		return text === ';' ? '' : `${text}\n`;
	}
	if (node.kind === 'trailing') {
		return node.text.trim() ? `${node.text.trim()}\n` : '';
	}
	const prelude = node.prelude.trim();
	if (!prelude) return '';
	if (prelude.startsWith('@')) {
		const name = AT_RULE_NAME.exec(prelude)?.[1]?.toLowerCase();
		if (name && NESTED_RULE_AT_RULES.has(name)) {
			const inner = scopeRuleList(node.block, scope);
			if (!inner.trim()) return '';
			return `${prelude} {\n${inner}}\n`;
		}
		return `${prelude} {${node.block}}\n`;
	}
	// Rules with no declarations are dropped, as they were before.
	const declarations = node.block.trim();
	if (!declarations) return '';
	const selectors = splitTopLevel(prelude, ',')
		.map((selector) => scopeSelectorText(selector.trim(), scope))
		.filter(Boolean);
	if (selectors.length === 0) return '';
	return `${selectors.join(', ')} { ${declarations} }\n`;
}

function getStylesheetScopeSelector(stylesheet: ResolvedQtiStylesheetRef, scopeSelector: string): string {
	if (stylesheet.source !== 'stimulus' || !stylesheet.stimulusIdentifier) return scopeSelector;
	return `${scopeSelector} [data-stimulus-idref="${escapeCssString(stylesheet.stimulusIdentifier)}"]`;
}

function scopeSelectorText(selector: string, scopeSelector: string): string {
	if (!selector) return '';
	if (selector === scopeSelector || selector.startsWith(`${scopeSelector} `)) return selector;
	// `:root`/`html`/`body` are replaced rather than prefixed: `[scope] :root`
	// cannot match, because `:root` is the document element and is not a
	// descendant of the item body. Whatever followed is preserved, so
	// `html.dark .a` becomes `[scope].dark .a`.
	const rootPrefix = DOCUMENT_ROOT_PREFIX.exec(selector);
	if (rootPrefix) return `${scopeSelector}${selector.slice(rootPrefix[0].length)}`;
	// Everything else becomes a descendant, including a leading pseudo. This
	// used to attach — `[scope]:is(.a, .b)` — which is a different selector: an
	// authored `:is(.a, .b) .c` means "some element matching .a or .b", so
	// attaching demands that the item body itself carry the authored class, and
	// it does not. The same holds for `:hover` and `::selection`.
	return `${scopeSelector} ${selector}`;
}

/**
 * Read one node starting at `start`, tracking strings and parentheses so a `{`
 * inside `content: "{"` or a `,` inside `:is(a, b)` is not mistaken for
 * structure.
 */
function readNode(css: string, start: number): StyleNode {
	let index = start;
	let quote: string | null = null;
	let parenDepth = 0;
	while (index < css.length) {
		const char = css[index];
		if (quote) {
			if (char === '\\') index += 1;
			else if (char === quote) quote = null;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === '(') {
			parenDepth += 1;
		} else if (char === ')') {
			if (parenDepth > 0) parenDepth -= 1;
		} else if (parenDepth === 0 && char === ';') {
			return { kind: 'statement', text: css.slice(start, index + 1), end: index + 1 };
		} else if (parenDepth === 0 && char === '{') {
			const blockEnd = findBlockEnd(css, index);
			return {
				kind: 'rule',
				prelude: css.slice(start, index),
				block: css.slice(index + 1, blockEnd.contentEnd),
				end: blockEnd.end,
			};
		}
		index += 1;
	}
	return { kind: 'trailing', text: css.slice(start), end: css.length };
}

/**
 * Find the `}` matching the `{` at `openIndex`. Unbalanced input — a truncated
 * stylesheet — is treated as running to the end rather than throwing.
 */
function findBlockEnd(css: string, openIndex: number): { contentEnd: number; end: number } {
	let depth = 0;
	let quote: string | null = null;
	for (let index = openIndex; index < css.length; index += 1) {
		const char = css[index];
		if (quote) {
			if (char === '\\') index += 1;
			else if (char === quote) quote = null;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === '{') depth += 1;
		else if (char === '}') {
			depth -= 1;
			if (depth === 0) return { contentEnd: index, end: index + 1 };
		}
	}
	return { contentEnd: css.length, end: css.length };
}

/** Split on `separator` at paren depth zero and outside strings. */
function splitTopLevel(value: string, separator: string): string[] {
	const parts: string[] = [];
	let current = '';
	let quote: string | null = null;
	let parenDepth = 0;
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index] as string;
		if (quote) {
			current += char;
			if (char === '\\' && index + 1 < value.length) {
				current += value[index + 1];
				index += 1;
			} else if (char === quote) {
				quote = null;
			}
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			current += char;
			continue;
		}
		if (char === '(') parenDepth += 1;
		else if (char === ')' && parenDepth > 0) parenDepth -= 1;
		if (char === separator && parenDepth === 0) {
			parts.push(current);
			current = '';
			continue;
		}
		current += char;
	}
	parts.push(current);
	return parts;
}

/**
 * Remove comments before walking, so a comment between two rules is not
 * absorbed into the next rule's selector list. String-aware, so a literal
 * `content: "/*"` survives — the previous regex strip was not.
 */
function stripComments(css: string): string {
	let out = '';
	let quote: string | null = null;
	let index = 0;
	while (index < css.length) {
		const char = css[index] as string;
		if (quote) {
			out += char;
			if (char === '\\' && index + 1 < css.length) {
				out += css[index + 1];
				index += 2;
				continue;
			}
			if (char === quote) quote = null;
			index += 1;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			out += char;
			index += 1;
			continue;
		}
		if (char === '/' && css[index + 1] === '*') {
			const close = css.indexOf('*/', index + 2);
			index = close === -1 ? css.length : close + 2;
			// Keep a space so `a/**/b` does not become the single token `ab`.
			out += ' ';
			continue;
		}
		out += char;
		index += 1;
	}
	return out;
}

function escapeCssString(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n|\r|\f/g, ' ');
}
