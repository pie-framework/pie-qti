<script lang="ts">
	import { ItemBody } from '@pie-qti/item-player/components';
	import type { QTIRole } from '@pie-qti/item-player';
	import { typesetMathInElement } from '@pie-qti/typeset-katex';
	import { onDestroy, untrack } from 'svelte';
	import { DemoItemSessionController } from '$lib/item-session.svelte';
	import { SAMPLE_ITEMS } from '$lib/sample-items';
	import { getSecurityConfig } from '$lib/player-config';

	let selectedSampleId = $state('simple-choice');
	let xmlContent = $state('');
	const itemSession = new DemoItemSessionController();
	let selectedRole = $state<QTIRole>('candidate');

	function loadPlayer(xml: string) {
		if (!xml.trim()) {
			itemSession.dispose();
			return;
		}

		itemSession.open({
			itemXml: xml,
			role: selectedRole,
			security: getSecurityConfig(),
		});
	}

	$effect(() => {
		const xml = SAMPLE_ITEMS.find((item) => item.id === selectedSampleId)?.xml || '';
		xmlContent = xml;
		// Use untrack to prevent infinite loop when loadPlayer modifies state
		untrack(() => {
			loadPlayer(xml);
		});
	});

	onDestroy(() => itemSession.dispose());
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
	{#if itemSession.session}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Question</h2>

				<div class="qti-question-body">
					<ItemBody
						session={itemSession.session}
						revision={itemSession.revision}
						typeset={typesetMathInElement}
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
