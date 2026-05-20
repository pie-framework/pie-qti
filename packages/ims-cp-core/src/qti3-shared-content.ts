import { parse, type HTMLElement, type Node } from 'node-html-parser';
import {
	isPackageRelativeHref,
	resolveCheckedPackagePathFromFile,
	resolvePackagePathFromFile,
} from './package-path.js';

export interface AssessmentStimulusRef {
	identifier: string;
	href: string;
	title?: string;
}

export interface QtiStylesheetRef {
	href: string;
	type?: string;
	media?: string;
	xml: string;
}

export interface AssessmentStimulusDocument {
	identifier?: string;
	title?: string;
	lang?: string;
	bodyHtml: string;
	stylesheets: QtiStylesheetRef[];
	catalogInfoXml?: string;
	validationMessages: string[];
}

export interface ResolvedQtiStylesheetRef extends QtiStylesheetRef {
	/** Package-relative path resolved against the item or stimulus XML path. */
	resolvedHref: string;
	/** Source scope for precedence and diagnostics. */
	source: 'item' | 'stimulus';
	stimulusIdentifier?: string;
	/** Sanitized stylesheet text when the package stylesheet was readable and safe. */
	cssText?: string;
}

export interface ResolvedQtiCatalogSource {
	scope: 'item' | 'stimulus';
	xml: string;
	baseHref: string;
	stimulusIdentifier?: string;
}

export interface ResolvedAssessmentStimulus {
	identifier: string;
	href: string;
	resolvedHref: string;
	title?: string;
	lang?: string;
	bodyHtml: string;
	stylesheets: ResolvedQtiStylesheetRef[];
	catalogSource?: ResolvedQtiCatalogSource;
	validationMessages: string[];
}

export interface ResolvedItemDeliveryContext {
	itemHref?: string;
	stimuli: Record<string, ResolvedAssessmentStimulus>;
	stylesheets: ResolvedQtiStylesheetRef[];
	catalogSources: ResolvedQtiCatalogSource[];
	validationMessages: string[];
}

export interface ResolveItemDeliveryContextOptions {
	itemXml: string;
	itemHref?: string;
	/**
	 * Read a package-relative text file. The utility stays package-agnostic by
	 * depending on this callback rather than traversing IMS package structures.
	 */
	readText: (path: string) => string | null | undefined;
	/**
	 * Optional package-relative asset URL resolver. When provided, simple HTML
	 * media references in stimulus bodies are rewritten before rendering.
	 */
	resolveAssetUrl?: (path: string) => string | null | undefined;
}

const STIMULUS_REF_TAGS = new Set(['assessmentstimulusref']);
const ASSESSMENT_STIMULUS_TAGS = new Set(['assessmentstimulus']);
const STIMULUS_BODY_TAGS = new Set(['stimulusbody']);
const STYLESHEET_TAGS = new Set(['stylesheet']);
const CATALOG_INFO_TAGS = new Set(['cataloginfo']);

export function extractAssessmentStimulusRefs(itemXml: string): AssessmentStimulusRef[] {
	const refs: AssessmentStimulusRef[] = [];
	for (const el of findElements(parseXml(itemXml), STIMULUS_REF_TAGS)) {
		const identifier = readAttr(el, 'identifier');
		const href = readAttr(el, 'href');
		if (!identifier || !href) continue;
		refs.push({
			identifier,
			href,
			title: readAttr(el, 'title') ?? undefined,
		});
	}
	return refs;
}

