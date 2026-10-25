<script lang="ts">
	import type { AssessmentPlayer } from '../core/AssessmentPlayer.js';
	import type { I18nProvider } from '@pie-qti/i18n';
	import { TimeManager } from '../core/TimeManager.js';

	interface Props {
		player: AssessmentPlayer;
		i18n?: I18nProvider;
		/** Show timer even when no time limit */
		showElapsed?: boolean;
		/** Position of timer. `start`/`end` follow the inline direction; `left`/`right` are physical. */
		position?:
			| 'top-end'
			| 'top-start'
			| 'bottom-end'
			| 'bottom-start'
			| 'top-right'
			| 'top-left'
			| 'bottom-right'
			| 'bottom-left';
	}

	let { player, i18n, showElapsed = false, position = 'top-end' }: Props = $props();

	const formatTime = (seconds: number) => TimeManager.formatTime(seconds, i18n?.formatNumber?.bind(i18n));

	// State
	let remainingSeconds = $state<number | null>(null);
	let elapsedSeconds = $state(0);
	let isWarning = $state(false);
	let isExpired = $state(false);
	let announcement = $state('');
	let announcementPriority = $state<'polite' | 'assertive'>('polite');

	// Initialize state and subscribe to timer events
	$effect(() => {
		// Initialize from player
		remainingSeconds = player.getRemainingTime();
		elapsedSeconds = player.getElapsedTime();
		isExpired = player.isTimeExpired();

		// Subscribe to timer events
		const unsubscribeWarning = player.onTimeWarning((remaining) => {
			isWarning = true;
			remainingSeconds = remaining;
			announcementPriority = 'polite';
			announcement =
				i18n?.t('assessment.timer.timeRemaining', { time: formatTime(remaining) }) ??
				`Time remaining: ${formatTime(remaining)}`;
		});

		const unsubscribeExpired = player.onTimeExpired(() => {
			isExpired = true;
			remainingSeconds = 0;
			announcementPriority = 'assertive';
			announcement = i18n?.t('assessment.timer.expired') ?? 'Time expired';
		});

		const unsubscribeTick = player.onTimeTick((remaining, elapsed) => {
			remainingSeconds = remaining;
			elapsedSeconds = elapsed;
		});

		// Cleanup subscriptions when effect reruns or component unmounts
		return () => {
			unsubscribeWarning?.();
			unsubscribeExpired?.();
			unsubscribeTick?.();
		};
	});

	// Derived values
	const displayTime = $derived(() => {
		if (remainingSeconds !== null && remainingSeconds >= 0) {
			return formatTime(remainingSeconds);
		}
		if (showElapsed) {
			return formatTime(elapsedSeconds);
		}
		return null;
	});

	const timerLabel = $derived(() => {
		if (remainingSeconds !== null) {
			return isExpired
				? (i18n?.t('assessment.timer.expired', 'Time Expired') ?? 'Time Expired')
				: (i18n?.t('assessment.timer.remaining', 'Time Remaining') ?? 'Time Remaining');
		}
		if (showElapsed) {
			return i18n?.t('assessment.timer.elapsed', 'Time Elapsed') ?? 'Time Elapsed';
		}
		return null;
	});
</script>

{#if displayTime()}
	<div
		class="assessment-timer"
		data-position={position}
		class:warning={isWarning && !isExpired}
		class:expired={isExpired}
		role="timer"
		aria-live="polite"
		aria-atomic="true"
		aria-label="{timerLabel()}: {displayTime()}"
	>
		<div class="timer-icon" aria-hidden="true">
			{#if isExpired}
				⏰
			{:else if isWarning}
				⏱️
			{:else}
				🕒
			{/if}
		</div>
		<div class="timer-content">
			<div class="timer-label">{timerLabel()}</div>
			<div class="timer-value">{displayTime()}</div>
		</div>
		<div class="sr-only" role={announcementPriority === 'assertive' ? 'alert' : 'status'} aria-live={announcementPriority} aria-atomic="true">
			{announcement}
		</div>
	</div>
{/if}

<style>
	.assessment-timer {
		position: fixed;
		z-index: 1000;
		background: hsl(var(--b1));
		border: 2px solid hsl(var(--bc) / 0.2);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		transition: all 0.3s ease;
	}

	.assessment-timer[data-position^='top'] {
		top: 1rem;
	}

	.assessment-timer[data-position^='bottom'] {
		bottom: 1rem;
	}

	.assessment-timer[data-position$='-end'] {
		inset-inline-end: 1rem;
	}

	.assessment-timer[data-position$='-start'] {
		inset-inline-start: 1rem;
	}

	/* The physical position values stay physical; -start and -end mirror. */
	.assessment-timer[data-position$='-right'] {
		right: 1rem; /* i18n-physical */
	}

	.assessment-timer[data-position$='-left'] {
		left: 1rem; /* i18n-physical */
	}

	.assessment-timer.warning {
		background: hsl(var(--wa) / 0.1);
		border-color: hsl(var(--wa));
		animation: pulse-warning 2s ease-in-out infinite;
	}

	.assessment-timer.expired {
		background: hsl(var(--er) / 0.1);
		border-color: hsl(var(--er));
		animation: pulse-error 1s ease-in-out infinite;
	}

	.timer-icon {
		font-size: 1.5rem;
		line-height: 1;
	}

	.timer-content {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.timer-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: hsl(var(--bc) / 0.6);
	}

	.assessment-timer.warning .timer-label {
		color: hsl(var(--wa));
	}

	.assessment-timer.expired .timer-label {
		color: hsl(var(--er));
	}

	.timer-value {
		font-size: 1.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: hsl(var(--bc));
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	.assessment-timer.warning .timer-value {
		color: hsl(var(--wa));
	}

	.assessment-timer.expired .timer-value {
		color: hsl(var(--er));
	}

	@keyframes pulse-warning {
		0%,
		100% {
			box-shadow:
				0 4px 6px -1px rgb(0 0 0 / 0.1),
				0 0 0 0 hsl(var(--wa) / 0.4);
		}
		50% {
			box-shadow:
				0 4px 6px -1px rgb(0 0 0 / 0.1),
				0 0 0 8px hsl(var(--wa) / 0);
		}
	}

	@keyframes pulse-error {
		0%,
		100% {
			box-shadow:
				0 4px 6px -1px rgb(0 0 0 / 0.1),
				0 0 0 0 hsl(var(--er) / 0.4);
		}
		50% {
			box-shadow:
				0 4px 6px -1px rgb(0 0 0 / 0.1),
				0 0 0 8px hsl(var(--er) / 0);
		}
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.assessment-timer {
			padding: 0.5rem 0.75rem;
			gap: 0.5rem;
		}

		.timer-icon {
			font-size: 1.25rem;
		}

		.timer-label {
			font-size: 0.625rem;
		}

		.timer-value {
			font-size: 1rem;
		}
	}
</style>
