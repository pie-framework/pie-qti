<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PlayerSecurityConfig } from '@pie-qti/item-player';
	import type {
		QtiSectionRole,
		QtiSectionRuntimeHostContract,
		QtiSharedHtmlBlock,
		QtiSharedHtmlSanitizeContext,
	} from '../contracts/index.js';
	import { prepareReadableBlock } from '../tts/spoken-catalogs.js';
	import { isQtiViewVisibleForRole } from '../visibility/role-view.js';
	import QtiToolButtonBar from './QtiToolButtonBar.svelte';
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
		/** Heading level of the passage titles, so they fit the page outline. Default 3. */
		headingLevel?: number;
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
		headingLevel = 3,
	}: Props = $props();

	const uid = $props.id();

	/** Per-passage collapse state; passages without an entry follow the `collapsed` prop. */
	let collapsedPassages = $state<Record<string, boolean>>({});
	let passageScopeElements = $state<Record<string, HTMLElement>>({});

	const isVisibleForRole = (block: QtiSharedHtmlBlock) => isQtiViewVisibleForRole(block.view, role);
	const visiblePassages = $derived(passages.filter(isVisibleForRole));
	const visibleRubricBlocks = $derived(rubricBlocks.filter(isVisibleForRole));
	// Prepared markup docks the passages' SSML; a host-supplied `html` renders as given.
	const readablePassages = $derived(
		new Map(
			visiblePassages.map((passage) => [
				passage.identifier,
				passage.html === undefined && passage.rawHtml
					? prepareReadableBlock(passage.rawHtml)
					: { html: passage.rawHtml ?? '', catalogs: [] },
			]),
		),
	);
	const visibleInstructions = $derived(visibleRubricBlocks.filter((block) => block.kind === 'instructions'));
	const visibleRubrics = $derived(visibleRubricBlocks.filter((block) => block.kind !== 'instructions'));
	const headingTag = $derived(`h${Math.min(6, Math.max(1, Math.round(headingLevel)))}`);

	$effect(() => {
		// A new default from the host applies to every passage again.
		void collapsed;
		collapsedPassages = {};
	});

	function isPassageCollapsed(identifier: string): boolean {
		return collapsedPassages[identifier] ?? collapsed;
	}

	function toggleCollapse(identifier: string) {
		collapsedPassages = { ...collapsedPassages, [identifier]: !isPassageCollapsed(identifier) };
	}

	/** The authored title, or a neutral label ("Passage", "Passage 2") — never an identifier. */
	function passageTitle(passage: QtiSharedHtmlBlock, index: number): string {
		const authored = passage.title?.trim();
		if (authored) return authored;
		if (visiblePassages.length > 1) {
			return (
				i18n?.t('sectionPlayer.passageNumbered', 'Passage {number}', { number: index + 1 }) ?? `Passage ${index + 1}`
			);
		}
		return i18n?.t('sectionPlayer.passage', 'Passage') ?? 'Passage';
	}

	function passageScope(node: HTMLElement, identifier: string) {
		passageScopeElements = { ...passageScopeElements, [identifier]: node };
		return {
			destroy() {
				const next = { ...passageScopeElements };
				delete next[identifier];
				passageScopeElements = next;
			},
		};
	}

	function sanitizeKind(block: QtiSharedHtmlBlock): QtiSharedHtmlSanitizeContext['kind'] {
		return block.kind === 'stimulus' || block.kind === 'test-feedback' ? block.kind : block.kind === 'instructions' ? 'instructions' : 'rubric';
	}
</script>

