import type { UrlPolicyConfig } from '../types/index.js';

export type UrlKind = 'img' | 'media' | 'object' | 'link' | 'any';

const DEFAULT_POLICY: Required<Pick<
	UrlPolicyConfig,
	| 'allowHttps'
	| 'allowHttp'
	| 'allowProtocolRelative'
	| 'allowDataImages'
	| 'allowSvgDataImages'
>> = {
	allowHttps: true,
	allowHttp: false,
	allowProtocolRelative: false,
	allowDataImages: true,
	allowSvgDataImages: false,
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

	if (isDangerousScheme(s)) return null;

	// data: URLs (context-sensitive)
	const dataOk = sanitizeDataUrl(s, kind, p);
	if (dataOk) return dataOk;
	if (s.toLowerCase().trim().startsWith('data:')) return null;

	// Protocol-relative URLs are treated as network loads and blocked by default.
	if (s.startsWith('//')) return p.allowProtocolRelative ? `https:${s}` : null;

	// Relative/absolute-path URLs: allow and optionally resolve.
	if (s.startsWith('/') || s.startsWith('./') || s.startsWith('../')) {
		if (p.assetBaseUrl) {
			try {
				// Strip leading '/' to make URL constructor resolve relative to base path, not origin
				const relativePath = s.startsWith('/') ? s.slice(1) : s;
				return new URL(relativePath, p.assetBaseUrl).toString();
			} catch {
				return null;
			}
		}
		return s;
	}

	// Absolute URLs: allow only http/https (by policy) and optional host allowlist.
	let u: URL;
	try {
		u = new URL(s);
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


