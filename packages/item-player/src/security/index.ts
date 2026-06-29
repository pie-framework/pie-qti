import { sanitizeHtml, sanitizeTextContent, type SanitizeHtmlOptions } from '../core/sanitizer.js';
import { sanitizeResourceUrl, type UrlKind } from '../core/urlPolicy.js';
import { toTrustedHtml, htmlToString } from '../core/trustedTypes.js';
import type { HtmlContent, PlayerSecurityConfig } from '../types/index.js';

export { sanitizeHtml, sanitizeTextContent, type SanitizeHtmlOptions };
export { sanitizeResourceUrl, type UrlKind };
export {
	enforceItemXmlLimits,
	normalizeParsingLimits,
	type NormalizedParsingLimits,
} from '../core/parsingLimits.js';
export { toTrustedHtml, htmlToString };
export { applyInteractionSecurity } from '../extraction/interactionSecurity.js';
export type {
	HtmlContent,
	ParsingLimitsConfig,
	PlayerSecurityConfig,
	TrustedTypesHtml,
	UrlPolicyConfig,
} from '../types/index.js';

export interface SanitizeSharedHtmlOptions {
	sanitizeUrl?: SanitizeHtmlOptions['sanitizeUrl'];
}

export function sanitizeSharedHtml(
	html: string,
	security?: PlayerSecurityConfig,
	options?: SanitizeSharedHtmlOptions
): HtmlContent {
	const sanitized = sanitizeHtml(html, { security, sanitizeUrl: options?.sanitizeUrl });
	return toTrustedHtml(sanitized, security?.trustedTypesPolicyName);
}
