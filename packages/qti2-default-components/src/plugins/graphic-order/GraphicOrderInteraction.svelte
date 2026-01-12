<svelte:options customElement="pie-qti-graphic-order" />

<script lang="ts">
	import type { GraphicOrderInteractionData } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import SortableList from '../../shared/components/SortableList.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';

	interface Props {
		interaction?: GraphicOrderInteractionData | string;
		response?: string[] | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<GraphicOrderInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	let orderedIds = $state<string[]>([]);
	let imageContainer: HTMLDivElement | null = $state(null);
	let imageElement: HTMLElement | null = $state(null);

	// Track whether user has confirmed their order
	let hasConfirmed = $state(false);

	// Track initial order to detect if user has made changes
	const initialOrder = $derived(parsedInteraction?.hotspotChoices.map((c) => c.identifier) || []);
	const hasReordered = $derived(
		orderedIds.length > 0 &&
		orderedIds.some((id, index) => id !== initialOrder[index])
	);

	// Show confirmation button when response is null or when not confirmed yet
	const needsConfirmation = $derived(
		!disabled &&
		(!parsedResponse || !hasConfirmed) &&
		orderedIds.length > 0
	);

	$effect(() => {
		// Sync with parent response changes
		orderedIds = parsedResponse ? [...parsedResponse] : parsedInteraction?.hotspotChoices.map((c) => c.identifier) || [];
	});

	// Reset confirmation state when response is externally cleared
	$effect(() => {
		if (parsedResponse === null || (Array.isArray(parsedResponse) && parsedResponse.length === 0)) {
			hasConfirmed = false;
		}
	});

	function handleReorder(newOrder: string[]) {
		hasConfirmed = true; // Auto-confirm on drag
		orderedIds = newOrder;
		response = orderedIds;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(orderedIds);
		// Dispatch custom event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, orderedIds));
		}
	}

	function confirmOrder() {
		if (disabled || hasConfirmed) return;

		hasConfirmed = true;
		const currentOrder = orderedIds;
		response = currentOrder;

		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(currentOrder);
		// Dispatch custom event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, currentOrder));
		}
	}

	function getChoiceByIdentifier(identifier: string) {
		return parsedInteraction?.hotspotChoices.find((c) => c.identifier === identifier);
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-graphic-order-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-go-prompt font-semibold mb-3">{@html parsedInteraction.prompt}</p>
		{/if}

		<div part="layout" class="qti-go-layout flex flex-col gap-4">
			<!-- Image Area -->
			<div part="image-area" class="qti-go-image-area">
				<div
					bind:this={imageContainer}
					part="stage"
					class="qti-go-stage relative border-2 border-base-300 rounded-lg overflow-hidden bg-base-200"
				>
					{#if parsedInteraction.imageData}
						{#if parsedInteraction.imageData.type === 'svg' && parsedInteraction.imageData.content}
							<div
								bind:this={imageElement}
								class="w-full h-auto"
								style="width: {parsedInteraction.imageData.width}px; height: {parsedInteraction.imageData.height}px;"
							>
								{@html parsedInteraction.imageData.content}
							</div>
						{:else if parsedInteraction.imageData.src}
							<img
								bind:this={imageElement}
								src={parsedInteraction.imageData.src}
								alt="Ordering diagram"
								class="w-full h-auto"
								style="width: {parsedInteraction.imageData.width}px; height: {parsedInteraction.imageData
									.height}px;"
							/>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Ordering Area -->
			<div part="panel" class="qti-go-panel w-full">
				<div class="qti-go-card card bg-base-100 border border-base-300">
					<div class="qti-go-card-body card-body p-4">
						<h3 part="panel-title" class="qti-go-title card-title text-sm">Order (drag to reorder)</h3>
						<SortableList
							items={parsedInteraction.hotspotChoices.map(c => ({ id: c.identifier, text: c.label }))}
							{orderedIds}
							orientation="vertical"
							{disabled}
							onReorder={handleReorder}
						/>

						<!-- Confirmation button for WCAG 2.2 SC 3.3.4 compliance -->
						<div part="confirm" class="qti-go-confirm mt-4 pt-3 border-t border-base-300">
							{#if needsConfirmation}
								<button
									type="button"
									class="btn btn-primary btn-sm w-full"
									onclick={confirmOrder}
									aria-label={i18n?.t('interactions.graphicOrder.confirmAria') ?? 'Confirm this order as your answer'}
								>
									{hasReordered
										? (i18n?.t('interactions.graphicOrder.confirmOrder') ?? 'Confirm Order')
										: (i18n?.t('interactions.graphicOrder.confirmOrderNoChanges') ?? 'Confirm Order (No Changes)')}
								</button>
								<p class="text-xs text-base-content/60 mt-2 text-center">
									{i18n?.t('interactions.graphicOrder.instruction') ?? 'Drag to reorder, or click to confirm'}
								</p>
							{:else if hasConfirmed}
								<div class="alert alert-success py-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										part="confirmed-icon"
										class="qti-icon qti-go-confirmed stroke-current shrink-0 w-5 h-5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										></path>
									</svg>
									<span class="text-sm">Order confirmed</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Ensure proper drag and drop visual feedback */
	:global(.qti-graphic-order-interaction [draggable='true']) {
		user-select: none;
		-webkit-user-drag: element;
	}

	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex: 0 0 auto;
	}

	/* Minimal layout so this works without Tailwind utilities */
	.qti-go-layout {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.qti-go-image-area {
		width: 100%;
	}
	.qti-go-panel {
		width: 100%;
	}
	.qti-go-stage {
		position: relative;
		border-radius: 0.75rem;
		overflow: hidden;
		border: 2px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
	}
	.qti-go-card {
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--color-base-100, oklch(100% 0 0));
	}
	.qti-go-card-body {
		padding: 1rem;
	}
	.qti-go-confirm {
		border-top: 1px solid var(--color-base-300, oklch(95% 0 0));
		padding-top: 0.75rem;
		margin-top: 1rem;
	}
</style>
