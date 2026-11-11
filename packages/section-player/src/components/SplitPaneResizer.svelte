<script lang="ts">
	import { tick, untrack, type Snippet } from 'svelte';
	import { interfaceLocaleAttributes, type I18nProvider } from '@pie-qti/i18n';
	import type { PnpProfile } from '@pie-qti/item-player';
	import { interfaceText } from '../i18n/interface-text.js';
	import { pnpSurface } from '../pnp/section-surface.js';

	type Pane = 'context' | 'item';

	interface Props {
		i18n?: I18nProvider;
		storageKey?: string;
		leftPane?: Snippet;
		children?: Snippet;
		/**
		 * Rendered last inside the layout, outside both panes: a modal the section opens
		 * (its display settings dialog) stays on the PNP surface whichever pane is shown.
		 */
		overlay?: Snippet;
		onRightPaneReady?: (element: HTMLElement) => void;
		/**
		 * Identity of the item shown in the item pane. When it changes while the
		 * panes are stacked into tabs, the question tab is selected so the newly
		 * presented item is visible.
		 */
		activeItemKey?: string;
		/**
		 * The candidate's display needs, applied to this layout as the section's PNP
		 * surface: passages, rubrics, tool bars, chrome and items all take them from here.
		 */
		pnp?: PnpProfile;
	}

	const {
		i18n,
		storageKey = 'pie-qti22-assessment-player.splitLeftPct',
		leftPane,
		children,
		overlay,
		onRightPaneReady,
		activeItemKey,
		pnp,
	}: Props = $props();

	const minLeftPct = 25;
	const maxLeftPct = 75;
	const initialSplitPct = 50;
	/** Below this inline size (in rem) the panes stack behind a Passage/Question tab switch. */
	const stackBelowRem = 48;
	/** Extra room required before re-splitting, so a scrollbar at the boundary cannot flip the layout. */
	const resplitHysteresisPx = 16;
	/** The grid's smallest pane and the splitter: together they bound the achievable split. */
	const minPaneRem = 18;
	const splitterRem = 1.5;

	const uid = $props.id();
	const contextPaneId = `${uid}-context`;
	const itemPaneId = `${uid}-item`;
	const contextTabId = `${uid}-context-tab`;
	const itemTabId = `${uid}-item-tab`;

	let splitContainerEl = $state<HTMLDivElement | null>(null);
	let contextPaneEl = $state<HTMLElement | null>(null);
	let rightPaneEl = $state<HTMLElement | null>(null);
	let reportedRightPaneEl = $state<HTMLElement | null>(null);
	let contextTabEl = $state<HTMLButtonElement | null>(null);
	let itemTabEl = $state<HTMLButtonElement | null>(null);
	let splitLeftPct = $state<number>(50);
	let isResizing = $state(false);
	let hasInitializedFromProps = $state(false);
	let isStacked = $state(false);
	let selectedPane = $state<Pane>('context');
	let lastActiveItemKey: string | undefined;
	/** The split percentages the grid can actually take at the current width. */
	let achievableMinPct = $state(minLeftPct);
	let achievableMaxPct = $state(maxLeftPct);

	const passageLabel = $derived(interfaceText(i18n, 'sectionPlayer.passage', 'Passage'));
	const questionLabel = $derived(interfaceText(i18n, 'sectionPlayer.question', 'Question'));
	const tablistLabel = $derived(interfaceText(i18n, 'sectionPlayer.passageAndQuestion', 'Passage and question'));
	/** The profile's single-column need: the panes stack behind their tabs at any width. */
	const singleColumn = $derived(pnp?.display?.singleColumn === true);
	/** The split the grid actually takes: the request clamped into the achievable range. */
	const effectiveSplitPct = $derived(Math.max(achievableMinPct, Math.min(achievableMaxPct, splitLeftPct)));

	function clampPct(pct: number) {
		return Math.min(maxLeftPct, Math.max(minLeftPct, pct));
	}

	function saveSplitPct(pct: number) {
		try {
			if (typeof window === 'undefined') return;
			window.localStorage.setItem(storageKey, String(pct));
		} catch {
			// Ignore persistence failures in restricted browser contexts.
		}
	}

	function loadSplitPct() {
		try {
			if (typeof window === 'undefined') return null;
			const raw = window.localStorage.getItem(storageKey);
			if (!raw) return null;
			const n = Number(raw);
			if (!Number.isFinite(n)) return null;
			return clampPct(n);
		} catch {
			return null;
		}
	}

	/** Right-to-left layout puts the shared-context pane, the grid's first column, on the right. */
	function isRtl() {
		return splitContainerEl ? getComputedStyle(splitContainerEl).direction === 'rtl' : false;
	}

	function updateSplitFromClientX(clientX: number) {
		if (!splitContainerEl) return;
		const rect = splitContainerEl.getBoundingClientRect();
		if (rect.width <= 0) return;
		const x = isRtl() ? rect.right - clientX : clientX - rect.left;
		const pct = (x / rect.width) * 100;
		splitLeftPct = clampPct(pct);
	}

	function onSplitterPointerDown(e: PointerEvent) {
		if (!splitContainerEl) return;
		isResizing = true;
		(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
		updateSplitFromClientX(e.clientX);

		const move = (ev: PointerEvent) => updateSplitFromClientX(ev.clientX);
		const up = () => {
			isResizing = false;
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
			saveSplitPct(splitLeftPct);
		};

		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up, { once: true });
		window.addEventListener('pointercancel', up, { once: true });
	}

	function onSplitterKeyDown(e: KeyboardEvent) {
		// The arrows move the splitter where they point, which grows the first pane
		// towards the inline end: rightwards left-to-right, leftwards right-to-left.
		// Stepping and the ends work within the achievable range, so every press moves
		// the splitter where the layout can follow.
		const grow = isRtl() ? 'ArrowLeft' : 'ArrowRight';
		const shrink = isRtl() ? 'ArrowRight' : 'ArrowLeft';
		if (e.key === shrink) {
			e.preventDefault();
			splitLeftPct = clampPct(effectiveSplitPct - 2);
			saveSplitPct(splitLeftPct);
		} else if (e.key === grow) {
			e.preventDefault();
			splitLeftPct = clampPct(effectiveSplitPct + 2);
			saveSplitPct(splitLeftPct);
		} else if (e.key === 'Home') {
			e.preventDefault();
			splitLeftPct = achievableMinPct;
			saveSplitPct(splitLeftPct);
		} else if (e.key === 'End') {
			e.preventDefault();
			splitLeftPct = achievableMaxPct;
			saveSplitPct(splitLeftPct);
		}
	}

	function splitterInteractions(node: HTMLElement) {
		const pointerDown = (e: PointerEvent) => onSplitterPointerDown(e);
		const keyDown = (e: KeyboardEvent) => onSplitterKeyDown(e);

		node.addEventListener('pointerdown', pointerDown);
		node.addEventListener('keydown', keyDown);

		return {
			destroy() {
				node.removeEventListener('pointerdown', pointerDown);
				node.removeEventListener('keydown', keyDown);
			},
		};
	}

	function stackThresholdPx(): number {
		return stackBelowRem * rootFontSizePx();
	}

	function rootFontSizePx(): number {
		const rootFontSize =
			typeof document === 'undefined' ? 16 : Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
		return Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
	}

	/**
	 * The percentages the grid can actually take: below ~72rem containers its
	 * `minmax(18rem, …)` tracks clamp the left track, so a requested 75% renders
	 * narrower. Reported against the content box (the grid resolves percentages
	 * against it), so the value the separator announces is the position it holds.
	 */
	function updateAchievableRange(width: number) {
		if (!(width > 0)) return;
		const paddingX =
			(Number.parseFloat(getComputedStyle(splitContainerEl!).paddingLeft) || 0) +
			(Number.parseFloat(getComputedStyle(splitContainerEl!).paddingRight) || 0);
		const contentWidth = width - paddingX;
		if (!(contentWidth > 0)) return;
		const remPx = rootFontSizePx();
		const min = clampPct((minPaneRem * remPx * 100) / contentWidth);
		const max = clampPct(((contentWidth - (minPaneRem + splitterRem) * remPx) * 100) / contentWidth);
		achievableMinPct = Math.max(minLeftPct, min);
		achievableMaxPct = Math.max(achievableMinPct, Math.min(maxLeftPct, max));
	}

	function applyStacked(next: boolean) {
		// A single-column accommodation stacks the panes whatever the width.
		const effective = singleColumn || next;
		if (effective === isStacked) return;
		if (effective) {
			// Keep a focused control visible: stacking hides the pane that is not
			// selected, so whichever pane holds focus wins the tab.
			if (contextPaneEl?.contains(document.activeElement)) selectedPane = 'context';
			else if (rightPaneEl?.contains(document.activeElement)) selectedPane = 'item';
		}
		isStacked = effective;
	}

	/** Width is the layout's own border box, which its parent decides, so stacking cannot feed back into it. */
	function evaluateWidth(width: number) {
		if (!(width > 0)) return; // not rendered (hidden, detached, or no layout engine)
		const threshold = stackThresholdPx();
		updateAchievableRange(width);
		applyStacked(isStacked ? width < threshold + resplitHysteresisPx : width < threshold);
	}

	$effect(() => {
		const el = splitContainerEl;
		// Read here, so an accommodation flip re-runs the evaluation.
		const forcedSingleColumn = singleColumn;
		if (!el) return;
		if (forcedSingleColumn) {
			untrack(() => applyStacked(true));
			return;
		}
		untrack(() => evaluateWidth(el.getBoundingClientRect().width));

		if (typeof ResizeObserver === 'undefined') {
			// No layout observer (older engines, jsdom): follow the viewport instead.
			const query = typeof window !== 'undefined' ? window.matchMedia?.(`(max-width: ${stackBelowRem}rem)`) : undefined;
			if (!query) return;
			const sync = () =>
				untrack(() => {
					updateAchievableRange(el.getBoundingClientRect().width);
					applyStacked(query.matches);
				});
			sync();
			query.addEventListener?.('change', sync);
			return () => query.removeEventListener?.('change', sync);
		}

		const observer = new ResizeObserver((entries) => {
			const entry = entries[entries.length - 1];
			const box = entry?.borderBoxSize?.[0];
			evaluateWidth(box ? box.inlineSize : el.getBoundingClientRect().width);
		});
		observer.observe(el);
		return () => observer.disconnect();
	});

	// A newly presented item replaces the question; show it rather than a passage the
	// candidate already switched to.
	$effect.pre(() => {
		const key = activeItemKey;
		if (lastActiveItemKey !== undefined && key !== lastActiveItemKey) {
			untrack(() => {
				selectedPane = 'item';
			});
		}
		lastActiveItemKey = key;
	});

	async function selectPane(pane: Pane, options: { focusTab?: boolean } = {}) {
		selectedPane = pane;
		if (!options.focusTab) return;
		await tick();
		(pane === 'context' ? contextTabEl : itemTabEl)?.focus();
	}

	function onTabKeydown(event: KeyboardEvent) {
		const order: Pane[] = ['context', 'item'];
		const index = order.indexOf(selectedPane);
		// Tabs follow the reading direction, so the arrow keys mirror right-to-left.
		const nextKey = isRtl() ? 'ArrowLeft' : 'ArrowRight';
		const previousKey = isRtl() ? 'ArrowRight' : 'ArrowLeft';
		let target: Pane | undefined;
		if (event.key === nextKey) target = order[(index + 1) % order.length];
		else if (event.key === previousKey) target = order[(index - 1 + order.length) % order.length];
		else if (event.key === 'Home') target = order[0];
		else if (event.key === 'End') target = order[order.length - 1];
		if (!target) return;
		event.preventDefault();
		void selectPane(target, { focusTab: true });
	}

	/**
	 * Show the item pane — selecting the question tab when the panes are stacked —
	 * and return it, ready to receive focus.
	 */
	export async function revealItemPane(): Promise<HTMLElement | null> {
		if (isStacked && selectedPane !== 'item') {
			selectedPane = 'item';
			await tick();
		}
		return rightPaneEl;
	}

	// One initialization: the candidate's last split (persisted when they dragged the
	// splitter) wins, and the prop default is only the fallback for a storage miss.
	// Restoring inside this effect — the only one that touches `splitLeftPct` at
	// mount — keeps a later initialization from clobbering the restored value.
	$effect(() => {
		if (hasInitializedFromProps) return;
		const loaded = loadSplitPct();
		splitLeftPct = clampPct(loaded ?? initialSplitPct);
		hasInitializedFromProps = true;
	});

	$effect(() => {
		if (rightPaneEl && rightPaneEl !== reportedRightPaneEl) {
			reportedRightPaneEl = rightPaneEl;
			onRightPaneReady?.(rightPaneEl);
		}
	});

	// The section's chrome takes the interface locale; passages and items set
	// their own from their content language.
	const interfaceAttributes = $derived(interfaceLocaleAttributes(i18n));
