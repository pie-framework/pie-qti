<script lang="ts">
	import { IFramePlayerHost, type IFramePlayerHostEvent } from '@pie-qti/qti2-item-player/iframe';
	import { onDestroy, onMount, getContext } from 'svelte';
	import { base } from '$app/paths';
	import { SAMPLE_ITEMS } from '$lib/sample-items';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

	const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
	const i18n = $derived(i18nContext?.value);

	let selectedSampleId = $state('simple-choice');
	let lastResponses = $state<Record<string, unknown>>({});
	let lastSubmitResult = $state<any | null>(null);
	let lastError = $state<string | null>(null);
	let readyInfo = $state<{ origin: string; version: string } | null>(null);

	let host: IFramePlayerHost | null = null;
	let iframeContainer: HTMLElement | null = $state(null);

	let runtimeUrl = $state('');

	function computeRuntimeUrl() {
		const parentOrigin = window.location.origin;
		runtimeUrl = `${parentOrigin}${base}/iframe-runtime?parentOrigin=${encodeURIComponent(parentOrigin)}`;
	}

	function onHostEvent(evt: IFramePlayerHostEvent) {
		switch (evt.type) {
			case 'ready':
				readyInfo = { origin: evt.payload.origin, version: evt.payload.version };
				return;
			case 'responseChange':
				lastResponses = evt.payload.responses;
				return;
			case 'submitResult':
				lastSubmitResult = evt.payload.result;
				return;
			case 'error':
				lastError = evt.payload.message;
				return;
			default:
				return;
		}
	}

	async function initSelectedSample() {
		if (!host) return;
		lastError = null;
		lastSubmitResult = null;

		const item = SAMPLE_ITEMS.find((s) => s.id === selectedSampleId);
		if (!item) return;

		await host.init({
			itemXml: item.xml,
			role: 'candidate',
		});
	}

	async function submit() {
		lastError = null;
		lastSubmitResult = null;
		await host?.submit();
	}

	async function reset() {
		lastError = null;
		lastSubmitResult = null;
		await host?.reset();
	}

	onMount(() => {
		if (!iframeContainer) return;

		computeRuntimeUrl();

		host = new IFramePlayerHost({
			container: iframeContainer,
			iframeUrl: runtimeUrl,
			// NOTE: In this demo the runtime is same-origin, so this does NOT provide meaningful isolation.
			// Production guidance: host runtime on a separate origin and keep allow-same-origin enabled.
			allowedOrigins: [window.location.origin],
			// Demo needs allow-same-origin so SvelteKit module scripts load reliably.
			sandbox: 'allow-scripts allow-same-origin',
			autoResize: true,
		});

		const off = host.on(onHostEvent);
		host
			.ready()
			.then(initSelectedSample)
			.catch((e: unknown) => (lastError = e instanceof Error ? e.message : String(e)));

		onDestroy(() => {
			off();
			host?.destroy();
			host = null;
		});
	});
</script>

<svelte:head>
	<title>Iframe Mode Demo (Reference)</title>
</svelte:head>

<div class="container mx-auto p-6 space-y-6">
	<div class="alert alert-info">
		<div>
			<div class="font-semibold">Iframe mode demo (reference)</div>
			<div class="text-sm opacity-80">
				This demonstrates `@pie-qti/qti2-item-player/iframe` and the postMessage protocol. Because this demo runs
				the runtime on the same origin, it is <span class="font-semibold">not a secure isolation boundary</span>.
				For real isolation, host the runtime on a separate origin.
			</div>
		</div>
	</div>

	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">Host Controls</h2>

			<div class="form-control w-full max-w-xl">
				<label class="label" for="sample-select"><span class="label-text">Sample item</span></label>
				<select
					id="sample-select"
					class="select select-bordered"
					bind:value={selectedSampleId}
					onchange={() => initSelectedSample()}
				>
					{#each SAMPLE_ITEMS as item}
						<option value={item.id}>{item.title}</option>
					{/each}
				</select>
				<div class="label">
					<span class="label-text-alt">{i18n?.t(`demo.sampleItemDescriptions.${selectedSampleId}`) ?? SAMPLE_ITEMS.find((s) => s.id === selectedSampleId)?.description}</span>
				</div>
			</div>

			<div class="flex gap-2">
				<button class="btn btn-primary" onclick={submit} disabled={!readyInfo}>Submit</button>
				<button class="btn btn-secondary" onclick={reset} disabled={!readyInfo}>Reset</button>
			</div>

			<div class="text-sm opacity-70">
				<div>Runtime URL: <code class="text-xs">{runtimeUrl}</code></div>
				{#if readyInfo}
					<div>READY from: <code class="text-xs">{readyInfo.origin}</code> (protocol {readyInfo.version})</div>
				{:else}
					<div>Waiting for READY…</div>
				{/if}
			</div>

			{#if lastError}
				<div class="alert alert-error mt-4">
					<div class="text-sm">{lastError}</div>
				</div>
			{/if}
		</div>
	</div>

	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">Embedded iframe</h2>
			<div bind:this={iframeContainer}></div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Latest responses</h2>
				<pre class="text-xs overflow-auto bg-base-200 p-3 rounded">{JSON.stringify(lastResponses, null, 2)}</pre>
			</div>
		</div>

		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Latest submit result</h2>
				{#if lastSubmitResult}
					<pre class="text-xs overflow-auto bg-base-200 p-3 rounded">{JSON.stringify(lastSubmitResult, null, 2)}</pre>
				{:else}
					<div class="text-sm opacity-70">No submit result yet.</div>
				{/if}
			</div>
		</div>
	</div>
</div>


