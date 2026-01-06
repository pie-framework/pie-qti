<script lang="ts">
	import type { InteractionData, Player } from '@pie-qti/qti2-item-player';
	import { typesetAction } from '../actions/typesetAction';
	import InlineInteractionRenderer from './InlineInteractionRenderer.svelte';

	interface Props {
		player: Player;
		responses?: Record<string, any>;
		disabled?: boolean;
		typeset?: (element: HTMLElement) => void;
		onResponseChange?: (responseId: string, value: any) => void;
	}

	let {
		player,
		responses = {},
		disabled = false,
		typeset,
		onResponseChange = () => {},
	}: Props = $props();

	// Get the component registry from the player
	const componentRegistry = $derived(player.getComponentRegistry());

	// Process interactions
	const interactions = $derived<InteractionData[]>(player.getInteractionData());

	// Get components for block-level interactions only (not inline interactions)
	// Inline interactions (textEntry, inlineChoice) are rendered within the HTML via InlineInteractionRenderer
	const interactionComponents = $derived(
		interactions
			.filter(
				(interaction) =>
					interaction.type !== 'textEntryInteraction' &&
					interaction.type !== 'inlineChoiceInteraction'
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

	// Get item body HTML and remove interaction elements (they're rendered separately)
	const itemBodyHtml = $derived.by(() => {
		let html = player.getItemBodyHtml();

		// Remove block interactions from HTML
		html = html
			.replace(/<choiceInteraction[\s\S]*?<\/choiceInteraction>/gi, '')
			.replace(
				/<textEntryInteraction[^>]*responseIdentifier="([^"]+)"[^>]*?(?:\/>|><\/textEntryInteraction>)/gi,
				'[TEXTENTRY:$1]'
			)
			.replace(/<extendedTextInteraction[\s\S]*?<\/extendedTextInteraction>/gi, '')
			.replace(
				/<inlineChoiceInteraction[^>]*responseIdentifier="([^"]+)"[^>]*>[\s\S]*?<\/inlineChoiceInteraction>/gi,
				'[INLINECHOICE:$1]'
			)
			.replace(/<orderInteraction[\s\S]*?<\/orderInteraction>/gi, '')
			.replace(/<matchInteraction[\s\S]*?<\/matchInteraction>/gi, '')
			.replace(/<associateInteraction[\s\S]*?<\/associateInteraction>/gi, '')
			.replace(/<gapMatchInteraction[\s\S]*?<\/gapMatchInteraction>/gi, '')
			.replace(/<sliderInteraction[\s\S]*?<\/sliderInteraction>/gi, '')
			.replace(/<hotspotInteraction[\s\S]*?<\/hotspotInteraction>/gi, '')
			.replace(/<graphicGapMatchInteraction[\s\S]*?<\/graphicGapMatchInteraction>/gi, '')
			.replace(/<graphicOrderInteraction[\s\S]*?<\/graphicOrderInteraction>/gi, '')
			.replace(/<graphicAssociateInteraction[\s\S]*?<\/graphicAssociateInteraction>/gi, '')
			.replace(/<positionObjectInteraction[\s\S]*?<\/positionObjectInteraction>/gi, '')
			.replace(/<endAttemptInteraction[\s\S]*?<\/endAttemptInteraction>/gi, '')
			.replace(/<uploadInteraction[\s\S]*?<\/uploadInteraction>/gi, '')
			.replace(/<drawingInteraction[\s\S]*?<\/drawingInteraction>/gi, '')
			.replace(/<mediaInteraction[\s\S]*?<\/mediaInteraction>/gi, '')
			.replace(/<hottextInteraction[\s\S]*?<\/hottextInteraction>/gi, '')
			.replace(/<selectPointInteraction[\s\S]*?<\/selectPointInteraction>/gi, '')
			.replace(/<customInteraction[\s\S]*?<\/customInteraction>/gi, '');

		return html;
	});

	function handleResponseChange(responseId: string, value: any) {
		onResponseChange(responseId, value);
	}

	// Handle qti:change events from web components
	function handleQtiChange(event: CustomEvent) {
		const { responseId, value } = event.detail;
		handleResponseChange(responseId, value);
	}
</script>

<div class="qti-item-body" use:typesetAction={{ typeset }}>
	<!-- Item body with inline interactions -->
	<div class="prose max-w-none mb-4">
		<InlineInteractionRenderer
			html={itemBodyHtml}
			{interactions}
			{responses}
			onResponseChange={handleResponseChange}
		/>
	</div>

	<!-- Block interactions rendered dynamically as web components -->
	{#each interactionComponents as { interaction, tagName } (interaction.responseId)}
		<svelte:element
			this={tagName}
			interaction={JSON.stringify(interaction)}
			response={JSON.stringify(responses[interaction.responseId] ?? null)}
			disabled={disabled ? true : undefined}
			on:qti-change={handleQtiChange}
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
</style>
