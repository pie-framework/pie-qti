import { decodeXmlAttribute } from '@pie-qti/ims-cp-core';
import type { UrlPolicyConfig } from '../types/index.js';

export type UrlKind = 'img' | 'media' | 'object' | 'link' | 'any';

const DEFAULT_POLICY: Required<Pick<
	UrlPolicyConfig,
	| 'allowHttps'
	| 'allowHttp'
	| 'allowProtocolRelative'
	| 'allowDataImages'
	| 'allowSvgDataImages'
	| 'allowBlobImages'
	| 'allowBlobMedia'
>> = {
	allowHttps: true,
	allowHttp: false,
	allowProtocolRelative: false,
	allowDataImages: true,
	allowSvgDataImages: false,
	allowBlobImages: false,
	allowBlobMedia: false,
};

function normalizePolicy(policy?: UrlPolicyConfig): UrlPolicyConfig & typeof DEFAULT_POLICY {
	return { ...DEFAULT_POLICY, ...(policy ?? {}) };
}

function isDangerousScheme(u: string): boolean {
	const s = u.toLowerCase().trim();
	return s.startsWith('javascript:') || s.startsWith('vbscript:') || s.startsWith('data:text/html');
}

function allowHost(hostname: string, policy: UrlPolicyConfig): boolean {
	const allow = policy.allowedHosts;
	if (!allow || allow.length === 0) return true;
	return allow.includes(hostname);
}

function sanitizeDataUrl(raw: string, kind: UrlKind, policy: UrlPolicyConfig & typeof DEFAULT_POLICY): string | null {
	const s = raw.toLowerCase().trim();
	if (!s.startsWith('data:')) return null;
	if (kind !== 'img') return null;
	if (!policy.allowDataImages) return null;
	if (!s.startsWith('data:image/')) return null;
	if (!policy.allowSvgDataImages && s.startsWith('data:image/svg+xml')) return null;
	return raw.trim();
}

/**
 * Sanitize a URL used for embedding resources (img/audio/video/object/link).
 * Returns null when the URL should be blocked.
 */
export function sanitizeResourceUrl(raw: string, policy?: UrlPolicyConfig, kind: UrlKind = 'any'): string | null {
	const p = normalizePolicy(policy);
	const s = String(raw ?? '').trim();
	if (!s) return null;
	const decoded = decodeXmlAttribute(s);
	const compact = stripUrlControlsAndWhitespace(decoded);
	const safeValue = stripUrlControls(decoded).trim();
	if (!compact || !safeValue) return null;

	if (isDangerousScheme(compact)) return null;

	// data: URLs (context-sensitive)
	const dataOk = sanitizeDataUrl(compact, kind, p);
	if (dataOk) return dataOk;
	if (compact.toLowerCase().startsWith('data:')) return null;

	// Protocol-relative URLs are treated as network loads and blocked by default.
	if (safeValue.startsWith('//')) return p.allowProtocolRelative ? `https:${safeValue}` : null;

	if (compact.toLowerCase().startsWith('blob:')) {
		if (kind === 'img' && p.allowBlobImages) return compact;
		if (kind === 'media' && p.allowBlobMedia) return compact;
		return null;
	}

	const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(compact);
	// Relative/absolute-path URLs: allow and optionally resolve.
	// Bare relative paths (e.g. "images/foo.png" from IMS CP manifests) are treated
	// the same as "./" paths — they have no scheme and are safe to pass through.
	if (safeValue.startsWith('/') || safeValue.startsWith('./') || safeValue.startsWith('../') || !hasScheme) {
		if (p.assetBaseUrl) {
			try {
				// Strip leading '/' to make URL constructor resolve relative to base path, not origin
				const relativePath = safeValue.startsWith('/') ? safeValue.slice(1) : safeValue;
				return new URL(relativePath, p.assetBaseUrl).toString();
			} catch {
				// assetBaseUrl resolution failed; return the raw relative path as-is
				return safeValue;
			}
		}
		return safeValue;
	}

	// Absolute URLs: allow only http/https (by policy) and optional host allowlist.
	let u: URL;
	try {
		u = new URL(compact);
	} catch {
		return null;
	}

	const proto = u.protocol.toLowerCase();
	if (proto === 'https:' && !p.allowHttps) return null;
	if (proto === 'http:' && !p.allowHttp) return null;
	if (proto !== 'https:' && proto !== 'http:') return null;

	if (!allowHost(u.hostname, p)) return null;
	return u.toString();
}

function stripUrlControls(value: string): string {
	return Array.from(value).filter((char) => !isUrlControl(char)).join('');
}

function stripUrlControlsAndWhitespace(value: string): string {
	return Array.from(value).filter((char) => !isUrlControl(char) && !/\s/.test(char)).join('');
}

function isUrlControl(char: string): boolean {
	const code = char.charCodeAt(0);
	return code <= 0x1F || code === 0x7F;
}

