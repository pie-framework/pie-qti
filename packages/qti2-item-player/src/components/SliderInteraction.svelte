<script lang="ts">
	import type { SliderInteractionData } from '../types/interactions';

	interface Props {
		interaction: SliderInteractionData;
		response: number | null;
		disabled: boolean;
		onChange: (value: number) => void;
	}

	let { interaction, response, disabled, onChange }: Props = $props();

	const defaultValue = $derived(
		Math.floor((interaction.lowerBound + interaction.upperBound) / 2)
	);
	const currentValue = $derived(response ?? defaultValue);
</script>

<div class="qti-slider-interaction space-y-3">
	{#if interaction.prompt}
		<p class="font-semibold">{interaction.prompt}</p>
	{/if}

	<div class="flex items-center gap-4">
		<span class="text-sm text-base-content/70">{interaction.lowerBound}</span>
		<input
			type="range"
			min={interaction.lowerBound}
			max={interaction.upperBound}
			step={interaction.step}
			class="range range-primary flex-1"
			aria-label={`Slider ${interaction.responseId ?? 'response'}`}
			value={currentValue}
			oninput={(e: Event) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
			{disabled}
		/>
		<span class="text-sm text-base-content/70">{interaction.upperBound}</span>
	</div>

	<div class="text-center">
		<div class="stat bg-base-200 rounded-box inline-block">
			<div class="stat-title">Selected Value</div>
			<div class="stat-value text-primary">
				{currentValue}
			</div>
		</div>
	</div>
</div>
