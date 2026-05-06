import { parse as parseHtml } from 'node-html-parser';
import type { HTMLElement as NhpElement } from 'node-html-parser';
import type { CatalogSupportPreference, PnpProfile } from './types.js';

/**
 * Parse a QTI 3.0 <personalNeedsProfile> element (or legacy <pnp> element) into a PnpProfile.
 *
 * Accepts either an XML/HTML string containing the profile element, or a live DOM Element.
 * Unknown child elements are silently ignored for forward-compatibility.
 */
export function parsePnpXml(xml: string | Element): PnpProfile {
	if (typeof xml !== 'string') {
		// Live DOM Element — serialise to string and re-parse via node-html-parser
		return parsePnpXml((xml as Element).outerHTML ?? '');
	}

	const trimmed = xml.trim();
	if (!trimmed) return {};

	// Wrap so node-html-parser treats the outer tag as the root
	const doc = parseHtml(`<root>${trimmed}</root>`, { lowerCaseTagName: true });
	const root = doc.querySelector('personalneedsprofile') ?? doc.querySelector('pnp');
	if (!root) return {};

	return extractProfile(root);
}

function extractProfile(root: NhpElement): PnpProfile {
	const profile: PnpProfile = {};

	// <display>
	const displayEl = findChild(root, ['display']);
	if (displayEl) {
		profile.display = {};

		const colorSchemeEl = findChild(displayEl, ['colorscheme', 'color-scheme']);
		if (colorSchemeEl) {
			const val = (colorSchemeEl.getAttribute('value') ?? colorSchemeEl.text ?? '').trim().toLowerCase();
			if (isColorScheme(val)) profile.display.colorScheme = val;
		}

		const magEl = findChild(displayEl, ['magnification']);
		if (magEl) {
			const val = parseFloat(magEl.getAttribute('value') ?? magEl.text ?? '');
			if (Number.isFinite(val) && val > 0) profile.display.magnification = val;
		}
	}

	// <content>
	const contentEl = findChild(root, ['content']);
	if (contentEl) {
		profile.content = {};

		const glossaryEl = findChild(contentEl, ['glossaryonscreen', 'glossary-on-screen']);
		if (glossaryEl) {
			profile.content.glossaryOnScreen = parseBool(glossaryEl.getAttribute('enabled') ?? glossaryEl.text ?? 'true');
		}

		const kwEl = findChild(contentEl, ['keywordtranslation', 'keyword-translation']);
		if (kwEl) {
			const active = parseBool(kwEl.getAttribute('active') ?? 'true');
			const languageCode = (kwEl.getAttribute('languagecode') ?? kwEl.getAttribute('language-code') ?? kwEl.getAttribute('lang') ?? '').trim();
			if (languageCode) profile.content.keywordTranslation = { active, languageCode };
		}

		const illustratedEl = findChild(contentEl, [
			'illustratedglossary',
			'illustrated-glossary',
			'ext:sbacglossaryillustration',
			'ext:sbac-glossary-illustration',
		]);
		if (illustratedEl) {
			profile.content.illustratedGlossary = parseBool(
				illustratedEl.getAttribute('enabled') ?? illustratedEl.getAttribute('active') ?? illustratedEl.text ?? 'true'
			);
		}

		const catalogSupportMap = [
			['ttsPronunciation', ['ttspronunciation', 'tts-pronunciation']],
			['signingDefinition', ['signingdefinition', 'signing-definition']],
			['brailleText', ['brailletext', 'braille-text']],
			['audioDescription', ['audiodescription', 'audio-description']],
			['extendedDescription', ['extendeddescription', 'extended-description']],
		] as const;
		for (const [key, names] of catalogSupportMap) {
			const el = findChild(contentEl, names);
			if (el) {
				profile.content.catalogSupports ??= {};
				profile.content.catalogSupports[key] = parseCatalogSupportPreference(el);
			}
		}

		for (const el of findChildren(contentEl, ['catalogsupport', 'catalog-support', 'qti-catalog-support'])) {
			const usage = normalizeCatalogUsage(
				el.getAttribute('usage') ?? el.getAttribute('support') ?? el.getAttribute('name') ?? ''
			);
			if (!usage) continue;
			const key = catalogSupportPreferenceKey(usage);
			profile.content.catalogSupports ??= {};
			profile.content.catalogSupports[key] = parseCatalogSupportPreference(el);
		}

		const etEl = findChild(contentEl, ['extendedtime', 'extended-time']);
		if (etEl) {
			const active = parseBool(etEl.getAttribute('active') ?? 'true');
			const rawMultiplier = etEl.getAttribute('multiplier') ?? etEl.text ?? '';
			const multiplier = rawMultiplier.trim().toLowerCase() === 'infinity'
				? Infinity
				: parseFloat(rawMultiplier);
			if (Number.isFinite(multiplier) || multiplier === Infinity) {
				profile.content.extendedTime = { active, multiplier };
			}
		}
	}

	// <cognitive>
	const cogEl = findChild(root, ['cognitive']);
	if (cogEl) {
		profile.cognitive = {};

		const elTool = findChild(cogEl, ['eliminationtool', 'elimination-tool']);
		if (elTool) {
			profile.cognitive.eliminationTool = parseBool(
				elTool.getAttribute('enabled') ?? elTool.getAttribute('active') ?? elTool.text ?? 'true'
			);
		}
	}

	return profile;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findChild(parent: NhpElement, names: readonly string[]): NhpElement | null {
	return findChildren(parent, names)[0] ?? null;
}

function findChildren(parent: NhpElement, names: readonly string[]): NhpElement[] {
	const matches: NhpElement[] = [];
	for (const child of parent.childNodes) {
		if (child.nodeType !== 1) continue; // element nodes only
		const el = child as NhpElement;
		const tag = (el.rawTagName ?? '').toLowerCase();
		if (names.includes(tag)) matches.push(el);
	}
	return matches;
}

function parseBool(value: string): boolean {
	const v = (value ?? '').trim().toLowerCase();
	return v !== 'false' && v !== '0' && v !== 'no';
}

function parseCatalogSupportPreference(el: NhpElement): CatalogSupportPreference {
	const active = parseBool(el.getAttribute('enabled') ?? el.getAttribute('active') ?? el.text ?? 'true');
	const languageCode = normalizeLanguageCode(
		el.getAttribute('languagecode') ?? el.getAttribute('language-code') ?? el.getAttribute('lang') ?? ''
	);
	return languageCode ? { active, languageCode } : active;
}

type ColorScheme = PnpProfile['display'] extends { colorScheme?: infer C } ? Exclude<C, undefined> : never;
const COLOR_SCHEMES = new Set<string>([
	'default',
	'defaultreverse',
	'blackwhite',
	'whiteblack',
	'blackrose',
	'roseblack',
	'yellowblue',
	'blueyellow',
	'mgraydgray',
	'dgraymgray',
	'blackcyan',
	'cyanblack',
	'blackcream',
	'creamblack',
	'whitenav',
	'medgray',
]);
function isColorScheme(v: string): v is ColorScheme {
	return COLOR_SCHEMES.has(v);
}

function normalizeCatalogUsage(value: string): string | null {
	const usage = value.trim().toLowerCase();
	if (!/^[a-z][a-z0-9._-]*$/.test(usage)) return null;
	return usage;
}

function normalizeLanguageCode(value: string): string | undefined {
	const languageCode = value.trim();
	if (!languageCode) return undefined;
	if (!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(languageCode)) return undefined;
	return languageCode;
}

function catalogSupportPreferenceKey(usage: string): string {
	switch (usage) {
		case 'tts-pronunciation':
			return 'ttsPronunciation';
		case 'signing-definition':
			return 'signingDefinition';
		case 'braille-text':
			return 'brailleText';
		case 'audio-description':
			return 'audioDescription';
		case 'extended-description':
			return 'extendedDescription';
		default:
			return usage;
	}
}
