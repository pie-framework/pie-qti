<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PlayerSecurityConfig } from '@pie-qti/item-player';
	import type {
		QtiSectionRole,
		QtiSectionRuntimeHostContract,
		QtiSharedHtmlBlock,
		QtiSharedHtmlSanitizeContext,
	} from '../contracts/index.js';
	import { isQtiViewVisibleForRole } from '../visibility/role-view.js';
	import SanitizedHtml from './SanitizedHtml.svelte';

	interface Props {
		passages?: QtiSharedHtmlBlock[];
		rubricBlocks?: QtiSharedHtmlBlock[];
		role?: QtiSectionRole;
		collapsed?: boolean;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		host?: QtiSectionRuntimeHostContract;
		typeset?: (root: HTMLElement) => void | Promise<void>;
	}

	const {
		passages = [],
		rubricBlocks = [],
		role = 'candidate',
		collapsed = false,
		i18n,
		security,
		host,
		typeset,
	}: Props = $props();

	let isCollapsed = $state(false);

	const isVisibleForRole = (block: QtiSharedHtmlBlock) => isQtiViewVisibleForRole(block.view, role);
	const visiblePassages = $derived(passages.filter(isVisibleForRole));
	const visibleRubricBlocks = $derived(rubricBlocks.filter(isVisibleForRole));
	const visibleInstructions = $derived(visibleRubricBlocks.filter((block) => block.kind === 'instructions'));
	const visibleRubrics = $derived(visibleRubricBlocks.filter((block) => block.kind !== 'instructions'));

	$effect(() => {
		isCollapsed = collapsed;
	});

	function toggleCollapse() {
		isCollapsed = !isCollapsed;
	}

	function sanitizeKind(block: QtiSharedHtmlBlock): QtiSharedHtmlSanitizeContext['kind'] {
		return block.kind === 'stimulus' || block.kind === 'test-feedback' ? block.kind : block.kind === 'instructions' ? 'instructions' : 'rubric';
	}
</script>

{#if visiblePassages.length > 0 || visibleRubricBlocks.length > 0}
	<div class="rubric-container">
		{#if visiblePassages.length > 0}
			<section class="passage-section" aria-label={i18n?.t('assessment.readingPassages') ?? 'Reading passages'}>
				{#each visiblePassages as passage, index (passage.identifier)}
					<article class="passage" aria-labelledby={`passage-heading-${index}`}>
						<div class="passage-header">
							<h4 id={`passage-heading-${index}`} class="font-semibold text-base">
								{i18n?.t('assessment.readingPassage') ?? 'Reading Passage'}
							</h4>
							<button
								type="button"
								class="btn btn-ghost btn-sm passage-toggle"
								onclick={toggleCollapse}
								aria-expanded={!isCollapsed}
								aria-label={isCollapsed ? (i18n?.t('assessment.expandPassage') ?? 'Expand passage') : (i18n?.t('assessment.collapsePassage') ?? 'Collapse passage')}
							>
								{#if isCollapsed}
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
									</svg>
								{/if}
							</button>
						</div>

						{#if !isCollapsed}
							<SanitizedHtml
								rawHtml={passage.rawHtml}
								html={passage.html}
								{security}
								{host}
								sanitizeContext={{ kind: 'passage', source: passage.source }}
								class="passage-content prose max-w-none"
								{typeset}
							/>
						{/if}
					</article>
				{/each}
			</section>
		{/if}

		{#if visibleInstructions.length > 0}
			<section class="instructions-section" aria-label={i18n?.t('assessment.instructions') ?? 'Instructions'}>
				{#each visibleInstructions as instruction (instruction.identifier)}
					<div class="alert alert-info">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
						<SanitizedHtml
							rawHtml={instruction.rawHtml}
							html={instruction.html}
							{security}
							{host}
							sanitizeContext={{ kind: 'instructions', source: instruction.source }}
							class="instructions-content"
							{typeset}
						/>
					</div>
				{/each}
			</section>
		{/if}

		{#if visibleRubrics.length > 0}
			<section class="rubric-section" aria-label={i18n?.t('assessment.rubrics') ?? 'Rubrics'}>
				{#each visibleRubrics as rubric (rubric.identifier)}
					<SanitizedHtml
						rawHtml={rubric.rawHtml}
						html={rubric.html}
						{security}
						{host}
						sanitizeContext={{ kind: sanitizeKind(rubric), source: rubric.source }}
						class="rubric-block"
						{typeset}
					/>
				{/each}
			</section>
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
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.passage-toggle {
		min-width: 44px;
		min-height: 44px;
	}

	.passage-toggle:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	:global(.passage-content) {
		padding: 1rem 0;
		line-height: 1.6;
	}

	.instructions-section {
		margin-bottom: 1.5rem;
	}

	:global(.instructions-content) {
		line-height: 1.6;
	}

	.rubric-section {
		margin-bottom: 1.5rem;
	}

	:global(.rubric-block) {
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
