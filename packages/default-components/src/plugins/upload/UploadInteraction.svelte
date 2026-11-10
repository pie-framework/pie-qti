<svelte:options customElement="pie-qti-upload" />

<script lang="ts">
	import type { UploadInteractionData, QTIFileResponse } from '@pie-qti/item-player';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { htmlToString } from '@pie-qti/item-player/security';
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { ResponseOnlyInteractionProps, TypesetProps } from '../../shared/utils/interactionProps';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import FileUpload from '../../shared/components/FileUpload.svelte';
		import { parseJsonProp, responseProp } from '../../shared/utils/webComponentHelpers';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';

	interface Props extends ResponseOnlyInteractionProps<'uploadInteraction'>, TypesetProps {
		/** Maximum accepted upload size in bytes; use Infinity to disable the cap */
		maxFileSizeBytes?: number;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, maxFileSizeBytes, i18n = $bindable(), typeset, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage); the response is a value
	const parsedInteraction = $derived(parseJsonProp<UploadInteractionData>(interaction));
	const parsedResponse = $derived(responseProp(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	function handleChange(value: QTIFileResponse | null) {
		response = value;
		// Call onChange callback if provided (for Svelte component usage)
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: value, onChange });
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class="qti-upload-interaction" use:typesetAction={{ typeset }}>
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">
			<span>{i18n?.t('common.error', 'Error')}: {i18n?.t('common.errorNoData', 'No interaction data provided')}</span>
		</div>
	{:else}
		<FileUpload
			label={parsedInteraction.prompt
				? htmlToString(parsedInteraction.prompt).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
				: i18n?.t('interactions.upload.label', 'Upload a file')}
			responseId={parsedInteraction.responseId}
			fileTypes={parsedInteraction.fileTypes}
			{maxFileSizeBytes}
			{disabled}
			{i18n}
			value={parsedResponse}
			onChange={handleChange}
		/>
	{/if}
</div>
