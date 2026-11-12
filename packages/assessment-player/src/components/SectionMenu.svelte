<script lang="ts">
	/**
	 * Section menu: a disclosure pattern (button with `aria-expanded` plus a plain list of
	 * section buttons). Not a `role="menu"`: section jumps are page navigation, and a
	 * disclosure keeps normal Tab, screen-reader and touch behaviour.
	 *
	 * Each section shows its answered count; only sections jumping is legal for right now
	 * (the current navigationMode, locks, finalization) are enabled. The current section
	 * is marked with `aria-current`. Styled self-contained on the `--pie-qti-*` tokens.
	 */
	import { tick } from 'svelte';
	import type { I18nProvider } from '@pie-qti/i18n';

	interface SectionMenuItem {
		id: string;
		title?: string;
		/** Position in the candidate-facing section list. */
		index: number;
		/** Whether jumping to this section is legal right now. */
		navigable: boolean;
		/** Items with a response (answered or partially answered). */
		answered: number;
		/** All delivered items in the section. */
		total: number;
		isCurrent: boolean;
	}

	interface Props {
		sections: SectionMenuItem[];
		i18n?: I18nProvider;
		onSectionSelect?: (sectionIndex: number) => void;
		disabled?: boolean;
	}

	const { sections, i18n, onSectionSelect, disabled = false }: Props = $props();

	const uid = $props.id();
	const menuId = `${uid}-sections`;

	let isOpen = $state(false);
	let toggleButton = $state<HTMLButtonElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);
	let menuRoot = $state<HTMLDivElement | null>(null);

	const translations = $derived.by(() => {
		const t = (key: string, fallback: string, values?: Record<string, string | number>) =>
			i18n?.t(key, fallback, values) ?? fallback;
		return {
			title: t('assessment.sections.title', 'Sections'),
			sectionDefault: (number: number) => t('assessment.sectionDefault', 'Section {number}', { number }),
			answeredCount: (answered: number, total: number) =>
				t('assessment.navigation.answeredCount', '{answered} of {total} answered', { answered, total }),
			current: t('assessment.review.currentItem', 'Current question'),
		};
	});

	async function openMenu() {
		if (disabled || isOpen) return;
		isOpen = true;
		await tick();
		// Focus lands on the current section, else the first enabled one.
		const current = listEl?.querySelector<HTMLButtonElement>('[aria-current="true"]:not(:disabled)');
		const firstEnabled = listEl?.querySelector<HTMLButtonElement>('.section-item:not(:disabled)');
		(current ?? firstEnabled)?.focus();
	}

	function closeMenu({ restoreFocus = true } = {}) {
		if (!isOpen) return;
		isOpen = false;
		if (restoreFocus) toggleButton?.focus();
	}

	function toggleMenu() {
		if (isOpen) closeMenu();
		else void openMenu();
	}

	function handleToggleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			void openMenu();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen || event.key !== 'Escape') return;
		const target = event.target;
		if (target instanceof Node && menuRoot?.contains(target)) {
			event.preventDefault();
			closeMenu();
		}
	}

	/** Pointer presses outside the disclosure close it, like a native popover. */
	function handlePointerDown(event: PointerEvent) {
		if (!isOpen) return;
		if (event.target instanceof Node && menuRoot?.contains(event.target)) return;
		closeMenu({ restoreFocus: false });
	}

	function selectSection(sectionIndex: number) {
		if (disabled) return;
		if (onSectionSelect) onSectionSelect(sectionIndex);
		closeMenu();
	}
</script>

<svelte:window onpointerdown={handlePointerDown} onkeydown={handleKeydown} />

