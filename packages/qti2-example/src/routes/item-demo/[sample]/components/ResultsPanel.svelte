<script lang="ts">
	import { getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

	const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
	const i18n = $derived(i18nContext?.value);

	interface Props {
		scoringResult: any;
	}

	let { scoringResult }: Props = $props();
</script>

{#if scoringResult}
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">{i18n?.t('demo.results') ?? 'Results'}</h2>

			<div class="stats shadow">
				<div class="stat">
					<div class="stat-title">{i18n?.t('demo.score') ?? 'Score'}</div>
					<div class="stat-value">
						{scoringResult.score.toFixed(2)} / {scoringResult.maxScore.toFixed(2)}
					</div>
					<div class="stat-desc">
						{((scoringResult.score / scoringResult.maxScore) * 100).toFixed(0)}%
					</div>
				</div>
			</div>

			<details class="collapse collapse-arrow bg-base-200 mt-4">
				<summary class="collapse-title text-lg font-medium">{i18n?.t('demo.outcomeVariables') ?? 'Outcome Variables'}</summary>
				<div class="collapse-content">
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>{i18n?.t('demo.variable') ?? 'Variable'}</th>
									<th>{i18n?.t('demo.value') ?? 'Value'}</th>
								</tr>
							</thead>
							<tbody>
								{#each Object.entries(scoringResult.outcomeValues) as [key, value]}
									<tr>
										<td class="font-mono">{key}</td>
										<td class="font-mono">{JSON.stringify(value)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</details>
		</div>
	</div>
{/if}
