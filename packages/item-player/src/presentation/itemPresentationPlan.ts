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
import { cleanFeedbackText, processFeedbackInline } from '@pie-qti/qti-common';
import { extractShownFeedback, type ShownFeedback } from './feedbackAnnouncement.js';
import { buildScopedStylesheetCss } from '../components/utils/stylesheetRender.js';
import { buildEffectiveStimulusContent, injectStimulusContent } from '../components/utils/stimulusRender.js';
import { isInlineInteractionType } from '../interactions/inline/render-plan.js';
import { textEntryStringIdentifier } from '../interactions/text-entry/response.js';
import type {
	BaseInteractionData,
	InlineChoiceInteractionData,
	TextEntryInteractionData,
} from '../interactions/shared/types.js';
import { hasInteractionSlot, placeInteractionSlots } from './interactionSlots.js';

export { INTERACTION_SLOT_ATTRIBUTE } from './interactionSlots.js';

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
	/** The content's `xml:lang`, when the item declares one. */
	contentLanguage?: string;
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
	/** False drops every feedbackInline and feedbackBlock, as test-level showFeedback="false" requires. */
	showFeedback?: boolean;
	/** True exposes correct responses whatever the role, as test-level showSolution requires. */
	showSolution?: boolean;
	onComponentError?: (interaction: BaseInteractionData, error: unknown) => void;
}

export interface BlockInteractionMount {
	readonly placement: 'block';
	readonly renderer: 'web-component';
	readonly interaction: BaseInteractionData;
	readonly tagName: string;
	readonly key: string;
	/**
	 * The slot this interaction mounts into: the `data-qti-interaction-slot` value of the empty
	 * placeholder at its authored position in the body HTML. Null when the interaction's element
	 * is not in the body; the interaction then renders after the body.
	 */
	readonly slot: string | null;
	readonly response: ItemPresentationResponseValue | null;
	/** Lexical companion value used by extendedTextInteraction stringIdentifier. */
	readonly stringResponse?: ItemPresentationResponseValue | null;
	readonly correctResponse: unknown;
	readonly pnp: PnpProfile | undefined;
	readonly eliminationTool: boolean;
	readonly answerMasking: boolean;
	/** Label the interaction's answer set as an ARIA group for assistive technology (G-13). */
	readonly structuredLabelSupport: boolean;
	readonly disabled: boolean;
	readonly componentRole: 'scorer' | undefined;
}

/** Where an inline interaction sits among the item's inline interactions, in document order. */
export interface InlineInteractionPosition {
	/** 1-based. */
	readonly index: number;
	readonly count: number;
}

interface InlineInteractionMountBase {
	readonly placement: 'inline';
	readonly key: string;
	/** As for {@link BlockInteractionMount.slot}; the slot stays in its sentence. */
	readonly slot: string | null;
	/**
	 * Its position among the item's inline interactions, which names it for assistive
	 * technology ("Blank 2 of 4") when no label is authored. The response identifier never
	 * does: it is author data and can hint at the answer.
	 */
	readonly position: InlineInteractionPosition;
}

