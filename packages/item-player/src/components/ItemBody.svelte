<script lang="ts">
	import type { InteractionData } from '../types';
	import type { Player } from '../core/Player';
	import type { InteractionResponseValue, QTIChangeEventDetail } from '../web-components';
	import type { I18nProvider } from '@pie-qti/i18n';
	import {
		normalizeHeuristicsConfig,
		type QtiHeuristicsConfig,
		type ResolvedItemDeliveryContext
	} from '@pie-qti/ims-cp-core';
	import { processFeedbackInline } from './utils/feedbackUtils';
	import { typesetAction } from './actions/typesetAction';
	import { glossaryAction } from '../catalog/glossaryAction';
	import { assignProps } from './utils/assignProps';
	import { buildEffectiveStimulusContent, injectStimulusContent } from './utils/stimulusRender';
	import { getRoleCapabilities } from '../core/rolePolicy';
	import InlineChoice from '../interactions/inline-choice/InlineChoice.svelte';
	import InlineTextEntry from '../interactions/text-entry/InlineTextEntry.svelte';
	import { createInlineRenderPlan, isInlineInteractionTagName, isInlineInteractionType } from '../interactions/inline/render-plan';

	type ItemResponseValue = InteractionResponseValue | null;
	type ItemResponseMap = Record<string, ItemResponseValue>;
	type QtiChangeDomEvent = CustomEvent<QTIChangeEventDetail<ItemResponseValue>>;

	interface Props {
		player: Player;
		responses?: ItemResponseMap;
		disabled?: boolean;
		role?: 'candidate' | 'scorer' | 'author' | 'tutor' | 'proctor' | 'testConstructor';
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onResponseChange?: (responseId: string, value: ItemResponseValue) => void;
		outcomeValues?: Record<string, any>; // Needed for feedbackInline visibility
		heuristicsConfig?: QtiHeuristicsConfig; // Optional heuristics configuration
		/** QTI 3.0 shared stimulus content: map of stimulus identifier → HTML string */
		stimulusContent?: Record<string, string>;
		/** Package/assessment-resolved QTI 3 delivery context. */
		deliveryContext?: ResolvedItemDeliveryContext;
	}

	let {
		player,
		responses = {},
		disabled = false,
		role = 'candidate',
		i18n,
		typeset,
		onResponseChange = () => {},
		outcomeValues = {},
		heuristicsConfig,
		stimulusContent = {},
		deliveryContext,
	}: Props = $props();

	// Normalize heuristics configuration with defaults
	const heuristics = $derived(normalizeHeuristicsConfig(heuristicsConfig));

	// Get the component registry from the player
	const componentRegistry = $derived(player.getComponentRegistry());
	const roleCapabilities = $derived(getRoleCapabilities(role));
	const effectiveDisabled = $derived(disabled || roleCapabilities.isReadOnly);

	// Process interactions
	const interactions = $derived<InteractionData[]>(player.getInteractionData());

	// Get correct responses for roles allowed by policy.
	const correctResponses = $derived.by(() => {
		return roleCapabilities.canViewCorrectResponses ? player.getCorrectResponses() : {};
	});

	// Get components for block-level interactions only (not inline interactions).
	// Type is always normalized to QTI 2.x camelCase by Player (qti-text-entry-interaction → textEntryInteraction).
	const interactionComponents = $derived(
		interactions
			.filter(
				(interaction) =>
					!isInlineInteractionType(interaction.type)
			)
			.map((interaction) => {
				try {
					// Get the web component tag name from the registry
					const tagName = componentRegistry.getTagName(interaction);
					return {
						interaction,
						tagName,
					};
				} catch (error) {
					console.error(`Failed to get tag name for ${interaction.type}:`, error);
					return null;
				}
			})
			.filter((item): item is NonNullable<typeof item> => item !== null)
	);

	// Get item body HTML and process interactions
	// Block interactions are kept in HTML but wrapped with a hidden marker (see styles below)
	// Inline interactions are replaced with placeholders
	const itemBodyHtml = $derived.by(() => {
		let html = player.getItemBodyHtml();
		const resolvedDeliveryContext = deliveryContext ?? player.getDeliveryContext();
		const effectiveStimulusContent = buildEffectiveStimulusContent(
			resolvedDeliveryContext,
			stimulusContent,
			(content) => player.sanitizeHtmlContent(content)
		);

		html = injectStimulusContent(html, effectiveStimulusContent);

		// Process feedbackInline elements - conditionally show/hide based on outcome values
		html = processFeedbackInline(html, {
			outcomeValues,
			applyHeuristics: heuristics.feedbackTextFormatting,
			wrapWithSpan: false
		});

		// Wrap all block-level interaction elements with a hidden marker.
		// Matches both QTI 2.x camelCase (*Interaction) and QTI 3.0 kebab-case (qti-*-interaction).
		html = html.replace(
			/<(\w+Interaction|qti-[\w-]+-interaction)(\s[^>]*)?>[\s\S]*?<\/\1>/gi,
			(match, tagName) => {
				const lower = tagName.toLowerCase();
				// Inline interactions are rendered in-flow by the inline render plan.
				if (isInlineInteractionTagName(lower)) {
					return match;
				}
				// Wrap block interactions with a hidden span
				return `<span class="qti-hidden-interaction">${match}</span>`;
			}
		);

		return html;
	});

	const inlineSegments = $derived(createInlineRenderPlan(itemBodyHtml, interactions));

	function getStringResponse(responseId: string): string {
		const response = responses[responseId];
		return typeof response === 'string' ? response : '';
	}

	function handleResponseChange(responseId: string, value: ItemResponseValue) {
		onResponseChange(responseId, value);
	}

	// Handle qti:change events from web components
	function handleQtiChange(event: QtiChangeDomEvent) {
		const { responseId, value } = event.detail;
		handleResponseChange(responseId, value);
	}

	// In runes mode, prefer explicit DOM listener wiring to avoid edge cases with
	// custom events bubbling out of shadow DOM (and to keep typing sane for dynamic elements).
	let rootEl: HTMLDivElement | null = $state(null);
	$effect(() => {
		if (!rootEl) return;
		player.applyPnp(rootEl);
		const handler = (e: Event) => handleQtiChange(e as QtiChangeDomEvent);
		const el = rootEl; // Capture reference for cleanup
		el.addEventListener('qti-change', handler as EventListener);
		return () => {
			el.removeEventListener('qti-change', handler as EventListener);
		};
	});

	// Ensure web-component instances are not accidentally reused across items when
	// different items share the same responseId (common in QTI demos: "RESPONSE").
	function interactionKey(interaction: InteractionData): string {
		const anyInteraction = interaction as any;
		const ids =
			Array.isArray(anyInteraction?.choices) && anyInteraction.choices.length > 0
				? anyInteraction.choices.map((c: any) => c?.identifier).filter(Boolean).join(',')
				: '';
		// Include prompt if present to further reduce accidental reuse.
		const prompt = typeof anyInteraction?.prompt === 'string' ? anyInteraction.prompt : '';
		return `${interaction.type}|${interaction.responseId}|${ids}|${prompt}`;
	}

	// Action to set typeset and i18n on web components when they mount
	function setWebComponentProps(
		node: HTMLElement,
		params: {
			i18n?: I18nProvider;
			typeset?: (el: HTMLElement) => void;
			[key: string]: unknown;
		}
	) {
		// Use microtask to ensure custom element is fully initialized
		queueMicrotask(() => {
			if (!node) return;
			assignProps(node, params);
		});

		return {
			update(
				newParams: {
					i18n?: I18nProvider;
					typeset?: (el: HTMLElement) => void;
					[key: string]: unknown;
				}
			) {
				assignProps(node, newParams);
			},
			destroy() {}
		};
	}
