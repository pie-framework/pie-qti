<svelte:options customElement="pie-qti-custom" />

<script lang="ts">
	import type { CustomInteractionData } from '@pie-qti/item-player';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import type { I18nProvider } from '@pie-qti/i18n';
	import CustomInteractionFallback from '../../shared/components/CustomInteractionFallback.svelte';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
		import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';

	interface Props {
		interaction?: CustomInteractionData | string;
		response?: string | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string | null) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), typeset, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<CustomInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Type assertion for custom interaction data
	const customInteraction = $derived(parsedInteraction as CustomInteractionData | undefined);

	function handleChange(value: string | null) {
		response = value;
		// Call onChange callback if provided (for Svelte component usage)
		emitInteractionChange({ target: rootElement, responseId: customInteraction?.responseId, value: value, onChange });
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class="qti-custom-interaction">
	<InteractionDescription interaction={parsedInteraction} />
	{#if !customInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		<!-- @ts-expect-error - CustomInteractionFallback has stricter prop types -->
		<CustomInteractionFallback
			responseId={customInteraction.responseId}
			prompt={customInteraction.prompt}
			rawAttributes={customInteraction.rawAttributes}
			xml={customInteraction.xml}
			{disabled}
			{i18n}
			value={parsedResponse}
			onChange={handleChange}
			testIdInput={`custom-input-${customInteraction.responseId}`}
		/>
	{/if}
</div>
