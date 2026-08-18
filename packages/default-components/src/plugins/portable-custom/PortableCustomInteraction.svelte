<svelte:options customElement="pie-qti-portable-custom" />

<script lang="ts">
	import type {
		ExtractedPci,
		PciConfiguration,
		PciHostController,
		PlayerSecurityConfig,
		PortableCustomInteractionData,
	} from '@pie-qti/item-player';
	import { PciHost } from '@pie-qti/item-player/pci';
	import { sanitizeSharedHtml } from '@pie-qti/item-player/security';
	import type { I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	type PciHostFactory = (data: ExtractedPci) => PciHostController;
	type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

	interface Props {
		interaction?: PortableCustomInteractionData | string;
		response?: unknown;
		disabled?: boolean;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		/** Player-owned factory used when rendered inside pie-qti-item-player. */
		createPciHost?: PciHostFactory;
		/** Standalone custom-element trust configuration. Set as a JavaScript property. */
		pci?: PciConfiguration;
		onChange?: (value: unknown) => void;
	}

	let {
		interaction = $bindable(),
		response = $bindable(),
		disabled = false,
		i18n = $bindable(),
		security,
		createPciHost,
		pci,
		onChange,
	}: Props = $props();

	const parsedInteraction = $derived(
		parseJsonProp<PortableCustomInteractionData>(interaction)
	);
	const parsedResponse = $derived(parseJsonProp<unknown>(response));
	const safeMarkup = $derived.by(() => {
		const markup = parsedInteraction?.markup ?? '';
		return typeof markup === 'string' ? sanitizeSharedHtml(markup, security) : markup;
	});

	let mountElement: HTMLDivElement | undefined = $state();
	let eventTarget: HTMLDivElement | undefined = $state();
	let host: PciHostController | null = $state(null);
	let status: LoadStatus = $state('idle');
	let errorMessage = $state<string | null>(null);
	// The module's own reports round-trip through the `response` prop. Tracking
	// the last emitted value keeps that echo from re-entering the module.
	let lastEmitted: unknown = undefined;
	let hasEmitted = false;

	// Interactive descendants, in document order, for restoring focus after a
	// rebuild. Negative tabindex is excluded: it is reachable by script only.
	const FOCUSABLE_SELECTOR =
		'a[href],area[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
		'textarea:not([disabled]),iframe,[contenteditable="true"],[tabindex]:not([tabindex^="-"])';

	/** Reset the module's DOM scaffold and the per-instance echo tracking. */
	function resetScaffold(target: HTMLElement, markup: unknown) {
		// A fresh module has emitted nothing yet.
		hasEmitted = false;
		lastEmitted = undefined;
		status = 'loading';
		errorMessage = null;
		// Keep TrustedHTML opaque until the DOM sink. Raw standalone strings are
		// sanitized and finalized by `safeMarkup` above.
		target.innerHTML = markup as any;
	}

	function holdsFocus(target: HTMLElement): boolean {
		const root = target.getRootNode() as Document | ShadowRoot;
		const active = root.activeElement;
		return !!active && target.contains(active);
	}

	function restoreFocus(target: HTMLElement) {
		(target.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? target).focus();
	}

	function emitResponse(value: unknown) {
		lastEmitted = value;
		hasEmitted = true;
		response = value;
		onChange?.(value);
		// A player-owned host publishes this same change through the authoritative
		// ItemSession binding. Emitting qti-change as well would dispatch twice.
		if (eventTarget && !createPciHost) {
			eventTarget.dispatchEvent(
				createQtiChangeEvent(parsedInteraction?.responseId, value)
			);
		}
	}

	$effect(() => {
		const data = parsedInteraction;
		const target = mountElement;
		const factory = createPciHost;
		const resolver = pci?.moduleResolver;
		const baseUrl = pci?.baseUrl;
		const markup = safeMarkup;
		if (!data || !target) return;
		resetScaffold(target, markup);

		let cancelled = false;
		let currentHost: PciHostController;
		try {
			currentHost = factory
				? factory(data)
				: new PciHost(data, { baseUrl, moduleResolver: resolver });
		} catch (error) {
			status = 'error';
			errorMessage = error instanceof Error ? error.message : String(error);
			return;
		}

		host = currentHost;
		const stopListening = currentHost.onResponseChange((_responseId, value) => {
			if (!cancelled) emitResponse(value);
		});

		// An authoritative restore rebuilds the module from the restored value.
		// Scaffold sanitization lives here, so the reset does too.
		const stopRemountRequests = currentHost.onRemountRequest(() => {
			if (cancelled) return;
			// Replacing the scaffold destroys the focused element inside it, so a
			// candidate working by keyboard would be dropped back to the document.
			const refocus = holdsFocus(target);
			resetScaffold(target, markup);
			void currentHost
				.remount(target)
				.then(() => {
					if (cancelled) return;
					status = 'ready';
					if (refocus) restoreFocus(target);
				})
				.catch((error) => {
					if (cancelled) return;
					status = 'error';
					errorMessage = error instanceof Error ? error.message : String(error);
				});
		});

		void currentHost
			.load()
			.then(() => {
				if (cancelled) return;
				currentHost.initialize(target);
				status = 'ready';
			})
			.catch((error) => {
				if (cancelled) return;
				currentHost.destroy();
				status = 'error';
				errorMessage = error instanceof Error ? error.message : String(error);
			});

		return () => {
			cancelled = true;
			stopListening();
			stopRemountRequests();
			currentHost.destroy();
			if (host === currentHost) host = null;
		};
	});

	// Offer controlled/session state before and after module initialization. The
	// host declines once the module owns its response; skipping our own echo here
	// avoids a pointless round-trip on every candidate change.
	$effect(() => {
		const currentHost = host;
		const value = parsedResponse;
		if (!currentHost || value === undefined) return;
		if (hasEmitted && value === lastEmitted) return;
		currentHost.offerResponse(value);
	});

	// Keep the module's operability aligned with the candidate/read-only state.
	$effect(() => {
		const currentHost = host;
		if (!currentHost || status !== 'ready') return;
		if (disabled) currentHost.disable();
		else currentHost.enable();
	});
</script>

<ShadowBaseStyles />

<div
	bind:this={eventTarget}
	part="root"
	class="qti-portable-custom-interaction"
	role="group"
	aria-label={i18n?.t('customInteraction.portableLabel', 'Portable custom interaction')}
>
	{#if !parsedInteraction}
		<div class="alert alert-error" role="alert">
			{i18n?.t('common.errorNoData', 'No interaction data provided')}
		</div>
	{:else}
		{#if status === 'loading'}
			<div class="pci-status" role="status">
				{i18n?.t('common.loading', 'Loading...')}
			</div>
		{:else if status === 'error'}
			<div class="alert alert-error" role="alert">
				{errorMessage ?? i18n?.t('item.loadingError', 'Failed to load interaction')}
			</div>
		{/if}

		<!-- tabindex="-1": script-only focus target when a rebuilt scaffold has no
		     focusable descendant to return the candidate to. -->
		<div
			bind:this={mountElement}
			part="interaction"
			class="pci-mount"
			tabindex="-1"
			aria-busy={status === 'loading'}
		></div>
	{/if}
</div>

<style>
	.qti-portable-custom-interaction,
	.pci-mount {
		max-width: 100%;
		min-width: 0;
	}

	.pci-status {
		margin-block-end: 0.5rem;
		color: var(--pie-qti-base-content, currentColor);
	}

	.alert {
		margin-block-end: 0.75rem;
	}
</style>
