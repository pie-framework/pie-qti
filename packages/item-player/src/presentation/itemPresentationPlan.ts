import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import {
	normalizeHeuristicsConfig,
	type QtiHeuristicsConfig,
} from '@pie-qti/ims-cp-core';
import { parse } from 'node-html-parser';
import type { HTMLElement as ParsedHtmlElement } from 'node-html-parser';
import type { ComponentRegistry } from '../core/ComponentRegistry.js';
import { sanitizeHtml } from '../core/sanitizer.js';
import { htmlToString, toTrustedHtml } from '../core/trustedTypes.js';
import type { PnpProfile } from '../pnp/types.js';
import { getRoleCapabilities, type RoleCapabilities } from '../core/rolePolicy.js';
import type {
	HtmlContent,
	PlayerSecurityConfig,
	QTIRole,
	RubricBlock,
} from '../types/index.js';
import { processFeedbackInline } from '../components/utils/feedbackUtils.js';
import { buildScopedStylesheetCss } from '../components/utils/stylesheetRender.js';
import { buildEffectiveStimulusContent, injectStimulusContent } from '../components/utils/stimulusRender.js';
import {
	createInlineRenderPlan,
	isInlineInteractionTagName,
	isInlineInteractionType,
} from '../interactions/inline/render-plan.js';
import type {
	BaseInteractionData,
	InlineChoiceInteractionData,
	TextEntryInteractionData,
} from '../interactions/shared/types.js';

export type ItemPresentationResponseValue = unknown;
export type ItemPresentationResponseMap = Record<string, ItemPresentationResponseValue>;

/**
 * Immutable inputs captured from the live item session for one presentation pass.
 *
 * This deliberately contains data rather than a Player-shaped adapter. Presentation
 * cannot reach back into the session midway through a render, and its only live seam
 * is the real component registry used to resolve plugin renderers.
 */
export interface ItemPresentationSource {
	itemBodyHtml: HtmlContent;
	interactions: readonly BaseInteractionData[];
	correctResponses: Record<string, unknown>;
	componentRegistry: ComponentRegistry;
	deliveryContext?: ResolvedItemDeliveryContext;
	pnp?: PnpProfile;
	security?: PlayerSecurityConfig;
	/** Role-filtered, finalized direct rubrics for host placement. */
	directRubrics?: readonly RubricBlock[];
}

export interface CreateItemPresentationOptions {
	source: ItemPresentationSource;
	responses?: ItemPresentationResponseMap;
	disabled?: boolean;
	role?: QTIRole;
	outcomeValues?: Record<string, unknown>;
	heuristicsConfig?: QtiHeuristicsConfig;
	itemBodyScopeSelector?: string;
	renderItemBodyRubrics?: boolean;
	onComponentError?: (interaction: BaseInteractionData, error: unknown) => void;
}

export interface BlockInteractionMount {
	readonly placement: 'block';
	readonly renderer: 'web-component';
	readonly interaction: BaseInteractionData;
	readonly tagName: string;
	readonly key: string;
	readonly response: ItemPresentationResponseValue | null;
	/** Lexical companion value used by extendedTextInteraction stringIdentifier. */
	readonly stringResponse?: ItemPresentationResponseValue | null;
	readonly correctResponse: unknown;
	readonly pnp: PnpProfile | undefined;
	readonly eliminationTool: boolean;
	readonly disabled: boolean;
	readonly componentRole: 'scorer' | undefined;
}

export type InlineInteractionMount =
	| {
			readonly placement: 'inline';
			readonly renderer: 'text-entry';
			readonly interaction: TextEntryInteractionData;
	  }
	| {
			readonly placement: 'inline';
			readonly renderer: 'inline-choice';
			readonly interaction: InlineChoiceInteractionData;
	  };

export type ItemInteractionMount = InlineInteractionMount | BlockInteractionMount;

declare const finalItemBodyHtmlBrand: unique symbol;

/** HTML that has completed every body transform, sanitation, and Trusted Types finalization. */
export type FinalItemBodyHtml = HtmlContent & {
	readonly [finalItemBodyHtmlBrand]: true;
};

export type ItemPresentationFlowNode =
	| { readonly kind: 'html'; readonly html: FinalItemBodyHtml }
	| { readonly kind: 'interaction'; readonly mount: ItemInteractionMount };

export interface ItemPresentation {
	readonly capabilities: RoleCapabilities;
	readonly disabled: boolean;
	readonly correctResponses: Readonly<Record<string, unknown>>;
	/** Direct assessmentItem rubrics that remain outside the item-body flow. */
	readonly directRubrics: readonly RubricBlock[];
	/** Ordered, render-neutral body flow. Block mounts follow the authored body HTML. */
	readonly flow: readonly ItemPresentationFlowNode[];
	/** Policy-checked CSS is kept out of the HTML/Trusted Types pipeline. */
	readonly scopedCss: string;
}