export function parseAssessmentStimulusXml(stimulusXml: string): AssessmentStimulusDocument {
	const root = parseXml(stimulusXml);
	const stimulus = findElements(root, ASSESSMENT_STIMULUS_TAGS)[0];
	const validationMessages: string[] = [];

	if (!stimulus) {
		validationMessages.push('Expected one qti-assessment-stimulus root element.');
		return { bodyHtml: '', stylesheets: [], validationMessages };
	}

	const bodyElements = directChildElements(stimulus).filter((child) => STIMULUS_BODY_TAGS.has(normalizeTag(child.tagName)));
	const catalogElements = directChildElements(stimulus).filter((child) => CATALOG_INFO_TAGS.has(normalizeTag(child.tagName)));
	const stylesheets = directChildElements(stimulus)
		.filter((child) => STYLESHEET_TAGS.has(normalizeTag(child.tagName)))
		.map(toStylesheetRef)
		.filter((style): style is QtiStylesheetRef => Boolean(style));

	if (bodyElements.length !== 1) {
		validationMessages.push('Expected exactly one qti-stimulus-body child element.');
	}
	if (catalogElements.length > 1) {
		validationMessages.push('Expected at most one qti-catalog-info child element.');
	}

	validateStimulusChildOrder(stimulus, validationMessages);

	return {
		identifier: readAttr(stimulus, 'identifier') ?? undefined,
		title: readAttr(stimulus, 'title') ?? undefined,
		lang: readAttr(stimulus, 'xml:lang') ?? readAttr(stimulus, 'lang') ?? undefined,
		bodyHtml: bodyElements[0] ? serializeChildren(bodyElements[0]).trim() : '',
		stylesheets,
		catalogInfoXml: catalogElements[0]?.toString(),
		validationMessages,
	};
}

export function extractStimulusBodyHtml(stimulusXml: string): string {
	return parseAssessmentStimulusXml(stimulusXml).bodyHtml;
}

export function createResolvedItemDeliveryContext(
	options: ResolveItemDeliveryContextOptions
): ResolvedItemDeliveryContext {
	const itemHref = options.itemHref ?? '';
	const validationMessages: string[] = [];
	const stimuli: Record<string, ResolvedAssessmentStimulus> = {};
	const catalogSources: ResolvedQtiCatalogSource[] = [];
	const stylesheets: ResolvedQtiStylesheetRef[] = resolveStylesheetRefs(
		extractQtiStylesheets(options.itemXml),
		itemHref,
		'item',
		validationMessages,
		options.readText
	);

	for (const itemCatalogXml of extractCatalogInfoXml(options.itemXml)) {
		catalogSources.push({ scope: 'item', xml: resolveCatalogFileHrefs(itemCatalogXml, itemHref), baseHref: itemHref });
	}

	for (const ref of extractAssessmentStimulusRefs(options.itemXml)) {
		const resolvedHref = resolvePackageHref(itemHref, ref.href, validationMessages, `Stimulus ${ref.identifier}`);
		if (!resolvedHref) continue;
		const stimulusXml = options.readText(resolvedHref);
		if (!stimulusXml) {
			validationMessages.push(`Stimulus file not found: ${resolvedHref}.`);
			continue;
		}

		const parsed = parseAssessmentStimulusXml(stimulusXml);
		const stimulusMessages = parsed.validationMessages.map((message) => `${ref.identifier}: ${message}`);
		validationMessages.push(...stimulusMessages);
		const bodyHtml = options.resolveAssetUrl
			? rewriteHtmlAssetRefs(parsed.bodyHtml, resolvedHref, options.resolveAssetUrl)
			: parsed.bodyHtml;
		const stimulusStylesheets = resolveStylesheetRefs(
			parsed.stylesheets,
			resolvedHref,
			'stimulus',
			validationMessages,
			options.readText,
			ref.identifier
		);
		const catalogSource = parsed.catalogInfoXml
			? {
					scope: 'stimulus' as const,
					xml: resolveCatalogFileHrefs(parsed.catalogInfoXml, resolvedHref),
					baseHref: resolvedHref,
					stimulusIdentifier: ref.identifier,
				}
			: undefined;

		if (catalogSource) {
			catalogSources.push(catalogSource);
		}
		stylesheets.push(...stimulusStylesheets);
		stimuli[ref.identifier] = {
			identifier: ref.identifier,
			href: ref.href,
			resolvedHref,
			title: ref.title ?? parsed.title,
			lang: parsed.lang,
			bodyHtml,
			stylesheets: stimulusStylesheets,
			catalogSource,
			validationMessages: stimulusMessages,
		};
	}

	return {
		itemHref: options.itemHref,
		stimuli,
		stylesheets,
		catalogSources,
		validationMessages,
	};
}

export function extractQtiStylesheets(xml: string): QtiStylesheetRef[] {
	return findElements(parseXml(xml), STYLESHEET_TAGS)
		.map(toStylesheetRef)
		.filter((style): style is QtiStylesheetRef => Boolean(style));
}

export function extractCatalogInfoXml(xml: string): string[] {
	return findElements(parseXml(xml), CATALOG_INFO_TAGS).map((el) => el.toString());
}