{#if sections.length > 1}
	<div class="section-menu" bind:this={menuRoot}>
	<!-- aria-controls names the list only while it exists: removed while closed,
	     a dangling reference would point at nothing. -->
	<button
		bind:this={toggleButton}
		class="section-menu-toggle"
		type="button"
		aria-expanded={isOpen}
		aria-controls={isOpen ? menuId : undefined}
		onclick={toggleMenu}
		onkeydown={handleToggleKeydown}
		disabled={disabled}
	>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="section-menu-icon"
				width="20"
				height="20"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
			</svg>
			{translations.title}
		</button>

		{#if isOpen}
			<div class="section-dropdown">
				<ul
					bind:this={listEl}
					id={menuId}
					class="section-list"
					aria-label={translations.title}
				>
					{#each sections as section (section.id)}
						<li class="section-entry">
							<button
								class="section-item"
								class:active={section.isCurrent}
								type="button"
								aria-current={section.isCurrent ? 'true' : undefined}
								onclick={() => selectSection(section.index)}
								disabled={!section.navigable || disabled}
							>
								<span class="section-info">
									<span class="section-title">
										{section.title?.trim() || translations.sectionDefault(section.index + 1)}
									</span>
									<span class="section-status">{translations.answeredCount(section.answered, section.total)}</span>
								</span>
								{#if section.isCurrent}
									<span class="section-current">{translations.current}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
{/if}

<style>
	.section-menu {
		position: relative;
	}

	.section-menu-toggle {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		gap: var(--pie-qti-space-2, 0.5rem);
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-3, 0.75rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		cursor: pointer;
	}

	.section-menu-toggle:hover:not(:disabled) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.section-menu-toggle:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.section-menu-toggle:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.section-menu-icon {
		flex: none;
		inline-size: 1.25rem;
		block-size: 1.25rem;
	}

	.section-dropdown {
		position: absolute;
		inset-block-start: calc(100% + var(--pie-qti-space-1, 0.25rem));
		inset-inline-end: 0;
		z-index: 50;
		min-inline-size: 16rem;
		max-inline-size: min(20rem, 100vw);
	}

	.section-list {
		list-style: none;
		margin: 0;
		padding: var(--pie-qti-space-2, 0.5rem);
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-1, 0.25rem);
		max-block-size: 24rem;
		overflow-y: auto;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		box-shadow: 0 0.625rem 1.5rem rgb(0 0 0 / 0.15);
	}

	.section-item {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pie-qti-space-3, 0.75rem);
		inline-size: 100%;
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-3, 0.75rem);
		border: 0;
		border-radius: var(--pie-qti-radius-sm, 0.25rem);
		background: transparent;
		color: inherit;
		font: inherit;
		line-height: 1.3;
		text-align: start;
		cursor: pointer;
	}

	.section-item:hover:not(:disabled) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	/* Inset ring: the list scrolls and would clip an outer one. */
	.section-item:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: -2px;
	}

	.section-item.active {
		background: color-mix(
			in oklab,
			var(--pie-qti-primary, oklch(45% 0.24 277)) 12%,
			var(--pie-qti-base-100, oklch(100% 0 0))
		);
		font-weight: 700;
	}

	.section-item:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.section-info {
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-1, 0.25rem);
		min-inline-size: 0;
	}

	.section-title {
		font-weight: inherit;
		overflow-wrap: anywhere;
	}

	.section-item.active .section-title {
		font-weight: 700;
	}

	.section-status {
		font-size: 0.875em;
		color: color-mix(in oklab, var(--pie-qti-base-content, oklch(21% 0 0)) 80%, transparent);
	}

	.section-current {
		flex: none;
		font-size: 0.8125em;
		font-weight: 600;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 999px;
		padding-block: var(--pie-qti-space-1, 0.25rem);
		padding-inline: var(--pie-qti-space-2, 0.5rem);
	}

	/* Phones: the panel spans the header row instead of overflowing the screen edge. */
	@media (max-width: 40rem) {
		.section-dropdown {
			position: fixed;
			inset-block-start: auto;
			inset-inline: var(--pie-qti-space-3, 0.75rem);
			min-inline-size: 0;
			max-inline-size: none;
		}
	}
</style>
