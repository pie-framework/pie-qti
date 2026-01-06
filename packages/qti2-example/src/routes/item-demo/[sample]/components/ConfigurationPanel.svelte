<script lang="ts">
	import XmlEditor from '$lib/components/XmlEditor.svelte';
	import { SAMPLE_ITEMS } from '$lib/sample-items';

	interface Props {
		selectedSampleId: string;
		xmlContent: string;
		onSampleChange: (id: string) => void;
		onXmlChange: (xml: string) => void;
	}

	let { selectedSampleId = $bindable(), xmlContent = $bindable(), onSampleChange, onXmlChange }: Props = $props();
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title">QTI Item XML</h2>

		<div class="form-control w-full mb-4">
			<label class="label" for="sample-select">
				<span class="label-text">Select Sample Item</span>
			</label>
			<select
				id="sample-select"
				class="select select-bordered w-full"
				bind:value={selectedSampleId}
				onchange={() => onSampleChange(selectedSampleId)}
			>
				{#each SAMPLE_ITEMS as item}
					<option value={item.id}>{item.title}</option>
				{/each}
			</select>
			<div class="label">
				<span class="label-text-alt">
					{SAMPLE_ITEMS.find((item) => item.id === selectedSampleId)?.description}
				</span>
			</div>
		</div>

		<XmlEditor bind:content={xmlContent} onContentChange={onXmlChange} />
	</div>
</div>
