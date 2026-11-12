<script lang="ts">
	import { joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import type { InlineInteractionPosition } from '../../presentation/itemPresentationPlan.js';
	import { inlineInteractionLabel } from '../inline/accessibleName.js';
	import type { InlineChoiceInteractionData } from '../shared/types.js';

	interface Props {
		interaction: InlineChoiceInteractionData;
		/** Its place among the item's inline interactions, which names it when no label is authored. */
		position: InlineInteractionPosition;
		/** The id of the sentence or paragraph the dropdown sits in, which describes it. */
		contextId?: string;
		response?: string;
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
		correctAnswer = null,
		disabled = false,
		i18n,
		onResponseChange = () => {},
	}: Props = $props();

	// Ids are per instance: two items on one page commonly share a response identifier.
	const uid = $props.id();
	const descriptionId = `${uid}-description`;
	const minMessageId = `${uid}-min-message`;
	const displayValue = $derived(correctAnswer !== null ? correctAnswer : response);
	const correctChoice = $derived(correctAnswer ? interaction.choices.find((choice) => choice.identifier === correctAnswer) : null);
	const label = $derived(inlineInteractionLabel(i18n, interaction, position));
	// The author's data-min-selections-message (QTI 3.0, inlineChoiceInteraction) describes the
	// requirement a valid response must meet; a dropdown has no refusal of its own to attach it
	// to, so it is stated in the control's description instead.
	const minSelectionsMessage = $derived(interaction.minSelectionsMessage?.trim() || '');
	const describedBy = $derived(
		[
			interaction.accessibility?.description ? descriptionId : '',
			minSelectionsMessage ? minMessageId : '',
			contextId ?? '',
		]
			.filter(Boolean)
			.join(' ') || undefined,
	);

	function handleChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement | null)?.value ?? '';
		onResponseChange(interaction.responseId, value);
	}
</script>

<span class="inline-choice-wrapper">
	{#if interaction.accessibility?.description}
		<span id={descriptionId} hidden>{interaction.accessibility.description}</span>
	{/if}
	{#if minSelectionsMessage}
		<span id={minMessageId} hidden>{minSelectionsMessage}</span>
	{/if}
	<select
		class:qti-inline-select={true}
		class:qti-inline-select-correct={correctAnswer !== null}
		aria-label={correctAnswer && correctChoice
			? joinSentences(
					translate(i18n, 'accessibility.sentence', '{text}.', { text: label }),
					translate(i18n, 'accessibility.correctAnswerIs', 'Correct answer: {answer}.', { answer: correctChoice.text }),
				)
			: label}
		aria-describedby={describedBy}
		value={displayValue}
		onchange={handleChange}
		{disabled}
	>
		<option value="">{interaction.label ?? interaction.dataPrompt ?? translate(i18n, 'interactions.inline.selectPlaceholder', 'Select...')}</option>
		{#each interaction.choices as choice}
			{@const isCorrect = correctAnswer === choice.identifier}
			<option value={choice.identifier}>
				{choice.text}{isCorrect ? ' ✓' : ''}
			</option>
		{/each}
	</select>
	{#if correctAnswer !== null && correctChoice}
		<span class="qti-inline-choice-correct-badge">
			{translate(i18n, 'interactions.inline.correctChoice', 'Correct: {choice}', { choice: correctChoice.text })}
		</span>
	{/if}
</span>

<style>
	.inline-choice-wrapper {
		position: relative;
		display: inline-block;
	}

	.qti-inline-select {
		display: inline-block;
		width: auto;
		min-width: 120px;
		margin: 0 4px;
		padding-block: 0.25rem;
		padding-inline: 0.5rem 1.75rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
	}

	.qti-inline-select:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.qti-inline-select-correct {
		border-color: var(--pie-qti-success-text, #15803d);
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 10%, transparent);
	}

	.qti-inline-choice-correct-badge {
		position: absolute;
		top: -1.5rem;
		inset-inline-start: 0;
		display: inline-flex;
		align-items: center;
		white-space: nowrap;
		min-height: 1.1rem;
		padding: 0 0.5rem;
		border: 1px solid var(--pie-qti-success-text, #15803d);
		border-radius: 9999px;
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 12%, transparent);
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font-size: 0.75rem;
		font-weight: 600;
	}
</style>
