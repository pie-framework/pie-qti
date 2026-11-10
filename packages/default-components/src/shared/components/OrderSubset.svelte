<script lang="ts">
	/**
	 * The two-zone UI for subset ordering (QTI 2.2 ASI §5.73 / §5.42, §2.4.1.2: "the candidate
	 * must select a subset of the choices and impose an ordering on them"). The ordered subset
	 * lives in "Your order" — a SortableList, with all its drag, keyboard, touch, RTL,
	 * forced-colors and focus behaviour — and the other choices wait in "Not in your order",
	 * moved in and out with explicit add and remove controls. Selecting and ordering are the
	 * two gestures the spec names, and each is announced.
	 *
	 * Shared by the order and graphic-order plugins, beside the SortableList it wraps.
	 */
	import { tick, type Snippet } from 'svelte';
	import { translate, translatePlural, type I18nProvider } from '@pie-qti/i18n';
	import type { HtmlContent } from '@pie-qti/item-player';
	import { limitMessage } from '../utils/capacity.js';
	import { accessibleTextFromHtml } from '../utils/accessibleText.js';
	import { describedByIds } from '../utils/minimumRequirement.js';
	import SortableList, { type SortableIndexLabels } from './SortableList.svelte';
	import '../styles/shared.css';

	interface Item {
		id: string;
		text: HtmlContent;
	}

	interface Props {
		/** Every orderable choice, in presentation order. */
		items: Item[];
		/** The ordered subset, in order; the other choices wait in the pool in `items` order. */
		orderedIds: string[];
		/** The most items the order may hold; adding past it is refused and announced. */
		maxOrdered: number;
		/**
		 * The author's `data-max-selections-message` (QTI 3.0 orderInteraction), which states
		 * the cap refusal instead of the localized default.
		 */
		capMessage?: string | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		/** Position badge style, from the interaction's `qti-labels-*` class. */
		indexLabels?: SortableIndexLabels;
		/** Text after each position badge. */
		indexSuffix?: string;
		orientation?: 'vertical' | 'horizontal';
		/** The authored correct subset, shown (read-only) beside the order while it is non-empty. */
		correctOrder?: string[];
		/** Id(s) of more descriptions for the order list, such as the limits hint. */
		describedBy?: string;
		/** Rendered at the end of each choice's row in either zone (e.g. the elimination toggle). */
		rowTrailing?: Snippet<[Item]>;
		/** The ordered subset after an add, a remove or a reorder. */
		onChange: (orderedIds: string[]) => void;
	}

	let {
		items,
		orderedIds,
		maxOrdered,
		capMessage = null,
		disabled = false,
		i18n,
		indexLabels = 'decimal',
		indexSuffix = '',
		orientation = 'vertical',
		correctOrder = [],
		describedBy,
		rowTrailing,
		onChange,
	}: Props = $props();

	const uid = $props.id();
	const orderLabelId = `${uid}-order-label`;
	const poolLabelId = `${uid}-pool-label`;
	const emptyId = `${uid}-order-empty`;
	const correctLabelId = `${uid}-correct-label`;

	let root: HTMLDivElement | undefined = $state();
	let announcement = $state('');

	const ordered = $derived(new Set(orderedIds));
	const poolItems = $derived(items.filter((item) => !ordered.has(item.id)));
	const atCap = $derived(orderedIds.length >= maxOrdered);
	const correctItems = $derived(
		[...new Set(correctOrder)]
			.map((id) => items.find((item) => item.id === id))
			.filter((item): item is Item => item !== undefined),
	);

	function itemLabel(item: Item | undefined): string {
		// Image alt and MathML alttext participate, matching the sortable rows' names.
		return (item && accessibleTextFromHtml(item.text)) || translate(i18n, 'interactions.order.itemFallback', 'Item');
	}

	/**
	 * Announce through the polite region. Repeating the same refused attempt would leave the
	 * live text unchanged, which assistive technology does not announce, so a repeat toggles a
	 * trailing zero-width space (silent to screen readers) — the re-announce toggle of
	 * MatchDragDrop's `announceRefusal` and PositionObjectInteraction's `announcePlacementRefused`.
	 */
	function announce(message: string) {
		announcement = announcement === message ? `${message}\u200b` : message;
	}

	/** Move keyboard focus to `id`'s control in a zone once Svelte has applied the change. */
	function focusControl(part: 'pool-add' | 'order-remove', id: string) {
		void tick().then(() => {
			const controls = Array.from(root?.querySelectorAll<HTMLButtonElement>(`button[part="${part}"]`) ?? []);
			controls.find((control) => control.dataset.id === id)?.focus();
		});
	}

	function add(id: string) {
		if (disabled || ordered.has(id)) return;
		if (atCap) {
			// Refused, never silent (WCAG 3.3.1 / 4.1.3): the cap is named — the author's
			// data-max-selections-message when authored, else the localized default.
			announce(
				limitMessage(
					capMessage,
					translatePlural(
						i18n,
						'interactions.order.orderLimitReached',
						{
							one: 'Your order can hold {max} item. Remove it to add another.',
							other: 'Your order can hold up to {max} items. Remove one to add another.',
						},
						maxOrdered,
						{ max: maxOrdered },
					),
				),
			);
			return;
		}
		// Read before onChange: the parent's response flows back into `orderedIds` synchronously.
		const next = [...orderedIds, id];
		const item = items.find((entry) => entry.id === id);
		onChange(next);
		announce(
			translate(i18n, 'interactions.order.itemAdded', '{item} added to your order at position {position} of {total}.', {
				item: itemLabel(item),
				position: next.length,
				total: next.length,
			}),
		);
		// Focus follows the item: its new row's remove control, which also undoes the add.
		focusControl('order-remove', id);
	}

	function remove(id: string) {
		if (disabled || !ordered.has(id)) return;
		const next = orderedIds.filter((entry) => entry !== id);
		const item = items.find((entry) => entry.id === id);
		onChange(next);
		announce(translate(i18n, 'interactions.order.itemRemoved', '{item} removed from your order.', { item: itemLabel(item) }));
		// Focus follows the item back to the pool: its add control, which also undoes the remove.
		focusControl('pool-add', id);
	}
