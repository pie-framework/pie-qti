<script lang="ts">
	
	import { onDestroy, onMount } from 'svelte';
import type { AssessmentPlayer } from '../core/AssessmentPlayer.js';

	interface Props {
		player: AssessmentPlayer;
		/** Where to position the info display */
		position?: 'inline' | 'floating';
		/** Show detailed information */
		showDetails?: boolean;
	}

	let { player, position = 'inline', showDetails = false }: Props = $props();

	let sessionInfo = $state<{
		canSubmit: boolean;
		remainingAttempts: number | null;
		attemptCount: number;
		showFeedback: boolean;
		showSolution: boolean;
		canReview: boolean;
		canSkip: boolean;
	} | null>(null);

	let unsubscribeItemChange: (() => void) | null = null;
	let unsubscribeResponseChange: (() => void) | null = null;

	function updateSessionInfo() {
		sessionInfo = player.getItemSessionInfo();
	}

	onMount(() => {
		updateSessionInfo();

		// Update when item changes
		unsubscribeItemChange = player.onItemChange(() => {
			updateSessionInfo();
		});

		// Update when responses change (affects attempt state)
		unsubscribeResponseChange = player.onResponseChange(() => {
			updateSessionInfo();
		});
	});

	onDestroy(() => {
		unsubscribeItemChange?.();
		unsubscribeResponseChange?.();
	});

	let hasAttemptLimit = $derived(
		sessionInfo?.remainingAttempts !== null && sessionInfo?.remainingAttempts !== undefined
	);

	let attemptsMessage = $derived(() => {
		if (!sessionInfo || !hasAttemptLimit) {
			return null;
		}

		if (sessionInfo.remainingAttempts === 0) {
			return `No attempts remaining (${sessionInfo.attemptCount} used)`;
		}

		if (sessionInfo.remainingAttempts === 1) {
			return `1 attempt remaining`;
		}

		return `${sessionInfo.remainingAttempts} attempts remaining`;
	});
</script>

{#if sessionInfo}
	<div
		class="item-session-info"
		class:inline={position === 'inline'}
		class:floating={position === 'floating'}
		class:no-attempts={hasAttemptLimit && sessionInfo.remainingAttempts === 0}
		class:low-attempts={hasAttemptLimit && sessionInfo.remainingAttempts === 1}
	>
		<!-- Attempt count indicator -->
		{#if hasAttemptLimit}
			<div class="session-badge" role="status" aria-live="polite">
				<span class="badge-icon" aria-hidden="true">
					{#if sessionInfo.remainingAttempts === 0}
						🚫
					{:else if sessionInfo.remainingAttempts === 1}
						⚠️
					{:else}
						📝
					{/if}
				</span>
				<span class="badge-text">{attemptsMessage()}</span>
			</div>
		{/if}

		<!-- Detailed information -->
		{#if showDetails}
			<div class="session-details">
				{#if sessionInfo.attemptCount > 0}
					<div class="detail-item">
						<span class="detail-label">Attempts:</span>
						<span class="detail-value">{sessionInfo.attemptCount}</span>
					</div>
				{/if}

				{#if !sessionInfo.canSubmit}
					<div class="detail-item warning">
						<span class="detail-label">Status:</span>
						<span class="detail-value">Max attempts reached</span>
					</div>
				{/if}

				{#if !sessionInfo.canSkip}
					<div class="detail-item info">
						<span class="detail-label">Required:</span>
						<span class="detail-value">Must answer before continuing</span>
					</div>
				{/if}

				{#if !sessionInfo.canReview}
					<div class="detail-item info">
						<span class="detail-label">Review:</span>
						<span class="detail-value">Not allowed once submitted</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.item-session-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.item-session-info.inline {
		padding: 0.75rem;
		background: hsl(var(--b2));
		border-radius: 0.5rem;
		border: 1px solid hsl(var(--bc) / 0.1);
	}

	.item-session-info.floating {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		padding: 0.75rem 1rem;
		background: hsl(var(--b1));
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		z-index: 100;
		border: 2px solid hsl(var(--bc) / 0.1);
	}

	.session-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: hsl(var(--b1));
		border-radius: 0.375rem;
		border: 1px solid hsl(var(--bc) / 0.1);
	}

	.item-session-info.no-attempts .session-badge {
		background: hsl(var(--er) / 0.1);
		border-color: hsl(var(--er));
		color: hsl(var(--er));
	}

	.item-session-info.low-attempts .session-badge {
		background: hsl(var(--wa) / 0.1);
		border-color: hsl(var(--wa));
		color: hsl(var(--wa));
	}

	.badge-icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	.badge-text {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.session-details {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-top: 0.5rem;
		border-top: 1px solid hsl(var(--bc) / 0.1);
	}

	.detail-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8125rem;
		padding: 0.25rem 0;
	}

	.detail-label {
		font-weight: 600;
		color: hsl(var(--bc) / 0.7);
	}

	.detail-value {
		color: hsl(var(--bc));
	}

	.detail-item.warning .detail-value {
		color: hsl(var(--er));
		font-weight: 600;
	}

	.detail-item.info .detail-value {
		color: hsl(var(--in));
		font-weight: 500;
	}

	@media (max-width: 640px) {
		.item-session-info.floating {
			bottom: 0.5rem;
			right: 0.5rem;
			left: 0.5rem;
			padding: 0.5rem 0.75rem;
		}

		.badge-text {
			font-size: 0.8125rem;
		}

		.badge-icon {
			font-size: 1.125rem;
		}
	}
</style>