export function createItemPresentation({
	source,
	responses = {},
	disabled = false,
	role = 'candidate',
	outcomeValues = {},
	heuristicsConfig,
	itemBodyScopeSelector = '[data-qti-item-body-scope]',
	renderItemBodyRubrics = true,
	onComponentError,
}: CreateItemPresentationOptions): ItemPresentation {
	const roleCapabilities = getRoleCapabilities(role);
	const effectiveDisabled = disabled || roleCapabilities.isReadOnly;
	const correctResponses = roleCapabilities.canViewCorrectResponses ? source.correctResponses : {};
	const { html, scopedCss } = buildItemBodyPresentation({
		source,
		role,
		outcomeValues,
		heuristicsConfig,
		itemBodyScopeSelector,
		renderItemBodyRubrics,
	});
	const inlineFlow = createInlineRenderPlan(html, source.interactions).map(
		(segment): ItemPresentationFlowNode => {
			if (segment.type === 'html') {
				// Inline planning parses and reserializes the composed body, so sanitation
				// belongs after that final string transform and immediately before TT.
				const sanitized = sanitizeHtml(segment.content, { security: source.security });
				return {
					kind: 'html',
					html: finalizeItemBodyHtml(sanitized, source.security),
				};
			}
			if (segment.type === 'textEntry') {
				return {
					kind: 'interaction',
					mount: {
						placement: 'inline',
						renderer: 'text-entry',
						interaction: segment.interaction,
					},
				};
			}
			return {
				kind: 'interaction',
				mount: {
					placement: 'inline',
					renderer: 'inline-choice',
					interaction: segment.interaction,
				},
			};
		}
	);
	const blockFlow = createBlockInteractionMounts({
		interactions: source.interactions,
		source,
		responses,
		correctResponses,
		roleCapabilities,
		effectiveDisabled,
		onComponentError,
	}).map(
		(mount): ItemPresentationFlowNode => ({
			kind: 'interaction',
			mount,
		})
	);

	return freezePresentation({
		capabilities: roleCapabilities,
		disabled: effectiveDisabled,
		correctResponses,
		directRubrics: source.directRubrics ?? [],
		flow: [...inlineFlow, ...blockFlow],
		scopedCss,
	});
}

function freezePresentation<T>(value: T): T {
	if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;
	Object.freeze(value);
	for (const child of Object.values(value as Record<string, unknown>)) {
		freezePresentation(child);
	}
	return value;
}

function buildItemBodyPresentation({
	source,
	role,
	outcomeValues,
	heuristicsConfig,
	itemBodyScopeSelector,
	renderItemBodyRubrics,
}: {
	source: ItemPresentationSource;
	role: QTIRole;
	outcomeValues: Record<string, unknown>;
	heuristicsConfig: QtiHeuristicsConfig | undefined;
	itemBodyScopeSelector: string;
	renderItemBodyRubrics: boolean;
}): { html: string; scopedCss: string } {
	let html = htmlToString(source.itemBodyHtml);
	const scopedCss = buildScopedStylesheetCss(source.deliveryContext, itemBodyScopeSelector);
	const effectiveStimulusContent = buildEffectiveStimulusContent(
		source.deliveryContext,
		(content) => sanitizeHtml(content, { security: source.security })
	);

	html = injectStimulusContent(html, effectiveStimulusContent);
	html = renderRubricBlocksForRole(html, role, { renderRubrics: renderItemBodyRubrics });

	const heuristics = normalizeHeuristicsConfig(heuristicsConfig);
	html = processFeedbackInline(html, {
		outcomeValues,
		applyHeuristics: heuristics.feedbackTextFormatting,
		wrapWithSpan: false,
	});

	return { html: hideBlockInteractionMarkup(html), scopedCss };
}

function finalizeItemBodyHtml(
	html: string,
	security: PlayerSecurityConfig | undefined
): FinalItemBodyHtml {
	return toTrustedHtml(html, security?.trustedTypesPolicyName) as FinalItemBodyHtml;
}

function renderRubricBlocksForRole(
	html: string,
	role: QTIRole,
	{ renderRubrics }: { renderRubrics: boolean }
): string {
	if (!html || !/rubric-?block/i.test(html)) {
		return html;
	}

	try {
		const root = parse(html, { lowerCaseTagName: false, comment: false });
		renderRubricBlockChildren(root as unknown as ParsedHtmlElement, role, { renderRubrics });
		return root.toString();
	} catch {
		return html;
	}
}

