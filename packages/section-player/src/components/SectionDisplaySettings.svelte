<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import { tick, untrack } from 'svelte';
	import { interfaceText } from '../i18n/interface-text.js';
	import {
		type QtiCandidateDisplaySettings,
		DEFAULT_DISPLAY_SETTINGS,
	} from '../tools/display-settings.js';

	/**
	 * The display settings modal: one native `<dialog>` per section layout, opened
	 * from the "Display settings" button in the tool bars.
	 *
	 * - `showModal()`: the section behind is inert and the dialog sits in the top
	 *   layer. Where `showModal()` is missing (jsdom, very old engines) it opens
	 *   with the `open` attribute and traps Tab itself.
	 * - Settings apply as chosen; closing keeps them. Escape closes and focus
	 *   returns to the trigger.
	 * - Chromium fires a dialog's `close` event from a queued task and can run the
	 *   click that reopens it first, so close events the dialog causes itself are
	 *   counted and consumed; only a browser-initiated close reports a cancel.
	 * - Every control is a ≥ 44px target that draws from the `--pie-qti-*` tokens.
	 */

	interface Props {
		i18n?: I18nProvider;
		/** The settings in force; changed controls rewrite them. */
		settings?: QtiCandidateDisplaySettings;
		/** Where focus returns when the dialog closes; defaults to the element focused when it opened. */
		returnFocus?: HTMLElement | null;
		/** A control changed; the component writes the new settings. */
		onChange?: (settings: QtiCandidateDisplaySettings) => void;
	}

	let {
		i18n,
		settings = { ...DEFAULT_DISPLAY_SETTINGS },
		returnFocus = null,
		onChange,
	}: Props = $props();

	const uid = $props.id();
	const titleId = `${uid}-title`;
	const descriptionId = `${uid}-description`;

	const textSizeOptions: Array<{ value: QtiCandidateDisplaySettings['textSize']; labelKey: string; fallback: string }> = [
		{ value: 0, labelKey: 'sectionPlayer.displaySettings.sizeDefault', fallback: 'Default' },
		{ value: 1, labelKey: 'sectionPlayer.displaySettings.sizeLarge', fallback: 'Large' },
		{ value: 2, labelKey: 'sectionPlayer.displaySettings.sizeLarger', fallback: 'Larger' },
		{ value: 3, labelKey: 'sectionPlayer.displaySettings.sizeLargest', fallback: 'Largest' },
	];

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let titleEl = $state<HTMLElement | null>(null);
	/** True when the dialog runs without `showModal()` and emulates modality itself. */
	let usesFallback = $state(false);
	let returnTarget: HTMLElement | null = null;
	/** close() calls we issued ourselves; their `close` events must not be mistaken for cancels. */
	let expectedCloses = 0;

	const title = $derived(interfaceText(i18n, 'sectionPlayer.displaySettings.title', 'Display settings'));
	const description = $derived(
		interfaceText(
			i18n,
			'sectionPlayer.displaySettings.description',
			'Changes apply right away and stay on for this session.',
		),
	);

	/** The focused element, looking through open shadow roots so focus returns to the real trigger. */
	function deepActiveElement(doc: Document): HTMLElement | null {
		let active: Element | null = doc.activeElement;
		while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
		return active instanceof HTMLElement && active !== doc.body ? active : null;
	}

	function isShown(el: HTMLDialogElement): boolean {
		return el.hasAttribute('open');
	}

	function show(el: HTMLDialogElement) {
		if (isShown(el)) return;
		returnTarget = returnFocus ?? deepActiveElement(el.ownerDocument);
		usesFallback = typeof el.showModal !== 'function';
		if (!usesFallback) {
			try {
				el.showModal();
			} catch {
				// Not connected yet, or already open non-modally: emulate.
				usesFallback = true;
			}
		}
		if (usesFallback) el.setAttribute('open', '');
		titleEl?.focus();
	}

	function hide(el: HTMLDialogElement) {
		if (!isShown(el)) return;
		if (!usesFallback && typeof el.close === 'function') {
			expectedCloses += 1;
			el.close();
		} else {
			el.removeAttribute('open');
		}
		restoreFocus();
	}

	function restoreFocus() {
		const target = returnTarget;
		returnTarget = null;
		if (target?.isConnected) target.focus();
	}

	let open = $state(false);

	/** Open the dialog. Resolves once it is showing. */
	export async function openDialog(): Promise<void> {
		open = true;
		await tick();
	}

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (open) untrack(() => show(el));
		else untrack(() => hide(el));
	});

	function close() {
		open = false;
	}

	function handleCancelEvent(event: Event) {
		// The native close request (Escape). Keep the state in sync instead of letting
		// the browser close the element behind Svelte's back.
		event.preventDefault();
		close();
	}

	function handleCloseEvent() {
		// Chromium queues `close` as a task and can run fresh input first, so an event for a
		// previous close can arrive after the dialog was reopened — it must not cancel it.
		// Consume the close events we caused ourselves; only a browser-initiated close (no
		// matching close() call, e.g. a repeated Escape overriding `preventDefault`) closes.
		if (expectedCloses > 0) {
			expectedCloses -= 1;
			return;
		}
		if (!open) return;
		restoreFocus();
		close();
	}

	function focusableElements(el: HTMLElement): HTMLElement[] {
		return Array.from(
			el.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
			),
		).filter((node) => !node.closest('[hidden]'));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!usesFallback || !dialogEl) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (event.key !== 'Tab') return;
		// Without `showModal()` nothing makes the page inert: keep Tab inside.
		const focusable = focusableElements(dialogEl);
		if (focusable.length === 0) {
			event.preventDefault();
			return;
		}
		const first = focusable[0]!;
		const last = focusable[focusable.length - 1]!;
		const active = deepActiveElement(dialogEl.ownerDocument);
		const inside = active !== null && dialogEl.contains(active);
		if (event.shiftKey && (active === first || !inside)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || !inside)) {
			event.preventDefault();
			first.focus();
		}
	}

	/** Apply one control's change and report the resulting settings. */
	function apply(change: Partial<QtiCandidateDisplaySettings>) {
		const next: QtiCandidateDisplaySettings = {
			textSize: settings.textSize ?? DEFAULT_DISPLAY_SETTINGS.textSize,
			highContrast: settings.highContrast ?? false,
			textSpacing: settings.textSpacing ?? false,
			...change,
		};
		settings = next;
		onChange?.(next);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogEl}
	class="display-settings-dialog pie-qti-chrome"
	class:fallback={usesFallback}
	aria-labelledby={titleId}
	aria-describedby={descriptionId}
	data-testid="section-display-settings-dialog"
	oncancel={handleCancelEvent}
	onclose={handleCloseEvent}
	onkeydown={handleKeydown}
