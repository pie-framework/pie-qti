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
	class={['qti-inline-input', correctAnswer !== null ? 'qti-inline-input-correct' : '', inputWidthClass ?? '', extraClasses].filter(Boolean).join(' ')}
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
	<span id={errorId} role="alert" class="qti-text-entry-error">
		{validationError}
	</span>
{/if}

<style>
	.qti-inline-input {
		box-sizing: border-box;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 0.5rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
	}

	.qti-inline-input:focus-visible {
		outline: 2px solid var(--pie-qti-focus, var(--pie-qti-primary, oklch(45% 0.24 277)));
		outline-offset: 2px;
	}

	.qti-inline-input-correct {
		border-color: var(--pie-qti-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 10%, transparent);
	}

	.qti-text-entry-error {
		display: block;
		color: var(--pie-qti-error, oklch(71% 0.194 13.428));
		font-size: 0.75rem;
	}
</style>