function renderRubricBlockChildren(
	element: ParsedHtmlElement,
	role: QTIRole,
	{ renderRubrics }: { renderRubrics: boolean }
): void {
	const children = [...element.childNodes] as unknown as ParsedHtmlElement[];
	for (const child of children) {
		const tagName = child.rawTagName?.toLowerCase();
		if (
			tagName &&
			isRubricBlockTag(tagName) &&
			(!renderRubrics || !rubricBlockVisibleToRole(child, role))
		) {
			child.remove();
			continue;
		}
		if (child.childNodes?.length) {
			renderRubricBlockChildren(child, role, { renderRubrics });
		}
		if (tagName && isRubricBlockTag(tagName)) {
			child.replaceWith(renderRubricBlockWrapper(child));
		}
	}
}

function isRubricBlockTag(tagName: string): boolean {
	return tagName === 'rubricblock' || tagName === 'qti-rubric-block';
}

function rubricBlockVisibleToRole(element: ParsedHtmlElement, role: QTIRole): boolean {
	const view = element.getAttribute('view')?.trim();
	if (!view) {
		return true;
	}
	return splitRubricView(view).includes(role);
}

function renderRubricBlockWrapper(element: ParsedHtmlElement): string {
	const view = element.getAttribute('view')?.trim();
	const use = element.getAttribute('use')?.trim();
	const attrs = [
		'class="qti-rubric-block"',
		view ? `data-qti-rubric-view="${escapeHtmlAttribute(view)}"` : '',
		use ? `data-qti-rubric-use="${escapeHtmlAttribute(use)}"` : '',
	]
		.filter(Boolean)
		.join(' ');
	return `<div ${attrs}>${serializeHtmlChildren(element)}</div>`;
}

function splitRubricView(view: string): string[] {
	return view.split(/[\s,]+/).filter(Boolean);
}

function serializeHtmlChildren(element: ParsedHtmlElement): string {
	return ([...element.childNodes] as unknown as ParsedHtmlElement[])
		.map((child) => child.toString())
		.join('');
}

function escapeHtmlAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function hideBlockInteractionMarkup(html: string): string {
	// positionObjectStage is hidden as a unit: it owns the background object and wraps its
	// interactions, all of which the component renders. Matching only the interaction inside it
	// would leave the stage's background image visible in the item body as well.
	return html.replace(
		/<(\w+Interaction|qti-[\w-]+-interaction|positionObjectStage|qti-position-object-stage)(\s[^>]*)?>[\s\S]*?<\/\1>/gi,
		(match, tagName) => {
			const lower = tagName.toLowerCase();
			if (isInlineInteractionTagName(lower)) return match;
			return `<span class="qti-hidden-interaction">${match}</span>`;
		}
	);
}

function createBlockInteractionMounts({
	interactions,
	source,
	responses,
	correctResponses,
	roleCapabilities,
	effectiveDisabled,
	onComponentError,
}: {
	interactions: readonly BaseInteractionData[];
	source: ItemPresentationSource;
	responses: ItemPresentationResponseMap;
	correctResponses: Record<string, unknown>;
	roleCapabilities: RoleCapabilities;
	effectiveDisabled: boolean;
	onComponentError?: (interaction: BaseInteractionData, error: unknown) => void;
}): BlockInteractionMount[] {
	return interactions
		.filter((interaction) => !isInlineInteractionType(interaction.type))
		.map((interaction) => {
			try {
				const stringIdentifier =
					'stringIdentifier' in interaction && typeof interaction.stringIdentifier === 'string'
						? interaction.stringIdentifier
						: undefined;
				const block: BlockInteractionMount = {
					placement: 'block',
					renderer: 'web-component',
					interaction,
					tagName: source.componentRegistry.getTagName(interaction),
					key: interactionKey(interaction),
					response: responses[interaction.responseId] ?? null,
					...(stringIdentifier
						? { stringResponse: responses[stringIdentifier] ?? null }
						: {}),
					correctResponse: roleCapabilities.canViewCorrectResponses
						? (correctResponses[interaction.responseId] ?? null)
						: null,
					pnp: source.pnp,
					eliminationTool: source.pnp?.cognitive?.eliminationTool === true,
					disabled: effectiveDisabled,
					componentRole: roleCapabilities.canViewCorrectResponses ? 'scorer' : undefined,
				};
				return block;
			} catch (error) {
				onComponentError?.(interaction, error);
				return null;
			}
		})
		.filter((item): item is BlockInteractionMount => item !== null);
}

export function interactionKey(interaction: BaseInteractionData): string {
	const anyInteraction = interaction as any;
	const ids =
		Array.isArray(anyInteraction?.choices) && anyInteraction.choices.length > 0
			? anyInteraction.choices.map((choice: any) => choice?.identifier).filter(Boolean).join(',')
			: '';
	const prompt = typeof anyInteraction?.prompt === 'string' ? anyInteraction.prompt : '';
	return `${interaction.type}|${interaction.responseId}|${ids}|${prompt}`;
}
