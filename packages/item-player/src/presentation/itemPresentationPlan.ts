import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import {
	normalizeHeuristicsConfig,
	type QtiHeuristicsConfig,
} from '@pie-qti/ims-cp-core';
import { parse } from 'node-html-parser';
import type { HTMLElement as ParsedHtmlElement } from 'node-html-parser';
import type { PnpProfile } from '../pnp/types.js';
import { getRoleCapabilities, type RoleCapabilities } from '../core/rolePolicy.js';
import type { InteractionData, HtmlContent, QTIRole } from '../types/index.js';
import { processFeedbackInline } from '../components/utils/feedbackUtils.js';
import { buildScopedStylesheetCss } from '../components/utils/stylesheetRender.js';
import { buildEffectiveStimulusContent, injectStimulusContent } from '../components/utils/stimulusRender.js';
import {
	createInlineRenderPlan,
	isInlineInteractionTagName,
	isInlineInteractionType,
	type InlineRenderSegment,
} from '../interactions/inline/render-plan.js';

export type ItemPresentationResponseValue = unknown;
export type ItemPresentationResponseMap = Record<string, ItemPresentationResponseValue>;

export interface ItemPresentationComponentRegistry {
	getTagName(interaction: InteractionData): string;
}

export interface ItemPresentationPlayer {
	getComponentRegistry(): ItemPresentationComponentRegistry;
	getInteractionData(): InteractionData[];
	getCorrectResponses(): Record<string, unknown>;
	getItemBodyHtml(): HtmlContent;
	getDeliveryContext(): ResolvedItemDeliveryContext | undefined;
	sanitizeHtmlContent(html: string): string;
	getPnp(): PnpProfile | undefined;
}

export interface CreateItemPresentationPlanOptions {
	player: ItemPresentationPlayer;
	responses?: ItemPresentationResponseMap;
	disabled?: boolean;
	role?: QTIRole;
	outcomeValues?: Record<string, unknown>;
	heuristicsConfig?: QtiHeuristicsConfig;
	stimulusContent?: Record<string, string>;
	deliveryContext?: ResolvedItemDeliveryContext;
	itemBodyScopeSelector?: string;
	renderItemBodyRubrics?: boolean;
	onComponentError?: (interaction: InteractionData, error: unknown) => void;
}

export interface BlockInteractionPresentation {
	interaction: InteractionData;
	tagName: string;
	key: string;
	response: ItemPresentationResponseValue | null;
	/** Lexical companion value used by extendedTextInteraction stringIdentifier. */
	stringResponse?: ItemPresentationResponseValue | null;
	correctResponse: unknown;
	pnp: PnpProfile | undefined;
	eliminationTool: boolean;
	disabled: boolean;
	componentRole: 'scorer' | undefined;
}

export interface ItemPresentationPlan {
	roleCapabilities: RoleCapabilities;
	effectiveDisabled: boolean;
	correctResponses: Record<string, unknown>;
	itemBodyHtml: string;
	inlineSegments: InlineRenderSegment[];
	blockInteractions: BlockInteractionPresentation[];
}

export function createItemPresentationPlan({
	player,
	responses = {},
	disabled = false,
	role = 'candidate',
	outcomeValues = {},
	heuristicsConfig,
	stimulusContent = {},
	deliveryContext,
	itemBodyScopeSelector = '[data-qti-item-body-scope]',
	renderItemBodyRubrics = true,
	onComponentError,
}: CreateItemPresentationPlanOptions): ItemPresentationPlan {
	const interactions = player.getInteractionData();
	const roleCapabilities = getRoleCapabilities(role);
	const effectiveDisabled = disabled || roleCapabilities.isReadOnly;
	const correctResponses = roleCapabilities.canViewCorrectResponses ? player.getCorrectResponses() : {};
	const itemBodyHtml = buildItemBodyPresentationHtml({
		player,
		role,
		outcomeValues,
		heuristicsConfig,
		stimulusContent,
		deliveryContext,
		itemBodyScopeSelector,
		renderItemBodyRubrics,
	});

	return {
		roleCapabilities,
		effectiveDisabled,
		correctResponses,
		itemBodyHtml,
		inlineSegments: createInlineRenderPlan(itemBodyHtml, interactions),
		blockInteractions: createBlockInteractionPresentations({
			interactions,
			player,
			responses,
			correctResponses,
			roleCapabilities,
			effectiveDisabled,
			onComponentError,
		}),
	};
}

