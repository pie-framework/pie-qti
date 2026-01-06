<script lang="ts">
	import type { Player } from '../core/Player';
	import { htmlToString, toTrustedHtml } from '../core/trustedTypes';
	import type { HtmlContent } from '../types';
	import type { InteractionData } from '../types/interactions';
	import AssociateInteraction from './AssociateInteraction.svelte';
	import { typesetAction } from './actions/typesetAction';
	import ChoiceInteraction from './ChoiceInteraction.svelte';
	import CustomInteraction from './CustomInteraction.svelte';
	import DrawingCanvas from './DrawingCanvas.svelte';
	import EndAttemptInteraction from './EndAttemptInteraction.svelte';
	import FileUpload from './FileUpload.svelte';
	import GapMatchInteraction from './GapMatchInteraction.svelte';
	import GraphicAssociateInteraction from './GraphicAssociateInteraction.svelte';
	import GraphicGapMatchAdapter from './GraphicGapMatchAdapter.svelte';
	import GraphicOrderInteraction from './GraphicOrderInteraction.svelte';
	import HotspotInteraction from './HotspotInteraction.svelte';
	import HottextInteraction from './HottextInteraction.svelte';
	import InlineInteractionRenderer from './InlineInteractionRenderer.svelte';
	import MatchInteraction from './MatchInteraction.svelte';
	import MediaInteraction from './MediaInteraction.svelte';
	import OrderInteraction from './OrderInteraction.svelte';
	import PositionObjectInteraction from './PositionObjectInteraction.svelte';
	import RichTextEditor from './RichTextEditor.svelte';
	import SelectPointInteraction from './SelectPointInteraction.svelte';
	import SliderInteraction from './SliderInteraction.svelte';

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

	// State for AssociateInteraction pairing selection
	let selectedForPairing = $state<string | null>(null);

	function handleSelectionChange(selected: string | null) {
		selectedForPairing = selected;
	}

	// Map of interaction types to their Svelte components
	// This is an internal mapping for rendering Svelte components in ItemBody
	const componentMap: Record<string, any> = {
		choiceInteraction: ChoiceInteraction,
		extendedTextInteraction: RichTextEditor,
		orderInteraction: OrderInteraction,
		matchInteraction: MatchInteraction,
		hotspotInteraction: HotspotInteraction,
		graphicGapMatchInteraction: GraphicGapMatchAdapter,
		associateInteraction: AssociateInteraction,
		gapMatchInteraction: GapMatchInteraction,
		sliderInteraction: SliderInteraction,
		drawingInteraction: DrawingCanvas,
		uploadInteraction: FileUpload,
		customInteraction: CustomInteraction,
		hottextInteraction: HottextInteraction,
		endAttemptInteraction: EndAttemptInteraction,
		graphicOrderInteraction: GraphicOrderInteraction,
		graphicAssociateInteraction: GraphicAssociateInteraction,
		positionObjectInteraction: PositionObjectInteraction,
		selectPointInteraction: SelectPointInteraction,
		mediaInteraction: MediaInteraction,
	};

	// Process interactions using the player's configured extraction registry
	const interactions = $derived<InteractionData[]>(player.getInteractionData());

	const trustedTypesPolicyName = $derived(player.getTrustedTypesPolicyName?.());

	// Get components for block-level interactions only (not inline interactions)
	// Inline interactions (textEntry, inlineChoice) are rendered within the HTML via InlineInteractionRenderer
	const interactionComponents = $derived(
		interactions
			.filter(interaction =>
				interaction.type !== 'textEntryInteraction' &&
				interaction.type !== 'inlineChoiceInteraction'
			)
			.map(interaction => {
				const component = componentMap[interaction.type];
				if (!component) {
					console.warn(`No component found for interaction type: ${interaction.type}`);
					return null;
				}
				return {
					interaction,
					component
				};
			})
			.filter((item): item is NonNullable<typeof item> => item !== null)
	);

	// Get item body HTML and remove interaction elements (they're rendered separately)
	const itemBodyHtml = $derived.by((): HtmlContent => {
		let html = htmlToString(player.getItemBodyHtml());

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

		return toTrustedHtml(html, trustedTypesPolicyName);
	});

	function handleResponseChange(responseId: string, value: any) {
		onResponseChange(responseId, value);
	}
</script>

{#if typeset}
	<div class="qti-item-body" use:typesetAction={{ typeset }}>
		<!-- Item body with inline interactions -->
		<div class="prose max-w-none mb-4">
			<InlineInteractionRenderer
				html={itemBodyHtml}
				{trustedTypesPolicyName}
				{interactions}
				{responses}
				onResponseChange={handleResponseChange}
			/>
		</div>

		<!-- Block interactions rendered dynamically via component registry -->
		{#each interactionComponents as { interaction, component } (interaction.responseId)}
		{@const Component = component}
		{#if interaction.type === 'associateInteraction'}
			<!-- @ts-expect-error - AssociateInteraction requires extra props -->
			<Component
				{interaction}
				response={responses[interaction.responseId] ?? null}
				{disabled}
				{typeset}
				{selectedForPairing}
				onSelectionChange={handleSelectionChange}
				onChange={(value: any) => handleResponseChange(interaction.responseId, value)}
			/>
		{:else}
			<Component
				{interaction}
				response={responses[interaction.responseId] ?? null}
				{disabled}
				{typeset}
				onChange={(value: any) => handleResponseChange(interaction.responseId, value)}
			/>
		{/if}
	{/each}
	</div>
{:else}
	<div class="qti-item-body">
		<!-- Item body with inline interactions -->
		<div class="prose max-w-none mb-4">
			<InlineInteractionRenderer
				html={itemBodyHtml}
				{trustedTypesPolicyName}
				{interactions}
				{responses}
				onResponseChange={handleResponseChange}
			/>
		</div>

		<!-- Block interactions rendered dynamically via component registry -->
		{#each interactionComponents as { interaction, component } (interaction.responseId)}
		{@const Component = component}
		{#if interaction.type === 'associateInteraction'}
			<!-- @ts-expect-error - AssociateInteraction requires extra props -->
			<Component
				{interaction}
				response={responses[interaction.responseId] ?? null}
				{disabled}
				{typeset}
				{selectedForPairing}
				onSelectionChange={handleSelectionChange}
				onChange={(value: any) => handleResponseChange(interaction.responseId, value)}
			/>
		{:else}
			<Component
				{interaction}
				response={responses[interaction.responseId] ?? null}
				{disabled}
				{typeset}
				onChange={(value: any) => handleResponseChange(interaction.responseId, value)}
			/>
		{/if}
	{/each}
	</div>
{/if}
