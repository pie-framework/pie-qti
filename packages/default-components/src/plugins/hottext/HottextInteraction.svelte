<svelte:options customElement="pie-qti-hottext" />

<script lang="ts">
	import type { HottextInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';

	interface Props {
		interaction?: HottextInteractionData | string;
		response?: string | string[] | null;
		correctResponse?: string | string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		onChange?: (value: string | string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<HottextInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string | string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string | string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);

	// Get correct IDs as array
	const correctIds = $derived.by(() => {
		if (!isShowingCorrect) return [];
		if (Array.isArray(parsedCorrectResponse)) {
			return parsedCorrectResponse;
		}
		return parsedCorrectResponse ? [parsedCorrectResponse] : [];
	});

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	let selectedIds = $state<string[]>([]);

	$effect(() => {
		// Sync with parent response changes
		// Handle both single string (maxChoices=1) and array (maxChoices>1) formats
		if (Array.isArray(parsedResponse)) {
			selectedIds = [...parsedResponse];
		} else if (typeof parsedResponse === 'string') {
			selectedIds = [parsedResponse];
		} else {
			selectedIds = [];
		}
	});
	let contentElement: HTMLDivElement | null = $state(null);

	/**
	 * Check if selection limit has been reached
	 */
	// maxChoices=0 means unlimited per QTI spec
	const canSelectMore = $derived(
		parsedInteraction
			? parsedInteraction.maxChoices === 0 || selectedIds.length < parsedInteraction.maxChoices
			: false
	);

	/**
	 * Check if a hottext element is selected
	 */
	function isSelected(identifier: string): boolean {
		return selectedIds.includes(identifier);
	}

	/**
	 * Check if a hottext element is correct
	 */
	function isCorrect(identifier: string): boolean {
		return isShowingCorrect && correctIds.includes(identifier);
	}

	/**
	 * Handle hottext element click
	 */
	function handleHottextClick(identifier: string) {
		if (disabled || !parsedInteraction) return;

		const currentlySelected = isSelected(identifier);

		if (currentlySelected) {
			// Deselect
			selectedIds = selectedIds.filter((id) => id !== identifier);
		} else if (canSelectMore) {
			// Select
			selectedIds = [...selectedIds, identifier];
		}

		// Return single string for maxChoices=1, array for multiple selection
		const responseValue = parsedInteraction.maxChoices === 1
			? (selectedIds.length > 0 ? selectedIds[0] : null)
			: selectedIds;

		response = responseValue;
		// Call onChange callback if provided (for Svelte component usage)
		if (responseValue !== null) {
			onChange?.(responseValue);
		}
		// Dispatch custom event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction.responseId, responseValue));
		}
		updateHottextStyles();
	}

	/**
	 * Update visual styles of hottext elements based on selection state
	 */
	function updateHottextStyles() {
		if (!contentElement) return;

		const hottextElements = contentElement.querySelectorAll('hottext');
		hottextElements.forEach((elem: Element) => {
			const identifier = elem.getAttribute('identifier');
			if (identifier) {
				const htmlElem = elem as HTMLElement;
				const selected = isSelected(identifier);

				// Update ARIA state
				htmlElem.setAttribute('aria-pressed', selected ? 'true' : 'false');

				// Update classes
				const isCorrectChoice = isCorrect(identifier);
				if (selected) {
					htmlElem.classList.add('selected');
					htmlElem.classList.remove('selectable');
				} else {
					htmlElem.classList.remove('selected');
					if (canSelectMore && !disabled) {
						htmlElem.classList.add('selectable');
					} else {
						htmlElem.classList.remove('selectable');
					}
				}
				if (isCorrectChoice) {
					htmlElem.classList.add('correct');
				} else {
					htmlElem.classList.remove('correct');
				}
			}
		});
	}

	/**
	 * Initialize hottext elements with click handlers and keyboard accessibility
	 */
	$effect(() => {
		if (!contentElement) return;

		const hottextElements = contentElement.querySelectorAll('hottext');
		hottextElements.forEach((elem: Element) => {
			const identifier = elem.getAttribute('identifier');
			if (identifier) {
				const htmlElem = elem as HTMLElement;

				// Make it visually interactive
				htmlElem.style.cursor = disabled ? 'default' : 'pointer';
				htmlElem.style.padding = '2px 4px';
				htmlElem.style.borderRadius = '3px';
				htmlElem.style.transition = 'all 0.2s';

				// Make keyboard accessible
				htmlElem.setAttribute('role', 'button');
				htmlElem.setAttribute('tabindex', disabled ? '-1' : '0');
				htmlElem.setAttribute('aria-pressed', isSelected(identifier) ? 'true' : 'false');

				// Get text content for aria-label
				const textContent = htmlElem.textContent || identifier;
				htmlElem.setAttribute('aria-label', `Selectable text: ${textContent}`);

				// Add click handler
				htmlElem.onclick = () => handleHottextClick(identifier);

				// Add keyboard handler
				htmlElem.onkeydown = (e: KeyboardEvent) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleHottextClick(identifier);
					}
				};
			}
		});

		updateHottextStyles();
	});

	/**
	 * Update styles when selection or disabled state changes
	 */
	$effect(() => {
		updateHottextStyles();
	});
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class={['qti-hottext-interaction space-y-3', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')}>
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-hottext-prompt font-semibold">{@html parsedInteraction.prompt}</p>
		{/if}

		<div
			bind:this={contentElement}
			part="content"
			class="hottext-content qti-hottext-content prose max-w-none"
			role="group"
			aria-label={i18n?.t('interactions.hottext.ariaLabel') ?? 'Text selection interaction'}
		>
			{@html parsedInteraction.contentHtml}
		</div>

		<div part="footer" class="qti-hottext-footer flex items-center justify-between text-sm text-base-content/70">
			<div>
				<span class="font-medium">{i18n?.t('interactions.hottext.selected') ?? 'Selected'}:</span>
				<span class="ml-2">{selectedIds.length} / {parsedInteraction.hottextChoices?.length ?? 0}</span>
				{#if parsedInteraction.minChoices > 0}
					{#if selectedIds.length >= parsedInteraction.minChoices}
						<span class="badge badge-success badge-sm ml-2">✓ {i18n?.t('interactions.hottext.minimumMet') ?? 'Minimum met'}</span>
					{:else}
						<span class="badge badge-warning badge-sm ml-2">{i18n?.t('interactions.hottext.selectAtLeast', `Select at least ${parsedInteraction.minChoices}`) ?? `Select at least ${parsedInteraction.minChoices}`}</span>
					{/if}
				{/if}
			</div>

			{#if selectedIds.length > 0}
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					onclick={() => {
						selectedIds = [];
						// Return null for single selection, empty array for multiple
						const responseValue = parsedInteraction!.maxChoices === 1 ? null : [];
						response = responseValue;
						if (responseValue !== null) {
							onChange?.(responseValue);
						}
						// Dispatch custom event for web component usage - event will bubble up to the host element
						if (rootElement) {
							rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, responseValue));
						}
						updateHottextStyles();
					}}
					{disabled}
				>
					Clear Selection
				</button>
			{/if}
		</div>
		{#if parsedInteraction.maxSelectionsMessage && selectedIds.length >= parsedInteraction.maxChoices && parsedInteraction.maxChoices > 0}
			<p class="qti-selection-message" role="alert">{parsedInteraction.maxSelectionsMessage}</p>
		{/if}
	{/if}
</div>

<style>
	.qti-selection-message {
		font-size: 0.875rem;
		color: var(--pie-qti-warning, oklch(77% 0.194 82));
		margin-top: 0.25rem;
	}

	/* qti-input-control-hidden: hide visual selection indicators but keep keyboard-accessible */
	.qti-input-control-hidden :global(hottext) {
		cursor: pointer;
		outline: none;
	}
	.qti-input-control-hidden :global(hottext[data-selected]) {
		background-color: transparent;
		text-decoration: underline;
	}

	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-hottext-interaction {
		display: grid;
		gap: 0.75rem;
	}
	.qti-hottext-prompt {
		margin: 0;
	}
	.qti-hottext-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	:global(.hottext-content hottext) {
		display: inline;
		user-select: none;
	}

	:global(.hottext-content hottext.selectable) {
		background-color: color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 10%, transparent);
		border: 1px solid color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 20%, transparent);
	}

	:global(.hottext-content hottext.selectable:hover) {
		background-color: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 20%, transparent);
		border-color: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 40%, transparent);
	}

	:global(.hottext-content hottext.selected) {
		background-color: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 30%, transparent);
		border: 2px solid var(--pie-qti-primary, oklch(45% 0.24 277));
		font-weight: 600;
	}

	:global(.hottext-content hottext.correct) {
		background-color: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 8%, transparent);
		border: 1px solid var(--pie-qti-success, oklch(76% 0.177 163.223));
		border-radius: 0.25rem;
		padding: 2px 4px;
		margin: -2px -4px;
	}
</style>
