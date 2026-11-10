<svelte:options customElement="pie-qti-graphic-order" />

<script lang="ts">
	import type { GraphicOrderInteractionData } from '@pie-qti/item-player';
	import { tick } from 'svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { createConfirmationFlow } from '../../shared/utils/confirmationFlow.svelte';
	import { translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import Icon from '../../shared/components/Icon.svelte';
	import { ICON_CHECK } from '../../shared/components/icons';
	import ImageStage from '../../shared/components/ImageStage.svelte';
	import SortableList from '../../shared/components/SortableList.svelte';
	import OrderSubset from '../../shared/components/OrderSubset.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import HotspotShape from '../../shared/components/HotspotShape.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { minimumHint, subsetOrderHint } from '../../shared/utils/minimumRequirement';
	import { orderChoiceLimits } from '@pie-qti/item-player';
	import { escapeHtml, imageAltText, regionMarkerPoint } from '../../shared/utils/graphicRegions';
	import { choiceAccessibleName } from '../../shared/utils/choiceName';
	import { createAnnouncer } from '../../shared/utils/announcer.svelte';

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

	// Props may be JSON strings (web component usage). Correct-answer mode is the scorer role
	// with a correct response, as in every interaction.
	const shell = $derived(
		createInteractionShell<GraphicOrderInteractionData, string[], string[]>({
			interaction,
			response,
			correctResponse,
			role,
			listResponse: true,
		}),
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);
	// The stage's pixel space (shared ImageStage): the image's declared width/height,
	// else a raster image's natural size once loaded, else unknown — the areas live
	// in that space, so unknown means no overlay is drawn (a default would place
	// them in a guessed space).
	let imageWidth = $state<number | null>(null);
	let imageHeight = $state<number | null>(null);
	let imageFailed = $state(false);
	let awaitingNaturalSize = $state(false);

	let warnedMissingDimensions = false;
	$effect(() => {
		if (missingDimensions && !warnedMissingDimensions) {
			warnedMissingDimensions = true;
			console.warn(
				'[pie-qti-graphic-order] The image has no known width/height, so its areas cannot be placed. Add width and height to the image, or supply the asset dimensions.',
			);
		}
	});

	// Rendered width of the image, so the area badges keep their CSS size at any image scale.
	let renderedWidth = $state(0);
	const renderScale = $derived(imageWidth && renderedWidth > 0 ? renderedWidth / imageWidth : 1);

	const imageData = $derived(parsedInteraction?.imageData ?? null);
	const hasImageDimensions = $derived(imageWidth !== null && imageHeight !== null);
	const missingDimensions = $derived(!!imageData && !hasImageDimensions && !awaitingNaturalSize);
	const showDiagnostics = $derived(role !== 'candidate');
	const imageAlt = $derived(
		imageAltText(imageData, translate(i18n, 'interactions.graphicOrder.imageFallback', 'Image for this question')),
	);
	const imageDescription = $derived(imageData?.decorative ? '' : (imageData?.altDescription ?? ''));
	const imageDescriptionId = $derived(`${uid}-image-description`);

	function warnImageFailed(src: string) {
		console.warn(`[pie-qti-graphic-order] The image failed to load: ${src}`);
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
	 * Each hotspot's position in the order the list shows (1-based), numbered as the list numbers
	 * it: every hotspot in full ordering, only the ordered ones in subset ordering. The areas on
	 * the image carry it.
	 */
	const positions = $derived(
		new Map((subsetMode ? subsetOrderedIds : orderedIds).map((id, index) => [id, index + 1])),
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
				choiceAccessibleName({
					i18n,
					label: choice.label,
					position: index + 1,
					// The interaction's own noun for an unlabeled hotspot ("Item 3").
					fallback: { key: 'interactions.graphicOrder.unlabeledItem', text: 'Item {index}' },
				}),
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
	const confirmationAnnouncer = createAnnouncer();

	/** Announce the confirmation; the shared announcer keeps repeats announcing. */
	function announceConfirmation(message: string) {
		confirmationAnnouncer.announce(message);
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
	// No QTI version defines a selections message on graphicOrderInteraction, so the hint is
	// always the localized text.
	const minHint = $derived.by(() => {
		if (subsetMode && !disabled && role === 'candidate') {
			return subsetOrderHint({
				i18n,
				min: limits.minOrdered,
				max: limits.maxOrdered,
				count: orderedCount,
				namespace: 'interactions.graphicOrder',
			});
		}
		return minimumHint({
			i18n,
			minimum: !disabled && role === 'candidate' && !subsetMode ? parsedInteraction?.minChoices : 0,
			count: orderedCount,
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

		{#if missingDimensions && showDiagnostics}
			<div part="diagnostic" class="alert alert-error qti-go-diagnostic" role="alert">
				{translate(
					i18n,
					'interactions.graphicOrder.unknownImageDimensions',
					'The areas cannot be shown: the size of the image is unknown. Add width and height to the image, or supply the asset dimensions.',
				)}
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
						<ImageStage
							{imageData}
							alt={imageAlt}
							description={imageDescription}
							descriptionId={imageDescriptionId}
							containerClass="qti-go-media"
							svgContentClass="qti-go-image"
							imgClass="qti-go-image"
							errorClass="qti-go-image qti-go-image-error"
							mediaPart="image"
							errorPart="image-error"
							loadErrorText={translate(i18n, 'interactions.graphicOrder.imageLoadError', 'The image could not be loaded.')}
							onImageError={warnImageFailed}
							sizing="refuse"
							reportWidth
							bind:width={imageWidth}
							bind:height={imageHeight}
							bind:failed={imageFailed}
							bind:awaiting={awaitingNaturalSize}
							bind:renderedWidth
						>
							<!-- The areas the candidate orders, on the image (QTI 3.0 §5.61: "The delivery
							     engine must clearly indicate all defined area(s) of the image"): each one
							     outlined, each placed one with its position in the order the list shows.
							     Visual only: the list is what the keyboard and assistive technology use,
							     so the overlay is hidden from both and takes no pointer input. It covers
							     exactly the image, in its natural pixel space, and scales with it. -->
							{#if hasImageDimensions && !imageFailed && (imageData.content || imageData.src)}
								<svg
									part="overlay"
									class="qti-go-overlay"
									viewBox="0 0 {imageWidth} {imageHeight}"
									xmlns="http://www.w3.org/2000/svg"
									aria-hidden="true"
									pointer-events="none"
								>
									{#each parsedInteraction.hotspotChoices as choice}
										{@const position = positions.get(choice.identifier)}
										<g class="qti-go-area" data-placed={position ? '' : undefined}>
											<HotspotShape shape={choice.shape} coords={choice.coords} interactive={false} presentation={{ class: 'qti-go-area-halo' }} />
											<HotspotShape shape={choice.shape} coords={choice.coords} interactive={false} presentation={{ class: 'qti-go-area-outline' }} />
											{#if position}
												{@const at = regionMarkerPoint(choice.shape, choice.coords, renderScale, 16)}
												<g class="qti-go-badge" transform="translate({at.x} {at.y}) scale({1 / renderScale})">
													<circle r="12" />
													<text text-anchor="middle" dominant-baseline="central">{position}</text>
												</g>
											{/if}
										</g>
									{/each}
								</svg>
							{/if}
						</ImageStage>
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
										<Icon d={ICON_CHECK} part="confirmed-icon" class="qti-icon qti-go-confirmed stroke-current shrink-0 w-5 h-5" />
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
							<div aria-live="polite" aria-atomic="true" class="qti-go-confirmation-live">{confirmationAnnouncer.message}</div>
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
	.qti-go-image :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}

	/*
	 * The areas overlay: exactly over the image, scaling with it (the viewBox is the image's
	 * pixel space). A light halo under a dark outline keeps each area visible on any image
	 * (WCAG 1.4.11); a placed area is drawn solid in the primary colour with its position, an
	 * area outside a subset order dashed — never colour alone (WCAG 1.4.1).
	 */
	.qti-go-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.qti-go-overlay :global(.qti-go-area-halo) {
		fill: none;
		stroke: #fff;
		stroke-width: 5px;
		vector-effect: non-scaling-stroke;
	}
	.qti-go-overlay :global(.qti-go-area-outline) {
		fill: none;
		stroke: var(--pie-qti-border-strong, #767676);
		stroke-width: 2px;
		stroke-dasharray: 6px 4px;
		vector-effect: non-scaling-stroke;
	}
	.qti-go-overlay :global(.qti-go-area[data-placed] .qti-go-area-outline) {
		stroke: var(--pie-qti-primary, oklch(45% 0.24 277));
		stroke-width: 3px;
		stroke-dasharray: none;
	}
	.qti-go-badge circle {
		fill: var(--pie-qti-primary, oklch(45% 0.24 277));
		stroke: #fff;
		stroke-width: 2px;
	}
	.qti-go-badge text {
		fill: #fff;
		font-size: 13px;
		font-weight: 700;
		font-family: inherit;
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

</style>
