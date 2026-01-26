import type { HtmlContent, TrustedTypesHtml } from '../types/index.js';

type TrustedTypesPolicyLike = {
	createHTML: (input: string) => TrustedTypesHtml;
};

function getTrustedTypesGlobal(): any {
	return (globalThis as any).trustedTypes;
}

const policyCache = new Map<string, TrustedTypesPolicyLike>();

function getOrCreatePolicy(policyName: string): TrustedTypesPolicyLike | null {
	const existing = policyCache.get(policyName);
	if (existing) return existing;

	const tt = getTrustedTypesGlobal();
	if (!tt?.createPolicy) return null;

	try {
		const policy = tt.createPolicy(policyName, {
			createHTML: (s: string) => s,
		});
		// Policy may be blocked/throw depending on CSP allowlist.
		if (!policy?.createHTML) return null;
		policyCache.set(policyName, policy as TrustedTypesPolicyLike);
		return policy as TrustedTypesPolicyLike;
	} catch {
		return null;
	}
}

/**
 * Convert a sanitized HTML string into a Trusted Types HTML value when:
 * - the host configured a policy name, and
 * - the browser supports Trusted Types, and
 * - CSP allows creating/using that policy.
 *
 * Otherwise returns the original string.
 */
export function toTrustedHtml(html: string, policyName?: string): HtmlContent {
	if (!policyName) return html;
	if (!html) return '';

	const policy = getOrCreatePolicy(policyName);
	if (!policy) return html;

	try {
		return policy.createHTML(html);
	} catch {
		return html;
	}
}

/**
 * Normalize HtmlContent back to a string.
 * Useful when you need to perform string operations (replace/substr/etc) before re-wrapping.
 */
export function htmlToString(html: HtmlContent): string {
	return typeof html === 'string' ? html : String(html as any);
}


