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
		<div class="alert alert-error">
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
			onResponseChange={handleResponseChange}
		/>

		{#if role === 'candidate' && !disabled && onSubmit}
			{@const canSubmit = player.canSubmitResponses(currentResponses)}
			<div class="mt-6 flex items-center gap-4">
				<button
					class="btn btn-primary"
					onclick={() => handleSubmit(true)}
					disabled={isCompleted || !canSubmit}
				>
					{isAdaptive && isCompleted ? (i18n?.t('item.completed') ?? 'item.completed') : (i18n?.t('item.submit') ?? 'item.submit')}
				</button>

				{#if isAdaptive}
					<div class="text-sm text-base-content/70">
						{#if isCompleted}
							<span class="badge badge-success">{i18n?.t('item.complete') ?? 'item.complete'}</span>
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
		<div class="alert alert-info">
			<span>{i18n?.t('item.loading') ?? 'item.loading'}</span>
		</div>
	{/if}
</div>
