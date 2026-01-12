<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import '@pie-qti/qti2-default-components/plugins'; // Load web components
	import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
	import { typesetAction } from '@pie-qti/qti2-default-components/shared';
	// @ts-expect-error - Svelte-check can't resolve workspace subpath exports, but runtime works correctly
	import { ItemBody } from '@pie-qti/qti2-item-player/components';
	import {
		Player,
		type PlayerSecurityConfig,
		type QTIRole,
	} from '@pie-qti/qti2-item-player';
	import { createEnvelope, parseQtiIframeMessage } from '@pie-qti/qti2-item-player/iframe';
	import { typesetMathInElement } from '@pie-qti/qti2-typeset-katex';
	import { onDestroy, onMount } from 'svelte';

	let player: Player | null = $state(null);
	let responses = $state<Record<string, any>>({});
	let scoringResult: any | null = $state(null);
	let errorMessage = $state<string | null>(null);
	let disabled = $state(false);
	let runtimeConfig = $state<Record<string, unknown> | null>(null);

	let rootEl: HTMLElement | null = $state(null);

	// Optional security: validate messages from a known parent origin.
	// Note: during prerendering, query strings are unavailable; guard access.
	const expectedParentOrigin = $derived(browser ? $page.url.searchParams.get('parentOrigin') : null);
	const targetParentOrigin = $derived(expectedParentOrigin ?? '*');

	function makePostMessageSafe(value: unknown): unknown {
		// Ensure payloads are structured-cloneable. If not, fall back to a JSON-safe shape.
		try {
			if (typeof structuredClone === 'function') {
				structuredClone(value);
			} else {
				throw new Error('structuredClone is not available in this runtime');
			}
			return value;
		} catch {
			const seen = new WeakSet<object>();
			try {
				return JSON.parse(
					JSON.stringify(value, (_key, v) => {
						if (typeof v === 'bigint') return `${v.toString()}n`;
						if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
						if (v instanceof Map) return { __type: 'Map', entries: Array.from(v.entries()) };
						if (v instanceof Set) return { __type: 'Set', values: Array.from(v.values()) };
						if (typeof v === 'object' && v !== null) {
							if (seen.has(v as object)) return '[Circular]';
							seen.add(v as object);
						}
						return v;
					})
				);
			} catch (err: any) {
				return {
					__type: 'Unserializable',
					message: err?.message ?? String(err),
				};
			}
		}
	}

	function postToParent(type: any, payload: any) {
		try {
			window.parent?.postMessage(createEnvelope(type, makePostMessageSafe(payload)), targetParentOrigin);
		} catch (err: any) {
			// Last resort: nothing we can do if postMessage fails.
			errorMessage = err?.message ?? String(err);
		}
	}

	function loadPlayer(params: {
		itemXml: string;
		role?: QTIRole;
		seed?: number;
		security?: PlayerSecurityConfig;
		responses?: Record<string, unknown>;
		runtimeConfig?: Record<string, unknown>;
	}) {
		try {
			errorMessage = null;
			scoringResult = null;
			disabled = false;
			runtimeConfig = params.runtimeConfig ?? null;

			const newPlayer = new Player({
				itemXml: params.itemXml,
				role: params.role ?? 'candidate',
				seed: params.seed,
				security: params.security,
			});
			registerDefaultComponents(newPlayer.getComponentRegistry());
			player = newPlayer;

			// Initialize responses map.
			const interactions = newPlayer.getResponseInteractions();
			const next: Record<string, any> = {};
			for (const interaction of interactions) {
				if (interaction?.responseIdentifier) {
					next[interaction.responseIdentifier] = null;
				}
			}
			// Apply any provided initial responses.
			if (params.responses) {
				for (const [k, v] of Object.entries(params.responses)) next[k] = v;
			}
			responses = next;
		} catch (err: any) {
			player = null;
			responses = {};
			errorMessage = err?.message ?? String(err);
			postToParent('ERROR', { message: errorMessage, code: 'INIT_FAILED' });
		}
	}

	function onResponseChange(responseId: string, value: any) {
		responses = { ...responses, [responseId]: value };
		postToParent('RESPONSE_CHANGE', { responses });
	}

	function submit() {
		if (!player) return;
		try {
			disabled = true;
			player.setResponses(responses);
			scoringResult = player.processResponses();
			postToParent('SUBMIT_RESULT', { result: scoringResult });
		} catch (err: any) {
			errorMessage = err?.message ?? String(err);
			postToParent('ERROR', { message: errorMessage, code: 'SUBMIT_FAILED' });
		} finally {
			disabled = false;
		}
	}

	function reset() {
		if (!player) return;
		try {
			scoringResult = null;
			disabled = false;
			const interactions = player.getResponseInteractions();
			const next: Record<string, any> = {};
			for (const interaction of interactions) {
				if (interaction?.responseIdentifier) {
					next[interaction.responseIdentifier] = null;
				}
			}
			responses = next;
			postToParent('RESPONSE_CHANGE', { responses });
		} catch (err: any) {
			errorMessage = err?.message ?? String(err);
			postToParent('ERROR', { message: errorMessage, code: 'RESET_FAILED' });
		}
	}

	function setResponses(next: Record<string, unknown>) {
		// Best-effort overwrite only known keys.
		const merged: Record<string, any> = { ...responses };
		for (const [k, v] of Object.entries(next)) merged[k] = v;
		responses = merged;
		postToParent('RESPONSE_CHANGE', { responses });
	}

	function handleIncomingMessage(event: MessageEvent) {
		if (expectedParentOrigin && event.origin !== expectedParentOrigin) return;
		if (event.source !== window.parent) return;

		const msg = parseQtiIframeMessage(event.data);
		if (!msg) return;

		switch (msg.type) {
			case 'INIT':
				loadPlayer(msg.payload as any);
				return;
			case 'SET_RESPONSES':
				setResponses((msg.payload as any)?.responses ?? {});
				return;
			case 'SUBMIT':
				submit();
				return;
			case 'RESET':
				reset();
				return;
			default:
				return;
		}
	}

	function emitResize() {
		if (!rootEl) return;
		const rect = rootEl.getBoundingClientRect();
		// Include some breathing room so focus outlines and shadows don't get clipped.
		const height = Math.ceil(rect.height + 8);
		postToParent('RESIZE', { height });
	}

	let resizeObserver: ResizeObserver | null = null;

	onMount(() => {
		window.addEventListener('message', handleIncomingMessage);

		// READY handshake
		postToParent('READY', { version: '0.1.0', runtime: 'qti2-example reference runtime' });

		// Resize notifications
		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => emitResize());
			if (rootEl) resizeObserver.observe(rootEl);
		}
		// Fallback: emit once on mount
		emitResize();
	});

	onDestroy(() => {
		// During SSR/prerender, Svelte runs destroy handlers; guard browser globals.
		if (browser) {
			window.removeEventListener('message', handleIncomingMessage);
		}
		resizeObserver?.disconnect();
	});

	$effect(() => {
		// Re-emit size when key state changes
		player;
		responses;
		scoringResult;
		errorMessage;
		runtimeConfig;
		queueMicrotask(() => emitResize());
	});
