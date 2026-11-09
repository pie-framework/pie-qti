<svelte:options customElement="pie-qti-slider" />

<script lang="ts">
	import type { SliderInteractionData } from '@pie-qti/item-player';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';

	interface Props {
		interaction?: SliderInteractionData | string;
		response?: number | null;
		correctResponse?: number | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		onChange?: (value: number) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage). Correct-answer mode is the
	// scorer's view of an item that has a correct response (the shared shell's rule).
	const shell = $derived(
		createInteractionShell<SliderInteractionData, number, number>({ interaction, response, correctResponse, role }),
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	const midpoint = $derived(
		parsedInteraction ? Math.floor((parsedInteraction.lowerBound + parsedInteraction.upperBound) / 2) : 0
	);

	// Untouched state: the response is null until the candidate's first interaction, so the
	// slider must not present the resting thumb position as a selected value (Slider-D).
	const hasValue = $derived(
		typeof parsedResponse === 'number' && Number.isFinite(parsedResponse)
	);
	// In scorer mode, use the correct response value; otherwise use user's response.
	const displayValue = $derived(
		isShowingCorrect && parsedCorrectResponse !== undefined
			? parsedCorrectResponse
			: hasValue
				? (parsedResponse as number)
				: midpoint
	);

	// Authored orientation/reverse/stepLabel (QTI 2.x §3.4.1)
	const isVertical = $derived(parsedInteraction?.orientation === 'vertical');
	const isReversed = $derived(parsedInteraction?.reverse === true);
	const stepValues = $derived.by(() => {
		if (!parsedInteraction || parsedInteraction.step <= 0) return [];
		const count = Math.floor((parsedInteraction.upperBound - parsedInteraction.lowerBound) / parsedInteraction.step);
		// Labels at every step are only useful while they stay readable.
		if (count <= 0 || count > 12) return [];
		return Array.from({ length: count + 1 }, (_, i) => parsedInteraction.lowerBound + i * parsedInteraction.step);
	});
	const showStepLabels = $derived(parsedInteraction?.stepLabel === true && stepValues.length > 0);

	// Unique per instance, so two renderings of the same item (same responseId) in one
	// document keep their own prompt label and tick list.
	const uid = $props.id();
	const promptId = `${uid}-slider-prompt`;
	const tickListId = `${uid}-slider-ticks`;

	// The accessible name comes from the prompt; the range bounds label it only
	// when the item has no authored prompt.
	const fallbackLabel = $derived(
		translate(
			i18n,
			'interactions.slider.ariaLabel',
			'Slider value from {lowerBound} to {upperBound}',
			{ lowerBound: parsedInteraction?.lowerBound ?? 0, upperBound: parsedInteraction?.upperBound ?? 100 }
		)
	);
	const noValueLabel = $derived(
		translate(i18n, 'interactions.slider.noValueSelected', 'No value selected')
	);
	// aria-valuetext carries the state: the value once selected, "No value selected" before.
	const valueText = $derived.by(() => {
		if (hasValue) return String(parsedResponse);
		if (isShowingCorrect && parsedCorrectResponse !== undefined) {
			return joinSentences(
				String(parsedCorrectResponse),
				translate(i18n, 'accessibility.correctAnswerIs', 'Correct answer: {answer}.', { answer: parsedCorrectResponse })
			);
		}
		return noValueLabel;
	});

	function handleChange(value: number) {
		// Synthetic events can reach a disabled input in tests; a real interaction cannot.
		if (disabled || isShowingCorrect) return;
		response = value;
		// Call onChange callback if provided (for Svelte component usage)
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: value, onChange });
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class="qti-slider-interaction space-y-3">
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData') ?? 'No interaction data provided'}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div id={promptId} part="prompt" class="qti-slider-prompt qti-rich-content font-semibold">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<div
			part="track"
			class="qti-slider-track"
			class:qti-slider-vertical={isVertical}
			class:qti-slider-reverse={isReversed}
			data-untouched={!hasValue && !isShowingCorrect ? '' : undefined}
		>
			<span part="min" class="qti-slider-bound qti-slider-min text-sm text-base-content/70">{parsedInteraction.lowerBound}</span>
			<input
				part="input"
				type="range"
				min={parsedInteraction.lowerBound}
				max={parsedInteraction.upperBound}
				step={parsedInteraction.step}
				class="qti-slider-input range range-primary"
				value={displayValue}
				list={showStepLabels ? tickListId : undefined}
				aria-labelledby={parsedInteraction.prompt ? promptId : undefined}
				aria-label={parsedInteraction.prompt ? undefined : fallbackLabel}
				aria-orientation={isVertical ? 'vertical' : undefined}
				aria-valuemin={parsedInteraction.lowerBound}
				aria-valuemax={parsedInteraction.upperBound}
				aria-valuenow={hasValue || (isShowingCorrect && parsedCorrectResponse !== undefined) ? displayValue : undefined}
				aria-valuetext={valueText}
				oninput={(e: Event) => handleChange(Number((e.currentTarget as HTMLInputElement).value))}
				disabled={disabled || isShowingCorrect}
			/>
			<span part="max" class="qti-slider-bound qti-slider-max text-sm text-base-content/70">{parsedInteraction.upperBound}</span>
		</div>

		{#if showStepLabels}
			<datalist id={tickListId}>
				{#each stepValues as stepValue (stepValue)}
					<option value={stepValue}></option>
				{/each}
			</datalist>
			<div part="ticks" class="qti-slider-ticks" aria-hidden="true">
				{#each stepValues as stepValue (stepValue)}
					<span class="qti-slider-tick">{stepValue}</span>
				{/each}
			</div>
		{/if}

		<div part="value" class="qti-slider-value text-center">
			<div
				part="value-card"
				class="qti-slider-stat"
				class:qti-slider-untouched={!hasValue && !isShowingCorrect}
				class:qti-slider-correct={isShowingCorrect}
			>
				{#if hasValue || (isShowingCorrect && parsedCorrectResponse !== undefined)}
					<div class="qti-slider-stat-title stat-title">{i18n?.t('interactions.slider.statTitle') ?? 'Selected Value'}</div>
					<div
						part="value-number"
						class="qti-slider-stat-value stat-value"
						class:text-primary={!isShowingCorrect}
						class:text-success={isShowingCorrect}
					>
						{displayValue}
					</div>
				{:else}
					<div part="value-number" class="qti-slider-no-value stat-value">{noValueLabel}</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-slider-interaction {
		display: grid;
		gap: 0.75rem;
	}
	.qti-slider-prompt {
		margin: 0;
	}
	.qti-slider-track {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.qti-slider-input {
		flex: 1 1 auto;
		width: 100%;
		/* K-12 target: a thumb area tall enough to grab (WCAG 2.5.8 and better) */
		min-height: 2.75rem;
	}
	.qti-slider-bound {
		white-space: nowrap;
	}
	.qti-slider-value {
		text-align: center;
	}
	.qti-slider-stat {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
		padding: 0.75rem 1.25rem;
		border-radius: 0.75rem;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}
	/* Distinct untouched visual state: the resting thumb is not a selected value */
	.qti-slider-stat.qti-slider-untouched {
		border: 1px dashed var(--pie-qti-border-strong, #767676);
		background: transparent;
	}
	.qti-slider-stat-title {
		font-size: 0.8rem;
		opacity: 0.7;
	}
	.qti-slider-stat-value {
		font-weight: 700;
		font-size: 1.25rem;
		color: var(--pie-qti-primary, oklch(45% 0.24 277));
	}
	.qti-slider-no-value {
		font-weight: 600;
		font-size: 1rem;
		color: var(--pie-qti-info-text, #1d4ed8);
	}

	/* Step labels (authored stepLabel): tick marks with readable values */
	.qti-slider-ticks {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		line-height: 1.25;
		color: color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 70%, transparent);
		padding: 0 0.5rem;
	}

	/* ── orientation="vertical" ─────────────────────────────────────────── */
	.qti-slider-track.qti-slider-vertical {
		flex-direction: column-reverse; /* DOM order min, input, max → max on top, min below */
		align-items: stretch;
		gap: 0.5rem;
	}
	.qti-slider-track.qti-slider-vertical .qti-slider-input {
		/* Native vertical slider: min at the bottom, max at the top */
		writing-mode: vertical-rl;
		width: auto;
		height: 12rem;
		min-height: 0;
		flex: 0 0 auto;
		align-self: center;
	}
	.qti-slider-track.qti-slider-vertical .qti-slider-bound {
		align-self: center;
	}

	/* ── reverse="true": min and max swap ends ──────────────────────────── */
	.qti-slider-track.qti-slider-reverse .qti-slider-min { order: 3; }
	.qti-slider-track.qti-slider-reverse .qti-slider-input { order: 2; direction: rtl; }
	.qti-slider-track.qti-slider-reverse .qti-slider-max { order: 1; }
	.qti-slider-track.qti-slider-vertical.qti-slider-reverse {
		flex-direction: column; /* reversed vertical: min on top */
	}
	.qti-slider-track.qti-slider-vertical.qti-slider-reverse .qti-slider-input {
		/* vertical-rl + rtl: min at the top, max at the bottom */
		direction: rtl;
	}
</style>
