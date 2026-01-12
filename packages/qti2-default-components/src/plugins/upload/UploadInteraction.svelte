<svelte:options customElement="pie-qti-upload" />

<script lang="ts">
	import type { UploadInteractionData, QTIFileResponse } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import FileUpload from '../../shared/components/FileUpload.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { typesetAction } from '../../shared/actions/typesetAction';

	interface Props {
		interaction?: UploadInteractionData | string;
		response?: QTIFileResponse | string | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: QTIFileResponse | null) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), typeset, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<UploadInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<QTIFileResponse>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	function handleChange(value: QTIFileResponse | null) {
		response = value;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(value);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement && parsedInteraction) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction.responseId, value));
		}
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-upload-interaction" use:typesetAction={{ typeset }}>
	{#if !parsedInteraction}
		<div class="alert alert-error">
			<span>{i18n?.t('common.error', 'Error')}: {i18n?.t('common.errorNoData', 'No interaction data provided')}</span>
		</div>
	{:else}
		<FileUpload
			label={parsedInteraction.prompt || i18n?.t('interactions.upload.label', 'Upload a file')}
			responseId={parsedInteraction.responseId}
			fileTypes={parsedInteraction.fileTypes}
			{disabled}
			{i18n}
			value={parsedResponse}
			onChange={handleChange}
		/>
	{/if}
</div>
