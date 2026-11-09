<svelte:options customElement="pie-qti-graphic-order" />

<script lang="ts">
	import type { GraphicOrderInteractionData } from '@pie-qti/item-player';
	import { tick } from 'svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { createConfirmationFlow } from '../../shared/utils/confirmationFlow.svelte';
	import { normalizePixelDimension } from '@pie-qti/item-player/security';
	import { translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import SortableList from '../../shared/components/SortableList.svelte';
	import OrderSubset from '../../shared/components/OrderSubset.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { minimumHint, subsetOrderHint } from '../../shared/utils/minimumRequirement';
	import { orderChoiceLimits } from '@pie-qti/item-player';
	import { escapeHtml, imageAltText } from '../hotspot/graphicRegions';

	interface Props {
		interaction?: GraphicOrderInteractionData | string;
		response?: string[] | null;
		correctResponse?: string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	const uid = $props.id();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<GraphicOrderInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);
	const imageWidth = $derived(
		normalizePixelDimension(parsedInteraction?.imageData?.width, '500') ?? '500',
	);
	const imageHeight = $derived(
		normalizePixelDimension(parsedInteraction?.imageData?.height, '300') ?? '300',
	);
	// Reflow (WCAG 1.4.10): the image scales down with its container, never past its natural size.
	const mediaStyle = $derived(`max-width: ${imageWidth}px; aspect-ratio: ${imageWidth} / ${imageHeight};`);

	const imageData = $derived(parsedInteraction?.imageData ?? null);
	const imageAlt = $derived(
		imageAltText(imageData, translate(i18n, 'interactions.graphicOrder.imageFallback', 'Image for this question')),
	);
	const imageDescription = $derived(imageData?.decorative ? '' : (imageData?.altDescription ?? ''));
	const imageDescriptionId = $derived(`${uid}-image-description`);
	let failedSrc = $state<string | null>(null);
	const imageFailed = $derived(!!imageData?.src && failedSrc === imageData.src);

	function handleImageError() {
		failedSrc = imageData?.src ?? null;
		console.warn(`[pie-qti-graphic-order] The image failed to load: ${imageData?.src ?? ''}`);
	}

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	let orderedIds = $state<string[]>([]);

	// Track initial order to detect if user has made changes
	const initialOrder = $derived(parsedInteraction?.hotspotChoices.map((c) => c.identifier) || []);

	// Subset ordering (QTI 2.2 ASI §5.42): only a minChoices below the hotspot count lets the
	// candidate pick which hotspots to order; without it, or with minChoices at or above N,
	// every hotspot is ordered. The same rule the engine's response validation reads.
	const limits = $derived(
		orderChoiceLimits({
			minChoices: parsedInteraction?.minChoices,
			maxChoices: parsedInteraction?.maxChoices,
			choiceCount: initialOrder.length,
		}),
	);
	const subsetMode = $derived(limits.subset);
	// Hotspots outside the subset keep no position: the listed items are ordered in sequence,
	// the rest wait in the pool. Unknown or repeated identifiers in a restored response are dropped.
	const subsetOrderedIds = $derived(
		parsedResponse ? [...new Set(parsedResponse.filter((id) => initialOrder.includes(id)))] : [],
	);

	/**
	 * The sortable items: each hotspot's authored label, else a localized
	 * ordinal by authored position — never its identifier, which can reveal the
	 * answer key. Labels are plain text, escaped for the list's HTML renderer.
	 */
	const sortableItems = $derived(
		(parsedInteraction?.hotspotChoices ?? []).map((choice, index) => ({
			id: choice.identifier,
			text: escapeHtml(
				choice.label?.trim() ||
					translate(i18n, 'interactions.graphicOrder.unlabeledItem', 'Item {index}', { index: index + 1 }),
			),
		})),
	);

	const confirmation = createConfirmationFlow({
		orderedIds: () => orderedIds,
		initialOrder: () => initialOrder,
		disabled: () => disabled,
		response: () => parsedResponse,
		commit: (order) => {
			orderedIds = order;
			response = order;
			emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: order, onChange });
		},
	});

	$effect(() => {
		// Sync with parent response changes
		orderedIds = parsedResponse ? [...parsedResponse] : parsedInteraction?.hotspotChoices.map((c) => c.identifier) || [];
	});

	// Reset confirmation state when response is externally cleared
	$effect(() => {
		confirmation.resetIfCleared();
	});

	// Confirmation feedback: the control itself stays mounted through confirmation (it
	// becomes an inert "Order confirmed" state instead of being swapped for an alert), so
	// the focus that pressed it keeps a home, and the always-present polite region below
	// announces the confirmation to assistive technology.
	let confirmationAnnouncement = $state('');

	function announceConfirmation(message: string) {
		confirmationAnnouncement = confirmationAnnouncement === message ? `${message}\u200b` : message;
	}

	async function confirmFromButton(event: MouseEvent) {
		const button = event.currentTarget as HTMLButtonElement | null;
		const wasNeedy = confirmation.needsConfirmation;
		confirmation.confirmOrder();
		if (!wasNeedy) return;
		announceConfirmation(translate(i18n, 'interactions.order.orderConfirmed', 'Order confirmed'));
		// The control flips to its confirmed state in place; make sure keyboard focus
		// sits on it even if a re-render replaced the element.
		await tick();
		button?.focus();
	}

	// Minimum requirement: stated while the response orders fewer hotspots than required — the
	// same minimum response validation enforces; the author's message wins. In subset mode the
	// statement also names the cap ("Choose between 2 and 3 items and put them in order."), so
	// the limits are known up front (WCAG 3.3.2). It describes the list. Only while the
	// candidate can still answer.
	const minHintId = `${uid}-min-hint`;
	const orderedCount = $derived(
		subsetMode
			? (Array.isArray(parsedResponse) ? parsedResponse.filter((id) => initialOrder.includes(id)).length : 0)
			: (Array.isArray(parsedResponse) ? parsedResponse.filter(Boolean).length : 0),
	);
	const minHint = $derived.by(() => {
		if (subsetMode && !disabled && role === 'candidate') {
			return subsetOrderHint({
				i18n,
				min: limits.minOrdered,
				max: limits.maxOrdered,
				count: orderedCount,
				authored: parsedInteraction?.minSelectionsMessage,
				namespace: 'interactions.graphicOrder',
			});
		}
		return minimumHint({
			i18n,
			minimum: !disabled && role === 'candidate' && !subsetMode ? parsedInteraction?.minChoices : 0,
			count: orderedCount,
			authored: parsedInteraction?.minSelectionsMessage,
			key: 'interactions.graphicOrder.minChoicesHint',
			fallback: { one: 'Put at least {count} item in order.', other: 'Put at least {count} items in order.' },
		});
	});

	function handleReorder(newOrder: string[]) {
		confirmation.autoConfirm(); // Auto-confirm on drag
		orderedIds = newOrder;
		response = orderedIds;
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: orderedIds, onChange });
	}

	// Subset ordering has no confirm step, for the same reasons as the order interaction: every
	// ordered hotspot arrived by an explicit, reversible add, so nothing is presented as an
	// answer that the candidate could accidentally keep. Each act records the response at once;
	// ordering nothing is a NULL response.
	function handleSubsetChange(newOrder: string[]) {
		const value = newOrder.length > 0 ? newOrder : null;
		orderedIds = newOrder;
		response = value;
		const nullAwareOnChange = onChange as ((value: string[] | null) => void) | undefined;
		emitInteractionChange<string[] | null>({
			target: rootElement,
			responseId: parsedInteraction?.responseId,
			value,
			onChange: nullAwareOnChange,
		});
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class="qti-graphic-order-interaction">
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-go-prompt qti-rich-content font-semibold mb-3">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<div part="layout" class="qti-go-layout flex flex-col gap-4">
			<!-- Image Area -->
			<div part="image-area" class="qti-go-image-area">
				<div
					part="stage"
					class="qti-go-stage relative border-2 border-base-300 rounded-lg overflow-hidden bg-base-200"
				>
					{#if imageData}
						<div class="qti-go-media" style={mediaStyle}>
							{#if imageData.type === 'svg' && imageData.content}
								<div
									part="image"
									class="qti-go-image"
									role={imageData.decorative ? undefined : 'img'}
									aria-hidden={imageData.decorative ? 'true' : undefined}
									aria-label={imageData.decorative ? undefined : imageAlt}
									aria-describedby={imageDescription ? imageDescriptionId : undefined}
								>
									{@html imageData.content}
								</div>
							{:else if imageFailed}
								<div part="image-error" class="qti-go-image qti-go-image-error">
									<p>{translate(i18n, 'interactions.graphicOrder.imageLoadError', 'The image could not be loaded.')}</p>
									{#if imageData.alt && !imageData.decorative}
										<p>{imageData.alt}</p>
									{/if}
								</div>
							{:else if imageData.src}
								<img
									part="image"
									src={imageData.src}
									alt={imageAlt}
									aria-describedby={imageDescription ? imageDescriptionId : undefined}
									class="qti-go-image"
									onerror={handleImageError}
								/>
							{/if}
						</div>
						{#if imageDescription}
							<p id={imageDescriptionId} class="qti-go-sr-only">{imageDescription}</p>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Ordering Area -->
			<div part="panel" class="qti-go-panel w-full">
				<div class="qti-go-card card bg-base-100 border border-base-300">
					<div class="qti-go-card-body card-body p-4">
						<h3 part="panel-title" class="qti-go-title card-title text-sm">{i18n?.t('interactions.graphicOrder.orderHeading') ?? 'Order (drag to reorder)'}</h3>
						{#if subsetMode}
							<OrderSubset
								items={sortableItems}
								orderedIds={subsetOrderedIds}
								maxOrdered={limits.maxOrdered}
								{disabled}
								{i18n}
								correctOrder={isShowingCorrect ? (parsedCorrectResponse || []) : []}
								describedBy={minHint ? minHintId : undefined}
								onChange={handleSubsetChange}
							/>
						{:else}
							<SortableList
								items={sortableItems}
								{orderedIds}
								correctOrder={isShowingCorrect ? (parsedCorrectResponse || []) : []}
								orientation="vertical"
								{disabled}
								{i18n}
								describedBy={minHint ? minHintId : undefined}
								onReorder={handleReorder}
							/>
						{/if}
						<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(parsedResponse ?? null)} />

						<!-- Confirmation control for WCAG 2.2 SC 3.3.4 compliance. One persistent
						     element flips between the actionable control and an inert "Order
						     confirmed" state (aria-disabled, tabindex=-1 — never removed), so the
						     focus that pressed it keeps a home; the always-present polite region
						     below announces the confirmation. -->
						<div part="confirm" class="qti-go-confirm mt-4 pt-3 border-t border-base-300">
							{#if !subsetMode && (confirmation.needsConfirmation || confirmation.hasConfirmed)}
								<button
									type="button"
									part={confirmation.hasConfirmed ? 'confirmed' : 'confirm-button'}
									class="btn btn-sm w-full {confirmation.hasConfirmed ? 'qti-go-confirmed-control' : 'btn-primary'}"
									onclick={confirmFromButton}
									aria-disabled={confirmation.hasConfirmed ? 'true' : undefined}
									tabindex={confirmation.hasConfirmed ? -1 : undefined}
									aria-label={confirmation.hasConfirmed
										? undefined
										: (i18n?.t('interactions.graphicOrder.confirmAria') ?? 'Confirm this order as your answer')}
								>
									{#if confirmation.hasConfirmed}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											part="confirmed-icon"
											class="qti-icon qti-go-confirmed stroke-current shrink-0 w-5 h-5"
											aria-hidden="true"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 13l4 4L19 7"
											></path>
										</svg>
										<span class="text-sm">{translate(i18n, 'interactions.order.orderConfirmed', 'Order confirmed')}</span>
									{:else}
										{confirmation.hasReordered
											? (i18n?.t('interactions.graphicOrder.confirmOrder') ?? 'Confirm Order')
											: (i18n?.t('interactions.graphicOrder.confirmOrderNoChanges') ?? 'Confirm Order (No Changes)')}
									{/if}
								</button>
								{#if !confirmation.hasConfirmed}
									<p class="text-xs text-base-content/60 mt-2 text-center">
										{i18n?.t('interactions.graphicOrder.instruction') ?? 'Drag to reorder, or click to confirm'}
									</p>
								{/if}
							{/if}
							<div aria-live="polite" aria-atomic="true" class="qti-go-confirmation-live">{confirmationAnnouncement}</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Ensure proper drag and drop visual feedback */
	:global(.qti-graphic-order-interaction [draggable='true']) {
		user-select: none;
		-webkit-user-drag: element;
	}

	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex: 0 0 auto;
	}

	/* Minimal layout so this works without Tailwind utilities */
	.qti-go-layout {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.qti-go-image-area {
		width: 100%;
	}
	.qti-go-panel {
		width: 100%;
	}
	.qti-go-stage {
		position: relative;
		border-radius: 0.75rem;
		overflow: hidden;
		border: 2px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}
	/* The image fills the available width up to its natural size, keeping its aspect ratio. */
	.qti-go-media {
		position: relative;
		width: 100%;
	}
	.qti-go-image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.qti-go-image :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.qti-go-image-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 1rem;
		box-sizing: border-box;
		text-align: center;
		color: var(--pie-qti-error-text, #b91c1c);
	}
	.qti-go-image-error p {
		margin: 0;
	}
	.qti-go-card {
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}
	.qti-go-card-body {
		padding: 1rem;
	}
	.qti-go-confirm {
		border-top: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		padding-top: 0.75rem;
		margin-top: 1rem;
	}
	/* The confirmed control: the alert's success reading without removing the control */
	.qti-go-confirmed-control {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		border: 1px solid var(--pie-qti-success-text, #15803d);
		color: var(--pie-qti-success-text, #15803d);
		background: transparent;
		cursor: default;
	}

	/* Visually hidden confirmation live region, self-contained so it hides without Tailwind. */
	.qti-go-confirmation-live {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.qti-go-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
