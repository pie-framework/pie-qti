<script lang="ts">
	import type { AssessmentResults } from '@pie-qti/qti2-assessment-player';

	type DisplayItemScore = {
		id: string;
		title: string;
		sectionTitle?: string;
		score: number;
		maxScore: number;
	};

	interface Props {
		results: AssessmentResults;
		items: DisplayItemScore[];
		onRetake?: () => void;
	}

	const { results, items, onRetake }: Props = $props();
</script>

<div class="card bg-base-100">
	<div class="card-body">
		<h2 class="card-title">Assessment complete</h2>

		<div class="stats stats-vertical lg:stats-horizontal shadow bg-base-200">
			<div class="stat">
				<div class="stat-title">Total score</div>
				<div class="stat-value text-primary">{results.totalScore} / {results.maxScore}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Questions</div>
				<div class="stat-value">{results.itemResults.length}</div>
			</div>
		</div>

		<div class="mt-6">
			<h3 class="text-lg font-semibold mb-3">Scores by question</h3>

			<div class="overflow-x-auto">
				<table class="table table-zebra">
					<thead>
						<tr>
							<th>Question</th>
							<th class="text-right">Score</th>
						</tr>
					</thead>
					<tbody>
						{#each items as item (item.id)}
							<tr>
								<td>
									<div class="font-medium">{item.title}</div>
									{#if item.sectionTitle}
										<div class="text-sm opacity-70">{item.sectionTitle}</div>
									{/if}
								</td>
								<td class="text-right font-mono">{item.score} / {item.maxScore}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="card-actions justify-end mt-6">
			<button class="btn btn-primary" type="button" onclick={() => onRetake?.()}>Retake assessment</button>
		</div>
	</div>
</div>


