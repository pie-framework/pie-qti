import { parse as parseHtml } from 'node-html-parser';
import type { HTMLElement as NhpElement } from 'node-html-parser';
import type { CatalogSupportPreference, PnpProfile } from './types.js';

/** QTI 3's profile of Access for All Personal Needs and Preferences 3.0. */
export const AFA_PNP_NAMESPACE = 'http://www.imsglobal.org/xsd/qtiv3p0/imsafa3p0pnp_v1p0';

/**
 * An AfA PNP 3.0 profile as JSON keyed by the spec's kebab-case terms, the shape
 * pie-players' `createPersonalNeedsProfileFromAfa` takes.
 *
 * An empty element is `{}`, an element holding only text is that text (a number or
 * boolean when it reads as one), `xml:lang` is `language`, a repeated element is an
 * array, and a feature set is the list of feature names it holds. Elements of another
 * namespace, AfA's extension mechanism, sit under `extensions` by local name.
 */
export interface AfaPnpRecord {
	'activate-at-initialization-set'?: string[];
	'activate-as-option-set'?: string[];
	'prohibit-set'?: string[];
	extensions?: Record<string, unknown>;
	[feature: string]: unknown;
}

const FEATURE_SETS = new Set(['activate-at-initialization-set', 'activate-as-option-set', 'prohibit-set']);

/**
 * QTI 3's predefined catalog card supports, less `glossary-on-screen` and
 * `keyword-translation`, which have popups of their own. A granted one enables the
 * catalog support of that name.
 */
const CATALOG_SUPPORT_FEATURES = [
	'additional-directions',
	'audio-description',
	'braille',
	'high-contrast',
	'keyboard-directions',
	'linguistic-guidance',
	'long-description',
	'sign-language',
	'simplified-graphics',
	'simplified-language-portions',
	'spoken',
	'tactile',
	'transcript',
] as const;

/** The extension SBAC requests its illustrated glossary with. */
const ILLUSTRATED_GLOSSARY_EXTENSION = 'sbac-glossary-illustration';

type ColorScheme = NonNullable<NonNullable<PnpProfile['display']>['colorScheme']>;

/**
 * AfA `color-theme` terms onto the player's scheme names. The spec leaves a theme's
 * exact colors to the delivery system, so `high-contrast` takes black on white and
 * its reverse white on black.
 */
const COLOR_THEMES: Readonly<Record<string, ColorScheme>> = {
	default: 'default',
	'default-reverse': 'defaultreverse',
	'high-contrast': 'blackwhite',
	'high-contrast-reverse': 'whiteblack',
	'black-rose': 'blackrose',
	'rose-black': 'roseblack',
	'yellow-blue': 'yellowblue',
	'blue-yellow': 'blueyellow',
	'medgray-darkgray': 'mgraydgray',
	'darkgray-medgray': 'dgraymgray',
	'black-cyan': 'blackcyan',
	'cyan-black': 'cyanblack',
	'black-cream': 'blackcream',
	'cream-black': 'creamblack',
};

/**
 * Parse an AfA PNP 3.0 document into its record: an `access-for-all-pnp` element, or
 * the first one inside an `access-for-all-pnp-record`. A bulk records file holds one
 * profile per candidate, so pass the candidate's record. Returns `null` when the input
 * holds no profile.
 */
export function parseAfaPnpXml(xml: string | Element): AfaPnpRecord | null {
	const source = typeof xml === 'string' ? xml : ((xml as Element).outerHTML ?? '');
	const trimmed = source.replace(/<\?xml[^>]*\?>/g, '').trim();
	if (!trimmed) return null;

	const doc = parseHtml(`<root>${trimmed}</root>`, { lowerCaseTagName: false });
	const root = findProfile(doc);
	if (!root) return null;

	const afaPrefixes = collectAfaPrefixes(root);
	const record: AfaPnpRecord = {};
	for (const child of elementChildren(root)) {
		const { prefix, local } = splitName(child.rawTagName);
		if (prefix && !afaPrefixes.has(prefix)) {
			record.extensions ??= {};
			addValue(record.extensions, local, elementValue(child));
		} else if (FEATURE_SETS.has(local)) {
			record[local] = elementChildren(child).map((feature) => splitName(feature.rawTagName).local);
		} else {
			addValue(record, local, elementValue(child));
		}
	}
	return record;
}

/**
 * The part of an AfA record the item player renders. A feature counts when the record
 * names it or one of its activation sets lists it, unless `prohibit-set` lists it.
 * Features with no `PnpProfile` field stay in the record for the host's tools:
 * `fixed-minutes` testing time, `ext:` color themes, and every tool support.
 */
