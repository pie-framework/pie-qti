import { describe, expect, test } from 'bun:test';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import { buildScopedStylesheetCss, scopeCssRules } from '../../src/components/utils/stylesheetRender.js';

describe('QTI stylesheet runtime rendering helpers', () => {
	test('scopes simple stylesheet rules to the item player root', () => {
		const scoped = scopeCssRules(
			'.term, p strong { color: blue; }\n:root { --accent: red; }',
			'[data-qti-item-body-scope="item-a"]'
		);

		expect(scoped).toContain(
			'[data-qti-item-body-scope="item-a"] .term, [data-qti-item-body-scope="item-a"] p strong { color: blue; }'
		);
		expect(scoped).toContain('[data-qti-item-body-scope="item-a"] { --accent: red; }');
		expect(scoped).not.toContain(':root');
	});

	test('builds scoped CSS in resolved stylesheet order', () => {
		const deliveryContext: ResolvedItemDeliveryContext = {
			itemHref: 'items/item.xml',
			stimuli: {},
			stylesheets: [
				{
					href: 'item.css',
					xml: '<qti-stylesheet href="item.css"/>',
					resolvedHref: 'items/item.css',
					source: 'item',
					cssText: '.term { color: blue; }',
				},
				{
					href: 'stimulus.css',
					xml: '<qti-stylesheet href="stimulus.css"/>',
					resolvedHref: 'stimuli/stimulus.css',
					source: 'stimulus',
					stimulusIdentifier: 'passage_1',
					cssText: '.term { font-weight: bold; }',
				},
			],
			catalogSources: [],
			validationMessages: [],
		};

		const css = buildScopedStylesheetCss(deliveryContext, '[data-qti-item-body-scope="item-a"]');

		expect(css.indexOf('color: blue')).toBeLessThan(css.indexOf('font-weight: bold'));
		expect(css).toContain('[data-qti-item-body-scope="item-a"] .term { color: blue; }');
		expect(css).toContain(
			'[data-qti-item-body-scope="item-a"] [data-stimulus-idref="passage_1"] .term { font-weight: bold; }'
		);
		expect(css).not.toContain('items/item.css');
		expect(css).not.toContain('stimuli/stimulus.css');
	});

	test('uses caller-provided instance scopes so styles cannot bleed between item players', () => {
		const deliveryContext: ResolvedItemDeliveryContext = {
			itemHref: 'items/item.xml',
			stimuli: {},
			stylesheets: [
				{
					href: 'item.css',
					xml: '<qti-stylesheet href="item.css"/>',
					resolvedHref: 'items/item.css',
					source: 'item',
					cssText: '.term { color: blue; }',
				},
			],
			catalogSources: [],
			validationMessages: [],
		};

		const itemA = buildScopedStylesheetCss(deliveryContext, '[data-qti-item-body-scope="item-a"]');
		const itemB = buildScopedStylesheetCss(deliveryContext, '[data-qti-item-body-scope="item-b"]');

		expect(itemA).toContain('[data-qti-item-body-scope="item-a"] .term');
		expect(itemA).not.toContain('[data-qti-item-body-scope="item-b"]');
		expect(itemB).toContain('[data-qti-item-body-scope="item-b"] .term');
		expect(itemB).not.toContain('[data-qti-item-body-scope="item-a"]');
	});

	test('drops unsafe CSS even if an external host supplied it on the delivery context', () => {
		const deliveryContext: ResolvedItemDeliveryContext = {
			itemHref: 'items/item.xml',
			stimuli: {},
			stylesheets: [
				{
					href: 'unsafe.css',
					xml: '<qti-stylesheet href="unsafe.css"/>',
					resolvedHref: 'items/unsafe.css',
					source: 'item',
					cssText: '.term { background-image: url("https://evil.example/a.png"); }',
				},
			],
			catalogSources: [],
			validationMessages: [],
		};

		expect(buildScopedStylesheetCss(deliveryContext)).toBe('');
	});

	test('drops comment-split and escaped unsafe CSS at render time', () => {
		const deliveryContext: ResolvedItemDeliveryContext = {
			itemHref: 'items/item.xml',
			stimuli: {},
			stylesheets: [
				{
					href: 'comment-bypass.css',
					xml: '<qti-stylesheet href="comment-bypass.css"/>',
					resolvedHref: 'items/comment-bypass.css',
					source: 'item',
					cssText: '.term { background-image: u/**/rl("https://evil.example/a.png"); }',
				},
				{
					href: 'escaped-bypass.css',
					xml: '<qti-stylesheet href="escaped-bypass.css"/>',
					resolvedHref: 'items/escaped-bypass.css',
					source: 'item',
					cssText: '.term { background-image: \\75 rl("https://evil.example/a.png"); }',
				},
			],
			catalogSources: [],
			validationMessages: [],
		};

		expect(buildScopedStylesheetCss(deliveryContext)).toBe('');
	});

	test('drops CSS image-set external loads at render time', () => {
		const deliveryContext: ResolvedItemDeliveryContext = {
			itemHref: 'items/item.xml',
			stimuli: {},
			stylesheets: [
				{
					href: 'image-set.css',
					xml: '<qti-stylesheet href="image-set.css"/>',
					resolvedHref: 'items/image-set.css',
					source: 'item',
					cssText: '.term { background-image: image-set("https://evil.example/a.png" 1x); }',
				},
			],
			catalogSources: [],
			validationMessages: [],
		};

		expect(buildScopedStylesheetCss(deliveryContext)).toBe('');
	});
});
