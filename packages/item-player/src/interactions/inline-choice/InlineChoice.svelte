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

<span class="inline-choice-wrapper">
	<select
		class:qti-inline-select={true}
		class:qti-inline-select-correct={correctAnswer !== null}
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
		<span class="qti-inline-choice-correct-badge">
			{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}: {correctChoice.text}
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
		padding: 0.25rem 1.75rem 0.25rem 0.5rem;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 0.5rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
	}

	.qti-inline-select:focus-visible {
		outline: 2px solid var(--pie-qti-focus, var(--pie-qti-primary, oklch(45% 0.24 277)));
		outline-offset: 2px;
	}

	.qti-inline-select-correct {
		border-color: var(--pie-qti-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 10%, transparent);
	}

	.qti-inline-choice-correct-badge {
		position: absolute;
		top: -1.5rem;
		left: 0;
		display: inline-flex;
		align-items: center;
		white-space: nowrap;
		min-height: 1.1rem;
		padding: 0 0.5rem;
		border: 1px solid var(--pie-qti-success, oklch(76% 0.177 163.223));
		border-radius: 9999px;
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 12%, transparent);
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font-size: 0.7rem;
		font-weight: 600;
	}
</style>
