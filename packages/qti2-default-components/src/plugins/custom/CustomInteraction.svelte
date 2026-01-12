<svelte:options customElement="pie-qti-custom" />

<script lang="ts">
	import type { CustomInteractionData, InteractionData } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import CustomInteractionFallback from '../../shared/components/CustomInteractionFallback.svelte';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';

	interface Props {
		interaction?: InteractionData | string;
		response?: string | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string | null) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), typeset, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<InteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Type assertion for custom interaction data
	const customInteraction = $derived(parsedInteraction as CustomInteractionData | undefined);

	function handleChange(value: string | null) {
		response = value;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(value);
		// Dispatch custom event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(customInteraction?.responseId, value));
		}
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-custom-interaction">
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
			value={parsedResponse}
			onChange={handleChange}
			testIdInput={`custom-input-${customInteraction.responseId}`}
		/>
	{/if}
</div>