export function pnpProfileFromAfa(record: AfaPnpRecord): PnpProfile {
	const prohibited = new Set(record['prohibit-set'] ?? []);
	const listed = new Set([
		...(record['activate-at-initialization-set'] ?? []),
		...(record['activate-as-option-set'] ?? []),
	]);
	const granted = (feature: string): boolean =>
		!prohibited.has(feature) && (isPresent(record[feature]) || listed.has(feature));

	const display: NonNullable<PnpProfile['display']> = {};
	const theme = granted('text-appearance')
		? field(record['text-appearance'], 'color-theme')
		: granted('color-theme')
			? record['color-theme']
			: undefined;
	if (typeof theme === 'string' && COLOR_THEMES[theme]) display.colorScheme = COLOR_THEMES[theme];
	if (granted('magnification')) {
		const magnification = record.magnification;
		const zoom =
			finiteNumber(field(field(magnification, 'all-content'), 'zoom-amount')) ??
			finiteNumber(field(field(magnification, 'text'), 'zoom-amount'));
		if (zoom !== undefined && zoom > 0) display.magnification = zoom;
	}

	const content: NonNullable<PnpProfile['content']> = {};
	if (granted('glossary-on-screen')) content.glossaryOnScreen = true;
	if (granted('keyword-translation')) {
		const languageCode = normalizeLanguageCode(field(record['keyword-translation'], 'language'));
		if (languageCode) content.keywordTranslation = { active: true, languageCode };
	}
	if (
		!prohibited.has(ILLUSTRATED_GLOSSARY_EXTENSION) &&
		isPresent(record.extensions?.[ILLUSTRATED_GLOSSARY_EXTENSION])
	) {
		content.illustratedGlossary = true;
	}
	for (const feature of CATALOG_SUPPORT_FEATURES) {
		if (!granted(feature)) continue;
		const languageCode = normalizeLanguageCode(field(record[feature], 'language'));
		const preference: CatalogSupportPreference = languageCode ? { active: true, languageCode } : true;
		content.catalogSupports ??= {};
		content.catalogSupports[feature] = preference;
	}
	if (granted('additional-testing-time')) {
		const testingTime = record['additional-testing-time'];
		const multiplier = isPresent(field(testingTime, 'unlimited'))
			? Infinity
			: finiteNumber(field(testingTime, 'time-multiplier'));
		if (multiplier !== undefined && multiplier > 0) content.extendedTime = { active: true, multiplier };
	}

	const cognitive: NonNullable<PnpProfile['cognitive']> = {};
	if (granted('answer-masking')) cognitive.eliminationTool = true;

	const profile: PnpProfile = {};
	if (Object.keys(display).length > 0) profile.display = display;
	if (Object.keys(content).length > 0) profile.content = content;
	if (Object.keys(cognitive).length > 0) profile.cognitive = cognitive;
	return profile;
}

/**
 * Parse an AfA PNP 3.0 document into the `PnpProfile` the item player renders. Returns
 * an empty profile when the input holds none. `parseAfaPnpXml` returns the whole record.
 */
export function parsePnpXml(xml: string | Element): PnpProfile {
	const record = parseAfaPnpXml(xml);
	return record ? pnpProfileFromAfa(record) : {};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findProfile(parent: NhpElement): NhpElement | null {
	for (const child of elementChildren(parent)) {
		if (splitName(child.rawTagName).local === 'access-for-all-pnp') return child;
		const nested = findProfile(child);
		if (nested) return nested;
	}
	return null;
}

/** Prefixes bound to an AfA PNP namespace on the profile or its ancestors. */
function collectAfaPrefixes(root: NhpElement): Set<string> {
	const prefixes = new Set<string>();
	for (let el: NhpElement | null = root; el; el = el.parentNode as NhpElement | null) {
		for (const [name, value] of Object.entries(el.rawAttributes ?? {})) {
			if (name.startsWith('xmlns:') && value.includes('imsafa3p0pnp')) prefixes.add(name.slice(6));
		}
	}
	return prefixes;
}

function elementChildren(parent: NhpElement): NhpElement[] {
	return parent.childNodes.filter((child): child is NhpElement => child.nodeType === 1);
}

function splitName(name: string | undefined): { prefix?: string; local: string } {
	const raw = name ?? '';
	const colon = raw.indexOf(':');
	return colon < 0 ? { local: raw } : { prefix: raw.slice(0, colon), local: raw.slice(colon + 1) };
}

function elementValue(el: NhpElement): unknown {
	const value: Record<string, unknown> = {};
	for (const [name, raw] of Object.entries(el.rawAttributes ?? {})) {
		if (name === 'xmlns' || name.startsWith('xmlns:') || name.startsWith('xsi:')) continue;
		addValue(value, name === 'xml:lang' ? 'language' : splitName(name).local, scalar(raw));
	}
	const children = elementChildren(el);
	for (const child of children) {
		addValue(value, splitName(child.rawTagName).local, elementValue(child));
	}
	if (children.length > 0 || Object.keys(value).length > 0) return value;
	const text = el.text.trim();
	return text ? scalar(text) : {};
}

function addValue(target: Record<string, unknown>, key: string, value: unknown): void {
	if (!(key in target)) {
		target[key] = value;
		return;
	}
	const existing = target[key];
	target[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
}

function scalar(raw: string): string | number | boolean {
	const value = raw.trim();
	if (value === 'true') return true;
	if (value === 'false') return false;
	if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
	return value;
}

function field(value: unknown, key: string): unknown {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)[key]
		: undefined;
}

function isPresent(value: unknown): boolean {
	return value !== undefined && value !== null && value !== false;
}

function finiteNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeLanguageCode(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const languageCode = value.trim();
	if (!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(languageCode)) return undefined;
	return languageCode;
}
