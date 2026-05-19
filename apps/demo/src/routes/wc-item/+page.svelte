<script lang="ts">
	import { onMount } from 'svelte';
	import { SAMPLE_ITEMS } from '$lib/sample-items';
	import { getSecurityConfig } from '$lib/player-config';
	import { assignProps } from '@pie-qti/qti-common';

	let status = $state<'booting' | 'registering' | 'registered' | 'rendered' | 'error'>('booting');
	let message = $state<string>('Starting…');
	let el = $state<any | null>(null);

	const sample = SAMPLE_ITEMS.find((i) => i.id === 'simple-choice') ?? SAMPLE_ITEMS[0];
	// Keep in sync with `SIMPLE_CHOICE`'s itemBody text in `$lib/sample-items`.
	const expectedText = 'If Maya has 12 cookies and gives 5 to her friend, how many cookies does she have left?';

	/** QTI interaction CEs use open shadow roots; recurse so we see prompt text inside them. */
	function deepText(root: Node | null | undefined): string {
		if (!root) return '';
		if (root.nodeType === Node.TEXT_NODE) return root.textContent ?? '';
		let s = '';
		for (const c of root.childNodes) s += deepText(c);
		if (root instanceof Element && root.shadowRoot) s += deepText(root.shadowRoot);
		return s;
	}

	async function waitForRender(timeoutMs: number) {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			if (deepText(el).includes(expectedText)) return true;
			await new Promise((r) => setTimeout(r, 100));
		}
		return false;
	}

	onMount(async () => {
		try {
			status = 'registering';
			message = 'Registering web components…';

			await import('@pie-qti/web-component-loaders').then((m) => m.loadPieQtiPlayerElements());
			await customElements.whenDefined('pie-qti-item-player');

			status = 'registered';
			message = 'Web component registered. Rendering…';

			if (!el) throw new Error('Element not mounted');

			assignProps(el, {
				itemXml: sample?.xml ?? '',
				identifier: sample?.id ?? 'item',
				title: sample?.title ?? 'Item',
				role: 'candidate',
				security: getSecurityConfig(),
			});

			const ok = await waitForRender(30_000);
			if (!ok) throw new Error('Timeout waiting for item to render');

			status = 'rendered';
			message = 'Rendered successfully.';
		} catch (e) {
			status = 'error';
			message = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<svelte:head>
	<title>Web Component: Item Player</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-6 py-8 space-y-6">
	<div class="prose max-w-none">
		<h1>Web Component: Item Player</h1>
		<p>
			This route is a <em>smoke test</em> for the <strong>custom element integration path</strong>.
			It proves that:
		</p>
		<ul>
			<li>
				<strong>Registration works</strong>: <code>@pie-qti/web-component-loaders</code> registers
				<code>&lt;pie-qti-item-player&gt;</code> via <code>customElements</code>.
			</li>
			<li>
				<strong>Property API works</strong>: the host can set <code>itemXml</code>, <code>identifier</code>,
				<code>title</code>, and <code>role</code> as JS properties (not HTML attributes).
			</li>
			<li>
				<strong>Rendering works</strong>: the element renders the expected prompt text (checked in both light DOM
				and shadow DOM).
			</li>
		</ul>
		<p class="text-sm opacity-70">
			This does <strong>not</strong> aim to prove full end-to-end scoring, hosting concerns, or cross-origin isolation.
			For that, use the Svelte routes (e.g. <code>/item-demo</code>) and the iframe demo where relevant.
		</p>
	</div>

	<div class="alert {status === 'error' ? 'alert-error' : status === 'rendered' ? 'alert-success' : 'alert-info'}">
		<div class="flex-1">
			<div class="font-semibold">Status: {status}</div>
			<div class="text-sm">{message}</div>
		</div>
	</div>

	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">Player</h2>
			<p class="text-sm text-base-content/70">Expected text: <strong>{expectedText}</strong></p>

			<div class="bg-base-200 rounded-lg p-4">
				<pie-qti-item-player bind:this={el} class="block w-full"></pie-qti-item-player>
			</div>
		</div>
	</div>
</div>
