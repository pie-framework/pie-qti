<script lang="ts">
	import { registerDefaultComponents } from '@pie-qti/default-components';
	// @ts-expect-error - Svelte-check can't resolve workspace subpath exports, but runtime works correctly
	import { ItemBody } from '@pie-qti/item-player/components';
	import { Player, type QTIRole } from '@pie-qti/item-player';
	import type { InteractionResponseValue } from '@pie-qti/item-player/web-components';
	import { typesetMathInElement } from '@pie-qti/typeset-katex';
	import { untrack } from 'svelte';
	import { SAMPLE_ITEMS } from '$lib/sample-items';
	import { getSecurityConfig } from '$lib/player-config';

	type FixtureResponseValue = InteractionResponseValue | null;
	type FixtureResponseMap = Record<string, FixtureResponseValue>;

	let selectedSampleId = $state('simple-choice');
	let xmlContent = $state('');
	let player = $state<Player | null>(null);
	let interactions = $state<any[]>([]);
	let responses = $state<FixtureResponseMap>({});
	let selectedRole = $state<QTIRole>('candidate');

	function loadPlayer(xml: string) {
		if (!xml.trim()) {
			player = null;
			interactions = [];
			responses = {};
			return;
		}

		const newPlayer = new Player({
			itemXml: xml,
			role: selectedRole,
			security: getSecurityConfig(),
		});
		registerDefaultComponents(newPlayer.getComponentRegistry());

		player = newPlayer;
		interactions = newPlayer.getInteractionData();

		const newResponses: FixtureResponseMap = {};
		for (const interaction of interactions) {
			if (interaction) {
				newResponses[interaction.responseId] = null;
			}
		}
		responses = newResponses;
	}

	$effect(() => {
		const xml = SAMPLE_ITEMS.find((item) => item.id === selectedSampleId)?.xml || '';
		xmlContent = xml;
		// Use untrack to prevent infinite loop when loadPlayer modifies state
		untrack(() => {
			loadPlayer(xml);
		});
	});

	function handleResponseChange(responseId: string, value: FixtureResponseValue) {
		responses = { ...responses, [responseId]: value };
	}
</script>

<div class="max-w-4xl mx-auto">
	<!-- Simple control panel -->
	<div class="card bg-base-100 shadow-xl mb-4">
		<div class="card-body">
			<div class="form-control">
				<label class="label" for="sample-select">
					<span class="label-text">Select Sample Item</span>
				</label>
				<select
					id="sample-select"
					class="select select-bordered w-full"
					bind:value={selectedSampleId}
				>
					{#each SAMPLE_ITEMS as item}
						<option value={item.id}>{item.title}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Player area -->
	{#if player}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Question</h2>

				<div class="qti-question-body">
					<ItemBody
						{player}
						{responses}
						role={selectedRole}
						typeset={typesetMathInElement}
						onResponseChange={handleResponseChange}
					/>
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
