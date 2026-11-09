<svelte:options customElement="pie-qti-media" />

<script lang="ts">
	import type { MediaInteractionData } from '@pie-qti/item-player';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { joinSentences, translate, translatePlural, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp, responseProp } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import {
		canStartPlay,
		defaultTextTrackIndex,
		formatPlaybackTime,
		normalizePlayCount,
		normalizePlayLimit,
		playableSources,
		playsLeft,
		renderableTracks,
		type SelectableTextTrack,
		selectableTextTracks,
	} from './mediaPlayback';

	interface Props {
		interaction?: MediaInteractionData | string;
		response?: number | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		onChange?: (value: number) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), onChange }: Props = $props();

	/** A paused player this close to the beginning has been returned to the start. */
	const START_EPSILON_SECONDS = 0.25;

	// Parse props that may be JSON strings (web component usage); the response is a value
	const parsedInteraction = $derived(parseJsonProp<MediaInteractionData>(interaction));
	const parsedResponse = $derived(responseProp(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();
	let mediaElement: HTMLAudioElement | HTMLVideoElement | null = $state(null);

	/** The response: how many plays have started (see `mediaPlayback.ts`). */
	const playCount = $derived(normalizePlayCount(parsedResponse));
	let isPlaying = $state(false);
	/** A counted play has started and not yet ended: pressing play resumes it. */
	let playInProgress = $state(false);
	/** A new play was requested and is about to start (between `play` and `playing`). */
	let pendingPlay = false;
	let muted = $state(false);
	let currentTime = $state(0);
	let duration = $state(Number.NaN);
	let selectedTrack: string | undefined = $state();
	let liveMessage = $state('');
	let liveToggle = false;

	const media = $derived(parsedInteraction?.mediaElement);
	const isPlayable = $derived(media?.type === 'audio' || media?.type === 'video');
	const maxPlays = $derived(normalizePlayLimit(parsedInteraction?.maxPlays));
	const minPlays = $derived(normalizePlayLimit(parsedInteraction?.minPlays));
	/**
	 * With a play limit the component owns playback: native controls (which can
	 * replay and seek without bound) give way to its own controls.
	 */
	const limitApplies = $derived(isPlayable && maxPlays > 0);
	const canStartNewPlay = $derived(canStartPlay(playCount, maxPlays));
	const hasReachedMaxPlays = $derived(maxPlays > 0 && !canStartNewPlay);
	/** The limit is spent and no play is left to resume. */
	const playBlocked = $derived(hasReachedMaxPlays && !playInProgress);
	const hasMetMinPlays = $derived(playCount >= minPlays);
	const remainingPlays = $derived(playsLeft(playCount, maxPlays));

	const sources = $derived(media ? playableSources(media) : []);
	const tracks = $derived(media ? renderableTracks(media) : []);
	const textTracks = $derived(media?.type === 'video' ? selectableTextTracks(tracks) : []);
	const textTrackValue = $derived(
		selectedTrack ?? String(defaultTextTrackIndex(textTracks) ?? ''),
	);

	const idToken = $derived((parsedInteraction?.responseId ?? 'media').replace(/[^A-Za-z0-9_-]/g, '-'));
	const promptId = $derived(`qti-media-prompt-${idToken}`);
	const playsLeftId = $derived(`qti-media-plays-left-${idToken}`);
	const limitNoticeId = $derived(`qti-media-limit-${idToken}`);
	const showLimitNotice = $derived(limitApplies && playBlocked);

	const t = (key: string, fallback: string, values?: Record<string, unknown>) => translate(i18n, key, fallback, values);
	const mediaLabel = $derived(t('interactions.media.ariaLabel', 'Media content'));
	const limitMessage = $derived(t('interactions.media.maxPlayLimitReached', 'Maximum play limit reached'));

	/** Announce through the polite live region; a repeat still changes the DOM. */
	function announce(message: string) {
		liveToggle = !liveToggle;
		liveMessage = liveToggle ? message : `${message}\u00A0`;
	}

	function countPlay() {
		const next = playCount + 1;
		response = next;
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: next, onChange });

		const started = limitApplies
			? t('interactions.media.playStartedOfMax', 'Play {count} of {max} started.', { count: next, max: maxPlays })
			: minPlays > 0
				? t('interactions.media.playStarted', 'Play {count} started.', { count: next })
				: null;
		if (started) {
			announce(
				joinSentences(
					started,
					next === minPlays && t('interactions.media.requiredPlaysReached', 'Required number of plays reached.'),
				),
			);
		}
	}

	/**
	 * `play` fires whenever playback is requested — by these controls, native
	 * controls, autoplay, a loop restart, media keys or a browser menu — and
	 * before any sound, so a play past the limit is refused here.
	 */
	function handlePlay() {
		const element = mediaElement;
		if (!element) return;
		if (!playInProgress) {
			const refuse = disabled ? limitApplies : !canStartNewPlay;
			if (refuse) {
				element.pause();
				if (!disabled) announce(limitMessage);
				return;
			}
			pendingPlay = !disabled;
		}
		isPlaying = true;
	}

	/**
	 * `playing` fires once media is actually playing, so a requested play counts
	 * here: a source that fails to load never consumes one of the allowed plays.
	 */
	function handlePlaying() {
		isPlaying = true;
		if (!pendingPlay || playInProgress) return;
		pendingPlay = false;
		playInProgress = true;
		countPlay();
	}

	function handlePause() {
		isPlaying = false;
	}

	function handleEnded() {
		isPlaying = false;
		pendingPlay = false;
		playInProgress = false;
		const element = mediaElement;
		if (!element || !parsedInteraction) return;
		if (hasReachedMaxPlays) {
			announce(limitMessage);
			return;
		}
		// `loop` restarts manually so each pass counts as a play and honors maxPlays.
		if (parsedInteraction.loop && !disabled) {
			Promise.resolve(element.play()).catch(() => {});
		}
	}

	/** Returning a paused player to the beginning makes the next start a new play. */
	function handleSeeked() {
		const element = mediaElement;
		if (element?.paused && element.currentTime <= START_EPSILON_SECONDS) playInProgress = false;
	}

	function handleTimeUpdate() {
		if (mediaElement) currentTime = mediaElement.currentTime;
	}

	function handleDurationChange() {
		if (mediaElement) duration = mediaElement.duration;
	}

	function handleVolumeChange() {
		muted = mediaElement?.muted ?? false;
	}

	function togglePlayback() {
		const element = mediaElement;
		if (!element || disabled) return;
		if (!element.paused) {
			element.pause();
			return;
		}
		if (playBlocked) {
			announce(limitMessage);
			return;
		}
		// Rejections (autoplay policy, an interrupted request) leave state to the events.
		Promise.resolve(element.play()).catch(() => {});
	}

	function toggleMute() {
		const element = mediaElement;
		if (!element || disabled) return;
		element.muted = !element.muted;
		muted = element.muted;
	}

	/** Show one caption or subtitle track (by its `textTracks` index), or none. */
	function selectTextTrack(value: string) {
		selectedTrack = value;
		const list = mediaElement?.textTracks;
		if (!list) return;
		for (let index = 0; index < list.length; index += 1) {
			const textTrack = list[index];
			if (!textTrack || (textTrack.kind !== 'captions' && textTrack.kind !== 'subtitles')) continue;
			textTrack.mode = String(index) === value ? 'showing' : 'disabled';
		}
	}

	function textTrackLabel(entry: SelectableTextTrack, position: number): string {
		if (entry.track.label) return entry.track.label;
		if (entry.track.srclang) {
			try {
				const names = new Intl.DisplayNames([i18n?.getLocale().replace(/_/g, '-') || 'en'], { type: 'language' });
				const name = names.of(entry.track.srclang);
				if (name) return name;
			} catch {
				// An unknown language tag falls through to the numbered label.
			}
		}
		return t('interactions.media.trackFallbackLabel', 'Track {index}', { index: position + 1 });
	}

	// Disabling a limited interaction stops playback: it may not run uncounted.
	$effect(() => {
		if (disabled && limitApplies && mediaElement && !mediaElement.paused) mediaElement.pause();
	});

	/** The browser's own menu would offer "Show controls" and "Loop" past the limit. */
	function preventMediaMenu(event: MouseEvent) {
		if (limitApplies) event.preventDefault();
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} class="qti-media-interaction space-y-3" part="root">
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction || !media}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div id={promptId} part="prompt" class="qti-media-prompt qti-rich-content font-semibold">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<div class="qti-media-container media-container" part="media">
			{#if media.type === 'audio'}
				<audio
					bind:this={mediaElement}
					class="w-full"
					controls={!limitApplies}
					aria-label={parsedInteraction.prompt ? undefined : mediaLabel}
					aria-labelledby={parsedInteraction.prompt ? promptId : undefined}
					autoplay={parsedInteraction.autostart && !disabled && canStartNewPlay}
					preload="metadata"
					crossorigin={media.crossOrigin}
					onplay={handlePlay}
					onplaying={handlePlaying}
					onpause={handlePause}
					onended={handleEnded}
					onseeked={handleSeeked}
					ontimeupdate={handleTimeUpdate}
					onloadedmetadata={handleDurationChange}
					ondurationchange={handleDurationChange}
					onvolumechange={handleVolumeChange}
				>
					{#each sources as source}
						<source src={source.src} type={source.mimeType || undefined} />
					{/each}
					{#each tracks as track}
						<track kind={track.kind} src={track.src} srclang={track.srclang} label={track.label} default={track.default} />
					{/each}
					{t('interactions.media.audioNoSupport', 'Your browser does not support the audio element.')}
				</audio>
			{:else if media.type === 'video'}
				<!--
					Inline playback keeps the question on screen on iOS, which would
					otherwise take over in fullscreen. The unprefixed attribute needs
					iOS 10; the prefixed one (spread, as Svelte's video attribute
					types do not know it) covers older iOS WebViews.
				-->
				<video
					bind:this={mediaElement}
					class="w-full rounded-lg"
					controls={!limitApplies}
					aria-label={parsedInteraction.prompt ? undefined : mediaLabel}
					aria-labelledby={parsedInteraction.prompt ? promptId : undefined}
					autoplay={parsedInteraction.autostart && !disabled && canStartNewPlay}
					preload="metadata"
					crossorigin={media.crossOrigin}
					playsinline
					{...({ 'webkit-playsinline': true } as Record<string, unknown>)}
					disablepictureinpicture={limitApplies}
					disableremoteplayback={limitApplies}
					width={media.width}
					height={media.height}
					oncontextmenu={preventMediaMenu}
					onplay={handlePlay}
					onplaying={handlePlaying}
					onpause={handlePause}
					onended={handleEnded}
					onseeked={handleSeeked}
					ontimeupdate={handleTimeUpdate}
					onloadedmetadata={handleDurationChange}
					ondurationchange={handleDurationChange}
					onvolumechange={handleVolumeChange}
				>
					{#each sources as source}
						<source src={source.src} type={source.mimeType || undefined} />
					{/each}
					{#each tracks as track}
						<track kind={track.kind} src={track.src} srclang={track.srclang} label={track.label} default={track.default} />
					{/each}
					{t('interactions.media.videoNoSupport', 'Your browser does not support the video element.')}
				</video>
			{:else if media.type === 'object' && parsedInteraction.allowObjectEmbeds}
				<object
					data={media.src}
					type={media.mimeType}
					width={media.width}
					height={media.height}
					class="w-full"
					aria-label={mediaLabel}
				>
					<p>{t('interactions.media.browserNoSupport', 'Your browser does not support this media type.')}</p>
				</object>
			{:else if media.type === 'object'}
				<p class="qti-media-unavailable" part="unavailable">
					{t('interactions.media.objectDisabled', 'This item uses an embedded object type that is disabled by default for security.')}
				</p>
			{/if}
		</div>

		{#if limitApplies}
			<div class="qti-media-controls" part="controls" role="group" aria-label={t('interactions.media.controls', 'Media controls')}>
				<button
					type="button"
					part="play-button"
					class="qti-media-control"
					disabled={disabled}
					aria-disabled={playBlocked ? 'true' : undefined}
					aria-describedby={showLimitNotice ? `${playsLeftId} ${limitNoticeId}` : playsLeftId}
					onclick={togglePlayback}
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="qti-icon" aria-hidden="true" focusable="false">
						{#if isPlaying}
							<path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"></path>
						{:else}
							<path fill="currentColor" d="M8 5v14l11-7z"></path>
						{/if}
					</svg>
					<span>{isPlaying ? t('interactions.media.pause', 'Pause') : t('interactions.media.play', 'Play')}</span>
				</button>
				<button type="button" part="mute-button" class="qti-media-control" disabled={disabled} onclick={toggleMute}>
					{muted ? t('interactions.media.unmute', 'Unmute') : t('interactions.media.mute', 'Mute')}
				</button>
				{#if textTracks.length > 0}
					<label class="qti-media-captions" part="captions">
						<span>{t('interactions.media.captions', 'Captions')}</span>
						<select
							class="qti-media-select"
							value={textTrackValue}
							disabled={disabled}
							onchange={(event) => selectTextTrack(event.currentTarget.value)}
						>
							<option value="">{t('interactions.media.captionsOff', 'Off')}</option>
							{#each textTracks as entry, position (entry.index)}
								<option value={String(entry.index)}>{textTrackLabel(entry, position)}</option>
							{/each}
						</select>
					</label>
				{/if}
				<span class="qti-media-time" part="time">
					{t('interactions.media.currentTime', '{current} / {duration}', {
						current: formatPlaybackTime(currentTime),
						duration: formatPlaybackTime(duration),
					})}
				</span>
			</div>
		{/if}

		<div class="qti-media-stats flex items-center justify-between text-sm" part="stats">
			<div>
				<span class="font-medium">{t('interactions.media.playCount', 'Play count:')}</span>
				<span class="ms-2">{playCount}</span>
			</div>

			{#if limitApplies && remainingPlays !== null}
				<div id={playsLeftId} part="plays-left">
					{translatePlural(
						i18n,
						'interactions.media.playsLeft',
						{ one: '{count} play left', other: '{count} plays left' },
						remainingPlays,
					)}
				</div>
			{/if}

			{#if minPlays > 0}
				<div class="flex items-center gap-2">
					{#if hasMetMinPlays}
						<span class="badge badge-success badge-sm">{t('interactions.media.requirementMet', '✓ Requirement met')}</span>
					{:else}
						<span class="badge badge-warning badge-sm">
							{translatePlural(
								i18n,
								'interactions.media.playAtLeastCount',
								{ one: 'Play at least {count} time', other: 'Play at least {count} times' },
								minPlays,
							)}
						</span>
					{/if}
				</div>
			{/if}

			{#if minPlays > 0 && !hasMetMinPlays}
				<div part="plays-needed">
					{translatePlural(
						i18n,
						'interactions.media.playsNeeded',
						{ one: '{count} more play needed', other: '{count} more plays needed' },
						Math.max(0, minPlays - playCount),
					)}
				</div>
			{/if}
		</div>

		{#if showLimitNotice}
			<div id={limitNoticeId} class="alert alert-info" part="limit">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					part="limit-icon"
					class="qti-icon stroke-current shrink-0 w-6 h-6"
					aria-hidden="true"
					focusable="false"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					></path>
				</svg>
				<span>{limitMessage}</span>
			</div>
		{/if}

		<div class="sr-only" part="announcer" role="status" aria-live="polite" aria-atomic="true">{liveMessage}</div>
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
	/* Keep the authored aspect ratio (from width/height) as the video narrows on small screens. */
	.qti-media-container :global(video) {
		height: auto;
	}
	.qti-media-unavailable {
		margin: 0;
	}
	.qti-media-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	/* Primary K-12 targets: at least 44 by 44 CSS pixels. */
	.qti-media-control,
	.qti-media-select {
		box-sizing: border-box;
		min-block-size: 2.75rem;
		min-inline-size: 2.75rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
	}
	.qti-media-control {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding-block: 0.5rem;
		padding-inline: 1rem;
		font-weight: 600;
		cursor: pointer;
	}
	.qti-media-select {
		padding-block: 0.25rem;
		padding-inline: 0.5rem;
	}
	.qti-media-control:focus-visible,
	.qti-media-select:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	/* Inactive controls are exempt from contrast minimums; the state is also conveyed in text. */
	.qti-media-control:disabled,
	.qti-media-control[aria-disabled='true'],
	.qti-media-select:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
	.qti-media-captions {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.qti-media-time {
		font-variant-numeric: tabular-nums;
	}
	.qti-media-stats {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}
</style>
