/**
 * HTML Sanitizer for QTI Content
 *
 * Removes dangerous HTML/scripts while preserving safe educational content.
 * Protects against XSS attacks via:
 * - Script tags
 * - Event handlers (onclick, onerror, onload, etc.)
 * - Dangerous protocols (javascript:, data:text/html)
 * - Unsafe iframe/object sources
 */

import { type HTMLElement, parse } from 'node-html-parser';
import { parseSrcsetCandidates } from '@pie-qti/ims-cp-core';
import type { PlayerSecurityConfig, UrlPolicyConfig } from '../types/index.js';
import { normalizeParsingLimits } from './parsingLimits.js';
import { sanitizeResourceUrl, type UrlKind } from './urlPolicy.js';

export interface SanitizeHtmlOptions {
	/**
	 * Security config (URL policy and tag allowances).
	 * Defaults are conservative for same-DOM embedding.
	 */
	security?: PlayerSecurityConfig;
	sanitizeUrl?: (href: string, kind: UrlKind) => string | null;
}

class HtmlLimitExceeded extends Error {
	constructor(message: string) {
		super(message);
	}
}

function policyFromOptions(options?: SanitizeHtmlOptions): UrlPolicyConfig | undefined {
	return options?.security?.urlPolicy;
}

function allowObjectEmbeds(options?: SanitizeHtmlOptions): boolean {
	return options?.security?.allowObjectEmbeds === true;
}

function allowIframes(options?: SanitizeHtmlOptions): boolean {
	return options?.security?.allowIframes === true;
}

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function getOptionalAttr(element: HTMLElement, attrName: string): string {
	const value = element.getAttribute(attrName);
	return value ? ` ${attrName}="${escapeAttr(value)}"` : '';
}

function sanitizeUrlForHtml(value: string, options: SanitizeHtmlOptions | undefined, kind: UrlKind): string | null {
	const policy = policyFromOptions(options);
	const sanitized = sanitizeResourceUrl(value, policy, kind);
	if (!sanitized) return null;

	if (!options?.sanitizeUrl) return sanitized;

	const hostSanitized = options.sanitizeUrl(sanitized, kind);
	if (!hostSanitized) return null;

	return sanitizeResourceUrl(hostSanitized, policy, kind);
}

function sanitizeUrlAttr(value: string, options: SanitizeHtmlOptions | undefined, kind: UrlKind): string {
	return sanitizeUrlForHtml(value, options, kind) ?? '#';
}

function sanitizeSrcset(value: string, options: SanitizeHtmlOptions | undefined): string {
	const out: string[] = [];
	for (const candidate of parseSrcsetCandidates(value)) {
		const sanitized = sanitizeUrlForHtml(candidate.url, options, 'img');
		if (!sanitized) continue;
		out.push([sanitized, candidate.descriptors].filter(Boolean).join(' '));
	}
	return out.join(', ');
}

/**
 * Recursively sanitize an HTML element and its children
 */
function sanitizeElement(
	element: HTMLElement,
	options: SanitizeHtmlOptions | undefined,
	limitsState: { enabled: boolean; nodes: number; maxNodes: number; maxDepth: number },
	depth: number
): void {
	if (limitsState.enabled) {
		if (depth > limitsState.maxDepth) {
			throw new HtmlLimitExceeded(`HTML depth exceeds maxHtmlDepth (${depth} > ${limitsState.maxDepth})`);
		}
		limitsState.nodes++;
		if (limitsState.nodes > limitsState.maxNodes) {
			throw new HtmlLimitExceeded(
				`HTML node count exceeds maxHtmlNodes (${limitsState.nodes} > ${limitsState.maxNodes})`
			);
		}
	}

	const tagName = (element as any).rawTagName?.toLowerCase();

	// Remove script tags entirely
	if (tagName === 'script') {
		element.remove();
		return;
	}

	// Remove high-risk elements by default (same-DOM embedding).
	if (tagName === 'iframe' && !allowIframes(options)) {
		element.remove();
		return;
	}
	if ((tagName === 'object' || tagName === 'embed') && !allowObjectEmbeds(options)) {
			const replacementHtml = getSafeObjectReplacementHtml(element, options);
		if (replacementHtml) {
			element.replaceWith(replacementHtml);
			return;
		}
		element.remove();
		return;
	}
	if (tagName === 'base' || tagName === 'meta' || tagName === 'link' || tagName === 'style' || tagName === 'foreignobject') {
		element.remove();
		return;
	}

	// Remove dangerous event handler attributes (case-insensitive).
	const attrs = element.attributes || {};
	for (const attrName of Object.keys(attrs)) {
		if (attrName.toLowerCase().startsWith('on')) {
			element.removeAttribute(attrName);
		}
	}

	// Sanitize URL attributes
	for (const attrName of Object.keys(attrs)) {
		const lower = attrName.toLowerCase();
		const value = element.getAttribute(attrName);
		if (!value) continue;

		// Block srcdoc everywhere (HTML document string).
		if (lower === 'srcdoc') {
			element.removeAttribute(attrName);
			continue;
		}

		if (lower === 'srcset') {
			const sanitized = sanitizeSrcset(value, options);
			if (!sanitized) element.removeAttribute(attrName);
			else if (sanitized !== value) element.setAttribute(attrName, sanitized);
			continue;
		}

		// URL-bearing attributes (include SVG xlink:href).
		if (
			lower === 'href' ||
			lower === 'xlink:href' ||
			lower === 'src' ||
			lower === 'data' ||
			lower === 'action' ||
			lower === 'formaction' ||
			lower === 'poster'
		) {
			const kind =
				tagName === 'img' ? 'img' :
				tagName === 'audio' || tagName === 'video' || tagName === 'source' ? 'media' :
				tagName === 'object' || tagName === 'embed' ? 'object' :
				tagName === 'a' ? 'link' :
				'any';
			const sanitized = sanitizeUrlAttr(value, options, kind);
			if (sanitized !== value) element.setAttribute(attrName, sanitized);
		}
	}

	// Recursively sanitize children
	const children = element.childNodes.filter((n) => (n as any).rawTagName) as HTMLElement[];
	for (const child of children) {
		sanitizeElement(child, options, limitsState, depth + 1);
	}
}

