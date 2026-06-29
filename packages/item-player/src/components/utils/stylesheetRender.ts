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

export function scopeCssRules(css: string, scopeSelector = '[data-qti-item-body-scope]'): string {
	const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
	let scoped = '';
	const rulePattern = /([^{}@]+)\{([^{}]*)\}/g;
	for (const match of withoutComments.matchAll(rulePattern)) {
		const selectorList = match[1]?.trim();
		const declarations = match[2]?.trim();
		if (!selectorList || !declarations) continue;
		const selectors = selectorList
			.split(',')
			.map((selector) => scopeSelectorText(selector.trim(), scopeSelector))
			.filter(Boolean);
		if (selectors.length === 0) continue;
		scoped += `${selectors.join(', ')} { ${declarations} }\n`;
	}
	return scoped.trim();
}

function getStylesheetScopeSelector(stylesheet: ResolvedQtiStylesheetRef, scopeSelector: string): string {
	if (stylesheet.source !== 'stimulus' || !stylesheet.stimulusIdentifier) return scopeSelector;
	return `${scopeSelector} [data-stimulus-idref="${escapeCssString(stylesheet.stimulusIdentifier)}"]`;
}

function scopeSelectorText(selector: string, scopeSelector: string): string {
	if (!selector) return '';
	if (selector.startsWith(scopeSelector)) return selector;
	if (selector === ':root' || selector === 'html' || selector === 'body') return scopeSelector;
	if (selector.startsWith(':')) return `${scopeSelector}${selector}`;
	return `${scopeSelector} ${selector}`;
}

function escapeCssString(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n|\r|\f/g, ' ');
}