{#if visiblePassages.length > 0 || visibleRubricBlocks.length > 0}
	<div class="rubric-container">
		{#if visiblePassages.length > 0}
			<section class="passage-section" aria-label={i18n?.t('sectionPlayer.passages', 'Passages') ?? 'Passages'}>
				{#each visiblePassages as passage, index (passage.identifier)}
					{@const headingId = `${uid}-passage-${index}`}
					{@const passageCollapsed = isPassageCollapsed(passage.identifier)}
					<article class="passage" aria-labelledby={headingId}>
						<div class="passage-header">
							<svelte:element this={headingTag} id={headingId} class="passage-title">
								{passageTitle(passage, index)}
							</svelte:element>
							<div class="passage-header-actions">
								<QtiToolButtonBar
									tools={passage.tools}
									scopeId={passage.identifier}
									scopeLabel="passage"
									sourceText={readablePassages.get(passage.identifier)?.html ?? passage.rawHtml}
									accessibilityCatalogs={readablePassages.get(passage.identifier)?.catalogs}
									language={passage.language}
									scopeElement={passageScopeElements[passage.identifier] ?? null}
									{i18n}
								/>
								<button
									type="button"
									class="passage-toggle"
									onclick={() => toggleCollapse(passage.identifier)}
									aria-expanded={!passageCollapsed}
									aria-label={passageCollapsed ? (i18n?.t('assessment.expandPassage') ?? 'Expand passage') : (i18n?.t('assessment.collapsePassage') ?? 'Collapse passage')}
								>
									<svg
										class="passage-toggle-icon"
										class:collapsed={passageCollapsed}
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-hidden="true"
									>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
									</svg>
								</button>
							</div>
						</div>

						{#if !passageCollapsed}
							<div use:passageScope={passage.identifier}>
								<SanitizedHtml
									rawHtml={readablePassages.get(passage.identifier)?.html ?? passage.rawHtml}
									html={passage.html}
									{security}
									{host}
									sanitizeContext={{ kind: 'passage', source: passage.source }}
									language={passage.language}
									class="passage-content pie-qti-content"
									{typeset}
								/>
							</div>
						{/if}
					</article>
				{/each}
			</section>
		{/if}

		{#if visibleInstructions.length > 0}
			<section class="instructions-section" aria-label={i18n?.t('assessment.instructions') ?? 'Instructions'}>
				{#each visibleInstructions as instruction (instruction.identifier)}
					<div class="instructions-block">
						<svg
							class="instructions-icon"
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
						<SanitizedHtml
							rawHtml={instruction.rawHtml}
							html={instruction.html}
							{security}
							{host}
							sanitizeContext={{ kind: 'instructions', source: instruction.source }}
							language={instruction.language}
							class="instructions-content pie-qti-content"
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
						language={rubric.language}
						class="rubric-block pie-qti-content"
						{typeset}
					/>
				{/each}
			</section>
		{/if}
	</div>
{/if}

<style>
	.rubric-container {
		margin-block-end: var(--pie-qti-space-5, 1.5rem);
	}

	.passage-section,
	.instructions-section,
	.rubric-section {
		margin-block-end: var(--pie-qti-space-4, 1rem);
	}

	.passage {
		box-sizing: border-box;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: var(--pie-qti-radius, 0.5rem);
		padding: var(--pie-qti-space-4, 1rem);
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.passage + .passage {
		margin-block-start: var(--pie-qti-space-4, 1rem);
	}

	.passage-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--pie-qti-space-2, 0.5rem) var(--pie-qti-space-4, 1rem);
		margin-block-end: var(--pie-qti-space-2, 0.5rem);
	}

	.passage-title {
		margin: 0;
		font-size: 1em;
		font-weight: 600;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.passage-header-actions {
		display: inline-flex;
		align-items: center;
		gap: var(--pie-qti-space-2, 0.5rem);
		margin-inline-start: auto;
	}

	.passage-toggle {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding: var(--pie-qti-space-2, 0.5rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius-sm, 0.25rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		cursor: pointer;
	}

	.passage-toggle:hover {
		background: var(--pie-qti-base-300, oklch(95% 0 0));
	}

	.passage-toggle:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.passage-toggle-icon {
		inline-size: 1.25rem;
		block-size: 1.25rem;
		flex: none;
	}

	.passage-toggle-icon.collapsed {
		transform: rotate(180deg);
	}

	.passage :global(.passage-content) {
		padding-block: var(--pie-qti-space-2, 0.5rem) 0;
		line-height: 1.6;
	}

	.passage :global(.passage-content > :first-child) {
		margin-block-start: 0;
	}

	.passage :global(.passage-content p) {
		margin-block: 0 1em;
	}

	.passage :global(.passage-content p:last-child) {
		margin-block-end: 0;
	}

	.instructions-block {
		display: flex;
		align-items: flex-start;
		gap: var(--pie-qti-space-3, 0.75rem);
		padding: var(--pie-qti-space-4, 1rem);
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-inline-start: 4px solid var(--pie-qti-info-text, #1d4ed8);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.instructions-block + .instructions-block {
		margin-block-start: var(--pie-qti-space-3, 0.75rem);
	}

	.instructions-icon {
		flex: none;
		inline-size: 1.5rem;
		block-size: 1.5rem;
		color: var(--pie-qti-info-text, #1d4ed8);
	}

	.instructions-block :global(.instructions-content) {
		flex: 1 1 auto;
		min-inline-size: 0;
		line-height: 1.6;
	}

	.instructions-block :global(.instructions-content > :first-child) {
		margin-block-start: 0;
	}

	.instructions-block :global(.instructions-content > :last-child) {
		margin-block-end: 0;
	}

	.rubric-section :global(.rubric-block) {
		padding: var(--pie-qti-space-4, 1rem);
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		border-radius: var(--pie-qti-radius, 0.5rem);
		margin-block-end: var(--pie-qti-space-4, 1rem);
	}

	.rubric-section :global(.rubric-block > :first-child) {
		margin-block-start: 0;
	}

	.rubric-section :global(.rubric-block > :last-child) {
		margin-block-end: 0;
	}

	/* Phones: one slim gutter instead of nested ones. */
	@media (max-width: 40rem) {
		.passage,
		.instructions-block,
		.rubric-section :global(.rubric-block) {
			padding: var(--pie-qti-space-3, 0.75rem);
		}
	}
</style>
