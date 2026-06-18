<script lang="ts">

	import { typesetAction } from '@pie-qti/default-components/shared';
	import { ItemBody } from '@pie-qti/item-player/components';
	import type { Player, QTIRole, RubricBlock, ScoringResult } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import { typesetMathInElement } from '@pie-qti/typeset-katex';
	import type { DemoResponseMap, DemoResponseValue } from '../lib/types';

	interface Props {
		player: Player;
		sidePanelRubrics: RubricBlock[];
		responses: DemoResponseMap;
		scoringResult: ScoringResult | null;
		answeredCount: number;
		totalInteractions: number;
		progressPercentage: number;
		isSubmitting: boolean;
		disabled: boolean;
		i18n?: I18nProvider | null;
		role: QTIRole;
		onResponseChange: (responseId: string, value: DemoResponseValue) => void;
		onSubmit: () => void;
		onReset: () => void;
	}

	let {
		player,
		sidePanelRubrics,
		responses,
		scoringResult,
		answeredCount,
		totalInteractions,
		progressPercentage,
		isSubmitting,
		disabled,
		i18n,
		role,
		onResponseChange,
		onSubmit,
		onReset,
	}: Props = $props();

	// Simplified translation helper - locale changes trigger page refresh
	const t = $derived((key: string, fallback: string) => i18n?.t(key) ?? fallback);

	// Delegate submission enablement to the player
	const canSubmit = $derived(player ? player.canSubmitResponses(responses) : false);
</script>

<!-- Progress Indicator -->
{#if totalInteractions > 1 && scoringResult === null}
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body py-4">
			<div class="flex items-center justify-between mb-2">
				<span class="text-sm font-semibold">{t('common.status', 'Progress')}</span>
				<span class="text-sm text-base-content/70">
					{answeredCount} {t('common.of', 'of')} {totalInteractions} {t('common.answered', 'answered')}
				</span>
			</div>
			<progress class="progress progress-primary w-full" value={progressPercentage} max="100"></progress>
		</div>
	</div>
{/if}

<div class="card bg-base-100 shadow-xl min-w-0" use:typesetAction={{ typeset: (el) => typesetMathInElement(el) }}>
	<div class="card-body min-w-0">
		<h2 class="card-title">{t('common.question', 'Question')}</h2>

		<div class="qti-question-layout" class:qti-question-layout--with-rubrics={sidePanelRubrics.length > 0}>
			<!-- ItemBody handles player-owned item-body rendering; direct rubrics are host-placed. -->
			<div class="qti-question-body">
				<ItemBody
					{player}
					{responses}
					{disabled}
					{role}
					i18n={i18n ?? undefined}
					typeset={typesetMathInElement}
					renderItemBodyRubrics={role === 'candidate'}
					{onResponseChange}
				/>
			</div>

			{#if sidePanelRubrics.length > 0}
				<aside class="qti-direct-rubrics" aria-label="Rubric blocks">
					<div class="text-xs font-bold uppercase tracking-wide text-base-content/50 mb-2">
						Host-placed rubrics
					</div>
					<div class="space-y-3">
						{#each sidePanelRubrics as rubric}
							<section class="alert alert-info items-start">
								<div class="prose max-w-none text-sm">
									{@html rubric.html}
								</div>
							</section>
						{/each}
					</div>
				</aside>
			{/if}
		</div>

		<div class="card-actions justify-end mt-6">
			{#if scoringResult === null}
				<button
					class="btn btn-primary"
					onclick={onSubmit}
					disabled={isSubmitting || !canSubmit}
					title={!canSubmit ? t('common.pleaseComplete', 'Please complete the required interactions') : ''}
				>
					{#if isSubmitting}
						<span class="loading loading-spinner loading-sm"></span>
						{t('common.submitting', 'Submitting...')}
					{:else}
						{(i18n?.plural && i18n.plural('plurals.submitAnswer', { count: totalInteractions })) || (totalInteractions > 1 ? 'Submit Answers' : 'Submit Answer')}
					{/if}
				</button>
			{:else}
				<button class="btn btn-secondary" onclick={onReset}>{t('common.tryAgain', 'Try Again')}</button>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Prevent wide interactions (SVG, tables, long code) from overflowing the question card. */
	.qti-question-body {
		max-width: 100%;
		min-width: 0;
		overflow-x: auto;
		overflow-y: visible;
	}

	.qti-question-layout--with-rubrics {
		display: grid;
		gap: 1rem;
	}

	@media (min-width: 1024px) {
		.qti-question-layout--with-rubrics {
			grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
			align-items: start;
		}

		.qti-direct-rubrics {
			position: sticky;
			top: 1rem;
			max-height: min(42rem, calc(100vh - 8rem));
			overflow: auto;
		}
	}

	/* Custom elements default to inline; force them to participate in layout and shrink to container. */
	:global(.qti-question-body :is(
		pie-qti-choice,
		pie-qti-slider,
		pie-qti-order,
		pie-qti-match,
		pie-qti-associate,
		pie-qti-gap-match,
		pie-qti-hotspot,
		pie-qti-hottext,
		pie-qti-media,
		pie-qti-custom,
		pie-qti-end-attempt,
		pie-qti-position-object,
		pie-qti-graphic-gap-match,
		pie-qti-graphic-order,
		pie-qti-graphic-associate,
		pie-qti-select-point,
		pie-qti-extended-text
	)) {
		display: block;
		max-width: 100%;
	}
</style>
