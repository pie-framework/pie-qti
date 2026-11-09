<svelte:options customElement="pie-qti-order" />

<script lang="ts">
	import type { OrderInteractionData } from '@pie-qti/item-player';
	import { tick } from 'svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { createConfirmationFlow } from '../../shared/utils/confirmationFlow.svelte';
	import { createEliminationTool } from '../../shared/utils/eliminationTool.svelte';
	import { accessibleTextFromHtml } from '../../shared/utils/accessibleText.js';
	import { choiceAccessibleName } from '../../shared/utils/choiceName';
	import { translate, type I18nProvider } from '@pie-qti/i18n';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import SortableList, { type SortableIndexLabels } from '../../shared/components/SortableList.svelte';
	import OrderSubset from '../../shared/components/OrderSubset.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { minimumHint, subsetOrderHint } from '../../shared/utils/minimumRequirement';
	import { orderChoiceLimits } from '@pie-qti/item-player';

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

	// Parse props that may be JSON strings (web component usage). Correct-answer mode is the
	// scorer's view of an item that has a correct response (the shared shell's rule).
	const shell = $derived(
		createInteractionShell<OrderInteractionData, string[], string[]>({ interaction, response, correctResponse, role, listResponse: true }),
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);
	const classes = $derived(parsedInteraction?.interactionClasses ?? []);
	const orientation = $derived(
		classes.includes('qti-orientation-horizontal') ||
			(parsedInteraction?.orientation === 'horizontal' && !classes.includes('qti-orientation-vertical'))
			? 'horizontal'
			: 'vertical',
	);
	const indexLabels = $derived<SortableIndexLabels>(
		classes.includes('qti-labels-none')
			? 'none'
			: classes.includes('qti-labels-lower-alpha')
				? 'lower-alpha'
				: classes.includes('qti-labels-upper-alpha')
					? 'upper-alpha'
					: 'decimal',
	);
	const indexSuffix = $derived(
		classes.includes('qti-labels-suffix-period') ? '.' : classes.includes('qti-labels-suffix-parenthesis') ? ')' : '',
	);

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();


	// Presentation order comes from the extractor, which applies `shuffle` seeded from the
	// item session GUID (see `core/shuffle.ts`). Shuffling here as well would re-order on
	// every re-render and double-shuffle the already-shuffled choices.
	const shuffledChoiceIds = $derived(parsedInteraction?.choices?.map((c) => c.identifier) ?? []);

	// Get ordered IDs from response, or use shuffled/original order
	const orderedIds = $derived(
		parsedResponse && parsedResponse.length > 0
			? parsedResponse
			: shuffledChoiceIds
	);

	// Subset ordering (QTI 2.2 ASI §5.73, §2.4.1.2): only a minChoices below the number of
	// choices lets the candidate pick which items to order; without it, or with minChoices at
	// or above N, every choice is ordered (and maxChoices is ignored). The same rule the
	// engine's response validation reads.
	const limits = $derived(
		orderChoiceLimits({
			minChoices: parsedInteraction?.minChoices,
			maxChoices: parsedInteraction?.maxChoices,
			choiceCount: shuffledChoiceIds.length,
		}),
	);
	const subsetMode = $derived(limits.subset);

	// The ordered subset: a restored response's known choices, in its sequence, each once.
	const subsetOrderedIds = $derived(
		parsedResponse
			? [...new Set(parsedResponse.filter((id) => shuffledChoiceIds.includes(id)))]
			: []
	);

	// Track initial order to detect if user has made changes
	const initialOrder = $derived(parsedInteraction?.choices.map((c) => c.identifier) ?? []);

	const confirmation = createConfirmationFlow({
		orderedIds: () => orderedIds,
		initialOrder: () => initialOrder,
		disabled: () => disabled,
		response: () => response,
		commit: (order) => {
			response = order;
			emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: order, onChange });
		},
	});

	function handleReorder(newOrder: string[]) {
		confirmation.autoConfirm(); // Auto-confirm on drag
		response = newOrder;
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: newOrder, onChange });
	}

	// Subset ordering has no confirm step. Full mode needs one because the presented order is
	// itself a plausible answer a candidate could mean to keep untouched; in subset mode nothing
	// is ordered until the candidate adds an item, every ordered item got there by an explicit
	// add, and each act stays reversible (remove, move) until submission — the "reversible"
	// branch of WCAG 2.2 SC 3.3.4 — so a confirm button would only add a step. Each add, remove
	// and move records the response at once; ordering nothing is a NULL response.
	function handleSubsetChange(newOrder: string[]) {
		const value = newOrder.length > 0 ? newOrder : null;
		response = value;
		// The public onChange keeps its string[] signature; a cleared subset reports null, as
		// clearing does elsewhere (choice's clear answer).
		const nullAwareOnChange = onChange as ((value: string[] | null) => void) | undefined;
		emitInteractionChange<string[] | null>({
			target: rootElement,
			responseId: parsedInteraction?.responseId,
			value,
			onChange: nullAwareOnChange,
		});
	}

	// Reset confirmation state when response is externally cleared
	$effect(() => {
		confirmation.resetIfCleared();
	});

	// Confirmation feedback: the control itself stays mounted through confirmation (it
	// becomes an inert "Order confirmed" state instead of being swapped for a badge), so
	// the focus that pressed it keeps a home, and the always-present polite region below
	// announces the confirmation to assistive technology.
	let confirmationAnnouncement = $state('');

	function announceConfirmation(message: string) {
		confirmationAnnouncement = confirmationAnnouncement === message ? `${message}\u200b` : message;
	}

	async function confirmFromButton(event: MouseEvent) {
		const button = event.currentTarget as HTMLButtonElement | null;
		const wasNeedy = confirmation.needsConfirmation;
		confirmation.confirmOrder();
		if (!wasNeedy) return;
		announceConfirmation(translate(i18n, 'interactions.order.orderConfirmed', 'Order confirmed'));
		// The control flips to its confirmed state in place; make sure keyboard focus
		// sits on it even if a re-render replaced the element.
		await tick();
		button?.focus();
	}

	// Minimum requirement: stated while the response orders fewer items than required — the same
	// minimum response validation enforces; the author's message wins. In subset mode the
	// statement also names the cap ("Choose 2 items and put them in order.", or a range), so the
	// limits are known up front (WCAG 3.3.2). It describes the list. Only while the candidate
	// can still answer.
	const uid = $props.id();
	const minHintId = `${uid}-min-hint`;
	const orderedCount = $derived(
		subsetMode
			? (Array.isArray(parsedResponse) ? parsedResponse.filter((id) => shuffledChoiceIds.includes(id)).length : 0)
			: (Array.isArray(parsedResponse) ? parsedResponse.filter(Boolean).length : 0),
	);
	const minHint = $derived.by(() => {
		if (subsetMode && !disabled && role === 'candidate') {
			return subsetOrderHint({
				i18n,
				min: limits.minOrdered,
				max: limits.maxOrdered,
				count: orderedCount,
				authored: parsedInteraction?.minSelectionsMessage,
				namespace: 'interactions.order',
			});
		}
		return minimumHint({
			i18n,
			minimum: !disabled && role === 'candidate' && !subsetMode ? parsedInteraction?.minChoices : 0,
			count: orderedCount,
			authored: parsedInteraction?.minSelectionsMessage,
			key: 'interactions.order.minChoicesHint',
			fallback: { one: 'Put at least {count} item in order.', other: 'Put at least {count} items in order.' },
		});
	});

	// Elimination tool (QTI 3.0 PNP §6.2): scratch-work toggles; the response is untouched.
	const elimination = createEliminationTool();
	// Each toggle is named for its item (image alt and MathML included), not just
	// "Eliminate", so screen reader users know which choice a toggle acts on. The name is the
	// same in both states: aria-pressed says whether the item is eliminated, so it never flips
	// to "Restore" (WCAG 4.1.2), and the visible ✕ never changes either (2.5.3). An item with
	// nothing to read is named by its presented position, never by its identifier.
	const eliminationLabel = (identifier: string): string => {
		const choices = parsedInteraction?.choices ?? [];
		const index = choices.findIndex((c) => c.identifier === identifier);
		const item = choiceAccessibleName({
			i18n,
			label: accessibleTextFromHtml(choices[index]?.text),
			position: index + 1,
		});
		return translate(i18n, 'interactions.order.eliminateItem', 'Eliminate {item}', { item });
	};