</script>

<div
	class:resizing={isResizing}
	class:stacked={isStacked}
	class="split-layout pie-qti-chrome"
	data-layout={isStacked ? 'stacked' : 'split'}
	lang={interfaceAttributes?.lang}
	dir={interfaceAttributes?.dir}
		bind:this={splitContainerEl}
		use:pnpSurface={pnp}
		style={`--split-left: ${effectiveSplitPct}%;`}
	>
	{#if isStacked}
		<div class="pane-tabs" role="tablist" aria-label={tablistLabel}>
			<button
				bind:this={contextTabEl}
				type="button"
				role="tab"
				id={contextTabId}
				class="pane-tab"
				aria-selected={selectedPane === 'context'}
				aria-controls={contextPaneId}
				tabindex={selectedPane === 'context' ? 0 : -1}
				onclick={() => selectPane('context')}
				onkeydown={onTabKeydown}
			>
				{passageLabel}
			</button>
			<button
				bind:this={itemTabEl}
				type="button"
				role="tab"
				id={itemTabId}
				class="pane-tab"
				aria-selected={selectedPane === 'item'}
				aria-controls={itemPaneId}
				tabindex={selectedPane === 'item' ? 0 : -1}
				onclick={() => selectPane('item')}
				onkeydown={onTabKeydown}
			>
				{questionLabel}
			</button>
		</div>
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<section
		id={contextPaneId}
		class="pane pane-left"
		bind:this={contextPaneEl}
		role={isStacked ? 'tabpanel' : undefined}
		aria-labelledby={isStacked ? contextTabId : undefined}
		aria-label={isStacked ? undefined : passageLabel}
		hidden={isStacked && selectedPane !== 'context'}
		tabindex={isStacked ? 0 : undefined}
	>
		{#if leftPane}
			{@render leftPane()}
		{/if}
	</section>

	{#if !isStacked}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="splitter"
			role="separator"
			aria-orientation="vertical"
			aria-label={interfaceText(i18n, 'accessibility.resizer', 'Resize passage and question panels')}
			aria-controls={`${contextPaneId} ${itemPaneId}`}
			aria-valuemin={Math.round(achievableMinPct)}
			aria-valuemax={Math.round(achievableMaxPct)}
			aria-valuenow={Math.round(effectiveSplitPct)}
			tabindex="0"
			use:splitterInteractions
		>
			<div class="splitter-grip" aria-hidden="true"></div>
		</div>
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<section
		id={itemPaneId}
		class="pane pane-right"
		tabindex="-1"
		bind:this={rightPaneEl}
		role={isStacked ? 'tabpanel' : undefined}
		aria-labelledby={isStacked ? itemTabId : undefined}
		aria-label={isStacked ? undefined : questionLabel}
		hidden={isStacked && selectedPane !== 'item'}
	>
		{#if children}
			{@render children()}
		{/if}
	</section>

	{#if overlay}
		{@render overlay()}
	{/if}
</div>

<style>
	.split-layout {
		--splitter-size: 1.5rem;
		box-sizing: border-box;
		display: grid;
		grid-template-columns: minmax(18rem, var(--split-left)) var(--splitter-size) minmax(18rem, 1fr);
		grid-template-rows: minmax(0, 1fr);
		inline-size: 100%;
		block-size: 100%;
		flex: 1 1 auto;
		min-block-size: 0;
		max-inline-size: 87.5rem;
		margin-inline: auto;
		padding: var(--pie-qti-space-4, 1rem);
	}

	.pane {
		box-sizing: border-box;
		min-block-size: 0;
		min-inline-size: 0;
		overflow: auto;
		padding-inline: var(--pie-qti-space-3, 0.75rem);
		/* Keep a focused control (and its focus ring) clear of the pane edges. */
		scroll-padding-block: var(--pie-qti-space-4, 1rem);
	}

	.pane[hidden] {
		display: none;
	}

	.pane-right:focus-visible,
	.pane-left:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: -2px;
	}

	.splitter {
		box-sizing: border-box;
		inline-size: var(--splitter-size);
		cursor: col-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		align-self: stretch;
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		border-inline: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		user-select: none;
		touch-action: none;
		position: relative;
	}

	.splitter:hover {
		background: var(--pie-qti-base-300, oklch(95% 0 0));
	}

	.splitter:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.splitter::before {
		content: '';
		position: absolute;
		inset-block: 0;
		inset-inline: 0;
		inline-size: 2px;
		margin-inline: auto;
		background: var(--pie-qti-border-strong, #767676);
	}

	.splitter-grip {
		position: relative;
		inline-size: 6px;
		block-size: 4.5rem;
		border-radius: 999px;
		background: var(--pie-qti-border-strong, #767676);
	}

	.split-layout.resizing .splitter {
		background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 14%, transparent);
		border-inline-color: var(--pie-qti-primary, oklch(45% 0.24 277));
	}

	.split-layout.resizing {
		user-select: none;
	}

	.split-layout :global(.rubric-container) {
		margin-block-end: 0;
	}

	/* Narrow containers: one pane at a time behind a Passage/Question tab switch. */
	.split-layout.stacked {
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-3, 0.75rem);
		padding: var(--pie-qti-space-3, 0.75rem);
	}

	.split-layout.stacked .pane {
		flex: 1 1 auto;
		padding-inline: 0;
	}

	.pane-tabs {
		display: flex;
		flex: none;
		gap: var(--pie-qti-space-1, 0.25rem);
		border-block-end: 1px solid var(--pie-qti-border-strong, #767676);
	}

	.pane-tab {
		flex: 1 1 0;
		min-inline-size: 0;
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-3, 0.75rem);
		margin-block-end: -1px;
		border: 0;
		border-block-end: 3px solid transparent;
		border-radius: var(--pie-qti-radius-sm, 0.25rem) var(--pie-qti-radius-sm, 0.25rem) 0 0;
		background: transparent;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		cursor: pointer;
		overflow-wrap: anywhere;
	}

	.pane-tab:hover {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.pane-tab[aria-selected='true'] {
		border-block-end-color: var(--pie-qti-primary, oklch(45% 0.24 277));
	}

	@media (forced-colors: active) {
		.pane-tab[aria-selected='true'] {
			border-block-end-color: Highlight;
		}
	}

	.pane-tab:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: -2px;
	}

	/* Short viewports (high zoom, landscape phones): panes flow and the page or shell scrolls. */
	@media (max-height: 30rem) {
		.split-layout {
			grid-template-rows: auto;
			block-size: auto;
		}

		.pane {
			overflow: visible;
		}
	}

	/*
	 * This layout is the section's PNP surface, so inverted polarity applies here,
	 * to everything it renders. Filters are not inherited and a second one cancels
	 * the first, so an inverting root nested inside another applies none of its own:
	 * an item body inside this surface, or this surface inside a host root that
	 * already inverts. The outer filter and its un-inverted media cover the subtree.
	 */
	.split-layout:global([data-qti-invert-polarity='invert']) :global([data-qti-invert-polarity='invert']),
	:global([data-qti-invert-polarity='invert']) .split-layout:global([data-qti-invert-polarity='invert']) {
		filter: none;
	}

	@media (prefers-reduced-motion: no-preference) {
		.pane-tab {
			transition: background-color 120ms ease;
		}
	}
</style>
