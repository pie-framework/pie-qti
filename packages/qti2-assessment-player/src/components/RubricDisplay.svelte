<script lang="ts">
	import { typesetAction } from '@pie-qti/qti2-default-components/shared';
	import type { RubricBlock } from '../integration/api-contract.js';

	interface Props {
		blocks: RubricBlock[];
		collapsed?: boolean;
		/** Math typesetting function (KaTeX, MathJax, etc.) */
		typeset?: (root: HTMLElement) => void | Promise<void>;
	}

	const { blocks, collapsed = false, typeset }: Props = $props();

	let isCollapsed = $state(false);

	$effect(() => {
		isCollapsed = collapsed;
	});

	function toggleCollapse() {
		isCollapsed = !isCollapsed;
	}

	// Filter blocks by view type (for student/candidate view)
	const visibleBlocks = $derived(blocks.filter((block) => block.view.includes('candidate')));

	// Group blocks by use type
	const passages = $derived(visibleBlocks.filter((block) => block.use === 'passage'));
	const instructions = $derived(visibleBlocks.filter((block) => block.use === 'instructions'));
	const rubrics = $derived(visibleBlocks.filter((block) => !block.use || block.use === 'rubric'));
</script>

{#if visibleBlocks.length > 0}
	<div class="rubric-container">
		<!-- Passages (typically reading comprehension) -->
		{#if passages.length > 0}
			<div class="passage-section">
				{#each passages as passage}
					<div class="passage">
						<div class="passage-header">
							<h4 class="font-semibold text-base">Reading Passage</h4>
							<button
								class="btn btn-ghost btn-sm"
								onclick={() => toggleCollapse?.()}
								aria-label={isCollapsed ? 'Expand passage' : 'Collapse passage'}
							>
								{#if isCollapsed}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 9l-7 7-7-7"
										/>
									</svg>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 15l7-7 7 7"
										/>
									</svg>
								{/if}
							</button>
						</div>

						{#if !isCollapsed}
							<div
								use:typesetAction={{ typeset }}
								class="passage-content prose max-w-none"
							>
								{@html passage.content}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Instructions -->
		{#if instructions.length > 0}
			<div class="instructions-section">
				{#each instructions as instruction}
					<div class="alert alert-info">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="stroke-current shrink-0 w-6 h-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<div use:typesetAction={{ typeset }}>
							{@html instruction.content}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Other rubric blocks -->
		{#if rubrics.length > 0}
			<div class="rubric-section">
				{#each rubrics as rubric}
					<div use:typesetAction={{ typeset }} class="rubric-block">
						{@html rubric.content}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.rubric-container {
		margin-bottom: 2rem;
	}

	.passage-section {
		margin-bottom: 1.5rem;
	}

	.passage {
		border: 1px solid var(--color-base-300);
		border-radius: 0.5rem;
		padding: 1rem;
		background: var(--color-base-200);
	}

	.passage-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.passage-content {
		padding: 1rem 0;
		line-height: 1.6;
	}

	.instructions-section {
		margin-bottom: 1.5rem;
	}

	.rubric-section {
		margin-bottom: 1.5rem;
	}

	.rubric-block {
		padding: 1rem;
		background: var(--color-base-200);
		border-radius: 0.5rem;
		margin-bottom: 1rem;
	}

	:global(.passage-content p) {
		margin-bottom: 1rem;
	}

	:global(.passage-content p:last-child) {
		margin-bottom: 0;
	}
</style>
