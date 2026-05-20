<script lang="ts" module>
	let nextItemBodyScopeId = 0;
</script>

<script lang="ts">
	import type { HtmlContent } from '../types';
	import type { PnpProfile } from '../pnp/types';
	import type { GlossaryPlayer } from '../catalog/applyGlossaryTriggers';
	import type { InteractionResponseValue, QTIChangeEventDetail } from '../web-components';
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { QtiHeuristicsConfig, ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
	import { typesetAction } from './actions/typesetAction';
	import { glossaryAction } from '../catalog/glossaryAction';
	import { assignProps } from '@pie-qti/qti-common';
	import InlineChoice from '../interactions/inline-choice/InlineChoice.svelte';
	import InlineTextEntry from '../interactions/text-entry/InlineTextEntry.svelte';
	import {
		createItemPresentationPlan,
		type ItemPresentationPlayer
	} from '../presentation/itemPresentationPlan';

	type ItemResponseValue = InteractionResponseValue | null;
	type ItemResponseMap = Record<string, ItemResponseValue>;
	type QtiChangeDomEvent = CustomEvent<QTIChangeEventDetail<ItemResponseValue>>;

	interface ItemBodyComponentRegistry {
		getTagName(interaction: ReturnType<ItemPresentationPlayer['getInteractionData']>[number]): string;
		getTagNameForType(type: string): string | null;
	}

	interface ItemBodyPlayer extends GlossaryPlayer {
		getComponentRegistry(): ItemBodyComponentRegistry;
		getInteractionData(): ReturnType<ItemPresentationPlayer['getInteractionData']>;
		getCorrectResponses(): Record<string, any>;
		getItemBodyHtml(): HtmlContent;
		getDeliveryContext(): ResolvedItemDeliveryContext | undefined;
		sanitizeHtmlContent(html: string): string;
		applyPnp(rootEl: HTMLElement): void;
		getPnp(): PnpProfile | undefined;
		onPnpChange?: (listener: () => void) => () => void;
	}

	interface Props {
		player: ItemBodyPlayer;
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
	const itemBodyScope = `qti-item-body-${++nextItemBodyScopeId}`;
	const itemBodyScopeSelector = `[data-qti-item-body-scope="${itemBodyScope}"]`;
	const presentation = $derived.by(() =>
		createItemPresentationPlan({
			player: player as ItemPresentationPlayer,
			responses,
			disabled,
			role,
			outcomeValues,
			heuristicsConfig,
			stimulusContent,
			deliveryContext,
			itemBodyScopeSelector,
			onComponentError: (interaction, error) =>
				console.error(`Failed to get tag name for ${interaction.type}:`, error)
		})
	);

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

<div
	bind:this={rootEl}
	class="qti-item-body"
	data-qti-item-body-scope={itemBodyScope}
	use:typesetAction={{ typeset }}
	use:glossaryAction={{ player }}
>
	<!-- Item body with inline interactions -->
	<div class="prose max-w-none mb-4">
		<div class="inline-interaction-container">
			{#each presentation.inlineSegments as segment}
				{#if segment.type === 'html'}
					{@html segment.content}
				{:else if segment.type === 'textEntry'}
					{@const correctAnswer = (presentation.roleCapabilities.canViewCorrectResponses ? (presentation.correctResponses[segment.interaction.responseId] ?? null) : null) as string | null}
					<InlineTextEntry
						interaction={segment.interaction}
						response={getStringResponse(segment.interaction.responseId)}
						correctAnswer={presentation.roleCapabilities.canViewCorrectResponses ? correctAnswer : null}
						disabled={presentation.effectiveDisabled}
						{i18n}
						onResponseChange={handleResponseChange}
					/>
				{:else if segment.type === 'inlineChoice'}
					{@const correctAnswer = (presentation.roleCapabilities.canViewCorrectResponses ? (presentation.correctResponses[segment.interaction.responseId] ?? null) : null) as string | null}
					<InlineChoice
						interaction={segment.interaction}
						response={getStringResponse(segment.interaction.responseId)}
						correctAnswer={presentation.roleCapabilities.canViewCorrectResponses ? correctAnswer : null}
						disabled={presentation.effectiveDisabled}
						{i18n}
						onResponseChange={handleResponseChange}
					/>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Block interactions rendered dynamically as web components -->
	{#each presentation.blockInteractions as block (block.key)}
		<svelte:element
			this={block.tagName}
			use:setWebComponentProps={{
				i18n,
				typeset,
				interaction: block.interaction,
				response: block.response,
				correctResponse: block.correctResponse,
				pnp: block.pnp,
				eliminationTool: block.eliminationTool,
				disabled: block.disabled,
				// Avoid invalid ARIA role values on custom-element hosts.
				// Components default to candidate when role is omitted.
				role: block.componentRole,
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
