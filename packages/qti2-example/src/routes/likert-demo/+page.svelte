<script lang="ts">
	import { likertScalePlugin } from '@acme/likert-scale-plugin';
	import '@pie-qti/qti2-default-components/plugins'; // Load web components
	import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
	// @ts-expect-error - Svelte-check can't resolve workspace subpath exports, but runtime works correctly
	import { ItemBody } from '@pie-qti/qti2-item-player/components';
	import { Player } from '@pie-qti/qti2-item-player';
	import { typesetMathInElement } from '@pie-qti/qti2-typeset-katex';
	import { browser } from '$app/environment';
	import { ALL_LIKERT_ITEMS } from '$lib/sample-likert-items';

	let selectedItemIndex = $state(0);
	let currentItem = $derived(ALL_LIKERT_ITEMS[selectedItemIndex]);
	let player = $derived.by(() => {
		// Avoid creating the Player during SSR (it may need browser DOM APIs).
		if (!browser) return null;

		const p = new Player({
			itemXml: currentItem.xml,
			plugins: [likertScalePlugin],
		});

		// Register default components with the player's registry so ItemBody can render interactions.
		registerDefaultComponents(p.getComponentRegistry());

		return p;
	});

	let responses = $state<Record<string, any>>({});

	let interactionInfo = $derived.by(() => {
		if (!browser) return { count: 0, types: [], debug: null };
		if (!player) return { count: 0, types: [], debug: null };
		try {
			const interactions = player.getInteractions();
			console.log('[Likert Demo] Raw interactions from player:', interactions);

			// Get first interaction for debugging
			const first = interactions[0];
			console.log('[Likert Demo] First interaction details:', {
				type: first?.type,
				responseId: first?.responseIdentifier,
				hasChoices: !!(first as any)?.choices,
				choicesLength: (first as any)?.choices?.length,
				choicesData: (first as any)?.choices,
			});

			return {
				count: interactions.length,
				types: interactions.map((i) => i.type),
				debug: first
					? {
							type: first.type,
							hasChoices: !!(first as any)?.choices,
							choicesCount: (first as any)?.choices?.length || 0,
						}
					: null,
			};
		} catch (error) {
			console.error('Error getting interactions:', error);
			return { count: 0, types: [], debug: null };
		}
	});

	function selectItem(index: number) {
		selectedItemIndex = index;
		// Reset responses when switching items
		responses = {};
	}

	function handleResponseChange(responseId: string, value: any) {
		responses = { ...responses, [responseId]: value };
	}
</script>

