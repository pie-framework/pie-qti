<script lang="ts">
	import { SAMPLE_ASSESSMENTS } from '$lib/sample-assessments';

	interface Props {
		selectedSampleId: string;
		onSampleChange: (id: string) => void;
	}

	let { selectedSampleId = $bindable(), onSampleChange }: Props = $props();
</script>

<div class="card bg-base-200">
	<div class="card-body">
		<h2 class="card-title">Select Assessment</h2>

		<!-- Sample selection -->
		<div class="form-control">
			<label class="label" for="sample-select">
				<span class="label-text">Sample Assessments</span>
			</label>
			<select
				id="sample-select"
				class="select select-bordered"
				bind:value={selectedSampleId}
				onchange={() => onSampleChange(selectedSampleId)}
			>
				{#each SAMPLE_ASSESSMENTS as sample}
					<option value={sample.id}>{sample.name}</option>
				{/each}
			</select>
			<div class="label">
				<span class="label-text-alt">
					{SAMPLE_ASSESSMENTS.find((s) => s.id === selectedSampleId)?.description || ''}
				</span>
			</div>
		</div>
	</div>
</div>