</script>

<div bind:this={root} part="subset" class="qti-order-subset" data-subset-mode="true">
	<!-- Add, remove and refusal announcements; moves are announced by the SortableList itself. -->
	<div aria-live="polite" aria-atomic="true" class="qti-subset-live" data-subset-live>{announcement}</div>

	<div part="ordered-zone" class="qti-subset-zone">
		<p id={orderLabelId} part="ordered-label" class="qti-subset-label">
			{translate(i18n, 'interactions.order.yourOrder', 'Your order')}
		</p>
		<SortableList
			{items}
			{orderedIds}
			correctOrder={correctOrder}
			{orientation}
			{indexLabels}
			{indexSuffix}
			{disabled}
			{i18n}
			labelledBy={orderLabelId}
			describedBy={describedByIds(describedBy, orderedIds.length === 0 && emptyId)}
			onReorder={onChange}
			rowTrailing={orderRowTrailing}
		/>
		{#if orderedIds.length === 0}
			<p id={emptyId} part="ordered-empty" class="qti-subset-empty">
				{translate(i18n, 'interactions.order.emptyOrder', 'Nothing is in your order yet.')}
			</p>
		{/if}
	</div>

	<div part="pool-zone" class="qti-subset-zone">
		<p id={poolLabelId} part="pool-label" class="qti-subset-label">
			{translate(i18n, 'interactions.order.notInOrder', 'Not in your order')}
		</p>
		<div role="list" aria-labelledby={poolLabelId} part="pool" class="qti-subset-pool" data-orientation={orientation}>
			{#each poolItems as item (item.id)}
				<div role="listitem" class="qti-subset-pool-row">
					<!-- The whole row adds, so the target is the item, not a small icon. At the cap it
					     stays focusable (aria-disabled) so pressing it says why it is refused. -->
					<button
						type="button"
						part="pool-add"
						data-id={item.id}
						class="qti-subset-add"
						{disabled}
						aria-disabled={!disabled && atCap ? 'true' : undefined}
						aria-label={translate(i18n, 'interactions.order.addItem', 'Add {item} to your order', {
							item: itemLabel(item),
						})}
						onclick={() => add(item.id)}
					>
						<span class="qti-subset-glyph" aria-hidden="true">+</span>
						<span class="qti-subset-text qti-rich-content">{@html item.text}</span>
					</button>
					{#if rowTrailing}
						{@render rowTrailing(item)}
					{/if}
				</div>
			{/each}
		</div>
	</div>

	{#if correctItems.length > 0}
		<!-- The scorer's correct-response view: the authored subset, in order. -->
		<div part="correct-order-zone" class="qti-subset-zone">
			<p id={correctLabelId} part="correct-order-label" class="qti-subset-label">
				{translate(i18n, 'interactions.order.correctOrder', 'Correct order')}
			</p>
			<ol aria-labelledby={correctLabelId} part="correct-order" class="qti-subset-correct">
				{#each correctItems as item (item.id)}
					<li class="qti-subset-correct-item qti-rich-content">{@html item.text}</li>
				{/each}
			</ol>
		</div>
	{/if}
</div>

{#snippet orderRowTrailing(item: Item)}
	{#if !disabled}
		<button
			type="button"
			part="order-remove"
			data-id={item.id}
			class="qti-subset-remove"
			aria-label={translate(i18n, 'interactions.order.removeItem', 'Remove {item} from your order', {
				item: itemLabel(item),
			})}
			title={translate(i18n, 'interactions.order.removeItem', 'Remove {item} from your order', {
				item: itemLabel(item),
			})}
			onclick={() => remove(item.id)}
		>
			<span class="qti-subset-glyph" aria-hidden="true">−</span>
		</button>
	{/if}
	{#if rowTrailing}
		{@render rowTrailing(item)}
	{/if}
{/snippet}

<style>
	/* Visually hidden live region, self-contained so it hides without Tailwind. */
	.qti-subset-live {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* minmax(0, 1fr): the track never grows to a row's min-content, so nothing overflows. */
	.qti-order-subset {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
	}
	.qti-subset-zone {
		min-width: 0;
	}
	/*
	 * Reflow (WCAG 1.4.10): each order row carries one more control than in full ordering, so on
	 * a narrow screen the row's controls wrap under the item instead of squeezing it; wide
	 * screens keep them on the item's line.
	 */
	.qti-order-subset :global(.qti-sortable-row) {
		flex-wrap: wrap;
	}
	.qti-order-subset :global(.qti-sortable-item) {
		flex: 1 1 12rem;
	}
	.qti-subset-label {
		margin-block: 0 0.5rem;
		margin-inline: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}
	.qti-subset-empty {
		margin: 0;
		padding: 0.75rem;
		border: 1px dashed var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	/* The pool follows the order list's orientation; logical properties mirror under RTL. */
	.qti-subset-pool {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.qti-subset-pool[data-orientation='horizontal'] {
		flex-direction: row;
		flex-wrap: wrap;
	}
	.qti-subset-pool-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	/* K-12 target size: well over the 24×24 CSS px minimum (WCAG 2.5.8). */
	.qti-subset-add {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		inline-size: 100%;
		min-block-size: 2.75rem;
		min-width: 0;
		padding: 0.5rem 0.75rem;
		border: 1px dashed var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		text-align: start;
		cursor: pointer;
	}
	.qti-subset-remove {
		min-inline-size: 2.75rem;
		min-block-size: 2.75rem;
		flex: 0 0 auto;
		border-radius: 0.375rem;
		border: 1px solid var(--pie-qti-base-content, #333);
		background: var(--pie-qti-base-100, white);
		color: var(--pie-qti-base-content, #333);
		font-size: 1.25rem;
		cursor: pointer;
	}
	.qti-subset-add:focus-visible,
	.qti-subset-remove:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.qti-subset-add:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	/* At the cap: still focusable, visibly unavailable, and not by colour alone (dimmed + cursor). */
	.qti-subset-add[aria-disabled='true'] {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.qti-subset-glyph {
		flex: 0 0 auto;
		font-weight: 700;
		font-size: 1.25rem;
		line-height: 1;
	}
	.qti-subset-text {
		flex: 1 1 auto;
		min-width: 0;
	}

	.qti-subset-correct {
		margin: 0;
		padding-inline-start: 1.5rem;
		display: grid;
		gap: 0.25rem;
	}

	/*
	 * Forced colors drop the dimming's meaning; the at-cap and disabled add controls read in the
	 * system's GrayText so their state survives, and every control keeps a system-coloured border.
	 */
	@media (forced-colors: active) {
		.qti-subset-add[aria-disabled='true'],
		.qti-subset-add:disabled {
			color: GrayText;
			border-color: GrayText;
		}
	}
</style>
