<svelte:options customElement="pie-qti-end-attempt" />

<script lang="ts">
	import type { EndAttemptInteractionData } from '@pie-qti/item-player';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { translate, type I18nProvider } from '@pie-qti/i18n';
	import { tick } from 'svelte';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import Icon from '../../shared/components/Icon.svelte';
	import { ICON_CHECK, ICON_CLOSE } from '../../shared/components/icons';
	import { parseJsonProp, responseProp } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';

	interface Props {
		interaction?: EndAttemptInteractionData | string;
		response?: boolean | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		onChange?: (value: boolean) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage); the response is a value
	const parsedInteraction = $derived(parseJsonProp<EndAttemptInteractionData>(interaction));
	const parsedResponse = $derived(responseProp(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();
	let mainButton: HTMLButtonElement | undefined = $state();
	let confirmButton: HTMLButtonElement | undefined = $state();
	let statusElement: HTMLDivElement | undefined = $state();

	// Track if the attempt has ended, and whether the candidate is being asked to confirm.
	let hasEnded = $state(false);
	let confirming = $state(false);
	// Focus is only moved to the status after a candidate-initiated end, never on restore.
	let focusStatusOnEnd = $state(false);

	const canInteract = $derived(!disabled);

	// Ending a counted attempt is irreversible (WCAG 3.3.4), so it requires confirmation.
	// A countAttempt=false request (e.g. a hint) ends without the extra step.
	const needsConfirmation = $derived(parsedInteraction?.countAttempt !== false);

	$effect(() => {
		// Sync with parent response changes; an external reset re-arms the control.
		hasEnded = parsedResponse ?? false;
		if (!hasEnded) {
			confirming = false;
			focusStatusOnEnd = false;
		}
	});

	$effect(() => {
		if (hasEnded && focusStatusOnEnd) {
			// The button disables itself, so focus would be lost: move it to the status
			// message, which is also the announced confirmation (WCAG 2.4.3 / 4.1.3).
			focusStatusOnEnd = false;
			void tick().then(() => statusElement?.focus());
		}
	});

	async function requestEnd() {
		if (!canInteract || hasEnded) return;
		if (!needsConfirmation) {
			endAttempt();
			return;
		}
		confirming = true;
		await tick();
		confirmButton?.focus();
	}

	function endAttempt() {
		if (!canInteract || hasEnded) return;
		confirming = false;
		focusStatusOnEnd = true;
		hasEnded = true;
		response = true;
		// The interaction change is emitted only after the confirmation step.
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: true, onChange });
	}

	function cancelConfirmation() {
		confirming = false;
		mainButton?.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (confirming && !hasEnded && event.key === 'Escape') {
			event.preventDefault();
			cancelConfirmation();
		}
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} class="qti-end-attempt-interaction" onkeydown={handleKeydown}>
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-end-attempt-prompt qti-rich-content font-semibold">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<div class="qti-end-row">
			<button
				bind:this={mainButton}
				part="button"
				class="qti-end-btn"
				class:qti-end-btn-ended={hasEnded}
				onclick={requestEnd}
				disabled={!canInteract || hasEnded}
			>
				{#if hasEnded}
					<Icon d={ICON_CHECK} part="icon" class="qti-icon" stroke="currentColor" />
					{parsedInteraction.countAttempt
						? translate(i18n, 'interactions.endAttempt.ended', 'Attempt Ended')
						: translate(i18n, 'interactions.endAttempt.requested', 'Requested')}
				{:else}
					<Icon d={ICON_CLOSE} part="icon" class="qti-icon" stroke="currentColor" />
					{parsedInteraction.title}
				{/if}
			</button>

			{#if confirming && !hasEnded}
				<div part="confirm" class="qti-end-confirm" role="alert">
					<p class="qti-end-confirm-message">{translate(i18n, 'interactions.endAttempt.confirmMessage', 'Are you sure you want to end your attempt? You will not be able to change your responses.')}</p>
					<div class="qti-end-confirm-actions">
						<button
							bind:this={confirmButton}
							type="button"
							part="confirm-button"
							class="qti-end-btn qti-end-btn-confirm"
							onclick={endAttempt}
						>{translate(i18n, 'interactions.endAttempt.confirm', 'Yes, end attempt')}</button>
						<button
							type="button"
							part="cancel-button"
							class="qti-end-btn qti-end-btn-cancel"
							onclick={cancelConfirmation}
						>{translate(i18n, 'interactions.endAttempt.cancel', 'Cancel')}</button>
					</div>
				</div>
			{/if}

			{#if hasEnded}
				<div
					bind:this={statusElement}
					part="status ended-message"
					class="qti-end-status"
					role="status"
					tabindex="-1"
				>
					{#if parsedInteraction.countAttempt}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							part="ended-icon"
							class="qti-icon"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<span>{translate(i18n, 'interactions.endAttempt.warningMessage', 'Your attempt has ended.')}</span>
					{:else}
						<span class="sr-only">{translate(i18n, 'interactions.endAttempt.requested', 'Requested')}</span>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Minimal layout if host doesn't provide utility classes */
	.qti-end-attempt-interaction {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
	}
	.qti-end-attempt-prompt {
		margin: 0;
	}
	.qti-end-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	/* Self-contained button styling (no host framework required) */
	.qti-end-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		/* K-12/AA target size (WCAG 2.5.8 and better) */
		min-height: 2.75rem;
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		color: inherit;
		font: inherit;
		font-weight: 600;
		line-height: 1.2;
		cursor: pointer;
	}
	.qti-end-btn:hover:not(:disabled) {
		background: color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 8%, transparent);
	}
	.qti-end-btn:focus-visible,
	.qti-end-status:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.qti-end-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.qti-end-btn-confirm {
		border-color: var(--pie-qti-error-text, #b91c1c);
		background: var(--pie-qti-error-text, #b91c1c);
		color: #ffffff;
	}
	.qti-end-btn-confirm:hover:not(:disabled) {
		background: color-mix(in oklch, var(--pie-qti-error-text, #b91c1c) 88%, #000000);
	}
	.qti-end-btn-cancel {
		background: transparent;
		color: inherit;
	}

	/* Inline confirmation step (WCAG 3.3.4) */
	.qti-end-confirm {
		display: grid;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
	}
	.qti-end-confirm-message {
		margin: 0;
		color: var(--pie-qti-warning-text, #92400e);
	}
	.qti-end-confirm-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	/* Post-end status: receives focus and announces itself (role="status") */
	.qti-end-status {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid var(--pie-qti-warning-text, #92400e);
		color: var(--pie-qti-warning-text, #92400e);
		background: transparent;
		font-weight: 500;
	}

	/* Icon sizing without Tailwind */
	.qti-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex: 0 0 auto;
	}
</style>
