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
	import { sanitizeHtml } from '@pie-qti/item-player/security';
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
	const safeMarkup = $derived(
		sanitizeHtml(parsedInteraction?.markup ?? '', { security })
	);

	let mountElement: HTMLDivElement | undefined = $state();
	let eventTarget: HTMLDivElement | undefined = $state();
	let host: PciHostController | null = $state(null);
	let status: LoadStatus = $state('idle');
	let errorMessage = $state<string | null>(null);

	function emitResponse(value: unknown) {
		response = value;
		onChange?.(value);
		if (eventTarget) {
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
		target.innerHTML = markup;

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
		status = 'loading';
		errorMessage = null;
		const stopListening = currentHost.onResponseChange((_responseId, value) => {
			if (!cancelled) emitResponse(value);
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
			currentHost.destroy();
			if (host === currentHost) host = null;
		};
	});

	// Restore controlled/session state both before and after module initialization.
	$effect(() => {
		const currentHost = host;
		const value = parsedResponse;
		if (currentHost && value !== undefined) currentHost.setResponse(value);
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

		<div
			bind:this={mountElement}
			part="interaction"
			class="pci-mount"
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
