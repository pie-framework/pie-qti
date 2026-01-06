<script lang="ts">
	import { Player } from '../core/Player';
	import type { AdaptiveAttemptResult, ModalFeedback, PlayerSecurityConfig, QTIRole } from '../types';
	import ItemBody from './ItemBody.svelte';
	import ModalFeedbackDisplay from './ModalFeedbackDisplay.svelte';

	interface Props {
		itemXml: string;
		role?: QTIRole;
		/** Optional security config (URL policy, embed allowances, Trusted Types). */
		security?: PlayerSecurityConfig;
		disabled?: boolean;
		typeset?: (element: HTMLElement) => void;
		onResponseChange?: (responseId: string, value: any) => void;
		onSubmit?: (responses: Record<string, any>, scoringResult: any) => void;
		/** Called when adaptive item completes (all attempts exhausted) */
		onComplete?: (finalResult: AdaptiveAttemptResult) => void;
	}

	let {
		itemXml,
		role = 'candidate',
		security,
		disabled = false,
		typeset,
		onResponseChange,
		onSubmit,
		onComplete,
	}: Props = $props();

	// Create player instance
	let player = $state<Player | null>(null);
	let responses = $state<Record<string, any>>({});
	let error = $state<string | null>(null);
	let modalFeedback = $state<ModalFeedback[]>([]);
	let isAdaptive = $state(false);
	let isCompleted = $state(false);
	let numAttempts = $state(0);

	// Initialize player when XML changes
	$effect(() => {
		try {
			player = new Player({ itemXml, role, security });
			error = null;
			// Reset state when XML changes
			responses = {};
			modalFeedback = [];
			isAdaptive = player.isAdaptive();
			isCompleted = player.isCompleted();
			numAttempts = player.getNumAttempts();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to parse QTI XML';
			player = null;
		}
	});

	function handleResponseChange(responseId: string, value: any) {
		responses = { ...responses, [responseId]: value };
		onResponseChange?.(responseId, value);
	}

	function handleSubmit(countAttempt: boolean = true) {
		if (!player) return;

		try {
			// Set responses in player
			player.setResponses(responses);

			// For adaptive items, use submitAttempt()
			if (isAdaptive && !isCompleted) {
				const result = player.submitAttempt(countAttempt);

				// Update state
				numAttempts = result.numAttempts;
				isCompleted = result.completed;
				modalFeedback = result.modalFeedback || [];

				// Notify parent
				onSubmit?.(responses, result);

				// If completed, notify parent
				if (result.completed && onComplete) {
					onComplete(result);
				}
			} else {
				// Non-adaptive item: use standard processResponses()
				const result = player.processResponses();
				modalFeedback = result.modalFeedback || [];
				onSubmit?.(responses, result);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to process responses';
		}
	}

	function closeFeedback() {
		modalFeedback = [];
	}
</script>

<div class="qti-item-player">
	{#if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{:else if player}
		<ItemBody
			{player}
			{responses}
			{disabled}
			{typeset}
			onResponseChange={handleResponseChange}
		/>

		{#if role === 'candidate' && !disabled && onSubmit}
			{@const canSubmit = player.canSubmitResponses(responses)}
			<div class="mt-6 flex items-center gap-4">
				<button
					class="btn btn-primary"
					onclick={() => handleSubmit(true)}
					disabled={isCompleted || !canSubmit}
				>
					{isAdaptive && isCompleted ? 'Completed' : 'Submit'}
				</button>

				{#if isAdaptive}
					<div class="text-sm text-base-content/70">
						{#if isCompleted}
							<span class="badge badge-success">Complete</span>
						{:else}
							<span>Attempt {numAttempts + 1}</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Modal feedback display -->
		<ModalFeedbackDisplay feedback={modalFeedback} onClose={closeFeedback} {typeset} />
	{:else}
		<div class="alert alert-info">
			<span>Loading item...</span>
		</div>
	{/if}
</div>
