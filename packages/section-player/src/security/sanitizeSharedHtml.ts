import { sanitizeSharedHtml as sanitizeItemPlayerSharedHtml } from '@pie-qti/item-player/security';
import type { HtmlContent, PlayerSecurityConfig } from '@pie-qti/item-player';
import type { QtiSectionRuntimeHostContract, QtiSharedHtmlSanitizeContext } from '../contracts/index.js';

export function sanitizeSectionSharedHtml(
	html: string,
	security: PlayerSecurityConfig | undefined,
	context: QtiSharedHtmlSanitizeContext,
	host?: QtiSectionRuntimeHostContract
): HtmlContent {
	const hostResult = host?.sanitizeSharedHtml?.(html, context);
	return sanitizeItemPlayerSharedHtml(hostResult ?? html, security);
}
