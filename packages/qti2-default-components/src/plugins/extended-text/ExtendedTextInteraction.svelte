<svelte:options customElement="pie-qti-extended-text" />

<script lang="ts">
	import type { ExtendedTextInteractionData } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import RichTextEditor from '../../shared/components/RichTextEditor.svelte';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: ExtendedTextInteractionData | string;
		response?: string | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), typeset, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<ExtendedTextInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	function handleChange(html: string) {
		response = html;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(html);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, html));
		}
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-extended-text-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">No interaction data provided</div>
	{:else}
		<div part="editor">
			<RichTextEditor
			value={parsedResponse || ''}
			editable={!disabled}
			placeholder={parsedInteraction.placeholderText || 'Enter your response...'}
			minHeight={parsedInteraction.expectedLines ? parsedInteraction.expectedLines * 24 : 200}
			{i18n}
			onChange={handleChange}
			/>
		</div>
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-extended-text-interaction {
		display: grid;
		gap: 0.75rem;
	}
</style>
