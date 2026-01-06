<script lang="ts">
	
	import { onDestroy, onMount } from 'svelte';
import type { AssessmentPlayer } from '../core/AssessmentPlayer.js';
	import { TimeManager } from '../core/TimeManager.js';

	interface Props {
		player: AssessmentPlayer;
		/** Show timer even when no time limit */
		showElapsed?: boolean;
		/** Position of timer */
		position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
	}

	let { player, showElapsed = false, position = 'top-right' }: Props = $props();

	// State
	let remainingSeconds = $state<number | null>(null);
	let elapsedSeconds = $state(0);
	let isWarning = $state(false);
	let isExpired = $state(false);

	// Cleanup functions
	let unsubscribeWarning: (() => void) | null = null;
	let unsubscribeExpired: (() => void) | null = null;
	let unsubscribeTick: (() => void) | null = null;

	onMount(() => {
		// Initialize from player
		remainingSeconds = player.getRemainingTime();
		elapsedSeconds = player.getElapsedTime();
		isExpired = player.isTimeExpired();

		// Subscribe to timer events
		unsubscribeWarning = player.onTimeWarning((remaining) => {
			isWarning = true;
			remainingSeconds = remaining;
		});

		unsubscribeExpired = player.onTimeExpired(() => {
			isExpired = true;
			remainingSeconds = 0;
		});

		unsubscribeTick = player.onTimeTick((remaining, elapsed) => {
			remainingSeconds = remaining;
			elapsedSeconds = elapsed;
		});
	});

	onDestroy(() => {
		// Cleanup subscriptions
		unsubscribeWarning?.();
		unsubscribeExpired?.();
		unsubscribeTick?.();
	});

	// Derived values
	let displayTime = $derived(() => {
		if (remainingSeconds !== null && remainingSeconds >= 0) {
			return TimeManager.formatTime(remainingSeconds);
		}
		if (showElapsed) {
			return TimeManager.formatTime(elapsedSeconds);
		}
		return null;
	});

	let timerLabel = $derived(() => {
		if (remainingSeconds !== null) {
			return isExpired ? 'Time Expired' : 'Time Remaining';
		}
		if (showElapsed) {
			return 'Time Elapsed';
		}
		return null;
	});

	// Position classes
	const positionClasses = {
		'top-right': 'top-4 right-4',
		'top-left': 'top-4 left-4',
		'bottom-right': 'bottom-4 right-4',
		'bottom-left': 'bottom-4 left-4',
	};
</script>

{#if displayTime()}
	<div
		class="assessment-timer {positionClasses[position]}"
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