</script>

<svelte:head>
	<title>PIE QTI 2.2 Player — Iframe Runtime (Reference)</title>
</svelte:head>

<div class="runtime-root" bind:this={rootEl} use:typesetAction={{ typeset: (el) => typesetMathInElement(el) }}>
	{#if !player}
		<!-- Keep the runtime visually minimal: the host drives INIT quickly in normal usage. -->
		<div class="text-sm opacity-60">Loading…</div>
	{:else}
		<div class="qti-question-body">
			<ItemBody {player} {responses} {disabled} typeset={typesetMathInElement} {onResponseChange} />
		</div>
	{/if}

	{#if scoringResult}
		<div class="card bg-base-100 shadow mt-4">
			<div class="card-body py-4">
				<h2 class="card-title text-base">Scoring</h2>
				<div class="text-sm">
					Score: <span class="font-semibold">{scoringResult.score}</span> / {scoringResult.maxScore}
					{#if typeof scoringResult.completed === 'boolean'}
						<span class="opacity-70">({scoringResult.completed ? 'completed' : 'incomplete'})</span>
					{/if}
				</div>

				{#if scoringResult.modalFeedback?.length}
					<div class="text-sm mt-2">
						<div class="font-semibold">Modal feedback</div>
						<ul class="list-disc ml-5">
							{#each scoringResult.modalFeedback as fb (fb.identifier)}
								<li>
									{fb.title ?? fb.identifier}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if errorMessage}
		<!-- Keep errors visible, but out of the way of the actual item UI -->
		<div class="alert alert-error mt-4">
			<div class="text-sm">{errorMessage}</div>
		</div>
	{/if}
</div>

<style>
	.runtime-root {
		padding: 16px;
	}

	.qti-question-body {
		max-width: 100%;
		min-width: 0;
		overflow-x: auto;
		overflow-y: visible;
	}

	:global(.qti-question-body :is(
		pie-qti-choice,
		pie-qti-slider,
		pie-qti-order,
		pie-qti-match,
		pie-qti-associate,
		pie-qti-gap-match,
		pie-qti-hotspot,
		pie-qti-hottext,
		pie-qti-media,
		pie-qti-custom,
		pie-qti-end-attempt,
		pie-qti-position-object,
		pie-qti-graphic-gap-match,
		pie-qti-graphic-order,
		pie-qti-graphic-associate,
		pie-qti-select-point,
		pie-qti-extended-text
	)) {
		display: block;
		max-width: 100%;
	}
</style>


