<svelte:options customElement="pie-qti-extended-text" />

<script lang="ts">
	import type { ExtendedTextInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import RichTextEditor from '../../shared/components/RichTextEditor.svelte';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: ExtendedTextInteractionData | string;
		response?: string | null;
		correctResponse?: string | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), typeset, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<ExtendedTextInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);

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
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
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
		{#if isShowingCorrect && parsedCorrectResponse}
			<div part="correct-answer" class="mt-3 p-3 bg-success bg-opacity-10 border border-success rounded">
				<div class="text-sm font-semibold text-success mb-2">
					{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'} Answer:
				</div>
				<div class="text-sm">{parsedCorrectResponse}</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-extended-text-interaction {
		display: grid;
		gap: 0.75rem;
	}
</style>