export type InlineInteractionMount =
	| (InlineInteractionMountBase & {
			readonly renderer: 'text-entry';
			readonly interaction: TextEntryInteractionData;
			/**
			 * The text the candidate entered, held by the response the interaction's
			 * stringIdentifier names: the field shows it while it is present, so "3.50" is restored
			 * as typed rather than as the numeric response's 3.5.
			 */
			readonly stringResponse?: ItemPresentationResponseValue | null;
	  })
	| (InlineInteractionMountBase & {
			readonly renderer: 'inline-choice';
			readonly interaction: InlineChoiceInteractionData;
	  });

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
	/** The language the item body is written in, for its `lang`; undefined when undeclared. */
	readonly contentLanguage?: string;
	readonly correctResponses: Readonly<Record<string, unknown>>;
	/** Direct assessmentItem rubrics that remain outside the item-body flow. */
	readonly directRubrics: readonly RubricBlock[];
	/**
	 * Ordered, render-neutral body flow: one `html` node holding the whole item body, then every
	 * interaction mount in document order. The body keeps each interaction's authored position as
	 * an empty slot element (`[data-qti-interaction-slot]`); render the body once and mount each
	 * interaction into the slot its `slot` names, which keeps block interactions between the
	 * paragraphs, layout columns and table cells they were authored in and inline interactions in
	 * their sentence. A mount whose `slot` is null renders after the body.
	 */
	readonly flow: readonly ItemPresentationFlowNode[];
	/** Policy-checked CSS is kept out of the HTML/Trusted Types pipeline. */
	readonly scopedCss: string;
	/**
	 * The feedbackInline and feedbackBlock this body shows, read as accessible text in document
	 * order. The plan splices shown feedback into the body and leaves no marker behind, so this is
	 * the one place the shown feedback survives as data — the item body announces it while the
	 * candidate can still hear it (WCAG 4.1.3 Status Messages).
	 */
	readonly shownFeedback: ShownFeedback;
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
	showFeedback = true,
	showSolution = false,
	onComponentError,
}: CreateItemPresentationOptions): ItemPresentation {
	const baseCapabilities = getRoleCapabilities(role);
	const roleCapabilities = showSolution
		? { ...baseCapabilities, canViewCorrectResponses: true }
		: baseCapabilities;
	const effectiveDisabled = disabled || roleCapabilities.isReadOnly;
	const correctResponses = roleCapabilities.canViewCorrectResponses ? source.correctResponses : {};
	const { html, scopedCss, shownFeedback } = buildItemBodyPresentation({
		source,
		role,
		outcomeValues,
		heuristicsConfig,
		itemBodyScopeSelector,
		renderItemBodyRubrics,
		showFeedback,
	});
	const placed = placeInteractionSlots(html, source.interactions, (interaction) =>
		isInlineInteractionType(interaction.type) ? 'inline' : 'block'
	);
	// Slot placement is the last string transform of the body, so sanitation runs once over the
	// composed body, immediately before Trusted Types finalization.
	const sanitized = sanitizeHtml(placed.html, { security: source.security });
	const slots = new Map(
		[...placed.slots].filter(([, slot]) => hasInteractionSlot(sanitized, slot))
	);
	const mounts = createInteractionMounts({
		interactions: source.interactions,
		slots,
		source,
		responses,
		correctResponses,
		roleCapabilities,
		effectiveDisabled,
		onComponentError,
	});

	return freezePresentation({
		capabilities: roleCapabilities,
		disabled: effectiveDisabled,
		...(source.contentLanguage ? { contentLanguage: source.contentLanguage } : {}),
		correctResponses,
		directRubrics: source.directRubrics ?? [],
		flow: [
			{ kind: 'html', html: finalizeItemBodyHtml(sanitized, source.security) },
			...mounts.map((mount): ItemPresentationFlowNode => ({ kind: 'interaction', mount })),
		],
		scopedCss,
		shownFeedback,
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
	showFeedback,
}: {
	source: ItemPresentationSource;
	role: QTIRole;
	outcomeValues: Record<string, unknown>;
	heuristicsConfig: QtiHeuristicsConfig | undefined;
	itemBodyScopeSelector: string;
	renderItemBodyRubrics: boolean;
	showFeedback: boolean;
}): { html: string; scopedCss: string; shownFeedback: ShownFeedback } {
	let html = htmlToString(source.itemBodyHtml);
	const scopedCss = buildScopedStylesheetCss(source.deliveryContext, itemBodyScopeSelector);
	const effectiveStimulusContent = buildEffectiveStimulusContent(
		source.deliveryContext,
		(content) => sanitizeHtml(content, { security: source.security })
	);

	html = injectStimulusContent(html, effectiveStimulusContent);
	html = renderRubricBlocksForRole(html, role, { renderRubrics: renderItemBodyRubrics });

	const heuristics = normalizeHeuristicsConfig(heuristicsConfig);
	// While every feedback element is still in the HTML, read which of them the outcomes show and
	// what they say, with the same text heuristics, so the body can announce it (WCAG 4.1.3) once
	// this presentation renders it.
	const shownFeedback = extractShownFeedback(html, outcomeValues, {
		hideAll: !showFeedback,
		transform: heuristics.feedbackTextFormatting ? (content) => cleanFeedbackText(content) : undefined,
	});
	html = processFeedbackInline(html, {
		outcomeValues,
		applyHeuristics: heuristics.feedbackTextFormatting,
		wrapWithSpan: false,
		hideAll: !showFeedback,
	});

	return { html, scopedCss, shownFeedback };
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

/**
 * One mount per interaction, in document order: slotted interactions in slot order, then any
 * whose element is not in the body, in extraction order.
 */
function createInteractionMounts({
	interactions,
	slots,
	source,
	responses,
	correctResponses,
	roleCapabilities,
	effectiveDisabled,
	onComponentError,
}: {
	interactions: readonly BaseInteractionData[];
	slots: ReadonlyMap<number, string>;
	source: ItemPresentationSource;
	responses: ItemPresentationResponseMap;
	correctResponses: Record<string, unknown>;
	roleCapabilities: RoleCapabilities;
	effectiveDisabled: boolean;
	onComponentError?: (interaction: BaseInteractionData, error: unknown) => void;
}): ItemInteractionMount[] {
	const slotRank = (index: number) => {
		const slot = slots.get(index);
		return slot === undefined ? Number.POSITIVE_INFINITY : Number(slot);
	};
	const order = interactions.map((_, index) => index).sort((a, b) => slotRank(a) - slotRank(b));
	const inlineCount = interactions.filter((interaction) => isInlineInteractionType(interaction.type)).length;
	const usedKeys = new Map<string, number>();
	const uniqueKey = (interaction: BaseInteractionData) => {
		const key = interactionKey(interaction);
		const seen = usedKeys.get(key) ?? 0;
		usedKeys.set(key, seen + 1);
		// Keyed rendering needs distinct keys even for (invalid) duplicate interactions.
		return seen === 0 ? key : `${key}#${seen}`;
	};

	const mounts: ItemInteractionMount[] = [];
	let inlineIndex = 0;
	for (const index of order) {
		const interaction = interactions[index];
		const slot = slots.get(index) ?? null;
		if (isInlineInteractionType(interaction.type)) {
			inlineIndex += 1;
			const inline = {
				placement: 'inline' as const,
				key: uniqueKey(interaction),
				slot,
				position: { index: inlineIndex, count: inlineCount },
			};
			if (interaction.type === 'textEntryInteraction') {
				const textEntry = interaction as TextEntryInteractionData;
				const stringIdentifier = textEntryStringIdentifier(textEntry);
				mounts.push({
					...inline,
					renderer: 'text-entry',
					interaction: textEntry,
					...(stringIdentifier ? { stringResponse: responses[stringIdentifier] ?? null } : {}),
				});
			} else {
				mounts.push({ ...inline, renderer: 'inline-choice', interaction: interaction as InlineChoiceInteractionData });
			}
			continue;
		}
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
				key: uniqueKey(interaction),
				slot,
				response: responses[interaction.responseId] ?? null,
				...(stringIdentifier
					? { stringResponse: responses[stringIdentifier] ?? null }
					: {}),
				correctResponse: roleCapabilities.canViewCorrectResponses
					? (correctResponses[interaction.responseId] ?? null)
					: null,
				pnp: source.pnp,
				eliminationTool: source.pnp?.cognitive?.eliminationTool === true,
				answerMasking: source.pnp?.cognitive?.answerMasking === true,
				structuredLabelSupport: source.pnp?.display?.structuredLabelSupport === true,
				disabled: effectiveDisabled,
				componentRole: roleCapabilities.canViewCorrectResponses ? 'scorer' : undefined,
			};
			mounts.push(block);
		} catch (error) {
			onComponentError?.(interaction, error);
		}
	}
	return mounts;
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