export function resolveRelativePath(baseHref: string, relativePath: string): string {
	return resolvePackagePathFromFile(baseHref, relativePath);
}

function resolveCheckedPackagePath(baseHref: string, href: string): string | null {
	if (!isPackageRelativeHref(href)) return null;
	return resolveCheckedPackagePathFromFile(baseHref, href);
}

function resolvePackageHref(
	baseHref: string,
	href: string,
	validationMessages: string[],
	label: string
): string | null {
	if (!isPackageRelativeHref(href)) {
		validationMessages.push(`${label} href is not a package-relative path: ${href}.`);
		return null;
	}
	const resolved = resolveCheckedPackagePath(baseHref, href);
	if (!resolved) {
		validationMessages.push(`${label} href escapes the package root: ${href}.`);
		return null;
	}
	return resolved;
}

function resolveStylesheetRefs(
	stylesheets: QtiStylesheetRef[],
	baseHref: string,
	source: 'item' | 'stimulus',
	validationMessages: string[],
	readText?: ResolveItemDeliveryContextOptions['readText'],
	stimulusIdentifier?: string
): ResolvedQtiStylesheetRef[] {
	const resolved: ResolvedQtiStylesheetRef[] = [];
	for (const style of stylesheets) {
		const resolvedHref = resolvePackageHref(
			baseHref,
			style.href,
			validationMessages,
			`${source === 'item' ? 'Item' : `Stimulus ${stimulusIdentifier ?? ''}`} stylesheet`
		);
		if (!resolvedHref) continue;
		const cssText = readText ? readText(resolvedHref) : undefined;
		const safeCssText = cssText === undefined || cssText === null
			? undefined
			: sanitizeStylesheetCss(cssText, validationMessages, resolvedHref);
		resolved.push({
			...style,
			resolvedHref,
			source,
			stimulusIdentifier,
			...(safeCssText ? { cssText: safeCssText } : {}),
		});
	}
	return resolved;
}

