<svelte:options customElement="pie-qti-hottext" />

<script lang="ts">
	import type { HottextInteractionData } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';

	interface Props {
		interaction?: HottextInteractionData | string;
		response?: string | string[] | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		onChange?: (value: string | string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<HottextInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string | string[]>(response));

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
	const canSelectMore = $derived(
		parsedInteraction ? selectedIds.length < parsedInteraction.maxChoices : false
	);

	/**
	 * Check if a hottext element is selected
	 */
	function isSelected(identifier: string): boolean {
		return selectedIds.includes(identifier);
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

<div bind:this={rootElement} part="root" class="qti-hottext-interaction space-y-3">
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
			aria-label="Text selection interaction"
		>
			{@html parsedInteraction.contentHtml}
		</div>

		<div part="footer" class="qti-hottext-footer flex items-center justify-between text-sm text-base-content/70">
			<div>
				<span class="font-medium">Selected:</span>
				<span class="ml-2">{selectedIds.length} / {parsedInteraction.maxChoices}</span>
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
	{/if}
</div>

<style>
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
		background-color: hsl(var(--bc) / 0.1);
		border: 1px solid hsl(var(--bc) / 0.2);
	}

	:global(.hottext-content hottext.selectable:hover) {
		background-color: hsl(var(--p) / 0.2);
		border-color: hsl(var(--p) / 0.4);
	}

	:global(.hottext-content hottext.selected) {
		background-color: hsl(var(--p) / 0.3);
		border: 2px solid hsl(var(--p));
		font-weight: 600;
	}
</style>
