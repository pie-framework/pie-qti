import { parse as parseHtml } from 'node-html-parser';
import type { HTMLElement as NhpElement } from 'node-html-parser';
import type { PnpProfile } from './types.js';

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

function findChild(parent: NhpElement, names: string[]): NhpElement | null {
	for (const child of parent.childNodes) {
		if (child.nodeType !== 1) continue; // element nodes only
		const el = child as NhpElement;
		const tag = (el.rawTagName ?? '').toLowerCase();
		if (names.includes(tag)) return el;
	}
	return null;
}

function parseBool(value: string): boolean {
	const v = (value ?? '').trim().toLowerCase();
	return v !== 'false' && v !== '0' && v !== 'no';
}

type ColorScheme = PnpProfile['display'] extends { colorScheme?: infer C } ? Exclude<C, undefined> : never;
const COLOR_SCHEMES = new Set<string>(['default', 'blackwhite', 'whitenav', 'blackcream', 'yellowblue', 'medgray']);
function isColorScheme(v: string): v is ColorScheme {
	return COLOR_SCHEMES.has(v);
}