/**
 * Sanitize HTML string by removing XSS vectors
 *
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(html: string, options?: SanitizeHtmlOptions): string {
	if (!html || typeof html !== 'string') {
		return '';
	}

	try {
		const limits = normalizeParsingLimits(options?.security);
		if (limits.enabled) {
			const TE: typeof TextEncoder | undefined = (globalThis as any).TextEncoder;
			const bytes = TE ? new TE().encode(html).byteLength : html.length * 2;
			if (bytes > limits.maxHtmlBytes) {
				return '';
			}
		}

		// Parse HTML
		const root = parse(html, {
			comment: false, // Remove comments (potential XSS vector)
		});

		// Sanitize all elements
		const elements = root.childNodes.filter((n) => (n as any).rawTagName) as HTMLElement[];
		const limitsState = {
			enabled: limits.enabled,
			nodes: 0,
			maxNodes: limits.maxHtmlNodes,
			maxDepth: limits.maxHtmlDepth,
		};
		for (const element of elements) {
			sanitizeElement(element, options, limitsState, 1);
		}

		// Return sanitized HTML
		return root.toString();
	} catch (error) {
		if (error instanceof HtmlLimitExceeded) {
			return '';
		}
		// If parsing fails, return empty string (safer than returning potentially malicious content)
		console.error('HTML sanitization failed:', error);
		return '';
	}
}

/**
 * Sanitize text content in choice labels, prompts, etc.
 * This is for content that gets serialized to JSON and displayed in UI.
 *
 * @param text - Text content that may contain HTML
 * @returns Sanitized text
 */
export function sanitizeTextContent(text: string, options?: SanitizeHtmlOptions): string {
	if (!text || typeof text !== 'string') {
		return '';
	}

	// If it looks like HTML (contains tags), sanitize it
	if (/<[^>]+>/.test(text)) {
		return sanitizeHtml(text, options);
	}

	// Plain text - return as-is
	return text;
}

function getSafeObjectReplacementHtml(element: HTMLElement, options: SanitizeHtmlOptions | undefined): string | null {
	if ((element as any).rawTagName?.toLowerCase() !== 'object') {
		return null;
	}

	const rawType = element.getAttribute('type')?.trim().toLowerCase() ?? '';
	const rawData = element.getAttribute('data')?.trim() ?? '';
	if (!rawType || !rawData) {
		return null;
	}

	const dimensions = `${getOptionalAttr(element, 'width')}${getOptionalAttr(element, 'height')}`;
	const classes = getOptionalAttr(element, 'class');
	const id = getOptionalAttr(element, 'id');

	if (rawType.startsWith('image/')) {
		const src = sanitizeUrlForHtml(rawData, options, 'img');
		if (!src) {
			return null;
		}
		const alt =
			element.getAttribute('aria-label') ??
			element.getAttribute('title') ??
			element.textContent?.trim() ??
			'';
		return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${dimensions}${classes}${id}>`;
	}

	if (rawType.startsWith('audio/')) {
		const src = sanitizeUrlForHtml(rawData, options, 'media');
		if (!src) {
			return null;
		}
		return `<audio controls${classes}${id}><source src="${escapeAttr(src)}" type="${escapeAttr(rawType)}"></audio>`;
	}

	if (rawType.startsWith('video/')) {
		const src = sanitizeUrlForHtml(rawData, options, 'media');
		if (!src) {
			return null;
		}
		const rawPoster = element.getAttribute('poster')?.trim() ?? '';
		const poster = rawPoster
			? sanitizeUrlForHtml(rawPoster, options, 'img')
			: null;
		const posterAttr = poster ? ` poster="${escapeAttr(poster)}"` : '';
		return `<video controls${dimensions}${classes}${id}${posterAttr}><source src="${escapeAttr(src)}" type="${escapeAttr(rawType)}"></video>`;
	}

	return null;
}
