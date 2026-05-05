<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { TextEntryInteractionData } from './types.js';

	interface Props {
		interaction: TextEntryInteractionData;
		response?: string;
		correctAnswer?: string | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		onResponseChange?: (responseId: string, value: string) => void;
	}

	let {
		interaction,
		response = '',
		correctAnswer = null,
		disabled = false,
		i18n,
		onResponseChange = () => {},
	}: Props = $props();

	let validationError = $state<string | null>(null);
	const displayValue = $derived(correctAnswer !== null ? correctAnswer : response);
	const inputWidthClass = $derived((interaction.interactionClasses ?? []).find((className) => className.startsWith('qti-input-width-')));
	const extraClasses = $derived((interaction.interactionClasses ?? []).filter((className) => !className.startsWith('qti-input-width-')).join(' '));
	const errorId = $derived(`${interaction.responseId}-error`);

	function handleInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement | null;
		const value = input?.value ?? '';
		onResponseChange(interaction.responseId, value);
		if (input?.validity.valid) {
			validationError = null;
		}
	}

	function handleInvalid(event: Event) {
		event.preventDefault();
		validationError =
			interaction.patternMaskMessage ??
			i18n?.t('interactions.textEntry.patternError', 'Please match the required format') ??
			'Please match the required format';
	}

	function handleBlur(event: Event) {
		(event.currentTarget as HTMLInputElement | null)?.checkValidity();
	}
</script>

<input
	type="text"
	class={['input input-bordered input-sm inline-input', inputWidthClass ?? '', extraClasses].filter(Boolean).join(' ')}
	class:border-success={correctAnswer !== null}
	class:bg-success={correctAnswer !== null}
	class:bg-opacity-10={correctAnswer !== null}
	style={inputWidthClass ? 'min-width: 100px; display: inline-block; margin: 0 4px;' : `width: ${interaction.expectedLength * 8}px; min-width: 100px; display: inline-block; margin: 0 4px;`}
	placeholder={interaction.placeholderText || '...'}
	pattern={interaction.patternMask || undefined}
	title={interaction.patternMask ? `Format: ${interaction.patternMask}` : undefined}
	data-format={interaction.format || undefined}
	aria-label={`Text entry ${interaction.responseId}${correctAnswer ? '. Correct answer: ' + correctAnswer : ''}`}
	aria-invalid={validationError ? 'true' : undefined}
	aria-describedby={validationError ? errorId : undefined}
	value={displayValue}
	oninput={handleInput}
	oninvalid={handleInvalid}
	onblur={handleBlur}
	{disabled}
/>
{#if validationError}
	<span id={errorId} role="alert" class="qti-text-entry-error text-error text-xs" style="display: block;">
		{validationError}
	</span>
{/if}
