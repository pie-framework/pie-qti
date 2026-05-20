<svelte:options customElement="pie-qti-choice" />

<script lang="ts">
	import type { ChoiceInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import { normalizeHeuristicsConfig, type QtiHeuristicsConfig } from '@pie-qti/item-player';
	import { processFeedbackInline } from '@pie-qti/item-player/components/utils';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';

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
		/** When true, renders an elimination toggle button per choice (QTI 3.0 PNP §6.2). */
		eliminationTool?: boolean;
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
		heuristicsConfig,
		eliminationTool = false
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

	const shell = $derived(
		createInteractionShell<ChoiceInteractionData, string | string[], string | string[]>({
			interaction,
			response,
			correctResponse,
			role,
		})
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);

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

	// Elimination tool state: set of eliminated choice identifiers.
	// Eliminated choices remain in DOM and in the response; only visually dimmed.
	let eliminatedChoices = $state(new Set<string>());

	function toggleElimination(identifier: string) {
		const next = new Set(eliminatedChoices);
		if (next.has(identifier)) {
			next.delete(identifier);
		} else {
			next.add(identifier);
		}
		eliminatedChoices = next;
	}

	function eliminationLabel(identifier: string): string {
		const isEliminated = eliminatedChoices.has(identifier);
		const action = isEliminated
			? (i18n?.t('interactions.choice.restoreChoice') ?? 'Restore')
			: (i18n?.t('interactions.choice.eliminateChoice') ?? 'Eliminate');
		return action;
	}

	function handleRadioChange(identifier: string) {
		response = identifier;
		emitInteractionChange({ target: rootElement, responseId: shell.responseId, value: identifier, onChange });
	}

	function handleCheckboxChange(identifier: string, checked: boolean) {
		const currentValues = Array.isArray(parsedResponse) ? parsedResponse : [];
		let newValues = [...currentValues];

		if (checked) {
			// Enforce maxChoices (0 = unlimited)
			const max = parsedInteraction?.maxChoices ?? 0;
			if (max > 0 && newValues.length >= max) return;
			newValues.push(identifier);
		} else {
			newValues = newValues.filter((v) => v !== identifier);
		}

		response = newValues;
		emitInteractionChange({ target: rootElement, responseId: shell.responseId, value: newValues, onChange });
	}

	// Selection limit message: show max message when at/over limit; min message is for submit time
	const selectionCount = $derived(Array.isArray(parsedResponse) ? parsedResponse.length : (parsedResponse ? 1 : 0));
	const maxChoices = $derived(parsedInteraction?.maxChoices ?? 0);
	const showMaxMessage = $derived(
		maxChoices > 0 && selectionCount >= maxChoices && !!parsedInteraction?.maxSelectionsMessage
	);
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class={['qti-choice-interaction space-y-2', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')} use:typesetAction={{ typeset }}>
	{#if parsedInteraction?.prompt}
		<div part="prompt" class="qti-choice-prompt font-semibold">{@html parsedInteraction.prompt}</div>
	{/if}

	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData') ?? 'No interaction data provided'}</div>
	{:else if parsedInteraction.maxChoices === 1}
		<!-- Single choice (radio buttons) -->
		{#each parsedInteraction.choices as choice}
			<div
				part="option"
				class="qti-choice-option form-control"
				data-eliminated={eliminatedChoices.has(choice.identifier) ? '' : undefined}
			>
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
				{#if eliminationTool}
					<button
						type="button"
						class="qti-eliminate-btn"
						aria-label={eliminationLabel(choice.identifier)}
						aria-pressed={eliminatedChoices.has(choice.identifier)}
						onclick={() => toggleElimination(choice.identifier)}
					>✕</button>
				{/if}
			</div>
		{/each}
	{:else}
		<!-- Multiple choice (checkboxes) -->
		{@const currentValues = Array.isArray(parsedResponse) ? parsedResponse : []}
		{#each parsedInteraction.choices as choice}
			<div
				part="option"
				class="qti-choice-option form-control"
				data-eliminated={eliminatedChoices.has(choice.identifier) ? '' : undefined}
			>
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
				{#if eliminationTool}
					<button
						type="button"
						class="qti-eliminate-btn"
						aria-label={eliminationLabel(choice.identifier)}
						aria-pressed={eliminatedChoices.has(choice.identifier)}
						onclick={() => toggleElimination(choice.identifier)}
					>✕</button>
				{/if}
			</div>
		{/each}
	{/if}
	{#if showMaxMessage}
		<p class="qti-selection-message qti-max-selection-message" role="alert">{parsedInteraction?.maxSelectionsMessage}</p>
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-choice-interaction {
		display: grid;
		gap: 0.5rem;
	}
	.qti-choice-prompt {
		margin: 0 0 0.25rem;
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

	/* Elimination tool */
	.qti-choice-option {
		position: relative;
	}

	.qti-eliminate-btn {
		position: absolute;
		right: 0.25rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: 1px solid currentColor;
		border-radius: 50%;
		width: 1.5rem;
		height: 1.5rem;
		line-height: 1;
		font-size: 0.75rem;
		cursor: pointer;
		opacity: 0.4;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.qti-eliminate-btn:hover,
	.qti-eliminate-btn[aria-pressed='true'] {
		opacity: 1;
	}

	/* Eliminated choices are dimmed with a strikethrough */
	[data-eliminated] .qti-choice-label {
		opacity: 0.4;
		text-decoration: line-through;
	}

	[data-eliminated] .qti-eliminate-btn {
		opacity: 1;
		color: var(--color-error, oklch(63% 0.237 25.331));
	}

	/* ── QTI Shared Vocabulary behavioral classes ─────────────────────────── */

	/* qti-input-control-hidden: hide radio/checkbox controls but keep keyboard-accessible */
	:global(.qti-input-control-hidden) .qti-choice-interaction input[type='radio'],
	:global(.qti-input-control-hidden) .qti-choice-interaction input[type='checkbox'],
	.qti-choice-interaction.qti-input-control-hidden input[type='radio'],
	.qti-choice-interaction.qti-input-control-hidden input[type='checkbox'] {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		pointer-events: none;
	}

	/* qti-orientation-horizontal: choices in a row */
	.qti-choice-interaction.qti-orientation-horizontal {
		grid-auto-flow: column;
		grid-template-columns: repeat(auto-fill, minmax(0, 1fr));
	}

	/* qti-choices-stacking-N: N-column grid */
	.qti-choice-interaction.qti-choices-stacking-1 { grid-template-columns: 1fr; }
	.qti-choice-interaction.qti-choices-stacking-2 { grid-template-columns: repeat(2, 1fr); }
	.qti-choice-interaction.qti-choices-stacking-3 { grid-template-columns: repeat(3, 1fr); }
	.qti-choice-interaction.qti-choices-stacking-4 { grid-template-columns: repeat(4, 1fr); }
	.qti-choice-interaction.qti-choices-stacking-5 { grid-template-columns: repeat(5, 1fr); }

	/* Selection limit messages */
	.qti-selection-message {
		font-size: 0.875rem;
		color: var(--color-warning, oklch(77% 0.194 82));
		margin-top: 0.5rem;
	}
</style>
