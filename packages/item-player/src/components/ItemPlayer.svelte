<script lang="ts">
	import { createAssessmentItemDefinition } from '../core/AssessmentItemDefinition';
	import type { AssessmentItemDefinitionConfig } from '../core/AssessmentItemDefinition';
	import { getItemSessionBinding, UnknownResponseIdentifierError, type ItemSession, type ItemSessionView } from '../core/ItemSession';
	import type { AssessmentItemDefinitionPlugin } from '../core/AssessmentItemDefinition';
	import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
	import type { AdaptiveAttemptResult, ItemBodyError, ItemPlayerErrorDetail, ModalFeedback, PlayerSecurityConfig, QTIRole, ScoringResult } from '../types';
	import type { PnpProfile } from '../pnp/types';
	import type { InteractionResponseValue } from '../web-components';
	import { SESSION_INPUTS, type SessionInputKey } from '../session-inputs';
	import { interfaceLocaleAttributes, translate, type I18nProvider } from '@pie-qti/i18n';
	import { warnOnce } from '@pie-qti/qti-common';
	import { untrack } from 'svelte';
	import ItemBody from './ItemBody.svelte';
	import ModalFeedbackDisplay from './ModalFeedbackDisplay.svelte';
	import { endAttemptRequest } from './utils/endAttempt';

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
		/** String comparison folds beyond QTI's equality; see `AssessmentItemDefinitionConfig`. */
		stringComparison?: AssessmentItemDefinitionConfig['stringComparison'];
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
		/**
		 * Standalone presentation policy for a session the player owns, applied as QTI
		 * `itemSessionControl` is: integrated feedback (`feedbackInline` / `feedbackBlock`)
		 * defaults to hidden (`showFeedback="false"` is the QTI default) and correct responses
		 * stay hidden until the attempt ends. An injected `session` keeps its own policy.
		 */
		showFeedback?: boolean;
		/** Standalone opt-in: expose correct responses once the attempt has ended. */
		showSolution?: boolean;
		/** A session the player owns or applied rendered successfully. */
		onReady?: () => void;
		/** A load, response-processing, response-dispatch, submission or render failure; the raw message never renders to candidates. */
		onError?: (error: ItemPlayerErrorDetail) => void;
		/**
		 * The player's own session was opened (or replaced by a definition change). Hosts that
		 * re-parent the element keep it alive across a detach by taking it here.
		 */
		onOwnedSession?: (session: ItemSession) => void;
		/**
		 * An owned session left the player undisposed — it is the host's to keep or close. Paired
		 * with `onOwnedSession`; without it the player disposes its own sessions.
		 */
		onOwnedSessionRelease?: (session: ItemSession) => void;
		/**
		 * A session the host kept from a previous mount of this player (a detach/reattach), to
		 * adopt as its own instead of opening a fresh one. Read once per effect run.
		 */
		resumeSession?: () => ItemSession | undefined;
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
		stringComparison,
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
		showFeedback,
		showSolution,
		onReady,
		onError,
		onOwnedSession,
		onOwnedSessionRelease,
		resumeSession,
	}: Props = $props();
	const shouldShowSubmit = $derived(showSubmit ?? Boolean(onSubmit));

	let activeSession = $state<ItemSession | null>(null);
	let sessionView = $state<ItemSessionView | null>(null);
	/** Which failure the generic candidate message describes; the raw detail goes to `onError`. */
	let errorKind = $state<'load' | 'processing' | 'submission' | null>(null);
	let modalFeedback = $state<ModalFeedback[]>([]);
	// The message is derived so a locale switch re-translates it; raw strings never render.
	const errorMessage = $derived(
		errorKind === 'load'
			? translate(i18n, 'item.loadingError', 'Failed to load item')
			: errorKind === 'submission'
				? translate(i18n, 'item.submitError', 'Your answer could not be submitted. Please try again.')
				: errorKind === 'processing'
					? translate(i18n, 'item.processingError', 'Failed to process responses')
					: null
	);
	const isAdaptive = $derived(sessionView?.adaptive ?? false);
	const isCompleted = $derived(sessionView?.completed ?? false);
	const numAttempts = $derived(sessionView?.numAttempts ?? 0);
	const canSubmit = $derived(sessionView?.canSubmit ?? false);
	const effectiveRole = $derived(sessionView?.role ?? role);

	function applySessionView(view: ItemSessionView) {
		sessionView = view;
	}

	// Only a change to the item's definition-fixed inputs may re-open the session: any other
	// property write — disabled, i18n, typeset, responses, a no-op — must never re-create the
	// item's attempt state. The element's mount bridge invalidates every prop together, so each
	// session input is guarded by an equality-checked derived: unchanged values do not reach the
	// session effect below. The guarded inputs and their no-op-write normalization come from the
	// canonical descriptor in ../session-inputs.ts, the same one the element's setters retire
	// the owned session through.
	const sessionItemXml = $derived(SESSION_INPUTS.itemXml.sessionValue(itemXml));
	const sessionRole = $derived(SESSION_INPUTS.role.sessionValue(role));
	const sessionSecurity = $derived(SESSION_INPUTS.security.sessionValue(security));
	const sessionPnp = $derived(SESSION_INPUTS.pnp.sessionValue(pnp));
	const sessionDeliveryContext = $derived(SESSION_INPUTS.deliveryContext.sessionValue(deliveryContext));
	const sessionResolveProcessingFragment = $derived(SESSION_INPUTS.resolveProcessingFragment.sessionValue(resolveProcessingFragment));
	const sessionProcessingFragmentLimits = $derived(SESSION_INPUTS.processingFragmentLimits.sessionValue(processingFragmentLimits));
	const sessionPci = $derived(SESSION_INPUTS.pci.sessionValue(pci));
	const sessionPlugins = $derived(SESSION_INPUTS.plugins.sessionValue(plugins));
	const sessionStringComparison = $derived(SESSION_INPUTS.stringComparison.sessionValue(stringComparison));
	const sessionShowFeedback = $derived(SESSION_INPUTS.showFeedback.sessionValue(showFeedback));
	const sessionShowSolution = $derived(SESSION_INPUTS.showSolution.sessionValue(showSolution));
	// Not a session input: an injected session replaces the displayed one and never re-opens
	// the item's definition.
	const injectedSession = $derived(session);

	// The guarded session inputs, keyed by the canonical descriptor's property names. The
	// `satisfies` pins this explicit list to src/session-inputs.ts in both directions at
	// compile time: an input added to the descriptor but not guarded here, or guarded here
	// but absent from the descriptor, is a type error. ($derived expressions cannot be
	// generated at runtime, so the map is written out; the session-stability suite enforces
	// the same lockstep behaviorally by flipping every descriptor input on the element.)
	const sessionInputGuards = {
		itemXml: () => sessionItemXml,
		role: () => sessionRole,
		security: () => sessionSecurity,
		pnp: () => sessionPnp,
		deliveryContext: () => sessionDeliveryContext,
		resolveProcessingFragment: () => sessionResolveProcessingFragment,
		processingFragmentLimits: () => sessionProcessingFragmentLimits,
		pci: () => sessionPci,
		plugins: () => sessionPlugins,
		stringComparison: () => sessionStringComparison,
		showFeedback: () => sessionShowFeedback,
		showSolution: () => sessionShowSolution,
	} satisfies { [K in SessionInputKey]: () => unknown };

	// Stable per component instance and item text: a legitimate re-open of the same definition
	// replays the same template-processing random layout instead of re-randomizing the
	// candidate's view, while different items and different player instances stay independent.
	const templateSeedSalt = Math.floor(Math.random() * 0x7fffffff);
	function templateSeed(seedXml: string): number {
		let hash = (templateSeedSalt ^ seedXml.length) >>> 0;
		for (let i = 0; i < seedXml.length; i++) {
			hash = Math.imul(hash ^ seedXml.charCodeAt(i), 0x01000193) >>> 0;
		}
		return hash >>> 0;
	}

	/**
	 * Opens a session carrying the host's initial responses. Responses left over from a
	 * previous item (an element re-used across items) would otherwise fail the whole open:
	 * the identifiers the new item declares keep their values, the stale ones are dropped
	 * with a diagnostic.
	 */
	function openOwnedSession(
		definition: ReturnType<typeof createAssessmentItemDefinition>,
		initialResponses: ItemResponseMap,
		presentation: { showFeedback: boolean; showSolution: boolean }
	): ItemSession {
		try {
			return definition.openSession({ responses: initialResponses, presentation });
		} catch (error) {
			if (!(error instanceof UnknownResponseIdentifierError)) throw error;
			const session = definition.openSession({ presentation });
			const carried = declaredResponsesOnly(session, initialResponses);
			if (Object.keys(carried).length > 0) {
				session.dispatch({ action: 'setResponses', responses: carried });
			}
			return session;
		}
	}

	/**
	 * `responses` filtered to the identifiers `session` declares; the rest are stale values
	 * carried over from a previous item and are dropped with a diagnostic.
	 */
	function declaredResponsesOnly(session: ItemSession, responses: ItemResponseMap): ItemResponseMap {
		const declared = new Set(Object.keys(session.state().responses));
		for (const identifier of Object.keys(responses)) {
			if (!declared.has(identifier)) {
				warnOnce(
					`item-player:unknown-response-${identifier}`,
					`Dropped response '${identifier}' carried over from the previous item: this item declares no such response identifier.`
				);
			}
		}
		return Object.fromEntries(
			Object.entries(responses).filter(([identifier]) => declared.has(identifier))
		);
	}

	/** The item's identifier when the session can still report one; never throws. */
	function safeItemIdentifier(known: ItemSession | null): { itemIdentifier?: string } {
		if (!known) return {};
		try {
			const identifier = known.state().itemIdentifier;
			return identifier ? { itemIdentifier: identifier } : {};
		} catch {
			return {};
		}
	}

	// Reuse an externally owned session verbatim, own one for standalone delivery, or adopt the
	// session a host kept for this player across a detach.
	$effect(() => {
		let nextSession: ItemSession | null = null;
		let ownsSession = false;
		let knownIdentifier: string | undefined;
		// Callbacks are read untracked: only the guarded session inputs above may re-run this
		// effect, so any host callback the run invokes must not subscribe it to prop writes.
		const callbacks = untrack(() => ({
			onReady,
			onError,
			onOwnedSession,
			resumeSession,
		}));
		try {
			if (injectedSession) {
				nextSession = injectedSession;
			} else {
				const resumable = callbacks.resumeSession?.();
				if (resumable && !resumable.state().disposed) {
					nextSession = resumable;
				} else {
					const initialResponses = untrack(() => responseValues);
					const definition = createAssessmentItemDefinition({
						itemXml: sessionItemXml,
						role: sessionRole,
						security: sessionSecurity,
						pnp: sessionPnp,
						deliveryContext: sessionDeliveryContext,
						resolveProcessingFragment: sessionResolveProcessingFragment,
						processingFragmentLimits: sessionProcessingFragmentLimits,
						pci: sessionPci,
						plugins: sessionPlugins,
						...(sessionStringComparison ? { stringComparison: sessionStringComparison } : {}),
						seed: templateSeed(sessionItemXml),
					});
					knownIdentifier = definition.identifier || undefined;
					nextSession = openOwnedSession(definition, initialResponses, {
						showFeedback: sessionShowFeedback,
						showSolution: sessionShowSolution,
					});
				}
				ownsSession = true;
				callbacks.onOwnedSession?.(nextSession);
			}

			activeSession = nextSession;
			applySessionView(nextSession.state());
			errorKind = null;
			modalFeedback = [];
			callbacks.onReady?.();
			const unsubscribe = nextSession.subscribe((transition) => {
				const { command, current } = transition;
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
					// Activating an endAttemptInteraction ends the attempt. Only a session this player
					// owns is submitted here, after the dispatch has finished notifying so every
					// subscriber sees the response change first. An externally owned session (assessment
					// delivery) is decided by its owner — closing it locally would make the owner's
					// later submission throw.
					const request = ownsSession
						? endAttemptRequest(transition, () => nextSession?.present().flow ?? [])
						: null;
					if (request) {
						queueMicrotask(() => {
							if (activeSession === nextSession) submit(request.countAttempt);
						});
					}
				}
			});
			return () => {
				unsubscribe();
				if (ownsSession && nextSession) {
					// A host keeping its element's session alive across a detach takes it here;
					// otherwise the player owns the session and closes it.
					if (onOwnedSessionRelease) onOwnedSessionRelease(nextSession);
					else nextSession.dispose();
				}
				if (activeSession === nextSession) {
					activeSession = null;
					sessionView = null;
				}
			};
		} catch (e) {
			if (ownsSession) nextSession?.dispose();
			errorKind = 'load';
			callbacks.onError?.({
				code: 'item-load-failed',
				message: e instanceof Error ? e.message : String(e),
				...(knownIdentifier ? { itemIdentifier: knownIdentifier } : {}),
			});
			activeSession = null;
			sessionView = null;
		}
	});

	// Preserve the controlled-responses convenience only for standalone sessions.
	// An injected session is authoritative and is never synchronized from snapshots.
	$effect(() => {
		const controlledResponses = responseValues;
		const currentSession = activeSession;
		if (!currentSession || injectedSession) return;
		const current = currentSession.state().responses;
		// Only the responses this item declares apply: values carried over from a previous item
		// (an element re-used across items) are dropped rather than failing the item.
		const applicable = declaredResponsesOnly(currentSession, controlledResponses);
		const keys = new Set([...Object.keys(current), ...Object.keys(applicable)]);
		const changed = [...keys].some((key) => current[key] !== applicable[key]);
		if (!changed) return;
		try {
			currentSession.dispatch({ action: 'setResponses', responses: applicable });
		} catch (e) {
			errorKind = 'processing';
			onError?.({
				code: 'response-processing-failed',
				message: e instanceof Error ? e.message : String(e),
				...safeItemIdentifier(currentSession),
			});
		}
	});

	/**
	 * A render failure keeps the item on screen — the failed interaction stands in
	 * as a visible alert in the body — so only the coded detail goes to the host.
	 * A rejected response write takes the generic processing message, as before.
	 */
	function handleItemBodyError(error: ItemBodyError) {
		if (error.code === 'response-dispatch-failed') errorKind = 'processing';
		onError?.({
			code: error.code,
			message: error.cause instanceof Error ? error.cause.message : String(error.cause),
			...safeItemIdentifier(activeSession),
		});
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
			errorKind = 'submission';
			onError?.({
				code: 'submission-failed',
				message: e instanceof Error ? e.message : String(e),
				...safeItemIdentifier(activeSession),
			});
		}
	}

	function closeFeedback() {
		modalFeedback = [];
	}

	// The player's chrome (status, submit, feedback controls) takes the interface
	// locale; the item body inside sets its own from the item's language.
	const interfaceAttributes = $derived(interfaceLocaleAttributes(i18n));

	// Surface silently-degraded setup: without a provider, UI messages fall back to
	// English and lang/dir attributes are never set.
	$effect(() => {
		if (!i18n) {
			warnOnce(
				'item-player:i18n-missing',
				'No i18n provider configured: UI messages fall back to English and lang/dir attributes are not set. Pass an I18nProvider from @pie-qti/i18n via the i18n property.',
			);
		}
	});
	const contentLanguage = $derived(activeSession ? getItemSessionBinding(activeSession).getContentLanguage() : undefined);
</script>

<div class="qti-item-player" lang={interfaceAttributes?.lang} dir={interfaceAttributes?.dir}>
	{#if errorMessage}
		<div class="qti-player-alert qti-player-alert-error" role="alert">
			<span>{errorMessage}</span>
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
					{isAdaptive && isCompleted ? translate(i18n, 'item.completed', 'Completed') : translate(i18n, 'item.submit', 'Submit')}
				</button>

				{#if isAdaptive}
					<div class="qti-player-attempt-status">
						{#if isCompleted}
							<span class="qti-player-badge qti-player-badge-success">{translate(i18n, 'item.complete', 'Complete')}</span>
						{:else}
							<span>{translate(i18n, 'item.attempt', 'Attempt {numAttempts}', { numAttempts: numAttempts + 1 })}</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Modal feedback display -->
		<ModalFeedbackDisplay feedback={modalFeedback} onClose={closeFeedback} {typeset} {i18n} {contentLanguage} />
	{:else}
		<div class="qti-player-alert qti-player-alert-info" role="status">
			<span>{translate(i18n, 'item.loading', 'Loading item...')}</span>
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
		min-height: 2.75rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
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
		outline: 2px solid var(--pie-qti-focus, #4338ca);
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
