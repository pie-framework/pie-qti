<svelte:options customElement="pie-qti-slider" />

<script lang="ts">
	import type { SliderInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

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

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<SliderInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<number>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<number>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);

	// Simplified translation helper - locale changes trigger page refresh
	const t = $derived((key: string, fallback: string) => i18n?.t(key) ?? fallback);

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	const defaultValue = $derived(
		parsedInteraction ? Math.floor((parsedInteraction.lowerBound + parsedInteraction.upperBound) / 2) : 0
	);
	// In scorer mode, use the correct response value; otherwise use user's response or default
	const currentValue = $derived(
		isShowingCorrect && parsedCorrectResponse !== null
			? parsedCorrectResponse
			: parsedResponse ?? defaultValue
	);

	function handleChange(value: number) {
		response = value;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(value);
		// Dispatch custom event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, value));
		}
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-slider-interaction space-y-3">
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData') ?? 'No interaction data provided'}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-slider-prompt qti-rich-content font-semibold">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<div part="track" class="qti-slider-track flex items-center gap-4">
			<span part="min" class="qti-slider-bound text-sm text-base-content/70">{parsedInteraction.lowerBound}</span>
			<input
				part="input"
				type="range"
				min={parsedInteraction.lowerBound}
				max={parsedInteraction.upperBound}
				step={parsedInteraction.step}
				class="qti-slider-input range range-primary flex-1"
				value={currentValue}
				aria-label="Slider value from {parsedInteraction.lowerBound} to {parsedInteraction.upperBound}{isShowingCorrect && parsedCorrectResponse !== null ? '. Correct answer: ' + parsedCorrectResponse : ''}"
				aria-valuemin={parsedInteraction.lowerBound}
				aria-valuemax={parsedInteraction.upperBound}
				aria-valuenow={currentValue}
				oninput={(e: Event) => handleChange(Number((e.currentTarget as HTMLInputElement).value))}
				disabled={disabled || isShowingCorrect}
			/>
			<span part="max" class="qti-slider-bound text-sm text-base-content/70">{parsedInteraction.upperBound}</span>
		</div>

		<div part="value" class="qti-slider-value text-center">
			<div class="qti-slider-stat stat bg-base-200 rounded-box inline-block" class:bg-success={isShowingCorrect} class:bg-opacity-10={isShowingCorrect}>
				<div class="qti-slider-stat-title stat-title">{i18n?.t('interactions.slider.statTitle') ?? 'Selected Value'}</div>
				<div
					part="value-number"
					class="qti-slider-stat-value stat-value"
					class:text-primary={!isShowingCorrect}
					class:text-success={isShowingCorrect}
				>
					{currentValue}
				</div>
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
	}
	.qti-slider-bound {
		white-space: nowrap;
	}
	.qti-slider-value {
		text-align: center;
	}
	.qti-slider-stat {
		display: inline-block;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
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
</style>
