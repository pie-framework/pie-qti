<script lang="ts">
	/**
	 * The candidate's countdown for the active scope's nearest hard time limit.
	 *
	 * - Reserves its space in the layout (it sits in the shell header, never an overlay).
	 * - The ticking readout is `role="timer"` with the live region OFF: the value changes
	 *   every second and must not chatter. Its accessible name carries the reading
	 *   ("Time remaining: 12:34").
	 * - Warnings fire per threshold through the core's `onTimeWarning` and are announced
	 *   once each through a separate polite status region; expiry through an assertive
	 *   alert region.
	 * - The candidate can hide the readout (`hidden` prop, persisted by the shell in the
	 *   session state like flags) and the paused state is shown while a proctor pause
	 *   freezes the clocks.
	 *
	 * Self-contained styling on the `--pie-qti-*` tokens; logical properties only, so it
	 * mirrors for RTL; the only animation is gated behind `prefers-reduced-motion`.
	 */
	import type { AssessmentPlayer } from '../core/AssessmentPlayer.js';
	import type { I18nProvider } from '@pie-qti/i18n';
	import { formatTime as formatClock } from '../core/formatTime.js';

	interface Props {
		player: AssessmentPlayer;
		i18n?: I18nProvider;
		/** Whether the candidate hid the countdown (persisted in the session state). */
		hidden?: boolean;
		/** Called when the candidate toggles visibility; the shell persists the choice. */
		onToggleHidden?: (hidden: boolean) => void;
	}

	let { player, i18n, hidden = false, onToggleHidden }: Props = $props();

	const uid = $props.id();
	const readoutId = `${uid}-readout`;

	let remainingSeconds = $state<number | null>(null);
	let expired = $state(false);
	let paused = $state(false);
	let warning = $state(false);
	let warningAnnouncement = $state('');
	let expiryAnnouncement = $state('');

	const t = (key: string, fallback: string, params?: Record<string, string | number>) =>
		i18n?.t(key, fallback, params) ?? fallback;

	const formatTime = (seconds: number) => formatClock(seconds, i18n?.formatNumber?.bind(i18n));

	/** Whole minutes read as sentences ("5 minutes remaining"); odd values as clock time. */
	function warningMessage(seconds: number): string {
		const minutes = seconds / 60;
		if (Number.isInteger(minutes) && minutes > 0) {
			return minutes === 1
				? t('assessment.timer.warningMinutesOne', '1 minute remaining')
				: t('assessment.timer.warningMinutes', '{count} minutes remaining', { count: minutes });
		}
		return t('assessment.timer.warningTime', '{time} remaining', { time: formatTime(seconds) });
	}

	$effect(() => {
		const state = player.getTimeState?.();
		remainingSeconds = state ? (state.limited ? state.remainingSeconds : null) : player.getRemainingTime();
		expired = state?.expired ?? player.isTimeExpired();
		paused = player.isPaused?.() ?? false;

		const offWarning = player.onTimeWarning((seconds) => {
			warning = true;
			remainingSeconds = seconds;
			warningAnnouncement = warningMessage(seconds);
		});
		const offExpired = player.onTimeExpired(() => {
			expired = true;
			warning = false;
			remainingSeconds = 0;
			expiryAnnouncement = t('assessment.timer.expired', 'Time expired');
		});
		const offTick = player.onTimeTick((rawSeconds) => {
			// Ticks deliver the raw remaining (it dips below zero on an expired
			// allowLateSubmission limit); the display never counts into the negative.
			const seconds = Math.max(0, rawSeconds);
			if (remainingSeconds !== null && seconds > remainingSeconds) {
				// A new limiting scope took over: its warnings and expiry start fresh.
				warning = false;
				expired = false;
			}
			if (seconds <= 0) expired = true;
			remainingSeconds = seconds;
			paused = player.isPaused?.() ?? false;
		});
		const offPause = player.onPauseChange?.((isPaused) => {
			paused = isPaused;
		});
		return () => {
			offWarning();
			offExpired();
			offTick();
			offPause?.();
		};
	});

	const readoutName = $derived.by(() => {
		if (remainingSeconds === null) return null;
		const time = formatTime(remainingSeconds);
		if (expired) return t('assessment.timer.expired', 'Time expired');
		if (paused) return `${t('assessment.timer.paused', 'Paused')}: ${time}`;
		return t('assessment.timer.timeRemaining', 'Time remaining: {time}', { time });
	});

	/**
	 * The control's one name in both states (WCAG 4.1.2): it names the countdown it
	 * controls, and `aria-expanded` alone carries whether the countdown is showing.
	 * A label that flipped with the state ("Show timer" / "Hide timer") would change
	 * the name a voice-control user speaks on every press while `aria-expanded`
	 * announced the same fact again.
	 */
	const toggleLabel = $derived(t('assessment.timer.label', 'Timer'));

	function toggleHidden() {
		onToggleHidden?.(!hidden);
	}
