<script lang="ts">
	import type { AssessmentResults, ItemResult } from '@pie-qti/assessment-player';
	import { typesetMathInElement } from '@pie-qti/typeset-katex';
	import { ItemBody } from '@pie-qti/item-player/components';
	import type { SampleAssessment } from '$lib/sample-assessments';
	import { typesetAction } from '@pie-qti/default-components/shared';
	import { DemoItemSessionController } from '$lib/item-session.svelte';
	import { getSecurityConfig } from '$lib/player-config';
	import { untrack } from 'svelte';

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
		assessment: SampleAssessment;
		showCorrectAnswers: boolean;
		onRetake?: () => void;
	}

	let { results, items, assessment, showCorrectAnswers = $bindable(), onRetake }: Props = $props();
	type ReviewItem = {
		result: ItemResult;
		controller: DemoItemSessionController | null;
	};
	let reviewItems = $state<ReviewItem[]>([]);

	const itemXmlById = $derived.by(() => {
		const map = new Map<string, string>();
		for (const tp of assessment.assessment.testParts || []) {
			for (const section of tp.sections || []) {
				for (const q of section.assessmentItemRefs || []) {
					map.set(q.identifier, q.itemXml);
				}
			}
		}
		return map;
	});

	const itemResultsById = $derived.by(() => new Map(results.itemResults.map((r) => [r.itemIdentifier, r])));

	$effect(() => {
		if (!showCorrectAnswers) {
			reviewItems = [];
			return;
		}

		const currentResults = results.itemResults;
		const xmlById = itemXmlById;
		const nextItems = untrack(() =>
			currentResults.map((result): ReviewItem => {
				const itemXml = xmlById.get(result.itemIdentifier);
				if (!itemXml) return { result, controller: null };
				const controller = new DemoItemSessionController();
				controller.open(
					{
						itemXml,
						role: 'scorer',
						security: getSecurityConfig(),
					},
					{ responses: result.responses },
				);
				return { result, controller };
			}),
		);
		reviewItems = nextItems;

		return () => {
			for (const item of nextItems) item.controller?.dispose();
		};
	});
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

		<div class="divider"></div>

		<div class="form-control">
			<label class="label cursor-pointer justify-start gap-4">
				<input type="checkbox" class="checkbox checkbox-primary" bind:checked={showCorrectAnswers} />
				<div>
					<span class="label-text font-semibold">Show correct answers</span>
					<p class="label-text-alt text-xs">
						Displays the scorer view for each item (read-only), with correct responses and your submitted responses.
					</p>
				</div>
			</label>
		</div>

		{#if showCorrectAnswers}
			<div class="mt-4 space-y-6">
				{#each reviewItems as review (review.result.itemIdentifier)}
					{@const r = review.result}
					{#if review.controller?.session}
						<div class="card bg-base-200" use:typesetAction={{ typeset: (el) => typesetMathInElement(el) }}>
							<div class="card-body">
								<div class="flex items-baseline justify-between gap-4">
									<h3 class="font-semibold">
										{items.find((i) => i.id === r.itemIdentifier)?.title ?? r.itemIdentifier}
									</h3>
									<div class="text-sm opacity-70 font-mono">{r.score} / {r.maxScore}</div>
								</div>

								<ItemBody
									session={review.controller.session}
									revision={review.controller.revision}
									disabled={true}
									typeset={typesetMathInElement}
								/>
							</div>
						</div>
					{:else}
						<div class="alert alert-warning">
							Missing item XML for <code>{r.itemIdentifier}</code>.
						</div>
					{/if}
				{/each}
			</div>
		{/if}

		<div class="card-actions justify-end mt-6">
			<button class="btn btn-primary" type="button" onclick={() => onRetake?.()}>Retake assessment</button>
		</div>
	</div>
</div>
