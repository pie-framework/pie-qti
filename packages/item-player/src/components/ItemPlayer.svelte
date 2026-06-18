<script lang="ts">
	import { Player } from '../core/Player';
	import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
	import type { AdaptiveAttemptResult, ModalFeedback, PlayerSecurityConfig, QTIRole, ScoringResult } from '../types';
	import type { PnpProfile } from '../pnp/types';
	import type { InteractionResponseValue } from '../web-components';
	import type { I18nProvider } from '@pie-qti/i18n';
	import { typesetMathInElement } from '@pie-qti/typeset-katex';
	import ItemBody from './ItemBody.svelte';
	import ModalFeedbackDisplay from './ModalFeedbackDisplay.svelte';

	type ItemResponseValue = InteractionResponseValue | null;
	type ItemResponseMap = Record<string, ItemResponseValue>;

	interface Props {
		itemXml: string;
		role?: QTIRole;
		/** Optional security config (URL policy, embed allowances, Trusted Types). */
		security?: PlayerSecurityConfig;
		/** QTI 3.0 Personal Needs and Preferences profile */
		pnp?: PnpProfile;
		/** Package/assessment-resolved delivery context */
		deliveryContext?: ResolvedItemDeliveryContext;
		/** Controlled/current responses, keyed by response identifier */
		responses?: ItemResponseMap;
		disabled?: boolean;
		renderItemBodyRubrics?: boolean;
		typeset?: (element: HTMLElement) => void;
		i18n?: I18nProvider;
		onResponseChange?: (responseId: string, value: ItemResponseValue) => void;
		onSubmit?: (responses: ItemResponseMap, scoringResult: ScoringResult) => void;
		/** Called when adaptive item completes (all attempts exhausted) */
		onComplete?: (finalResult: AdaptiveAttemptResult) => void;
	}

	let {
		itemXml,
		role = 'candidate',
		security,
		pnp,
		deliveryContext,
		responses: responseValues = {},
		disabled = false,
		renderItemBodyRubrics = true,
		typeset,
		i18n,
		onResponseChange,
		onSubmit,
		onComplete,
	}: Props = $props();

	// Use host-provided typeset if given, otherwise fall back to the built-in KaTeX typesetter.
	const effectiveTypeset = $derived(typeset ?? typesetMathInElement);

	// Create player instance
	let player = $state<Player | null>(null);
	let currentResponses = $state<ItemResponseMap>({});
	let error = $state<string | null>(null);
	let modalFeedback = $state<ModalFeedback[]>([]);
	let outcomeValues = $state<Record<string, any>>({});
	let isAdaptive = $state(false);
	let isCompleted = $state(false);
	let numAttempts = $state(0);

	// Initialize player when XML changes
	$effect(() => {
		try {
			const newPlayer = new Player({ itemXml, role, security, pnp, deliveryContext });
			player = newPlayer;
			error = null;
			// Reset state when XML changes
			currentResponses = { ...responseValues };
			modalFeedback = [];
			outcomeValues = {};
			isAdaptive = newPlayer.isAdaptive();
			isCompleted = newPlayer.isCompleted();
			numAttempts = newPlayer.getNumAttempts();
		} catch (e) {
			error = e instanceof Error ? e.message : (i18n?.t('item.parsingError') ?? 'item.parsingError');
			player = null;
		}
	});

	$effect(() => {
		currentResponses = { ...responseValues };
	});

	function handleResponseChange(responseId: string, value: ItemResponseValue) {
		currentResponses = { ...currentResponses, [responseId]: value };
		onResponseChange?.(responseId, value);
	}

	function handleSubmit(countAttempt: boolean = true) {
		if (!player) return;

		try {
			// Set responses in player
			player.setResponses(currentResponses);

			// For adaptive items, use submitAttempt()
			if (isAdaptive && !isCompleted) {
				const result = player.submitAttempt(countAttempt);

				// Update state
				numAttempts = result.numAttempts;
				isCompleted = result.completed;
				modalFeedback = result.modalFeedback || [];
				outcomeValues = result.outcomeValues || {};

				// Notify parent
				onSubmit?.(currentResponses, result);

				// If completed, notify parent
				if (result.completed && onComplete) {
					onComplete(result);
				}
			} else {
				// Non-adaptive item: use standard processResponses()
				const result = player.processResponses();
				modalFeedback = result.modalFeedback || [];
				outcomeValues = result.outcomeValues || {};
				onSubmit?.(currentResponses, result);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : (i18n?.t('item.processingError') ?? 'item.processingError');
		}
	}

	function closeFeedback() {
		modalFeedback = [];
	}
</script>

<div class="qti-item-player">
	{#if error}
		<div class="qti-player-alert qti-player-alert-error">
			<span>{error}</span>
		</div>
	{:else if player}
		<ItemBody
			{player}
			responses={currentResponses}
			{disabled}
			{role}
			typeset={effectiveTypeset}
			{i18n}
			{deliveryContext}
			{outcomeValues}
			{renderItemBodyRubrics}
			onResponseChange={handleResponseChange}
		/>

		{#if role === 'candidate' && !disabled && onSubmit}
			{@const canSubmit = player.canSubmitResponses(currentResponses)}
			<div class="qti-player-actions">
				<button
					class="qti-player-button qti-player-button-primary"
					onclick={() => handleSubmit(true)}
					disabled={isCompleted || !canSubmit}
				>
					{isAdaptive && isCompleted ? (i18n?.t('item.completed') ?? 'item.completed') : (i18n?.t('item.submit') ?? 'item.submit')}
				</button>

				{#if isAdaptive}
					<div class="qti-player-attempt-status">
						{#if isCompleted}
							<span class="qti-player-badge qti-player-badge-success">{i18n?.t('item.complete') ?? 'item.complete'}</span>
						{:else}
							<span>{i18n?.t('item.attempt', { numAttempts: numAttempts + 1 }) ?? `item.attempt (${numAttempts + 1})`}</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Modal feedback display -->
		<ModalFeedbackDisplay feedback={modalFeedback} onClose={closeFeedback} typeset={effectiveTypeset} {i18n} />
	{:else}
		<div class="qti-player-alert qti-player-alert-info">
			<span>{i18n?.t('item.loading') ?? 'item.loading'}</span>
		</div>
	{/if}
</div>

<style>
	.qti-item-player {
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.qti-player-alert {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.qti-player-alert-error {
		border-color: var(--pie-qti-error, oklch(71% 0.194 13.428));
		background: color-mix(in oklch, var(--pie-qti-error, oklch(71% 0.194 13.428)) 8%, transparent);
	}

	.qti-player-alert-info {
		border-color: var(--pie-qti-info, oklch(74% 0.16 232.661));
		background: color-mix(in oklch, var(--pie-qti-info, oklch(74% 0.16 232.661)) 8%, transparent);
	}

	.qti-player-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.qti-player-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		line-height: 1.1;
		cursor: pointer;
	}

	.qti-player-button-primary {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 12%, transparent);
	}

	.qti-player-button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.qti-player-button:focus-visible {
		outline: 2px solid var(--pie-qti-focus, var(--pie-qti-primary, oklch(45% 0.24 277)));
		outline-offset: 2px;
	}

	.qti-player-attempt-status {
		color: color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 70%, transparent);
		font-size: 0.875rem;
	}

	.qti-player-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 1.25rem;
		padding: 0 0.5rem;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.qti-player-badge-success {
		border-color: var(--pie-qti-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 12%, transparent);
	}
</style>
