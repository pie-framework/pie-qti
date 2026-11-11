/**
 * Tests for `scripts/check-consumer-keys.ts`, the consumer scan in
 * `check:i18n` that asserts every literal i18n key a consumer source file
 * passes to `t()` / `translate()` / `translatePlural()` / `interfaceText()` /
 * `.plural()` or names in a `labelKey` exists in the catalog.
 *
 * This is the guard the round-4 review found missing (finding L3): the five
 * player keys that shipped with no catalog entry all lived in script literals,
 * expression attributes and component props — exactly where the hardcoded-
 * string scanner is blind by design. Round 5 added the `interfaceText(`
 * wrapper-call pattern: section-player's 20+ call sites forwarded literal keys
 * through a variable-keyed wrapper the scan could not see.
 */

import { describe, expect, test } from 'bun:test';
import { KEYISH, scanConsumerKeyLiterals, type ConsumerKeyHit } from '../scripts/check-consumer-keys.js';

const CATALOG = new Set([
	'common.submit',
	'common.cancel',
	'assessment.feedback.title',
	'interactions.hottext.minimumMet',
	'interactions.hottext.selectAtLeast',
	'interaction.renderError',
	'customInteraction.portableLabel',
	'plurals.items',
	'demo.appName',
]);

function missing(source: string): ConsumerKeyHit[] {
	const catalog = new Set(CATALOG);
	return scanConsumerKeyLiterals(source)
		.filter((hit) => !catalog.has(hit.key));
}

describe('scanConsumerKeyLiterals — flags the L1 blind spots', () => {
	test('flags a key in a script-block translate() call, across lines', () => {
		const source = [
			'<script lang="ts">',
			'\talert.textContent = translate(',
			"\t\ti18n,",
			"\t\t'interaction.renderErrorTypo',",
			'\t\t"This interactive element ({type}) could not be displayed.",',
			'\t);',
			'</script>',
		].join('\n');
		const hits = missing(source);
		expect(hits.map((h) => h.key)).toEqual(['interaction.renderErrorTypo']);
		expect(hits[0].kind).toBe('translate()');
		expect(hits[0].line).toBe(4);
	});

	test('flags a key inside a component prop expression', () => {
		const source = `<DialogTitle title={i18n.t('assessment.feedback.titel')} />`;
		expect(missing(source).map((h) => h.key)).toEqual(['assessment.feedback.titel']);
	});

	test('flags keys in optional-chained calls and attribute expressions', () => {
		const source = `aria-label={x?.t('customInteraction.portableLable') ?? 'g'}`;
		expect(missing(source).map((h) => h.key)).toEqual(['customInteraction.portableLable']);
	});

	test('flags translatePlural and plural group keys', () => {
		const source = [
			"translatePlural(i18n, 'plurals.attemptsMissing', forms, count)",
			"i18n.plural('plurals.nope', { count })",
		].join('\n');
		expect(missing(source).map((h) => h.key)).toEqual(['plurals.attemptsMissing', 'plurals.nope']);
	});

	test('flags labelKey literals', () => {
		const source = ["{ labelKey: 'accessibility.notThere', label: 'x' }", "<Thing labelKey='also.missing' />"].join('\n');
		expect(missing(source).map((h) => h.key)).toEqual(['accessibility.notThere', 'also.missing']);
	});

	test('flags keys at interfaceText() wrapper call sites, across lines', () => {
		// section-player's interfaceText(i18n, key, fallback) forwards the key to
		// translate(); a typo'd literal there renders the English fallback in
		// every locale, so the wrapper's call sites must meet the same scan.
		const source = [
			'<script lang="ts">',
			"\tconst title = interfaceText(i18n, 'sectionPlayer.questoin', 'Question');",
			'</script>',
		].join('\n');
		const hits = missing(source);
		expect(hits.map((h) => h.key)).toEqual(['sectionPlayer.questoin']);
		expect(hits[0].kind).toBe('interfaceText()');
		expect(hits[0].line).toBe(2);

		const multiLine = [
			'const description = interfaceText(',
			'\ti18n,',
			"\t'sectionPlayer.displaySettings.descriptionTypo',",
			"\t'Changes apply right away.',",
			');',
		].join('\n');
		expect(missing(multiLine).map((h) => h.key)).toEqual(['sectionPlayer.displaySettings.descriptionTypo']);
	});

	test('keys at interfaceText() call sites present in the catalog are not flagged', () => {
		const source = [
			"aria-label={interfaceText(i18n, 'assessment.feedback.title', 'Test feedback')}",
			"interfaceText(i18n, 'common.submit', 'Submit', { attempt: n })",
		].join('\n');
		expect(missing(source)).toEqual([]);
	});

	test('a dynamic key argument at an interfaceText() call site is not flagged', () => {
		const source = "<span>{interfaceText(i18n, option.labelKey, option.fallback)}</span>";
		expect(missing(source)).toEqual([]);
	});

	test('flags .t() calls with double quotes', () => {
		const source = `i18n.t("no.double.quoted")`;
		expect(missing(source).map((h) => h.key)).toEqual(['no.double.quoted']);
	});
});

describe('scanConsumerKeyLiterals — passes legitimate code', () => {
	test('keys present in the catalog are not flagged', () => {
		const source = [
			"title={i18n.t('assessment.feedback.title', 'Feedback')}",
			"translate(i18n, 'interactions.hottext.minimumMet', 'Minimum met')",
			"i18n?.t('demo.appName')",
		].join('\n');
		expect(missing(source)).toEqual([]);
	});

	test('dynamic keys (template literals, variables) are not flagged', () => {
		const source = [
			// biome-ignore lint/suspicious/noTemplateCurlyInString: fixture must look like a template-literal key to the scanner
			'translate(i18n, `${key}.${form}`, fallback)',
			'translate(i18n, labelKey, fallback)',
			// biome-ignore lint/suspicious/noTemplateCurlyInString: fixture must look like a template-literal key to the scanner
			"i18n.t(`demo.sampleItemDescriptions.${id}`)",
		].join('\n');
		expect(missing(source)).toEqual([]);
	});

	test('doc comments and prose mentioning call syntax are not flagged', () => {
		const source = [
			'/**',
			" * @example t('not.a.real.key') => translated",
			' */',
			'<!-- usage: i18n.t("docs.example.key") -->',
			"// see also translate(i18n, 'docs.other.key', fallback)",
			'const message = i18n.t(\'common.submit\');',
		].join('\n');
		expect(missing(source)).toEqual([]);
	});

	test('non-keyish string arguments are not flagged', () => {
		const source = [
			"const locale = normalizeLanguageTag('en-US');",
			"const url = resolve('section.one');", // single segment after split? keyish requires 2+ segments — 'section.one' IS keyish; but not at a call pattern
		].join('\n');
		// 'section.one' never appears at an i18n call pattern, so nothing matches.
		expect(missing(source)).toEqual([]);
	});
});

describe('KEYISH', () => {
	test('requires dot-separated identifier segments', () => {
		expect(KEYISH.test('interactions.hottext.selectAtLeast')).toBe(true);
		expect(KEYISH.test('common.submit')).toBe(true);
		expect(KEYISH.test('single')).toBe(false);
		expect(KEYISH.test('en-US')).toBe(false);
		expect(KEYISH.test('Select at least {minChoices}')).toBe(false);
		expect(KEYISH.test('2fa.token')).toBe(false);
	});
});