function buildItemBodyPresentationHtml({
	player,
	role,
	outcomeValues,
	heuristicsConfig,
	stimulusContent,
	deliveryContext,
	itemBodyScopeSelector,
	renderItemBodyRubrics,
}: {
	player: ItemPresentationPlayer;
	role: QTIRole;
	outcomeValues: Record<string, unknown>;
	heuristicsConfig: QtiHeuristicsConfig | undefined;
	stimulusContent: Record<string, string>;
	deliveryContext: ResolvedItemDeliveryContext | undefined;
	itemBodyScopeSelector: string;
	renderItemBodyRubrics: boolean;
}): string {
	let html = String(player.getItemBodyHtml());
	const resolvedDeliveryContext = deliveryContext ?? player.getDeliveryContext();
	const stylesheetCss = buildScopedStylesheetCss(resolvedDeliveryContext, itemBodyScopeSelector);
	const effectiveStimulusContent = buildEffectiveStimulusContent(
		resolvedDeliveryContext,
		stimulusContent,
		(content) => player.sanitizeHtmlContent(content)
	);

	html = injectStimulusContent(html, effectiveStimulusContent);
	if (stylesheetCss) {
		html = `<style data-qti-stylesheets="resolved">${stylesheetCss}</style>${html}`;
	}
	html = renderRubricBlocksForRole(html, role, { renderRubrics: renderItemBodyRubrics });

	const heuristics = normalizeHeuristicsConfig(heuristicsConfig);
	html = processFeedbackInline(html, {
		outcomeValues,
		applyHeuristics: heuristics.feedbackTextFormatting,
		wrapWithSpan: false,
	});

	return hideBlockInteractionMarkup(html);
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
	return html.replace(
		/<(\w+Interaction|qti-[\w-]+-interaction)(\s[^>]*)?>[\s\S]*?<\/\1>/gi,
		(match, tagName) => {
			const lower = tagName.toLowerCase();
			if (isInlineInteractionTagName(lower)) return match;
			return `<span class="qti-hidden-interaction">${match}</span>`;
		}
	);
}

function createBlockInteractionPresentations({
	interactions,
	player,
	responses,
	correctResponses,
	roleCapabilities,
	effectiveDisabled,
	onComponentError,
}: {
	interactions: InteractionData[];
	player: ItemPresentationPlayer;
	responses: ItemPresentationResponseMap;
	correctResponses: Record<string, unknown>;
	roleCapabilities: RoleCapabilities;
	effectiveDisabled: boolean;
	onComponentError?: (interaction: InteractionData, error: unknown) => void;
}): BlockInteractionPresentation[] {
	const componentRegistry = player.getComponentRegistry();
	return interactions
		.filter((interaction) => !isInlineInteractionType(interaction.type))
		.map((interaction) => {
			try {
				const stringIdentifier =
					'stringIdentifier' in interaction && typeof interaction.stringIdentifier === 'string'
						? interaction.stringIdentifier
						: undefined;
				const block: BlockInteractionPresentation = {
					interaction,
					tagName: componentRegistry.getTagName(interaction),
					key: interactionKey(interaction),
					response: responses[interaction.responseId] ?? null,
					...(stringIdentifier
						? { stringResponse: responses[stringIdentifier] ?? null }
						: {}),
					correctResponse: roleCapabilities.canViewCorrectResponses
						? (correctResponses[interaction.responseId] ?? null)
						: null,
					pnp: player.getPnp(),
					eliminationTool: player.getPnp()?.cognitive?.eliminationTool === true,
					disabled: effectiveDisabled,
					componentRole: roleCapabilities.canViewCorrectResponses ? 'scorer' : undefined,
				};
				return block;
			} catch (error) {
				onComponentError?.(interaction, error);
				return null;
			}
		})
		.filter((item): item is BlockInteractionPresentation => item !== null);
}

export function interactionKey(interaction: InteractionData): string {
	const anyInteraction = interaction as any;
	const ids =
		Array.isArray(anyInteraction?.choices) && anyInteraction.choices.length > 0
			? anyInteraction.choices.map((choice: any) => choice?.identifier).filter(Boolean).join(',')
			: '';
	const prompt = typeof anyInteraction?.prompt === 'string' ? anyInteraction.prompt : '';
	return `${interaction.type}|${interaction.responseId}|${ids}|${prompt}`;
}
