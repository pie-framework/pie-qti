/**
 * HTML rendering for host sinks: sanitizing serialized item content into trusted HTML,
 * and resolving rubric blocks and modal feedback for the session's current outcomes.
 */
import { isShownByIdentifier } from '@pie-qti/qti-common';
import { sanitizeHtml } from '../sanitizer.js';
import { toTrustedHtml } from '../trustedTypes.js';
import type { AssessmentItemDocument } from '../../document/AssessmentItemDocument.js';
import type { ContentHandlers } from '../../document/contentPass.js';
import type { HtmlContent, ItemSessionEngineConfig, ModalFeedback, QTIRole, RubricBlock, RubricBlockOptions } from '../../types/index.js';

/** What HTML rendering reads from the session engine. */
export interface HtmlRenderHost {
	readonly itemDocument: AssessmentItemDocument;
	readonly config: ItemSessionEngineConfig;
	readonly role: QTIRole;
}

export function itemBodyHtml(host: HtmlRenderHost, handlers: ContentHandlers): HtmlContent {
	const inner = host.itemDocument.serializeItemBodyChildren(handlers);
	if (!inner) return '';

	return renderHtmlContent(host, inner);
}

/**
 * Extract rubric blocks for the current role.
 *
 * QTI uses `<rubricBlock view="...">` to provide role-specific guidance.
 * We return sanitized HTML for host rendering. `scope: "direct"` rubrics
 * are assessmentItem children; `scope: "itemBody"` rubrics are authored in
 * the rendered item body flow.
 */
export function rubricsOf(host: HtmlRenderHost, handlers: ContentHandlers, options: RubricBlockOptions = {}): RubricBlock[] {
	const role = host.role;
	const rubrics = host.itemDocument.readRubricBlocks(handlers);
	if (rubrics.length === 0) return [];

	const blocks: RubricBlock[] = [];
	for (const rubric of rubrics) {
		const { scope } = rubric;
		if (options.scope && options.scope !== 'all' && scope !== options.scope) continue;

		const view = [...rubric.view];

		// If view is specified, show only when it includes the current role.
		if (view.length > 0 && role && !view.includes(role)) continue;

		const html = renderHtmlContent(host, rubric.content);

		blocks.push({ view, html, scope, use: rubric.use });
	}

	return blocks;
}

export function modalFeedbackOf(host: HtmlRenderHost, handlers: ContentHandlers, outcomes: Record<string, any>): ModalFeedback[] {
	const active: ModalFeedback[] = [];

	for (const feedback of host.itemDocument.readModalFeedback(handlers)) {
		const { identifier, outcomeIdentifier, showHide, title } = feedback;
		const content = renderHtmlContent(host, feedback.content);

		if (isShownByIdentifier(outcomes[outcomeIdentifier], identifier, showHide) && content) {
			active.push({ identifier, outcomeIdentifier, showHide, content, title });
		}
	}
	return active;
}

export function renderHtmlContent(host: HtmlRenderHost, html: string): HtmlContent {
	const sanitized = sanitizeHtml(html, { security: host.config.security });
	return toTrustedHtml(sanitized, host.config.security?.trustedTypesPolicyName);
}