</script>

<div bind:this={rootEl} class="qti-item-body" use:typesetAction={{ typeset }} use:glossaryAction={{ player }}>
	<!-- Item body with inline interactions -->
	<div class="prose max-w-none mb-4">
		<div class="inline-interaction-container">
			{#each inlineSegments as segment}
				{#if segment.type === 'html'}
					{@html segment.content}
				{:else if segment.type === 'textEntry'}
					{@const correctAnswer = roleCapabilities.canViewCorrectResponses ? (correctResponses[segment.interaction.responseId] ?? null) : null}
					<InlineTextEntry
						interaction={segment.interaction}
						response={getStringResponse(segment.interaction.responseId)}
						correctAnswer={roleCapabilities.canViewCorrectResponses ? correctAnswer : null}
						disabled={effectiveDisabled}
						{i18n}
						onResponseChange={handleResponseChange}
					/>
				{:else if segment.type === 'inlineChoice'}
					{@const correctAnswer = roleCapabilities.canViewCorrectResponses ? (correctResponses[segment.interaction.responseId] ?? null) : null}
					<InlineChoice
						interaction={segment.interaction}
						response={getStringResponse(segment.interaction.responseId)}
						correctAnswer={roleCapabilities.canViewCorrectResponses ? correctAnswer : null}
						disabled={effectiveDisabled}
						{i18n}
						onResponseChange={handleResponseChange}
					/>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Block interactions rendered dynamically as web components -->
	{#each interactionComponents as { interaction, tagName } (interactionKey(interaction))}
		{@const correctRespForInteraction = correctResponses[interaction.responseId] ?? null}
		<svelte:element
			this={tagName}
			use:setWebComponentProps={{
				i18n,
				typeset,
				interaction,
				response: responses[interaction.responseId] ?? null,
				correctResponse: roleCapabilities.canViewCorrectResponses ? correctRespForInteraction : null,
				pnp: player.getPnp(),
				eliminationTool: player.getPnp()?.cognitive?.eliminationTool === true,
				disabled: effectiveDisabled,
				// Avoid invalid ARIA role values on custom-element hosts.
				// Components default to candidate when role is omitted.
				role: roleCapabilities.canViewCorrectResponses ? 'scorer' : undefined,
			}}
		/>
	{/each}
</div>

<style>
	/* Allow the whole item body to shrink inside flex/grid layouts (prevents overflow). */
	.qti-item-body {
		max-width: 100%;
		min-width: 0;
	}

	/*
	 * Custom elements default to inline; force them to be block-level and width-contained.
	 * This prevents wide interactions (SVGs, tables, canvases) from spilling outside panels.
	 */
	:global(.qti-item-body :is(
		pie-qti-choice,
		pie-qti-slider,
		pie-qti-order,
		pie-qti-match,
		pie-qti-associate,
		pie-qti-gap-match,
		pie-qti-hotspot,
		pie-qti-hottext,
		pie-qti-media,
		pie-qti-custom,
		pie-qti-end-attempt,
		pie-qti-position-object,
		pie-qti-graphic-gap-match,
		pie-qti-graphic-order,
		pie-qti-graphic-associate,
		pie-qti-select-point,
		pie-qti-extended-text
	)) {
		display: block;
		max-width: 100%;
		min-width: 0;
	}

	/* Keep inline interactions from breaking paragraph flow */
	.inline-interaction-container :global(p) {
		display: inline;
	}

	/*
	 * Hide all QTI interaction elements wrapped with qti-hidden-interaction.
	 * These are rendered separately as web components above.
	 * Keeping them in the HTML (but hidden) makes debugging easier and is fully extensible.
	 * Any *Interaction element will be automatically wrapped and hidden - no hardcoded list needed!
	 */
	:global(.qti-item-body .qti-hidden-interaction) {
		display: none !important;
	}

	/*
	 * Style for inline feedback elements that appear within choice text or other content.
	 * Provides visual distinction and spacing for feedback that appears inline with content.
	 */
	:global(.qti-feedback-inline) {
		display: inline-block;
		margin-left: 0.5rem;
		padding-left: 0.5rem;
		border-left: 2px solid var(--color-base-content, currentColor);
		opacity: 0.8;
	}

	/* QTI 3.0 Shared Stimulus: stimulus blocks that were prepended before the item body */
	:global(.qti-stimulus-block) {
		margin-bottom: 1rem;
	}

	/* QTI 3.0 Shared Vocabulary: qti-input-width-N sets minimum input width in character units. */
	:global(.qti-input-width-1)  { min-width: 1ch; }
	:global(.qti-input-width-2)  { min-width: 2ch; }
	:global(.qti-input-width-3)  { min-width: 3ch; }
	:global(.qti-input-width-4)  { min-width: 4ch; }
	:global(.qti-input-width-5)  { min-width: 5ch; }
	:global(.qti-input-width-6)  { min-width: 6ch; }
	:global(.qti-input-width-10) { min-width: 10ch; }
	:global(.qti-input-width-15) { min-width: 15ch; }
	:global(.qti-input-width-20) { min-width: 20ch; }
	:global(.qti-input-width-25) { min-width: 25ch; }
	:global(.qti-input-width-30) { min-width: 30ch; }
	:global(.qti-input-width-35) { min-width: 35ch; }
	:global(.qti-input-width-40) { min-width: 40ch; }
	:global(.qti-input-width-45) { min-width: 45ch; }
	:global(.qti-input-width-50) { min-width: 50ch; }
	:global(.qti-input-width-72) { min-width: 72ch; }
</style>