</script>

<div
	class="assessment-timer"
	data-testid="assessment-timer"
	data-timer-state={expired ? 'expired' : paused ? 'paused' : warning ? 'warning' : 'running'}
>
	<!-- A disclosure named by what it reveals: the name stays "Timer" in both states
	     and `aria-expanded` says which one it is in. aria-controls names the readout
	     only while it exists: removed when hidden, a dangling reference would point
	     at nothing. -->
	<button
		type="button"
		class="timer-toggle"
		data-testid="assessment-timer-toggle"
		aria-expanded={!hidden}
		aria-controls={hidden || readoutName === null ? undefined : readoutId}
		onclick={toggleHidden}
	>
		<svg
			class="timer-toggle-icon"
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 12h3m-9 0h.01M12 3a9 9 0 100 18 9 9 0 000-18zm0 0v3m-6.364-.636l2.122 2.122M12 9v3l2 2"
			/>
		</svg>
		<span class="timer-toggle-label">{toggleLabel}</span>
	</button>

	{#if !hidden && readoutName !== null}
		<div
			id={readoutId}
			class="timer-readout"
			role="timer"
			aria-live="off"
			aria-atomic="true"
			aria-label={readoutName}
		>
			<span class="timer-value" data-testid="assessment-timer-value">{readoutName}</span>
		</div>
	{/if}

	<!--
		Announcement regions, present before their content changes so assistive
		technology picks the updates up: threshold warnings politely, expiry
		assertively. The ticking readout above never announces.
	-->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="assessment-timer-warning">
		{warningAnnouncement}
	</div>
	<div class="sr-only" role="alert" aria-live="assertive" aria-atomic="true" data-testid="assessment-timer-expired">
		{expiryAnnouncement}
	</div>
</div>

<style>
	.assessment-timer {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--pie-qti-space-2, 0.5rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-1, 0.25rem);
		padding-inline: var(--pie-qti-space-2, 0.5rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.timer-toggle {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		gap: var(--pie-qti-space-1, 0.25rem);
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-1, 0.25rem);
		padding-inline: var(--pie-qti-space-2, 0.5rem);
		border: 0;
		border-radius: var(--pie-qti-radius-sm, 0.25rem);
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.875em;
		font-weight: 600;
		line-height: 1.25;
		cursor: pointer;
	}

	.timer-toggle:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.timer-toggle-icon {
		flex: none;
		inline-size: 1.25rem;
		block-size: 1.25rem;
	}

	.timer-readout {
		display: inline-flex;
		align-items: center;
		gap: var(--pie-qti-space-2, 0.5rem);
		padding-block: var(--pie-qti-space-1, 0.25rem);
		padding-inline-end: var(--pie-qti-space-2, 0.5rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
	}

	.timer-value {
		font-size: 1em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		overflow-wrap: anywhere;
	}

	/* Warning and expiry are colour plus a data-state attribute, never colour alone. */
	.assessment-timer[data-timer-state='warning'] {
		border-color: var(--pie-qti-warning-text, #92400e);
	}

	.assessment-timer[data-timer-state='warning'] .timer-value,
	.assessment-timer[data-timer-state='warning'] .timer-toggle {
		color: var(--pie-qti-warning-text, #92400e);
	}

	.assessment-timer[data-timer-state='expired'] {
		border-color: var(--pie-qti-error-text, #b91c1c);
	}

	.assessment-timer[data-timer-state='expired'] .timer-value {
		color: var(--pie-qti-error-text, #b91c1c);
	}

	.assessment-timer[data-timer-state='paused'] .timer-value {
		font-weight: 600;
	}

	/* A gentle attention pulse in the warning state, never for reduced motion. */
	@media (prefers-reduced-motion: no-preference) {
		.assessment-timer[data-timer-state='warning'] {
			animation: timer-warning-pulse 2s ease-in-out infinite;
		}
	}

	@keyframes timer-warning-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 color-mix(in oklab, var(--pie-qti-warning-text, #92400e) 35%, transparent);
		}
		50% {
			box-shadow: 0 0 0 0.25rem color-mix(in oklab, var(--pie-qti-warning-text, #92400e) 0%, transparent);
		}
	}

	.sr-only {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	/* Phones: the toggle collapses to its icon; its name stays for assistive technology. */
	@media (max-width: 30rem) {
		.timer-toggle {
			min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
			padding-inline: var(--pie-qti-space-1, 0.25rem);
		}

		.timer-toggle-label {
			position: absolute;
			inline-size: 1px;
			block-size: 1px;
			margin: -1px;
			padding: 0;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
			border: 0;
		}
	}
</style>
