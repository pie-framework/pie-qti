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
import type { PlayerSecurityConfig, UrlPolicyConfig } from '../types/index.js';
import { normalizeParsingLimits } from './parsingLimits.js';
import { sanitizeResourceUrl } from './urlPolicy.js';

export interface SanitizeHtmlOptions {
	/**
	 * Security config (URL policy and tag allowances).
	 * Defaults are conservative for same-DOM embedding.
	 */
	security?: PlayerSecurityConfig;
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

function sanitizeUrlAttr(value: string, policy: UrlPolicyConfig | undefined, kind: 'img' | 'media' | 'object' | 'link' | 'any'): string {
	return sanitizeResourceUrl(value, policy, kind) ?? '#';
}

function sanitizeSrcset(value: string, policy: UrlPolicyConfig | undefined): string {
	// srcset grammar is complex; we implement a conservative filter:
	// split by commas into candidate strings; sanitize the URL portion of each candidate.
	const parts = value
		.split(',')
		.map((p) => p.trim())
		.filter(Boolean);
	const out: string[] = [];
	for (const part of parts) {
		// URL is the first token; the rest are descriptors (e.g., 1x, 320w).
		const tokens = part.split(/\s+/).filter(Boolean);
		if (tokens.length === 0) continue;
		const url = tokens[0]!;
		const sanitized = sanitizeResourceUrl(url, policy, 'img');
		if (!sanitized) continue;
		out.push([sanitized, ...tokens.slice(1)].join(' '));
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
	const policy = policyFromOptions(options);
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
			const sanitized = sanitizeSrcset(value, policy);
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
			const sanitized = sanitizeUrlAttr(value, policy, kind);
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
