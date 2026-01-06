<script lang="ts">
	import type { HotspotInteractionData } from '../types/interactions';

	interface Props {
		interaction: HotspotInteractionData;
		response: string | null;
		disabled: boolean;
		onChange: (value: string) => void;
	}

	let { interaction, response, disabled, onChange }: Props = $props();

	function handleClick(identifier: string) {
		if (!disabled) {
			onChange(identifier);
		}
	}

	function handleKeyDown(e: KeyboardEvent, identifier: string) {
		if (disabled) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onChange(identifier);
		}
	}
</script>

<div class="qti-hotspot-interaction space-y-3">
	{#if interaction.prompt}
		<p class="font-semibold">{interaction.prompt}</p>
	{/if}

	<div class="relative inline-block">
		<!-- Render the image/SVG -->
		{#if interaction.imageData}
			{#if interaction.imageData.type === 'svg'}
				<div style="width: {interaction.imageData.width}px; height: {interaction.imageData.height}px;">
					{@html interaction.imageData.content}
				</div>
			{:else}
				<img
					src={interaction.imageData.src}
					alt="Hotspot interaction"
					style="width: {interaction.imageData.width}px; height: {interaction.imageData.height}px;"
				/>
			{/if}
		{/if}

		<!-- Overlay clickable areas using SVG -->
		<svg
			class="absolute top-0 left-0 cursor-pointer"
			style="width: {interaction.imageData?.width ? `${interaction.imageData.width}px` : '100%'}; height: {interaction.imageData?.height ? `${interaction.imageData.height}px` : '100%'}; top: 0; left: 0;"
			viewBox="0 0 {interaction.imageData?.width || '800'} {interaction.imageData?.height || '600'}"
		xmlns="http://www.w3.org/2000/svg"
		>
			{#each interaction.hotspotChoices as choice}
				{@const isSelected = response === choice.identifier}
				{@const coords = choice.coords.split(',').map(Number)}

				{#if choice.shape === 'circle'}
					<!-- Circle: coords are cx, cy, radius -->
					<circle
						cx={coords[0]}
						cy={coords[1]}
						r={coords[2]}
						fill={isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 0, 0, 0)'}
						stroke={isSelected ? '#3b82f6' : 'transparent'}
						stroke-width="2"
						class="hover:fill-[rgba(59,130,246,0.1)] transition-all"
						role="button"
						aria-label={`Select hotspot ${choice.identifier}`}
						tabindex={disabled ? -1 : 0}
						onclick={() => handleClick(choice.identifier)}
						onkeydown={(e) => handleKeyDown(e, choice.identifier)}
					/>
				{:else if choice.shape === 'rect'}
					<!-- Rectangle: coords are x, y, width, height -->
					<rect
						x={coords[0]}
						y={coords[1]}
						width={coords[2]}
						height={coords[3]}
						fill={isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 0, 0, 0)'}
						stroke={isSelected ? '#3b82f6' : 'transparent'}
						stroke-width="2"
						class="hover:fill-[rgba(59,130,246,0.1)] transition-all"
						role="button"
						aria-label={`Select hotspot ${choice.identifier}`}
						tabindex={disabled ? -1 : 0}
						onclick={() => handleClick(choice.identifier)}
						onkeydown={(e) => handleKeyDown(e, choice.identifier)}
					/>
				{:else if choice.shape === 'poly'}
					<!-- Polygon: coords are x1,y1,x2,y2,... -->
					{@const points = coords
						.reduce((acc: string[], val: number, idx: number) => {
							if (idx % 2 === 0 && idx + 1 < coords.length) {
								acc.push(`${coords[idx]},${coords[idx + 1]}`);
							}
							return acc;
						}, [])
						.join(' ')}
					<polygon
						{points}
						fill={isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 0, 0, 0)'}
						stroke={isSelected ? '#3b82f6' : 'transparent'}
						stroke-width="2"
						class="hover:fill-[rgba(59,130,246,0.1)] transition-all"
						role="button"
						aria-label={`Select hotspot ${choice.identifier}`}
						tabindex={disabled ? -1 : 0}
						onclick={() => handleClick(choice.identifier)}
						onkeydown={(e) => handleKeyDown(e, choice.identifier)}
					/>
				{/if}
			{/each}
		</svg>
	</div>

	{#if response}
		<div class="alert alert-info">
			<span>Selected: {response}</span>
		</div>
	{/if}
</div>
