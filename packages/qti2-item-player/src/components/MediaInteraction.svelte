<script lang="ts">
	import type { MediaInteractionData } from '../types/interactions';

	interface Props {
		interaction: MediaInteractionData;
		response: number | null;
		disabled: boolean;
		onChange: (value: number) => void;
	}

	let { interaction, response, disabled, onChange }: Props = $props();

	let playCount = $state(0);
	let mediaElement: HTMLAudioElement | HTMLVideoElement | null = $state(null);

	$effect(() => {
		// Sync with parent response changes
		playCount = response ?? 0;
	});

	/**
	 * Check if the max play limit has been reached
	 */
	const hasReachedMaxPlays = $derived(
		interaction.maxPlays > 0 && playCount >= interaction.maxPlays
	);

	/**
	 * Check if the minimum play requirement has been met
	 */
	const hasMetMinPlays = $derived(playCount >= interaction.minPlays);

	/**
	 * Handle media play event
	 */
	function handlePlay() {
		playCount++;
		onChange(playCount);
	}

	/**
	 * Handle media ended event for loop behavior
	 */
	function handleEnded() {
		if (interaction.loop && !hasReachedMaxPlays) {
			mediaElement?.play();
		}
	}

	/**
	 * Prevent playing if max plays reached
	 */
	function handlePlayAttempt(e: Event) {
		if (hasReachedMaxPlays) {
			e.preventDefault();
			return false;
		}
	}
</script>

<div class="qti-media-interaction space-y-3">
	{#if interaction.prompt}
		<p class="font-semibold">{interaction.prompt}</p>
	{/if}

	<div class="media-container">
		{#if interaction.mediaElement.type === 'audio'}
			<audio
				bind:this={mediaElement}
				class="w-full"
				controls
				autoplay={interaction.autostart}
				loop={interaction.loop && interaction.maxPlays === 0}
				onplay={handlePlay}
				onended={handleEnded}
				onplaying={handlePlayAttempt}
			>
				<source src={interaction.mediaElement.src} type={interaction.mediaElement.mimeType} />
				Your browser does not support the audio element.
			</audio>
		{:else if interaction.mediaElement.type === 'video'}
			<video
				bind:this={mediaElement}
				class="w-full rounded-lg"
				controls
				autoplay={interaction.autostart}
				loop={interaction.loop && interaction.maxPlays === 0}
				width={interaction.mediaElement.width}
				height={interaction.mediaElement.height}
				onplay={handlePlay}
				onended={handleEnded}
				onplaying={handlePlayAttempt}
			>
				<source src={interaction.mediaElement.src} type={interaction.mediaElement.mimeType} />
				Your browser does not support the video element.
			</video>
		{:else if interaction.mediaElement.type === 'object'}
			{#if interaction.allowObjectEmbeds}
				<object
					data={interaction.mediaElement.src}
					type={interaction.mediaElement.mimeType}
					width={interaction.mediaElement.width}
					height={interaction.mediaElement.height}
					class="w-full"
					aria-label="Media content"
				>
					<p>Your browser does not support this media type.</p>
				</object>
			{:else}
				<div class="alert alert-warning">
					This item uses an embedded object type that is disabled by default for security.
				</div>
			{/if}
		{/if}
	</div>

	<div class="flex items-center justify-between text-sm text-base-content/70">
		<div>
			<span class="font-medium">Play count:</span>
			<span class="ml-2">{playCount}</span>
		</div>

		{#if interaction.minPlays > 0}
			<div class="flex items-center gap-2">
				{#if hasMetMinPlays}
					<span class="badge badge-success badge-sm">✓ Requirement met</span>
				{:else}
					<span class="badge badge-warning badge-sm">
						Play at least {interaction.minPlays} time{interaction.minPlays === 1 ? '' : 's'}
					</span>
				{/if}
			</div>
		{/if}

		{#if interaction.maxPlays > 0}
			<div>
				<span class="font-medium">Remaining:</span>
				<span class="ml-2">{Math.max(0, interaction.maxPlays - playCount)}</span>
			</div>
		{/if}
	</div>

	{#if hasReachedMaxPlays}
		<div class="alert alert-info">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="stroke-current shrink-0 w-6 h-6"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<span>Maximum play limit reached</span>
		</div>
	{/if}
</div>
