<script lang="ts">
	import { registerDefaultComponents } from '@pie-qti/default-components';
	import { ItemBody } from '@pie-qti/item-player/components';
	import { Player, type QTIRole } from '@pie-qti/item-player';
	import type { InteractionResponseValue } from '@pie-qti/item-player/web-components';
	import { Qti3ElementNameMapper } from '@pie-qti/qti-common';
	import { typesetMathInElement } from '@pie-qti/typeset-katex';
	import { untrack } from 'svelte';
	import { QTI3_SAMPLE_ITEMS, getQti3Categories } from '$lib/sample-items-qti3';
	import { getSecurityConfig } from '$lib/player-config';

	type DemoResponseValue = InteractionResponseValue | null;
	type DemoResponseMap = Record<string, DemoResponseValue>;

	let selectedCategory = $state('core');
	let selectedSampleId = $state('qti3-choice-simple');
	let xmlContent = $state('');
	let player = $state<Player | null>(null);
	let interactions = $state<any[]>([]);
	let responses = $state<DemoResponseMap>({});
	let selectedRole = $state<QTIRole>('candidate');
	let error = $state<string | null>(null);

	const categories = getQti3Categories();

	$effect(() => {
		const filteredItems = QTI3_SAMPLE_ITEMS.filter(item => item.category === selectedCategory);
		if (filteredItems.length > 0 && !filteredItems.find(item => item.id === selectedSampleId)) {
			selectedSampleId = filteredItems[0].id;
		}
	});

	function loadPlayer(xml: string) {
		error = null;

		if (!xml.trim()) {
			player = null;
			interactions = [];
			responses = {};
			return;
		}

		try {
			// Create player with QTI 3.0 element name mapper
			const newPlayer = new Player({
				itemXml: xml,
				role: selectedRole,
				security: getSecurityConfig(),
				elementNameMapper: new Qti3ElementNameMapper(),
			});
			registerDefaultComponents(newPlayer.getComponentRegistry());

			player = newPlayer;
			interactions = newPlayer.getInteractionData();

			const newResponses: DemoResponseMap = {};
			for (const interaction of interactions) {
				if (interaction) {
					newResponses[interaction.responseId] = null;
				}
			}
			responses = newResponses;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			player = null;
			interactions = [];
			responses = {};
		}
	}

	$effect(() => {
		const sample = QTI3_SAMPLE_ITEMS.find((item) => item.id === selectedSampleId);
		const xml = sample?.xml || '';
		xmlContent = xml;
		untrack(() => {
			loadPlayer(xml);
		});
	});

	function handleResponseChange(responseId: string, value: DemoResponseValue) {
		responses = { ...responses, [responseId]: value };
	}

	function submitResponses() {
		if (!player) return;

		player.setResponses(responses);
		const result = player.processResponses();

		alert(`Score: ${result.score} / ${result.maxScore}\n\nCorrect Responses:\n${JSON.stringify(player.getCorrectResponses(), null, 2)}`);
	}
</script>

<div class="max-w-6xl mx-auto p-4">
	<div class="mb-6">
		<h1 class="text-3xl font-bold mb-2">QTI 3.0 Item Player Demo</h1>
		<p class="text-base-content/70">
			Test the QTI 3.0 element discovery and rendering system with kebab-case element names.
		</p>
	</div>

	<!-- Control Panel -->
	<div class="card bg-base-100 shadow-xl mb-4">
		<div class="card-body">
			<h2 class="card-title text-lg">Sample Selection</h2>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<!-- Category Selector -->
				<div class="form-control">
					<label class="label" for="category-select">
						<span class="label-text font-medium">Category</span>
					</label>
					<select
						id="category-select"
						class="select select-bordered w-full"
						bind:value={selectedCategory}
					>
						{#each categories as category}
							<option value={category.key}>{category.label}</option>
						{/each}
					</select>
				</div>

				<!-- Sample Selector -->
				<div class="form-control">
					<label class="label" for="sample-select">
						<span class="label-text font-medium">Sample Item</span>
					</label>
					<select
						id="sample-select"
						class="select select-bordered w-full"
						bind:value={selectedSampleId}
					>
						{#each QTI3_SAMPLE_ITEMS.filter(item => item.category === selectedCategory) as item}
							<option value={item.id}>{item.title}</option>
						{/each}
					</select>
				</div>

				<!-- Role Selector -->
				<div class="form-control">
					<label class="label" for="role-select">
						<span class="label-text font-medium">User Role</span>
					</label>
					<select
						id="role-select"
						class="select select-bordered w-full"
						bind:value={selectedRole}
						onchange={() => loadPlayer(xmlContent)}
					>
						<option value="candidate">Candidate</option>
						<option value="author">Author</option>
						<option value="proctor">Proctor</option>
						<option value="scorer">Scorer</option>
						<option value="tutor">Tutor</option>
					</select>
				</div>
			</div>

			<!-- Description -->
			{#each QTI3_SAMPLE_ITEMS.filter(item => item.id === selectedSampleId) as item}
				{#if item.description}
					<div class="alert alert-info mt-4">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
						<span>{item.description}</span>
					</div>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="alert alert-error mb-4">
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
			<div>
				<h3 class="font-bold">Error loading QTI 3.0 item</h3>
				<div class="text-xs">{error}</div>
			</div>
		</div>
	{/if}

	<!-- Item Rendering -->
	{#if player && !error}
		<div class="card bg-base-100 shadow-xl mb-4">
			<div class="card-body">
				<h2 class="card-title">Item Preview</h2>

				<div class="qti-question-body">
					<ItemBody
						{player}
						{responses}
						role={selectedRole}
						typeset={typesetMathInElement}
						onResponseChange={handleResponseChange}
					/>
				</div>

				<!-- Submit Button -->
				<div class="card-actions justify-end mt-6">
					<button class="btn btn-primary" onclick={submitResponses}>
						Submit Responses
					</button>
				</div>
			</div>
		</div>

		<!-- Debug Info -->
		<div class="collapse collapse-arrow bg-base-200">
			<input type="checkbox" />
			<div class="collapse-title text-lg font-medium">
				Debug Information
			</div>
			<div class="collapse-content">
				<div class="space-y-4">
					<div>
						<h3 class="font-bold mb-2">Extracted Interactions:</h3>
						<pre class="bg-base-300 p-4 rounded text-xs overflow-x-auto">{JSON.stringify(interactions, null, 2)}</pre>
					</div>
					<div>
						<h3 class="font-bold mb-2">Current Responses:</h3>
						<pre class="bg-base-300 p-4 rounded text-xs overflow-x-auto">{JSON.stringify(responses, null, 2)}</pre>
					</div>
					<div>
						<h3 class="font-bold mb-2">QTI 3.0 XML:</h3>
						<pre class="bg-base-300 p-4 rounded text-xs overflow-x-auto">{xmlContent}</pre>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.qti-question-body {
		max-width: 100%;
		min-width: 0;
		overflow-x: auto;
		overflow-y: visible;
	}
</style>
