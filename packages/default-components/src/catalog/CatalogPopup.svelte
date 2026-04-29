<svelte:options customElement="pie-qti-catalog-popup" />

<script lang="ts">
	/**
	 * CatalogPopup — accessible floating dialog for QTI 3.0 catalog entries.
	 *
	 * Renders glossary definitions, keyword translations, and illustrated-glossary images.
	 * Focus-trapped: Tab/Shift+Tab cycle within; Escape closes.
	 * For platform-level usages (TTS, signing, braille) the player fires a qti-catalog-lookup
	 * event instead of mounting this component.
	 */

	interface Props {
		/** HTML content from CatalogEntry.html (or URL for illustrated-glossary). */
		content: string;
		/** Accessible label for the dialog (the term text). */
		label: string;
		/** Callback when the popup is closed. */
		onClose: () => void;
	}

	const { content, label, onClose }: Props = $props();

	// Illustrated-glossary: if content looks like a URL, render as <img>
	const isUrl = $derived(/^(https?:\/\/|\/)/i.test(content.trim()));

	let dialogEl: HTMLDivElement | undefined = $state();
	let closeBtn: HTMLButtonElement | undefined = $state();

	// Move focus into the popup on mount
	$effect(() => {
		if (dialogEl) {
			closeBtn?.focus();
		}
	});

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
			return;
		}

		// Focus trap: keep Tab within the popup
		if (event.key === 'Tab' && dialogEl) {
			const focusable = Array.from(
				dialogEl.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
				)
			).filter((el) => el.offsetParent !== null);

			if (focusable.length === 0) {
				event.preventDefault();
				return;
			}

			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={dialogEl}
	role="dialog"
	aria-label={label}
	aria-modal="true"
	class="qti-catalog-popup"
	onkeydown={handleKeyDown}
>
	<div class="qti-catalog-popup__header">
		<span class="qti-catalog-popup__title">{label}</span>
		<button
			bind:this={closeBtn}
			type="button"
			class="qti-catalog-popup__close"
			aria-label="Close"
			onclick={onClose}
		>✕</button>
	</div>
	<div class="qti-catalog-popup__body">
		{#if isUrl}
			<img src={content} alt={label} class="qti-catalog-popup__img" />
		{:else}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html content}
		{/if}
	</div>
</div>

<style>
	.qti-catalog-popup {
		position: absolute;
		z-index: 1000;
		background: var(--color-base-100, #fff);
		border: 1px solid var(--color-base-300, #d1d5db);
		border-radius: 0.5rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		min-width: 16rem;
		max-width: 24rem;
		padding: 0;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.qti-catalog-popup__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
		background: var(--color-base-200, #f9fafb);
		border-radius: 0.5rem 0.5rem 0 0;
	}

	.qti-catalog-popup__title {
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--color-base-content, #111);
	}

	.qti-catalog-popup__close {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
		color: var(--color-base-content, #111);
		opacity: 0.6;
	}

	.qti-catalog-popup__close:hover,
	.qti-catalog-popup__close:focus-visible {
		opacity: 1;
		background: var(--color-base-300, #e5e7eb);
		outline: 2px solid var(--color-primary, #4f46e5);
		outline-offset: 1px;
	}

	.qti-catalog-popup__body {
		padding: 0.75rem;
		color: var(--color-base-content, #111);
	}

	.qti-catalog-popup__img {
		max-width: 100%;
		height: auto;
		display: block;
		margin: 0 auto;
	}
</style>
