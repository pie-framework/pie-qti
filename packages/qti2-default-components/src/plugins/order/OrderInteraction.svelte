<svelte:options customElement="pie-qti-order" />

<script lang="ts">
	import type { OrderInteractionData } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import SortableList from '../../shared/components/SortableList.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: OrderInteractionData | string;
		response?: string[] | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), typeset, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<OrderInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Track whether user has confirmed their order
	let hasConfirmed = $state(false);

	// Get ordered IDs from response, or use original order
	const orderedIds = $derived(
		parsedResponse && parsedResponse.length > 0
			? parsedResponse
			: parsedInteraction?.choices.map((c) => c.identifier) ?? []
	);

	// Track initial order to detect if user has made changes
	const initialOrder = $derived(parsedInteraction?.choices.map((c) => c.identifier) ?? []);
	const hasReordered = $derived(
		orderedIds.length > 0 &&
		orderedIds.some((id, index) => id !== initialOrder[index])
	);

	// Show confirmation button when response is null or when not confirmed yet
	const needsConfirmation = $derived(
		!disabled &&
		(!response || !hasConfirmed) &&
		orderedIds.length > 0
	);

	function handleReorder(newOrder: string[]) {
		hasConfirmed = true; // Auto-confirm on drag
		response = newOrder;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(newOrder);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, newOrder));
		}
	}

	function confirmOrder() {
		if (disabled || hasConfirmed) return;

		hasConfirmed = true;
		const currentOrder = orderedIds;
		response = currentOrder;

		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(currentOrder);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, currentOrder));
		}
	}

	// Reset confirmation state when response is externally cleared
	$effect(() => {
		if (response === null || (Array.isArray(response) && response.length === 0)) {
			hasConfirmed = false;
		}
	});
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} class="qti-order-interaction" use:typesetAction={{ typeset }}>
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div class="mb-3 text-sm text-base-content/70">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<SortableList
			items={parsedInteraction.choices.map(c => ({ id: c.identifier, text: c.text }))}
			{orderedIds}
			orientation="vertical"
			{disabled}
			onReorder={handleReorder}
		/>

		<!-- Confirmation button for WCAG 2.2 SC 3.3.4 compliance -->
		<div class="mt-4 flex items-center gap-3">
			{#if needsConfirmation}
				<button
					type="button"
					class="btn btn-primary btn-sm"
					onclick={confirmOrder}
					aria-label={i18n?.t('interactions.order.confirmAria') ?? 'Confirm this order as your answer'}
				>
					{hasReordered
						? (i18n?.t('interactions.order.confirmOrder') ?? 'Confirm Order')
						: (i18n?.t('interactions.order.confirmOrderNoChanges') ?? 'Confirm Order (No Changes)')}
				</button>
				<span class="text-xs text-base-content/60">
					{i18n?.t('interactions.order.instruction') ?? 'Drag items to reorder, or click to confirm the current order'}
				</span>
			{:else if hasConfirmed}
				<div class="badge badge-success gap-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						part="confirmed-icon"
						class="qti-icon-sm inline-block w-4 h-4 stroke-current"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						></path>
					</svg>
					Order confirmed
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon-sm {
		width: 1rem;
		height: 1rem;
		flex: 0 0 auto;
	}
</style>
