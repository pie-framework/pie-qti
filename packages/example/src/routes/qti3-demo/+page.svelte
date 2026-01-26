<script lang="ts">
	import { Player, type QTIRole } from '@pie-qti/item-player';
	import { Qti3ElementNameMapper } from '@pie-qti/qti-common';
	import { untrack } from 'svelte';
	import { QTI3_SAMPLE_ITEMS, getQti3Categories, type Qti3SampleItem } from '$lib/sample-items-qti3';
	import { getSecurityConfig } from '$lib/player-config';
	import { assignProps } from '$lib/utils/assignProps';

	let selectedCategory = $state('core');
	let selectedSampleId = $state('qti3-choice-simple');
	let xmlContent = $state('');
	let player = $state<Player | null>(null);
	let interactions = $state<any[]>([]);
	let itemBodyHtml = $state('');
	let responses = $state<Record<string, any>>({});
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
			itemBodyHtml = '';
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

			player = newPlayer;
			let rawItemBodyHtml = player.getItemBodyHtml();

			// Remove interaction elements from itemBodyHtml (QTI 3.0 element names)
			rawItemBodyHtml = rawItemBodyHtml
				.replace(/<qti-choice-interaction[\s\S]*?<\/qti-choice-interaction>/gi, '')
				.replace(/<qti-text-entry-interaction[^>]*response-identifier="([^"]+)"[^>]*?(?:\/>|><\/qti-text-entry-interaction>)/gi, '[TEXTENTRY:$1]')
				.replace(/<qti-extended-text-interaction[\s\S]*?<\/qti-extended-text-interaction>/gi, '')
				.replace(/<qti-inline-choice-interaction[^>]*response-identifier="([^"]+)"[^>]*>[\s\S]*?<\/qti-inline-choice-interaction>/gi, '[INLINECHOICE:$1]')
				.replace(/<qti-hotspot-interaction[\s\S]*?<\/qti-hotspot-interaction>/gi, '')
				.replace(/<qti-match-interaction[\s\S]*?<\/qti-match-interaction>/gi, '')
				.replace(/<qti-graphic-gap-match-interaction[\s\S]*?<\/qti-graphic-gap-match-interaction>/gi, '');

			itemBodyHtml = rawItemBodyHtml;
			interactions = newPlayer.getInteractionData();

			const newResponses: Record<string, any> = {};
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
			itemBodyHtml = '';
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

	function handleResponseChange(responseId: string, value: any) {
		responses = { ...responses, [responseId]: value };
	}

	function handleQtiChange(event: CustomEvent) {
		const { responseId, value } = event.detail;
		handleResponseChange(responseId, value);
	}

	function setElementProps(node: HTMLElement, props: Record<string, unknown>) {
		queueMicrotask(() => {
			if (!node) return;
			assignProps(node, props);
		});

		return {
			update(next: Record<string, unknown>) {
				assignProps(node, next);
			},
			destroy() {}
		};
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

				<!-- Item Body -->
				<div class="prose max-w-none">
					{@html itemBodyHtml}
				</div>

				<!-- Interactions -->
				{#each interactions as interaction}
					<div class="mt-4">
						{#if interaction.type === 'qti-choice-interaction' || interaction.type === 'choiceInteraction'}
							<pie-qti-choice-interaction
								use:setElementProps={{
									interaction,
									response: responses[interaction.responseId],
									onresponse: (e: CustomEvent) => handleQtiChange(e)
								}}
							/>
						{:else if interaction.type === 'qti-text-entry-interaction' || interaction.type === 'textEntryInteraction'}
							<pie-qti-text-entry-interaction
								use:setElementProps={{
									interaction,
									response: responses[interaction.responseId],
									onresponse: (e: CustomEvent) => handleQtiChange(e)
								}}
							/>
						{:else if interaction.type === 'qti-extended-text-interaction' || interaction.type === 'extendedTextInteraction'}
							<pie-qti-extended-text-interaction
								use:setElementProps={{
									interaction,
									response: responses[interaction.responseId],
									onresponse: (e: CustomEvent) => handleQtiChange(e)
								}}
							/>
						{:else if interaction.type === 'qti-match-interaction' || interaction.type === 'matchInteraction'}
							<pie-qti-match-interaction
								use:setElementProps={{
									interaction,
									response: responses[interaction.responseId],
									onresponse: (e: CustomEvent) => handleQtiChange(e)
								}}
							/>
						{:else}
							<div class="alert alert-warning">
								<span>Unsupported interaction type: {interaction.type}</span>
							</div>
						{/if}
					</div>
				{/each}

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
