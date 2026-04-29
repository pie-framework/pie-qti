<svelte:options customElement="pie-qti-order" />

<script lang="ts">
	import type { OrderInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import SortableList from '../../shared/components/SortableList.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: OrderInteractionData | string;
		response?: string[] | null;
		correctResponse?: string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string[]) => void;
		/** When true, renders an elimination toggle button per choice (QTI 3.0 PNP §6.2). */
		eliminationTool?: boolean;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), typeset, onChange, eliminationTool = false }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<OrderInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Track whether user has confirmed their order
	let hasConfirmed = $state(false);

	// Shuffle choices on first render when shuffle=true, respecting fixed=true per choice.
	// Uses a simple seeded shuffle keyed to the responseId so the order is stable within a session.
	const shuffledChoiceIds = $derived.by(() => {
		const choices = parsedInteraction?.choices;
		if (!choices || !parsedInteraction?.shuffle) {
			return choices?.map((c) => c.identifier) ?? [];
		}

		// Separate fixed and non-fixed choices
		const fixedSlots = new Map<number, string>(); // index → identifier
		const movable: string[] = [];
		for (let i = 0; i < choices.length; i++) {
			if (choices[i].fixed) {
				fixedSlots.set(i, choices[i].identifier);
			} else {
				movable.push(choices[i].identifier);
			}
		}

		// Fisher-Yates shuffle with a simple deterministic seed
		const seed = (parsedInteraction.responseId ?? 'order').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
		const rng = (n: number) => {
			// LCG: good enough for presentation shuffle
			return ((seed * 1664525 + 1013904223 + n * 22695477) & 0x7fffffff) / 0x7fffffff;
		};
		for (let i = movable.length - 1; i > 0; i--) {
			const j = Math.floor(rng(i) * (i + 1));
			[movable[i], movable[j]] = [movable[j], movable[i]];
		}

		// Reconstruct full array, inserting fixed choices back into their original slots
		const result: string[] = new Array(choices.length);
		let movableIdx = 0;
		for (let i = 0; i < choices.length; i++) {
			if (fixedSlots.has(i)) {
				result[i] = fixedSlots.get(i)!;
			} else {
				result[i] = movable[movableIdx++];
			}
		}
		return result;
	});

	// Get ordered IDs from response, or use shuffled/original order
	const orderedIds = $derived(
		parsedResponse && parsedResponse.length > 0
			? parsedResponse
			: shuffledChoiceIds
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

	// Elimination tool state
	let eliminatedChoices = $state(new Set<string>());

	function toggleElimination(identifier: string) {
		const next = new Set(eliminatedChoices);
		if (next.has(identifier)) {
			next.delete(identifier);
		} else {
			next.add(identifier);
		}
		eliminatedChoices = next;
	}

	function eliminationLabel(identifier: string): string {
		return eliminatedChoices.has(identifier)
			? (i18n?.t('interactions.choice.restoreChoice') ?? 'Restore')
			: (i18n?.t('interactions.choice.eliminateChoice') ?? 'Eliminate');
	}
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

		<div class="qti-order-sortable-wrapper" class:qti-order-with-elimination={eliminationTool}>
			<SortableList
				items={parsedInteraction.choices.map(c => ({ id: c.identifier, text: c.text }))}
				{orderedIds}
				correctOrder={isShowingCorrect ? (parsedCorrectResponse || []) : []}
				orientation="vertical"
				{disabled}
				onReorder={handleReorder}
			/>
			{#if eliminationTool}
				<div class="qti-order-elimination-col" aria-hidden="true">
					{#each orderedIds as id (id)}
						<button
							type="button"
							class="qti-eliminate-btn"
							aria-label={eliminationLabel(id)}
							aria-pressed={eliminatedChoices.has(id)}
							aria-hidden="false"
							onclick={() => toggleElimination(id)}
							data-eliminated={eliminatedChoices.has(id) ? '' : undefined}
						>✕</button>
					{/each}
				</div>
			{/if}
		</div>

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

	/* Elimination tool layout */
	.qti-order-sortable-wrapper {
		position: relative;
	}

	.qti-order-with-elimination {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem;
		align-items: start;
	}

	.qti-order-elimination-col {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.qti-eliminate-btn {
		background: none;
		border: 1px solid currentColor;
		border-radius: 50%;
		width: 1.75rem;
		height: 1.75rem;
		font-size: 0.75rem;
		cursor: pointer;
		opacity: 0.4;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.qti-eliminate-btn:hover,
	.qti-eliminate-btn[data-eliminated] {
		opacity: 1;
		color: var(--color-error, oklch(63% 0.237 25.331));
	}
</style>