</script>

<ShadowBaseStyles />

{#snippet eliminationToggle(item: { id: string })}
	{#if eliminationTool}
		<!-- Lives in its item's row, so the toggle aligns with the item at any row height. -->
		<button
			type="button"
			class="qti-eliminate-btn"
			aria-label={eliminationLabel(item.id)}
			aria-pressed={elimination.isEliminated(item.id)}
			onclick={() => elimination.toggle(item.id)}
			data-eliminated={elimination.isEliminated(item.id) ? '' : undefined}
		>✕</button>
	{/if}
{/snippet}

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} class={['qti-order-interaction', ...classes].join(' ')} use:typesetAction={{ typeset }}>
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-order-prompt qti-rich-content mb-3 text-sm text-base-content/70">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<div class="qti-order-sortable-wrapper">
			{#if subsetMode}
				<OrderSubset
					items={parsedInteraction.choices.map(c => ({ id: c.identifier, text: c.text }))}
					orderedIds={subsetOrderedIds}
					maxOrdered={limits.maxOrdered}
					{i18n}
					correctOrder={isShowingCorrect ? (parsedCorrectResponse || []) : []}
					{orientation}
					{indexLabels}
					{indexSuffix}
					{disabled}
					describedBy={minHint ? minHintId : undefined}
					onChange={handleSubsetChange}
					rowTrailing={eliminationToggle}
				/>
			{:else}
				<SortableList
					items={parsedInteraction.choices.map(c => ({ id: c.identifier, text: c.text }))}
					{orderedIds}
					{i18n}
					correctOrder={isShowingCorrect ? (parsedCorrectResponse || []) : []}
					{orientation}
					{indexLabels}
					{indexSuffix}
					{disabled}
					describedBy={minHint ? minHintId : undefined}
					onReorder={handleReorder}
					rowTrailing={eliminationToggle}
				/>
			{/if}
		</div>
		<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(parsedResponse ?? null)} />

		<!-- Confirmation control for WCAG 2.2 SC 3.3.4 compliance. One persistent element
		     flips between the actionable control and an inert "Order confirmed" state
		     (aria-disabled, tabindex=-1 — never removed), so the focus that pressed it keeps
		     a home; the always-present polite region below announces the confirmation. -->
		<div class="mt-4 flex items-center gap-3">
			{#if !subsetMode && (confirmation.needsConfirmation || confirmation.hasConfirmed)}
				<button
					type="button"
					part={confirmation.hasConfirmed ? 'confirmed' : 'confirm'}
					class="btn btn-sm {confirmation.hasConfirmed ? 'qti-order-confirmed' : 'btn-primary'}"
					onclick={confirmFromButton}
					aria-disabled={confirmation.hasConfirmed ? 'true' : undefined}
					tabindex={confirmation.hasConfirmed ? -1 : undefined}
					aria-label={confirmation.hasConfirmed
						? undefined
						: (i18n?.t('interactions.order.confirmAria') ?? 'Confirm this order as your answer')}
				>
					{#if confirmation.hasConfirmed}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							part="confirmed-icon"
							class="qti-icon-sm inline-block w-4 h-4 stroke-current"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							></path>
						</svg>
						{translate(i18n, 'interactions.order.orderConfirmed', 'Order confirmed')}
					{:else}
						{confirmation.hasReordered
							? (i18n?.t('interactions.order.confirmOrder') ?? 'Confirm Order')
							: (i18n?.t('interactions.order.confirmOrderNoChanges') ?? 'Confirm Order (No Changes)')}
					{/if}
				</button>
				{#if !confirmation.hasConfirmed}
					<span class="text-xs text-base-content/60">
						{i18n?.t('interactions.order.instruction') ?? 'Drag items to reorder, or click to confirm the current order'}
					</span>
				{/if}
			{/if}
		</div>
		<div aria-live="polite" aria-atomic="true" class="qti-order-confirmation-live">{confirmationAnnouncement}</div>
	{/if}
</div>

<style>
	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon-sm {
		width: 1rem;
		height: 1rem;
		flex: 0 0 auto;
	}

	/* The confirmed control: the badge's success reading without removing the control */
	.qti-order-confirmed {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		border: 1px solid var(--pie-qti-success-text, #15803d);
		color: var(--pie-qti-success-text, #15803d);
		background: transparent;
		cursor: default;
	}

	/* Visually hidden confirmation live region, self-contained so it hides without Tailwind. */
	.qti-order-confirmation-live {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Elimination tool layout */
	.qti-order-sortable-wrapper {
		position: relative;
	}

	/* K-12 target size: each toggle is a primary control in its item's row. */
	.qti-eliminate-btn {
		background: none;
		border: 1px solid currentColor;
		border-radius: 50%;
		width: 2.75rem;
		height: 2.75rem;
		font-size: 0.875rem;
		cursor: pointer;
		opacity: 0.4;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
	}

	.qti-eliminate-btn:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.qti-eliminate-btn:hover,
	.qti-eliminate-btn[data-eliminated] {
		opacity: 1;
		color: var(--pie-qti-error, oklch(63% 0.237 25.331));
	}
</style>