>
	<h2 bind:this={titleEl} id={titleId} class="display-settings-title" tabindex="-1">{title}</h2>
	<p id={descriptionId} class="display-settings-description">{description}</p>

	<fieldset class="display-settings-group">
		<legend>{interfaceText(i18n, 'sectionPlayer.displaySettings.textSize', 'Text size')}</legend>
		{#each textSizeOptions as option (option.value)}
			<label class="display-settings-option">
				<input
					type="radio"
					name={`${uid}-text-size`}
					value={option.value}
					checked={(settings.textSize ?? 0) === option.value}
					onchange={() => apply({ textSize: option.value })}
				/>
				<span>{interfaceText(i18n, option.labelKey, option.fallback)}</span>
			</label>
		{/each}
	</fieldset>

	<label class="display-settings-option">
		<input
			type="checkbox"
			data-testid="section-display-settings-contrast"
			checked={settings.highContrast === true}
			onchange={(event) => apply({ highContrast: (event.currentTarget as HTMLInputElement).checked })}
		/>
		<span>{interfaceText(i18n, 'sectionPlayer.displaySettings.highContrast', 'Higher-contrast text')}</span>
	</label>

	<label class="display-settings-option">
		<input
			type="checkbox"
			data-testid="section-display-settings-spacing"
			checked={settings.textSpacing === true}
			onchange={(event) => apply({ textSpacing: (event.currentTarget as HTMLInputElement).checked })}
		/>
		<span>{interfaceText(i18n, 'sectionPlayer.displaySettings.textSpacing', 'Extra text spacing')}</span>
	</label>

	<div class="display-settings-actions">
		<button type="button" class="display-settings-close" data-testid="section-display-settings-close" onclick={close}>
			{interfaceText(i18n, 'common.close', 'Close')}
		</button>
	</div>
</dialog>

<style>
	.display-settings-dialog {
		box-sizing: border-box;
		inline-size: min(26rem, calc(100% - 2 * var(--pie-qti-space-4, 1rem)));
		max-block-size: calc(100% - 2 * var(--pie-qti-space-4, 1rem));
		margin: auto;
		padding: var(--pie-qti-space-5, 1.5rem);
		overflow: auto;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		box-shadow: 0 1.25rem 2.75rem rgb(0 0 0 / 0.25);
		overscroll-behavior: contain;
	}

	.display-settings-dialog::backdrop {
		background: rgb(0 0 0 / 0.5);
	}

	/* Without showModal() there is no top layer: pin the dialog over the page. */
	.display-settings-dialog.fallback {
		position: fixed;
		inset: 0;
		z-index: 2147483000;
		block-size: fit-content;
	}

	.display-settings-title {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
		font-size: 1.25em;
		font-weight: 700;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.display-settings-title:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.display-settings-description {
		margin: 0 0 var(--pie-qti-space-4, 1rem);
	}

	.display-settings-group {
		box-sizing: border-box;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: var(--pie-qti-radius, 0.5rem);
		padding: var(--pie-qti-space-2, 0.5rem) var(--pie-qti-space-3, 0.75rem);
		margin: 0 0 var(--pie-qti-space-3, 0.75rem);
		min-inline-size: 0;
	}

	.display-settings-group legend {
		padding-inline: var(--pie-qti-space-1, 0.25rem);
		font-weight: 600;
	}

	.display-settings-option {
		display: flex;
		align-items: center;
		gap: var(--pie-qti-space-3, 0.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-1, 0.25rem);
		cursor: pointer;
	}

	.display-settings-option input {
		inline-size: 1.25rem;
		block-size: 1.25rem;
		margin: 0;
		accent-color: var(--pie-qti-primary, oklch(45% 0.24 277));
	}

	.display-settings-option input:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.display-settings-actions {
		display: flex;
		justify-content: flex-end;
		margin-block-start: var(--pie-qti-space-3, 0.75rem);
	}

	.display-settings-close {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-5, 1.5rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		color: var(--pie-qti-primary-content, oklch(98% 0.01 277));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		cursor: pointer;
	}

	.display-settings-close:hover {
		background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 85%, black);
	}

	.display-settings-close:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
</style>
