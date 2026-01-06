<script lang="ts">
	import { onMount } from 'svelte';
	import RubricDisplay from './RubricDisplay.svelte';

	interface Props {
		/** Left pane content (passage/stimulus) */
		leftContent: any[];
		/** Right pane content slot */
		children: any;
		/** Math typesetting function */
		typeset?: (root: HTMLElement) => void | Promise<void>;
		/** Storage key for persisting split position */
		storageKey?: string;
		/** Minimum left pane percentage */
		minLeftPct?: number;
		/** Maximum left pane percentage */
		maxLeftPct?: number;
		/** Initial split percentage */
		initialSplitPct?: number;
		/** Callback when right pane element is ready (for scroll management) */
		onRightPaneReady?: (element: HTMLDivElement) => void;
	}

	const {
		leftContent,
		children,
		typeset,
		storageKey = 'qti22-split-pane.splitLeftPct',
		minLeftPct = 25,
		maxLeftPct = 75,
		initialSplitPct = 50,
		onRightPaneReady
	}: Props = $props();

	let splitContainerEl = $state<HTMLDivElement | null>(null);
	let rightPaneEl = $state<HTMLDivElement | null>(null);
	let splitLeftPct = $state<number>(50);
	let isResizing = $state(false);
	let hasInitializedFromProps = $state(false);

	function clampPct(pct: number) {
		return Math.min(maxLeftPct, Math.max(minLeftPct, pct));
	}

	function saveSplitPct(pct: number) {
		try {
			if (typeof window === 'undefined') return;
			window.localStorage.setItem(storageKey, String(pct));
		} catch {
			// ignore
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

	function updateSplitFromClientX(clientX: number) {
		if (!splitContainerEl) return;
		const rect = splitContainerEl.getBoundingClientRect();
		if (rect.width <= 0) return;
		const x = clientX - rect.left;
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
		// Keyboard accessible resizing
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			splitLeftPct = clampPct(splitLeftPct - 2);
			saveSplitPct(splitLeftPct);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			splitLeftPct = clampPct(splitLeftPct + 2);
			saveSplitPct(splitLeftPct);
		} else if (e.key === 'Home') {
			e.preventDefault();
			splitLeftPct = minLeftPct;
			saveSplitPct(splitLeftPct);
		} else if (e.key === 'End') {
			e.preventDefault();
			splitLeftPct = maxLeftPct;
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
			}
		};
	}

	// Load saved position on mount
	onMount(() => {
		const loaded = loadSplitPct();
		if (loaded !== null) splitLeftPct = loaded;
	});

	// Initialize from prop (once). If there's a saved value, onMount() will override.
	$effect(() => {
		if (hasInitializedFromProps) return;
		splitLeftPct = clampPct(initialSplitPct);
		hasInitializedFromProps = true;
	});

	// Notify parent when right pane is ready
	$effect(() => {
		if (rightPaneEl && onRightPaneReady) {
			onRightPaneReady(rightPaneEl);
		}
	});
</script>

<div
	class:resizing={isResizing}
	class="split-layout"
	bind:this={splitContainerEl}
	style={`--split-left: ${splitLeftPct}%;`}
>
	<!-- Left pane (passage/stimulus) -->
	<div class="pane pane-left">
		<RubricDisplay blocks={leftContent} {typeset} />
	</div>

	<!-- Resizer -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="splitter"
		role="separator"
		aria-orientation="vertical"
		aria-label="Resize passage and question panels"
		aria-valuemin={minLeftPct}
		aria-valuemax={maxLeftPct}
		aria-valuenow={Math.round(splitLeftPct)}
		tabindex="0"
		use:splitterInteractions
	>
		<div class="splitter-grip" aria-hidden="true"></div>
	</div>

	<!-- Right pane (question) -->
	<div class="pane pane-right" bind:this={rightPaneEl}>
		{@render children()}
	</div>
</div>

<style>
	.split-layout {
		display: grid;
		--splitter-size: 16px;
		grid-template-columns: minmax(320px, var(--split-left)) var(--splitter-size) minmax(320px, 1fr);
		gap: 0;
		height: 100%;
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.pane {
		min-height: 0;
		overflow: auto;
		padding: 0 1rem;
	}

	.splitter {
		width: var(--splitter-size);
		cursor: col-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		align-self: stretch;
		height: 100%;
		background: var(--color-base-200);
		border-left: 1px solid var(--color-base-300);
		border-right: 1px solid var(--color-base-300);
		user-select: none;
		touch-action: none;
		position: relative;
	}

	.splitter:hover {
		background: var(--color-base-300);
		border-left-color: var(--color-base-300);
		border-right-color: var(--color-base-300);
	}

	.splitter:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* High-contrast center rail */
	.splitter::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 2px;
		transform: translateX(-50%);
		background: color-mix(in oklab, var(--color-base-content) 55%, transparent);
	}

	.splitter-grip {
		width: 6px;
		height: 72px;
		border-radius: 999px;
		background: linear-gradient(
			to bottom,
			color-mix(in oklab, var(--color-base-content) 15%, transparent),
			color-mix(in oklab, var(--color-base-content) 55%, transparent),
			color-mix(in oklab, var(--color-base-content) 15%, transparent)
		);
	}

	.split-layout.resizing .splitter {
		background: color-mix(in oklab, var(--color-primary) 14%, transparent);
		border-left-color: color-mix(in oklab, var(--color-primary) 60%, transparent);
		border-right-color: color-mix(in oklab, var(--color-primary) 60%, transparent);
	}

	/* Avoid accidental text selection during resize */
	.split-layout.resizing {
		user-select: none;
	}

	/* Avoid extra bottom spacing in panes */
	.pane :global(.rubric-container) {
		margin-bottom: 0;
	}

	@media (max-width: 768px) {
		.split-layout {
			grid-template-columns: 1fr;
			padding: 1rem;
		}

		.splitter {
			display: none;
		}

		.pane-left {
			max-height: 40vh;
		}
	}
</style>
