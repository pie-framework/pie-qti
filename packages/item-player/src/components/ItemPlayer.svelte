<script lang="ts">
	import { createAssessmentItemDefinition } from '../core/AssessmentItemDefinition';
	import type { AssessmentItemDefinitionConfig } from '../core/AssessmentItemDefinition';
	import type { ItemSession, ItemSessionView } from '../core/ItemSession';
	import type { AssessmentItemDefinitionPlugin } from '../core/AssessmentItemDefinition';
	import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
	import type { AdaptiveAttemptResult, ModalFeedback, PlayerSecurityConfig, QTIRole, ScoringResult } from '../types';
	import type { PnpProfile } from '../pnp/types';
	import type { InteractionResponseValue } from '../web-components';
	import type { I18nProvider } from '@pie-qti/i18n';
	import { untrack } from 'svelte';
	import ItemBody from './ItemBody.svelte';
	import ModalFeedbackDisplay from './ModalFeedbackDisplay.svelte';

	type ItemResponseValue = InteractionResponseValue | null;
	type ItemResponseMap = Record<string, ItemResponseValue>;

	interface Props {
		itemXml: string;
		/** Externally owned live session. When present, itemXml is display metadata only. */
		session?: ItemSession;
		role?: QTIRole;
		/** Optional security config (URL policy, embed allowances, Trusted Types). */
		security?: PlayerSecurityConfig;
		/** QTI 3.0 Personal Needs and Preferences profile */
		pnp?: PnpProfile;
		/** Package/assessment-resolved delivery context */
		deliveryContext?: ResolvedItemDeliveryContext;
		/** Host-owned resolver for package-local xi:include processing fragments. */
		resolveProcessingFragment?: AssessmentItemDefinitionConfig['resolveProcessingFragment'];
		processingFragmentLimits?: AssessmentItemDefinitionConfig['processingFragmentLimits'];
		/** Explicit opt-in and host resolver for Portable Custom Interaction modules. */
		pci?: AssessmentItemDefinitionConfig['pci'];
		/** Definition-lifetime extractor and renderer extensions for standalone delivery. */
		plugins?: readonly AssessmentItemDefinitionPlugin[];
		/** Controlled/current responses, keyed by response identifier */
		responses?: ItemResponseMap;
		disabled?: boolean;
		renderItemBodyRubrics?: boolean;
		typeset?: (element: HTMLElement) => void;
		i18n?: I18nProvider;
		onResponseChange?: (responseId: string, value: ItemResponseValue) => void;
		onSubmit?: (responses: ItemResponseMap, scoringResult: ScoringResult) => void;
		/** Controls the built-in submit action independently from the submission callback. */
		showSubmit?: boolean;
		/** Called when adaptive item completes (all attempts exhausted) */
		onComplete?: (finalResult: AdaptiveAttemptResult) => void;
	}

	let {
		itemXml,
		session,
		role = 'candidate',
		security,
		pnp,
		deliveryContext,
		resolveProcessingFragment,
		processingFragmentLimits,
		pci,
		plugins,
		responses: responseValues = {},
		disabled = false,
		renderItemBodyRubrics = true,
		typeset,
		i18n,
		onResponseChange,
		onSubmit,
		showSubmit,
		onComplete,
	}: Props = $props();
	const shouldShowSubmit = $derived(showSubmit ?? Boolean(onSubmit));

	let activeSession = $state<ItemSession | null>(null);
	let sessionView = $state<ItemSessionView | null>(null);
	let error = $state<string | null>(null);
	let modalFeedback = $state<ModalFeedback[]>([]);
	const isAdaptive = $derived(sessionView?.adaptive ?? false);
	const isCompleted = $derived(sessionView?.completed ?? false);
	const numAttempts = $derived(sessionView?.numAttempts ?? 0);
	const canSubmit = $derived(sessionView?.canSubmit ?? false);
	const effectiveRole = $derived(sessionView?.role ?? role);

	function applySessionView(view: ItemSessionView) {
		sessionView = view;
	}

	// Reuse an externally owned session verbatim, or own one for standalone delivery.
	$effect(() => {
		let nextSession: ItemSession | null = null;
		let ownsSession = false;
		try {
			if (session) {
				nextSession = session;
			} else {
				const initialResponses = untrack(() => responseValues);
				const definition = createAssessmentItemDefinition({
					itemXml,
					role,
					security,
					pnp,
					deliveryContext,
					resolveProcessingFragment,
					processingFragmentLimits,
					pci,
					plugins,
				});
				nextSession = definition.openSession({ responses: initialResponses });
				ownsSession = true;
			}

			activeSession = nextSession;
			applySessionView(nextSession.state());
			error = null;
			modalFeedback = [];
			const unsubscribe = nextSession.subscribe(({ command, current }) => {
				applySessionView(current);
				if (current.disposed) {
					if (activeSession === nextSession) activeSession = null;
					return;
				}
				if (command.action === 'setResponse') {
					onResponseChange?.(
						command.responseIdentifier,
						current.responses[command.responseIdentifier] as ItemResponseValue
					);
				}
			});
			return () => {
				unsubscribe();
				if (ownsSession) nextSession?.dispose();
				if (activeSession === nextSession) {
					activeSession = null;
					sessionView = null;
				}
			};
		} catch (e) {
			if (ownsSession) nextSession?.dispose();
			error = e instanceof Error ? e.message : (i18n?.t('item.parsingError') ?? 'item.parsingError');
			activeSession = null;
			sessionView = null;
		}
	});

	// Preserve the controlled-responses convenience only for standalone sessions.
	// An injected session is authoritative and is never synchronized from snapshots.
	$effect(() => {
		const controlledResponses = responseValues;
		const currentSession = activeSession;
		if (!currentSession || session) return;
		const current = currentSession.state().responses;
		const keys = new Set([...Object.keys(current), ...Object.keys(controlledResponses)]);
		const changed = [...keys].some((key) => current[key] !== controlledResponses[key]);
		if (!changed) return;
		try {
			currentSession.dispatch({ action: 'setResponses', responses: controlledResponses });
		} catch (e) {
			error = e instanceof Error ? e.message : (i18n?.t('item.processingError') ?? 'item.processingError');
		}
	});

	function handleItemBodyError(cause: unknown) {
		error = cause instanceof Error ? cause.message : (i18n?.t('item.processingError') ?? 'item.processingError');
	}

	export function submit(countAttempt: boolean = true): ScoringResult | AdaptiveAttemptResult | undefined {
		if (!activeSession) return;

		try {
			const transition = activeSession.dispatch(
				isAdaptive
					? { action: 'submitAttempt', countAttempt }
					: { action: 'endAttempt', countAttempt }
			);
			const result = transition.result?.scoring;
			if (!result) throw new Error('Item session submission did not produce a scoring result');
			modalFeedback = result.modalFeedback || [];
			const responses = { ...transition.current.responses } as ItemResponseMap;
			onSubmit?.(responses, result);

			if (isAdaptive) {
				const adaptiveResult = result as AdaptiveAttemptResult;
				if (adaptiveResult.completed) onComplete?.(adaptiveResult);
				return adaptiveResult;
			}
			return result;
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
	{:else if activeSession && sessionView}
		<ItemBody
			session={activeSession}
			revision={sessionView.revision}
			{disabled}
			{typeset}
			{i18n}
			{renderItemBodyRubrics}
			onError={handleItemBodyError}
		/>

		{#if effectiveRole === 'candidate' && !disabled && shouldShowSubmit}
			<div class="qti-player-actions">
				<button
					class="qti-player-button qti-player-button-primary"
					onclick={() => submit(true)}
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
		<ModalFeedbackDisplay feedback={modalFeedback} onClose={closeFeedback} {typeset} {i18n} />
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
