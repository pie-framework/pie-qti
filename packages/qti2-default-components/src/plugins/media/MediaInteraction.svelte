<svelte:options customElement="pie-qti-media" />

<script lang="ts">
	import type { MediaInteractionData } from '@pie-qti/qti2-item-player';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: MediaInteractionData | string;
		response?: number | null;
		disabled?: boolean;
		onChange?: (value: number) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<MediaInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<number>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	let playCount = $state(0);
	let mediaElement: HTMLAudioElement | HTMLVideoElement | null = $state(null);

	$effect(() => {
		// Sync with parent response changes
		playCount = parsedResponse ?? 0;
	});

	/**
	 * Check if the max play limit has been reached
	 */
	const hasReachedMaxPlays = $derived(
		parsedInteraction && parsedInteraction.maxPlays > 0 && playCount >= parsedInteraction.maxPlays
	);

	/**
	 * Check if the minimum play requirement has been met
	 */
	const hasMetMinPlays = $derived(parsedInteraction && playCount >= parsedInteraction.minPlays);

	/**
	 * Handle media ended event.
	 *
	 * For minPlays/maxPlays semantics, a "play" should count when the media finishes
	 * (i.e. the learner completed a play-through), not merely when playback starts.
	 */
	function handleEndedCountPlay() {
		playCount++;
		response = playCount;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(playCount);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, playCount));
		}
	}

	/**
	 * Handle media ended event for loop behavior.
	 * Counting plays happens first, then looping (if enabled).
	 */
	function handleEnded() {
		handleEndedCountPlay();
		if (parsedInteraction?.loop && !hasReachedMaxPlays) {
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

<ShadowBaseStyles />

<div bind:this={rootElement} class="qti-media-interaction space-y-3">
	{#if !parsedInteraction}
		<div class="alert alert-error">No interaction data provided</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p class="font-semibold">{@html parsedInteraction.prompt}</p>
		{/if}

		<div class="qti-media-container media-container" part="media">
			{#if parsedInteraction.mediaElement.type === 'audio'}
			<audio
				bind:this={mediaElement}
				class="w-full"
				controls
				autoplay={parsedInteraction.autostart}
				loop={parsedInteraction.loop && parsedInteraction.maxPlays === 0}
				onended={handleEnded}
				onplaying={handlePlayAttempt}
			>
				<source src={parsedInteraction.mediaElement.src} type={parsedInteraction.mediaElement.mimeType} />
				Your browser does not support the audio element.
			</audio>
		{:else if parsedInteraction.mediaElement.type === 'video'}
			<video
				bind:this={mediaElement}
				class="w-full rounded-lg"
				controls
				autoplay={parsedInteraction.autostart}
				loop={parsedInteraction.loop && parsedInteraction.maxPlays === 0}
				width={parsedInteraction.mediaElement.width}
				height={parsedInteraction.mediaElement.height}
				onended={handleEnded}
				onplaying={handlePlayAttempt}
			>
				<source src={parsedInteraction.mediaElement.src} type={parsedInteraction.mediaElement.mimeType} />
				Your browser does not support the video element.
			</video>
		{:else if parsedInteraction.mediaElement.type === 'object'}
			<object
				data={parsedInteraction.mediaElement.src}
				type={parsedInteraction.mediaElement.mimeType}
				width={parsedInteraction.mediaElement.width}
				height={parsedInteraction.mediaElement.height}
				class="w-full"
				aria-label="Media content"
			>
				<p>Your browser does not support this media type.</p>
			</object>
		{/if}
	</div>

	<div class="qti-media-stats flex items-center justify-between text-sm text-base-content/70" part="stats">
		<div>
			<span class="font-medium">Play count:</span>
			<span class="ml-2">{playCount}</span>
		</div>

		{#if parsedInteraction.minPlays > 0}
			<div class="flex items-center gap-2">
				{#if hasMetMinPlays}
					<span class="badge badge-success badge-sm">✓ Requirement met</span>
				{:else}
					<span class="badge badge-warning badge-sm">
						Play at least {parsedInteraction.minPlays} time{parsedInteraction.minPlays === 1 ? '' : 's'}
					</span>
				{/if}
			</div>
		{/if}

		{#if parsedInteraction.maxPlays > 0}
			<div>
				<span class="font-medium">Remaining:</span>
				<span class="ml-2">{Math.max(0, parsedInteraction.maxPlays - playCount)}</span>
			</div>
		{/if}
	</div>

		{#if hasReachedMaxPlays}
			<div class="alert alert-info">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					part="limit-icon"
					class="qti-icon stroke-current shrink-0 w-6 h-6"
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
	{/if}
</div>

<style>
	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex: 0 0 auto;
	}
	/* Minimal layout if host doesn't provide utility classes */
	.qti-media-interaction {
		display: grid;
		gap: 0.75rem;
	}
	.qti-media-container :global(audio),
	.qti-media-container :global(video),
	.qti-media-container :global(object) {
		width: 100%;
		max-width: 100%;
		display: block;
	}
	.qti-media-stats {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
</style>