<svelte:head>
	<title>ACME Likert Scale Plugin Demo</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-6xl mx-auto px-4">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">
				ACME Likert Scale Plugin Demo
			</h1>
			<p class="text-gray-600">
				Demonstrates custom <code class="bg-gray-200 px-2 py-1 rounded text-sm">&lt;likertChoice&gt;</code>
				element handling with priority-based extraction
			</p>
		</div>

		<!-- Item Selector -->
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-semibold mb-4">Select Example</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
				{#each ALL_LIKERT_ITEMS as item, index}
					<button
						onclick={() => selectItem(index)}
						class="text-left p-4 rounded-lg border-2 transition-all {selectedItemIndex === index
							? 'border-blue-500 bg-blue-50'
							: 'border-gray-200 hover:border-gray-300 bg-white'}"
					>
						<div class="font-semibold text-gray-900 mb-1">{item.name}</div>
						<div class="text-sm text-gray-600">{item.description}</div>
					</button>
				{/each}
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Item Preview -->
			<div class="bg-white rounded-lg shadow-md p-6">
				<h2 class="text-xl font-semibold mb-4">Item Preview</h2>

				{#if browser && player}
					<div class="mb-6">
						<ItemBody
							{player}
							{responses}
							disabled={false}
							typeset={typesetMathInElement}
							onResponseChange={handleResponseChange}
						/>
					</div>

					<!-- Show selected response -->
					{#if Object.keys(responses).length > 0 && responses.RESPONSE}
						<div class="alert alert-success mt-4">
							<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span>Selected: <strong>{responses.RESPONSE}</strong></span>
						</div>
					{/if}
				{:else}
					<p class="text-gray-500">Loading...</p>
				{/if}

				<div class="mt-6 pt-4 border-t border-gray-200">
					<h3 class="font-semibold text-gray-700 mb-2">Interaction Info</h3>
					<div class="bg-gray-50 rounded p-3 space-y-1 text-sm">
						<div><span class="font-medium">Interactions Found:</span> {interactionInfo.count}</div>
						<div><span class="font-medium">Types:</span> {interactionInfo.types.join(', ') || 'None'}</div>
					</div>
				</div>
			</div>

			<!-- QTI XML Source -->
			<div class="bg-white rounded-lg shadow-md p-6">
				<h2 class="text-xl font-semibold mb-4">QTI XML Source</h2>

				<details class="mb-4">
					<summary class="cursor-pointer font-semibold text-gray-700 hover:text-gray-900 mb-2">
						View XML Source
					</summary>
					<pre class="mt-2 bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-auto max-h-96"><code>{currentItem.xml}</code></pre>
				</details>

				<div class="space-y-4">
					<!-- Plugin Status -->
					<div class="bg-green-50 border border-green-200 rounded p-4">
						<h3 class="font-semibold text-green-900 mb-2">✓ Plugin Registered</h3>
						<div class="text-sm text-green-800">
							<p>The ACME Likert Scale Plugin has been successfully registered with priority 500.</p>
							<p class="mt-2">
								When the Player parses QTI XML containing <code class="bg-green-100 px-1 rounded">&lt;likertChoice&gt;</code> elements,
								the Likert extractor will take precedence over the standard choice extractor.
							</p>
						</div>
					</div>

					<!-- Likert Choice Detection -->
					<div class="bg-blue-50 border border-blue-200 rounded p-4">
						<h3 class="font-semibold text-blue-900 mb-2">Likert Choice Elements</h3>
						<div class="text-sm text-blue-800">
							{#if currentItem.xml.includes('<likertChoice')}
								<p class="mb-2">✓ This item contains <code class="bg-blue-100 px-1 rounded">&lt;likertChoice&gt;</code> elements</p>
								<p>The Likert extractor will:</p>
								<ul class="list-disc list-inside mt-2 space-y-1">
									<li>Detect the scale type (agreement, frequency, satisfaction, etc.)</li>
									<li>Extract choice metadata (scale points, likert index)</li>
									<li>Prevent shuffling (Likert scales must maintain order)</li>
									<li>Generate default labels for empty choices</li>
								</ul>
							{:else}
								<p>✗ This item uses standard <code class="bg-blue-100 px-1 rounded">&lt;simpleChoice&gt;</code> elements</p>
								<p class="mt-2">The standard choice extractor (priority 10) will handle this interaction.</p>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Plugin Architecture Info -->
		<div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
			<h2 class="text-xl font-semibold mb-3 text-blue-900">How It Works</h2>
			<div class="space-y-2 text-sm text-blue-800">
				<p>
					<strong>1. Custom Element Detection:</strong> The extractor's <code class="bg-blue-100 px-1 rounded">canHandle()</code>
					method checks for <code class="bg-blue-100 px-1 rounded">&lt;likertChoice&gt;</code> children
				</p>
				<p>
					<strong>2. Priority-Based Dispatch:</strong> Vendor-specific extractor (priority 500) takes precedence
					over standard extractor (priority 10)
				</p>
				<p>
					<strong>3. Type Detection:</strong> Automatically detects 6 scale types (agreement, frequency, satisfaction,
					quality, importance, likelihood) based on text patterns
				</p>
				<p>
					<strong>4. Default Labels:</strong> Generates appropriate labels for 3, 4, 5, and 7-point scales when
					<code class="bg-blue-100 px-1 rounded">&lt;likertChoice&gt;</code> elements are empty
				</p>
				<p>
					<strong>5. Validation:</strong> Ensures 2-7 scale points, no shuffling, and single selection (maxChoices=1)
				</p>
			</div>
		</div>
	</div>
</div>

<style>
	code {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
	}

	pre {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
	}
</style>
