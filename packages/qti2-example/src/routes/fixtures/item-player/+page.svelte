<script lang="ts">
	import '@pie-qti/qti2-default-components/plugins';
	import { typesetAction } from '@pie-qti/qti2-default-components/shared';
	import GraphicGapMatch from '@pie-qti/qti2-default-components/shared/components/GraphicGapMatch.svelte';
	import InlineInteractionRenderer from '@pie-qti/qti2-default-components/shared/components/InlineInteractionRenderer.svelte';
	import RichTextEditor from '@pie-qti/qti2-default-components/shared/components/RichTextEditor.svelte';
	import {
		Player,
		type QTIRole,
	} from '@pie-qti/qti2-item-player';
	import { typesetMathInElement } from '@pie-qti/qti2-typeset-katex';
	import { untrack } from 'svelte';
	import { SAMPLE_ITEMS } from '$lib/sample-items';

	let selectedSampleId = $state('simple-choice');
	let xmlContent = $state('');
	let player = $state<Player | null>(null);
	let interactions = $state<any[]>([]);
	let itemBodyHtml = $state('');
	let responses = $state<Record<string, any>>({});
	let selectedRole = $state<QTIRole>('candidate');

	function loadPlayer(xml: string) {
		if (!xml.trim()) {
			player = null;
			interactions = [];
			itemBodyHtml = '';
			responses = {};
			return;
		}

		const newPlayer = new Player({
			itemXml: xml,
			role: selectedRole,
		});

		player = newPlayer;
		let rawItemBodyHtml = player.getItemBodyHtml();

		// Remove interaction elements from itemBodyHtml
		rawItemBodyHtml = rawItemBodyHtml
			.replace(/<choiceInteraction[\s\S]*?<\/choiceInteraction>/gi, '')
			.replace(/<textEntryInteraction[^>]*responseIdentifier="([^"]+)"[^>]*?(?:\/>|><\/textEntryInteraction>)/gi, '[TEXTENTRY:$1]')
			.replace(/<extendedTextInteraction[\s\S]*?<\/extendedTextInteraction>/gi, '')
			.replace(/<inlineChoiceInteraction[^>]*responseIdentifier="([^"]+)"[^>]*>[\s\S]*?<\/inlineChoiceInteraction>/gi, '[INLINECHOICE:$1]')
			.replace(/<hotspotInteraction[\s\S]*?<\/hotspotInteraction>/gi, '')
			.replace(/<graphicGapMatchInteraction[\s\S]*?<\/graphicGapMatchInteraction>/gi, '');

		itemBodyHtml = rawItemBodyHtml;
		interactions = newPlayer.getInteractionData();

		const newResponses: Record<string, any> = {};
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

	function handleResponseChange(responseId: string, value: any) {
		responses = { ...responses, [responseId]: value };
	}

	function handleQtiChange(event: CustomEvent) {
		const { responseId, value } = event.detail;
		handleResponseChange(responseId, value);
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
		<div class="card bg-base-100 shadow-xl" use:typesetAction={{ typeset: (el) => typesetMathInElement(el) }}>
			<div class="card-body">
				<h2 class="card-title">Question</h2>

				<!-- Item Body -->
				<div class="prose max-w-none mb-4">
					<InlineInteractionRenderer
						html={itemBodyHtml}
						{interactions}
						{responses}
						onResponseChange={handleResponseChange}
					/>
				</div>

				<!-- Interactive Controls -->
				{#each interactions as interaction}
					{#if interaction.type === 'choiceInteraction'}
						<div class="space-y-2">
							{#if interaction.maxChoices === 1}
								{#each interaction.choices as choice}
									<div class="form-control">
										<label class="label cursor-pointer justify-start gap-4">
											<input
												type="radio"
												name={interaction.responseId}
												class="radio radio-primary"
												value={choice.identifier}
												checked={responses[interaction.responseId] === choice.identifier}
												onchange={() => handleResponseChange(interaction.responseId, choice.identifier)}
											/>
											<span class="label-text">{choice.text}</span>
										</label>
									</div>
								{/each}
							{:else}
								{@const currentValues = Array.isArray(responses[interaction.responseId])
									? responses[interaction.responseId]
									: []}
								{#each interaction.choices as choice}
									<div class="form-control">
										<label class="label cursor-pointer justify-start gap-4">
											<input
												type="checkbox"
												class="checkbox checkbox-primary"
												value={choice.identifier}
												checked={currentValues.includes(choice.identifier)}
												onchange={(e: Event) => {
													const checked = (e.currentTarget as HTMLInputElement).checked;
													let newValues = [...currentValues];
													if (checked) {
														newValues.push(choice.identifier);
													} else {
														newValues = newValues.filter((v) => v !== choice.identifier);
													}
													handleResponseChange(interaction.responseId, newValues);
												}}
											/>
											<span class="label-text">{choice.text}</span>
										</label>
									</div>
								{/each}
							{/if}
						</div>
					{/if}

					{#if interaction.type === 'extendedTextInteraction'}
						<div class="form-control w-full">
							<RichTextEditor
								value={responses[interaction.responseId] || ''}
								editable={true}
								placeholder={interaction.placeholderText || ''}
								minHeight={(interaction.expectedLines || 6) * 24}
								onChange={(html: string) => handleResponseChange(interaction.responseId, html)}
							/>
						</div>
					{/if}

					{#if interaction.type === 'hotspotInteraction'}
						<svelte:element
							this={'pie-qti-hotspot'}
							interaction={JSON.stringify(interaction)}
							response={JSON.stringify(responses[interaction.responseId] ?? null)}
							disabled={false}
							onqti-change={handleQtiChange}
						/>
					{/if}

					{#if interaction.type === 'graphicGapMatchInteraction'}
						{@const pairs = Array.isArray(responses[interaction.responseId]) ? responses[interaction.responseId] : []}
						<GraphicGapMatch
							gapTexts={interaction.gapTexts}
							hotspots={interaction.hotspots}
							imageData={interaction.imageData?.content || ''}
							imageWidth={interaction.imageData?.width || '600'}
							imageHeight={interaction.imageData?.height || '500'}
							{pairs}
							disabled={false}
							onPairsChange={(newPairs) => handleResponseChange(interaction.responseId, newPairs)}
						/>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>