function sanitizeStylesheetCss(css: string, validationMessages: string[], resolvedHref: string): string | null {
	if (!css.trim()) return '';
	const blockedPattern = /@import\b|url\s*\(|<\/style|expression\s*\(|javascript\s*:|vbscript\s*:|data\s*:/i;
	if (blockedPattern.test(css)) {
		validationMessages.push(`Stylesheet blocked by policy: ${resolvedHref}.`);
		return null;
	}
	return css;
}

function rewriteHtmlAssetRefs(
	html: string,
	baseHref: string,
	resolveAssetUrl: NonNullable<ResolveItemDeliveryContextOptions['resolveAssetUrl']>
): string {
	if (!html.trim()) return html;
	const root = parse(`<root>${html}</root>`, {
		comment: false,
		lowerCaseTagName: false,
	});
	const wrapper = root.querySelector('root') ?? root;
	for (const el of findElements(wrapper, new Set(['img', 'audio', 'video', 'source', 'track', 'object', 'embed', 'a']))) {
		for (const attr of ['src', 'href', 'data', 'poster']) {
			const raw = readAttr(el, attr);
			if (!raw || raw.trim().startsWith('#')) continue;
			const resolvedPath = resolveCheckedPackagePath(baseHref, raw);
			if (!resolvedPath) {
				el.removeAttribute(attr);
				continue;
			}
			const resolvedUrl = resolveAssetUrl(resolvedPath);
			if (resolvedUrl) {
				el.setAttribute(attr, resolvedUrl);
			} else {
				el.removeAttribute(attr);
			}
		}
		const srcset = readAttr(el, 'srcset');
		if (srcset) {
			const rewritten = rewriteSrcset(srcset, baseHref, resolveAssetUrl);
			if (rewritten) el.setAttribute('srcset', rewritten);
			else el.removeAttribute('srcset');
		}
	}
	return serializeChildren(wrapper);
}

function rewriteSrcset(
	value: string,
	baseHref: string,
	resolveAssetUrl: NonNullable<ResolveItemDeliveryContextOptions['resolveAssetUrl']>
): string | null {
	const rewritten: string[] = [];
	for (const candidate of value.split(',').map((part) => part.trim()).filter(Boolean)) {
		const [rawUrl, ...descriptors] = candidate.split(/\s+/).filter(Boolean);
		if (!rawUrl) return null;
		const resolvedPath = resolveCheckedPackagePath(baseHref, rawUrl);
		if (!resolvedPath) return null;
		const resolvedUrl = resolveAssetUrl(resolvedPath);
		if (!resolvedUrl) return null;
		rewritten.push([resolvedUrl, ...descriptors].join(' '));
	}
	return rewritten.length > 0 ? rewritten.join(', ') : null;
}

function resolveCatalogFileHrefs(xml: string, baseHref: string): string {
	if (!xml.trim()) return xml;
	const root = parse(`<root>${xml}</root>`, {
		comment: false,
		lowerCaseTagName: false,
	});
	const wrapper = root.querySelector('root') ?? root;
	for (const fileHref of findElements(wrapper, new Set(['filehref']))) {
		const raw = readAttr(fileHref, 'src') ?? fileHref.text?.trim() ?? '';
		const resolvedPath = resolveCheckedPackagePath(baseHref, raw);
		if (resolvedPath) {
			fileHref.setAttribute('src', resolvedPath);
		} else {
			fileHref.removeAttribute('src');
		}
		clearElementContent(fileHref);
	}
	return serializeChildren(wrapper);
}

function clearElementContent(el: HTMLElement): void {
	const mutable = el as HTMLElement & {
		set_content?: (content: string) => void;
		innerHTML?: string;
		textContent?: string;
	};
	if (typeof mutable.set_content === 'function') {
		mutable.set_content('');
		return;
	}
	mutable.innerHTML = '';
	mutable.textContent = '';
}

function parseXml(xml: string): HTMLElement {
	return parse(xml, {
		comment: false,
		lowerCaseTagName: false,
	});
}

function findElements(root: HTMLElement, normalizedTags: Set<string>): HTMLElement[] {
	const matches: HTMLElement[] = [];
	visit(root, (node) => {
		if (normalizedTags.has(normalizeTag(node.tagName))) {
			matches.push(node);
		}
	});
	return matches;
}

function visit(node: Node, callback: (el: HTMLElement) => void): void {
	if (isElement(node)) {
		callback(node);
	}
	for (const child of node.childNodes ?? []) {
		visit(child, callback);
	}
}

function directChildElements(el: HTMLElement): HTMLElement[] {
	return (el.childNodes ?? []).filter(isElement);
}

function isElement(node: Node): node is HTMLElement {
	return typeof (node as HTMLElement).tagName === 'string';
}

function normalizeTag(tagName: string): string {
	return tagName.toLowerCase().replace(/^qti-/, '').replace(/-([a-z])/g, (_match, char: string) => char);
}

function readAttr(el: HTMLElement, name: string): string | null {
	const direct = el.getAttribute(name);
	if (direct !== undefined) return direct;
	const kebabName = name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
	const kebab = el.getAttribute(kebabName);
	return kebab === undefined ? null : kebab;
}

function serializeChildren(el: HTMLElement): string {
	return (el.childNodes ?? []).map((child) => child.toString()).join('');
}

function toStylesheetRef(el: HTMLElement): QtiStylesheetRef | null {
	const href = readAttr(el, 'href');
	if (!href) return null;
	return {
		href,
		type: readAttr(el, 'type') ?? undefined,
		media: readAttr(el, 'media') ?? undefined,
		xml: el.toString(),
	};
}

function validateStimulusChildOrder(stimulus: HTMLElement, validationMessages: string[]): void {
	let seenBody = false;
	let seenCatalog = false;
	for (const child of directChildElements(stimulus)) {
		const tag = normalizeTag(child.tagName);
		if (STYLESHEET_TAGS.has(tag)) {
			if (seenBody || seenCatalog) {
				validationMessages.push('qti-stylesheet must precede qti-stimulus-body and qti-catalog-info.');
			}
			continue;
		}
		if (STIMULUS_BODY_TAGS.has(tag)) {
			if (seenCatalog) {
				validationMessages.push('qti-stimulus-body must precede qti-catalog-info.');
			}
			seenBody = true;
			continue;
		}
		if (CATALOG_INFO_TAGS.has(tag)) {
			seenCatalog = true;
			continue;
		}
		validationMessages.push(`Unexpected qti-assessment-stimulus child element: ${child.tagName}.`);
	}
}
