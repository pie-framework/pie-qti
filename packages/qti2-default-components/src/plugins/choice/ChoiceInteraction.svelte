<svelte:options customElement="pie-qti-choice" />

<script lang="ts">
	import type { ChoiceInteractionData } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import { normalizeHeuristicsConfig, type QtiHeuristicsConfig } from '@pie-qti/qti2-item-player';
	import { processFeedbackInline } from '@pie-qti/qti2-item-player/components/utils';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: ChoiceInteractionData | string;
		response?: string | string[] | null;
		correctResponse?: string | string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string | string[]) => void;
		outcomeValues?: Record<string, any>;
		heuristicsConfig?: QtiHeuristicsConfig;
	}

	let {
		interaction = $bindable(),
		response = $bindable(),
		correctResponse = $bindable(),
		disabled = false,
		role = 'candidate',
		i18n = $bindable(),
		typeset,
		onChange,
		outcomeValues = {},
		heuristicsConfig
	}: Props = $props();

	// Normalize heuristics configuration with defaults
	const heuristics = $derived(normalizeHeuristicsConfig(heuristicsConfig));

	// Translation helper:
	// The default i18n provider returns the key itself when a translation is missing.
	// We treat that as "missing" so we can safely fall back to the provided string.
	const t = $derived((key: string, fallback: string) => {
		const v = i18n?.t(key);
		return !v || v === key ? fallback : v;
	});

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<ChoiceInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string | string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string | string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);

	// Helper function to check if a choice is correct
	function isCorrectChoice(identifier: string): boolean {
		if (!isShowingCorrect) return false;
		if (Array.isArray(parsedCorrectResponse)) {
			return parsedCorrectResponse.includes(identifier);
		}
		return parsedCorrectResponse === identifier;
	}

	// Helper function to filter feedbackInline from choice text based on outcome values
	function filterFeedbackInline(text: string): string {
		return processFeedbackInline(text, {
			outcomeValues,
			applyHeuristics: heuristics.feedbackTextFormatting,
			wrapWithSpan: true
		});
	}

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	function handleRadioChange(identifier: string) {
		response = identifier;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(identifier);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, identifier));
		}
	}

	function handleCheckboxChange(identifier: string, checked: boolean) {
		const currentValues = Array.isArray(parsedResponse) ? parsedResponse : [];
		let newValues = [...currentValues];

		if (checked) {
			newValues.push(identifier);
		} else {
			newValues = newValues.filter((v) => v !== identifier);
		}

		response = newValues;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(newValues);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, newValues));
		}
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-choice-interaction space-y-2" use:typesetAction={{ typeset }}>
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData') ?? 'No interaction data provided'}</div>
	{:else if parsedInteraction.maxChoices === 1}
		<!-- Single choice (radio buttons) -->
		{#each parsedInteraction.choices as choice}
			<div part="option" class="qti-choice-option form-control">
				<label
					part="label"
					class="qti-choice-label label cursor-pointer justify-start gap-4"
					class:qti-choice-correct={isCorrectChoice(choice.identifier)}
				>
					<input
						part="input"
						type="radio"
						name={parsedInteraction.responseId}
						class="radio radio-primary"
						class:radio-success={isCorrectChoice(choice.identifier)}
						value={choice.identifier}
						checked={parsedResponse === choice.identifier}
						onchange={() => handleRadioChange(choice.identifier)}
						{disabled}
					/>
					<span part="text" class="qti-choice-text label-text">
						{@html choice.text}
					</span>
					{#if isCorrectChoice(choice.identifier)}
						<span class="badge badge-success badge-sm">{t('interactions.choice.correct', 'Correct')}</span>
					{/if}
				</label>
			</div>
		{/each}
	{:else}
		<!-- Multiple choice (checkboxes) -->
		{@const currentValues = Array.isArray(parsedResponse) ? parsedResponse : []}
		{#each parsedInteraction.choices as choice}
			<div part="option" class="qti-choice-option form-control">
				<label
					part="label"
					class="qti-choice-label label cursor-pointer justify-start gap-4"
					class:qti-choice-correct={isCorrectChoice(choice.identifier)}
				>
					<input
						part="input"
						type="checkbox"
						class="checkbox checkbox-primary"
						class:checkbox-success={isCorrectChoice(choice.identifier)}
						value={choice.identifier}
						checked={currentValues.includes(choice.identifier)}
						onchange={(e: Event) => {
							const checked = (e.currentTarget as HTMLInputElement).checked;
							handleCheckboxChange(choice.identifier, checked);
						}}
						{disabled}
					/>
					<span part="text" class="qti-choice-text label-text">
						{@html choice.text}
					</span>
					{#if isCorrectChoice(choice.identifier)}
						<span class="badge badge-success badge-sm">{t('interactions.choice.correct', 'Correct')}</span>
					{/if}
				</label>
			</div>
		{/each}
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-choice-interaction {
		display: grid;
		gap: 0.5rem;
	}
	.qti-choice-option {
		display: block;
	}
	.qti-choice-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
	}
	.qti-choice-text {
		display: inline-block;
		line-height: 1.35;
	}
	.qti-choice-interaction input[type='radio'],
	.qti-choice-interaction input[type='checkbox'] {
		margin-top: 0.15rem;
	}

	/* Correct answer highlighting */
	.qti-choice-correct {
		background-color: color-mix(in oklch, var(--color-success, oklch(76% 0.177 163.223)) 8%, transparent);
		border-radius: 0.5rem;
		padding: 0.25rem 0.5rem;
		margin: -0.25rem -0.5rem;
	}

	.radio-success,
	.checkbox-success {
		accent-color: var(--color-success, oklch(76% 0.177 163.223));
	}
</style>
