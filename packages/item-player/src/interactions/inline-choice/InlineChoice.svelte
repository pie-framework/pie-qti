<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { InlineChoiceInteractionData } from './types.js';

	interface Props {
		interaction: InlineChoiceInteractionData;
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

	const displayValue = $derived(correctAnswer !== null ? correctAnswer : response);
	const correctChoice = $derived(correctAnswer ? interaction.choices.find((choice) => choice.identifier === correctAnswer) : null);

	function handleChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement | null)?.value ?? '';
		onResponseChange(interaction.responseId, value);
	}
</script>

<span class="inline-choice-wrapper" style="display: inline-block; position: relative;">
	<select
		class="select select-bordered select-sm inline-select"
		class:border-success={correctAnswer !== null}
		class:bg-success={correctAnswer !== null}
		class:bg-opacity-10={correctAnswer !== null}
		style="display: inline-block; margin: 0 4px; width: auto; min-width: 120px;"
		aria-label={`Inline choice ${interaction.responseId}${correctAnswer && correctChoice ? '. Correct answer: ' + correctChoice.text : ''}`}
		value={displayValue}
		onchange={handleChange}
		{disabled}
	>
		<option value="">{interaction.label ?? interaction.dataPrompt ?? i18n?.t('interactions.inline.selectPlaceholder', 'Select...')}</option>
		{#each interaction.choices as choice}
			{@const isCorrect = correctAnswer === choice.identifier}
			<option value={choice.identifier}>
				{choice.text}{isCorrect ? ' ✓' : ''}
			</option>
		{/each}
	</select>
	{#if correctAnswer !== null && correctChoice}
		<span class="badge badge-success badge-sm" style="position: absolute; top: -1.5rem; left: 0; white-space: nowrap; font-size: 0.7rem;">
			{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}: {correctChoice.text}
		</span>
	{/if}
</span>
