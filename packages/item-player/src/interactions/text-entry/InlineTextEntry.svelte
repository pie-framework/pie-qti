<script lang="ts">
	import { joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import { xsdPatternSource } from '@pie-qti/qti-processing';
	import type { InlineInteractionPosition } from '../../presentation/itemPresentationPlan.js';
	import { inlineInteractionLabel, textEntryPatternMessage } from '../inline/accessibleName.js';
	import { textEntryInputStyle } from './inlineInputStyle.js';
	import { textEntryInputMode } from './inputMode.js';
	import type { TextEntryInteractionData } from '../shared/types.js';

	interface Props {
		interaction: TextEntryInteractionData;
		/** Its place among the item's inline interactions, which names it when no label is authored. */
		position: InlineInteractionPosition;
		/** The id of the sentence or paragraph the blank sits in, which describes it. */
		contextId?: string;
		response?: string;
		/**
		 * The text the candidate entered, held by the response the interaction's stringIdentifier
		 * names. Shown while present, so a restored "3.50" reads as typed, not as the numeric 3.5.
		 */
		stringResponse?: unknown;
		correctAnswer?: string | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		onResponseChange?: (responseId: string, value: string) => void;
	}

	let {
		interaction,
		position,
		contextId,
		response = '',
		stringResponse = null,
		correctAnswer = null,
		disabled = false,
		i18n,
		onResponseChange = () => {},
	}: Props = $props();

	// Ids are per instance: two items on one page commonly share a response identifier.
	const uid = $props.id();
	const errorId = `${uid}-error`;
	const descriptionId = `${uid}-description`;

	let invalid = $state(false);
	const validationError = $derived(invalid ? textEntryPatternMessage(i18n, interaction) : null);
	// stringIdentifier: the captured text is what the candidate typed; else the response itself.
	const enteredText = $derived(
		interaction.stringIdentifier && typeof stringResponse === 'string' && stringResponse.length > 0
			? stringResponse
			: response,
	);
	const displayValue = $derived(correctAnswer !== null ? correctAnswer : enteredText);
	const label = $derived(inlineInteractionLabel(i18n, interaction, position));
	const inputMode = $derived(textEntryInputMode(interaction));
	const inputWidthClass = $derived((interaction.interactionClasses ?? []).find((className) => className.startsWith('qti-input-width-')));
	const extraClasses = $derived((interaction.interactionClasses ?? []).filter((className) => !className.startsWith('qti-input-width-')).join(' '));
	const inputStyle = $derived(textEntryInputStyle(interaction, inputWidthClass ? { widthClass: inputWidthClass } : undefined));
	const describedBy = $derived(
		[interaction.accessibility?.description ? descriptionId : '', contextId ?? '', validationError ? errorId : '']
			.filter(Boolean)
			.join(' ') || undefined,
	);

	function handleInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement | null;
		const value = input?.value ?? '';
		onResponseChange(interaction.responseId, value);
		if (input?.validity.valid) {
			invalid = false;
		}
	}

	function handleInvalid(event: Event) {
		event.preventDefault();
		invalid = true;
	}

	function handleBlur(event: Event) {
		(event.currentTarget as HTMLInputElement | null)?.checkValidity();
	}
</script>

<!--
	Spelling, capitalization and autocomplete help would answer spelling and vocabulary items for
	the candidate, so the browser offers none. A numeric keyboard is only requested when the
	authored patternMask proves the answer cannot be negative: phone number pads have no minus key.
-->
<input
	type="text"
	class={['qti-inline-input', correctAnswer !== null ? 'qti-inline-input-correct' : '', inputWidthClass ?? '', extraClasses].filter(Boolean).join(' ')}
	style={inputStyle}
	placeholder={interaction.placeholderText || translate(i18n, 'interactions.inline.placeholder', '...')}
	pattern={interaction.patternMask ? xsdPatternSource(interaction.patternMask) : undefined}
	data-format={interaction.format || undefined}
	inputmode={inputMode}
	spellcheck="false"
	autocorrect="off"
	autocapitalize="off"
	autocomplete="off"
	dir="auto"
	aria-label={correctAnswer
		? joinSentences(
				translate(i18n, 'accessibility.sentence', '{text}.', { text: label }),
				translate(i18n, 'accessibility.correctAnswerIs', 'Correct answer: {answer}.', { answer: correctAnswer }),
			)
		: label}
	aria-invalid={validationError ? 'true' : undefined}
	aria-describedby={describedBy}
	value={displayValue}
	oninput={handleInput}
	oninvalid={handleInvalid}
	onblur={handleBlur}
	{disabled}
/>
{#if interaction.accessibility?.description}
	<span id={descriptionId} hidden>{interaction.accessibility.description}</span>
{/if}
{#if validationError}
	<span id={errorId} role="alert" class="qti-text-entry-error">
		{validationError}
	</span>
{/if}

<style>
	.qti-inline-input {
		box-sizing: border-box;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
	}

	.qti-inline-input:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.qti-inline-input-correct {
		border-color: var(--pie-qti-success-text, #15803d);
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 10%, transparent);
	}

	.qti-text-entry-error {
		display: block;
		color: var(--pie-qti-error-text, #b91c1c);
		font-size: 0.875rem;
	}
</style>
