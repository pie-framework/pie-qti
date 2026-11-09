<svelte:options customElement="pie-qti-graphic-associate" />

<script lang="ts">
	import type { GraphicAssociateHotspot, GraphicAssociateInteractionData } from '@pie-qti/item-player';
	import { tick } from 'svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { normalizePixelDimension } from '@pie-qti/item-player/security';
	import { formatList, joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import ImageStage from '../../shared/components/ImageStage.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { isCompatibleMatchGroup } from '../../shared/utils/matchGroupUtils';
	import { countPairsWithId, pairIncludesId } from '../../shared/utils/pairHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import HotspotShape from '../../shared/components/HotspotShape.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { choicesShortOfMatchMin, minimumHint } from '../../shared/utils/minimumRequirement';
	import { imageAltText, shapeBounds, shapeCenter, type Bounds } from '../../shared/utils/graphicRegions';

	interface Props {
		interaction?: GraphicAssociateInteractionData | string;
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
		createInteractionShell<GraphicAssociateInteractionData, string[], string[]>({
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
	const correctPairs = $derived(Array.isArray(parsedCorrectResponse) ? parsedCorrectResponse : []);
	// The stage's pixel space (shared ImageStage): the image's declared width/height,
	// else a raster image's natural size once loaded, else unknown — the hotspots are
	// positioned in percentages of it, so unknown means no stage is drawn (a default
	// would associate in a guessed space). The stage scales with its container (WCAG 1.4.10).
	let imageWidth = $state<number | null>(null);
	let imageHeight = $state<number | null>(null);
	let imageFailed = $state(false);
	let awaitingNaturalSize = $state(false);

	const stageStyle = $derived(`max-width: calc(${imageWidth ?? 0}px + 4px);`);

	const imageData = $derived(parsedInteraction?.imageData ?? null);
	const hasImageDimensions = $derived(imageWidth !== null && imageHeight !== null);
	const missingDimensions = $derived(!!imageData && !hasImageDimensions && !awaitingNaturalSize);
	const showDiagnostics = $derived(role !== 'candidate');

	let warnedMissingDimensions = false;
	$effect(() => {
		if (missingDimensions && !warnedMissingDimensions) {
			warnedMissingDimensions = true;
			console.warn(
				'[pie-qti-graphic-associate] The image has no known width/height, so its hotspots cannot be placed. Add width and height to the image, or supply the asset dimensions.',
			);
		}
	});
	const imageAlt = $derived(
		imageAltText(imageData, translate(i18n, 'interactions.graphicAssociate.imageFallback', 'Image for this question')),
	);
	const imageDescription = $derived(imageData?.decorative ? '' : (imageData?.altDescription ?? ''));
	const imageDescriptionId = $derived(`${uid}-image-description`);

	function warnImageFailed(src: string) {
		console.warn(`[pie-qti-graphic-associate] The image failed to load: ${src}`);
	}

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Pairs are stored as "ID1 ID2" strings (space-separated)
	let pairs = $state<string[]>([]);
	let selectedHotspot: string | null = $state(null);

	// Polite announcements of associations made, removed, and refused, for the
	// always-rendered live region below the description.
	let statusAnnouncement = $state('');

	function announce(message: string) {
		statusAnnouncement = statusAnnouncement === message ? `${message}\u200b` : message;
	}

	const canInteract = $derived(!disabled);
	// The interaction's association cap (QTI maxAssociations): 0 means unlimited, as the
	// sibling pairing surfaces (AssociateInteraction, MatchDragDrop) and the delivery
	// engine read it.
	const canAddMore = $derived(
		!parsedInteraction || parsedInteraction.maxAssociations <= 0 || pairs.length < parsedInteraction.maxAssociations,
	);

	// Hotspots incompatible with the currently selected hotspot due to matchGroup constraints
	const blockedHotspots = $derived.by(() => {
		if (!selectedHotspot || !parsedInteraction) return new Set<string>();
		const hotspots = parsedInteraction.associableHotspots;
		const src = hotspots.find((h) => h.identifier === selectedHotspot);
		return new Set(
			hotspots
				.filter((h) => h.identifier !== selectedHotspot && !isCompatibleMatchGroup(src, h))
				.map((h) => h.identifier)
		);
	});

	$effect(() => {
		// Sync with parent response changes
		pairs = parsedResponse ? [...parsedResponse] : [];
	});

	function handleHotspotClick(hotspotId: string) {
		if (!canInteract || !parsedInteraction) return;

		const hotspot = parsedInteraction.associableHotspots.find((h) => h.identifier === hotspotId);
		if (!hotspot) return;

		// Count how many times this hotspot is already used
		const usageCount = countPairsWithId(pairs, hotspotId);
		if (isAtMatchMax(hotspot, usageCount)) {
			// This hotspot is at its maximum connections: refuse, announced.
			announce(
				translate(i18n, 'interactions.graphicAssociate.hotspotLimitReached', 'Not possible: {label} cannot be in more associations.', {
					label: hotspotName(hotspot),
				}),
			);
			return;
		}

		if (!selectedHotspot) {
			// First selection
			selectedHotspot = hotspotId;
		} else if (selectedHotspot === hotspotId) {
			// Clicking the same hotspot deselects it
			selectedHotspot = null;
		} else {
			// Second selection - create a pair
			if (!canAddMore) {
				announce(
					translate(i18n, 'interactions.graphicAssociate.associationLimitReached', 'Association not possible: the limit of {max} is reached.', {
						max: parsedInteraction.maxAssociations,
					}),
				);
				return;
			}
			if (blockedHotspots.has(hotspotId)) {
				announce(translate(i18n, 'interactions.graphicAssociate.notAvailableSentence', 'Not available due to a match group restriction.'));
				return;
			}

			const newPair = `${selectedHotspot} ${hotspotId}`;
			pairs = [...pairs, newPair];
			response = pairs;
			// Call onChange callback if provided (for Svelte component usage)
			emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: pairs, onChange });
			announce(translate(i18n, 'interactions.graphicAssociate.associationMade', 'Association made.'));
			selectedHotspot = null;
		}
	}

	function removePair(index: number) {
		if (!canInteract) return;
		pairs = pairs.filter((_, i) => i !== index);
		response = pairs;
		// Call onChange callback if provided (for Svelte component usage)
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: pairs, onChange });
		// Announce the removal politely: the focused remove button vanishes with the pair,
		// so the live region is what tells assistive technology what just happened.
		announce(translate(i18n, 'interactions.graphicAssociate.associationRemoved', 'Association removed.'));
		void moveFocusAfterRemoval(index);
	}

	/**
	 * The activated remove button is gone, which would drop keyboard focus to the
	 * document. Focus stays on the pair list (the pair now in that row, else the
	 * new last one), or returns to the hotspots when no pair is left to remove —
	 * the same pattern AssociateInteraction uses.
	 */
	async function moveFocusAfterRemoval(removedIndex: number) {
		await tick();
		const buttons = rootElement?.querySelectorAll<HTMLButtonElement>('[part="association-remove"]');
		const next = buttons?.[Math.min(removedIndex, buttons.length - 1)];
		(next ?? rootElement?.querySelector<HTMLButtonElement>('[part="hotspot"]'))?.focus();
	}

	function getHotspotById(id: string) {
		return parsedInteraction?.associableHotspots.find((h) => h.identifier === id);
	}

	/** Visible and accessible name: the authored label, else a localized ordinal. Never the identifier. */
	function hotspotName(hotspot: GraphicAssociateHotspot | undefined): string {
		if (!hotspot) return '';
		const index = parsedInteraction?.associableHotspots.indexOf(hotspot) ?? -1;
		return (
			hotspot.label?.trim() ||
			translate(i18n, 'interactions.graphicAssociate.unlabeledHotspot', 'Region {index}', { index: index + 1 })
		);
	}

	function hotspotNameById(id: string): string {
		return hotspotName(getHotspotById(id));
	}

	function isHotspotSelected(id: string): boolean {
		return selectedHotspot === id;
	}

	function getHotspotUsageCount(id: string): number {
		return countPairsWithId(pairs, id);
	}

	/** A hotspot's own cap (QTI matchMax): 0 means unlimited, as for every associable choice. */
	function isAtMatchMax(hotspot: GraphicAssociateHotspot, usageCount: number): boolean {
		return hotspot.matchMax > 0 && usageCount >= hotspot.matchMax;
	}

	function isHotspotMaxed(id: string): boolean {
		const hotspot = getHotspotById(id);
		if (!hotspot) return false;
		return isAtMatchMax(hotspot, getHotspotUsageCount(id));
	}

	function hotspotAriaLabel(hotspot: GraphicAssociateHotspot, usageCount: number, isCorrect: boolean, isBlocked: boolean): string {
		const label = hotspotName(hotspot);
		return joinSentences(
			translate(i18n, 'accessibility.sentence', '{text}.', {
				text:
					hotspot.matchMax > 0
						? translate(i18n, 'interactions.graphicAssociate.hotspotConnections', '{label} ({usageCount}/{matchMax} connections)', {
								label,
								usageCount,
								matchMax: hotspot.matchMax,
							})
						: translate(i18n, 'interactions.graphicAssociate.hotspotConnectionsUnlimited', '{label} ({usageCount} connections, unlimited)', {
								label,
								usageCount,
							}),
			}),
			isCorrect
				? translate(i18n, 'accessibility.correctAnswer', 'Correct answer.')
				: isBlocked && translate(i18n, 'interactions.graphicAssociate.notAvailableSentence', 'Not available due to a match group restriction.'),
		);
	}

	function isCorrectPair(id1: string, id2: string): boolean {
		if (!isShowingCorrect) return false;
		return correctPairs.some((p) => p === `${id1} ${id2}` || p === `${id2} ${id1}`);
	}

	function isHotspotInCorrectPair(id: string): boolean {
		if (!isShowingCorrect) return false;
		return correctPairs.some((p) => pairIncludesId(p, id));
	}

	/**
	 * Minimum requirement (minAssociations, and each hotspot's matchMin): stated while the
	 * response falls short of either, the same minimums response validation enforces; the
	 * author's message wins. Only while the candidate can still answer.
	 */
	const minHintId = `${uid}-min-hint`;
	const minHint = $derived.by(() => {
		if (disabled || role !== 'candidate' || !parsedInteraction) return '';
		const fewerAssociations = minimumHint({
			i18n,
			minimum: parsedInteraction.minAssociations,
			count: pairs.length,
			key: 'interactions.graphicAssociate.minAssociationsHint',
			fallback: { one: 'Make at least {count} association.', other: 'Make at least {count} associations.' },
		});
		const shortHotspots = choicesShortOfMatchMin(parsedInteraction.associableHotspots, pairs);
		if (!fewerAssociations && shortHotspots.length === 0) return '';
		return joinSentences(
			fewerAssociations,
			shortHotspots.length > 0 &&
				translate(i18n, 'interactions.graphicAssociate.minHotspotUsesHint', 'Needs more associations: {items}.', {
					items: formatList(i18n, shortHotspots.map(hotspotName)),
				}),
		);
	});

	/**
	 * A hotspot's bounding box in natural image coordinates. The default shape is the whole
	 * image (QTI 3.0 §8.29); a shape whose coords cannot be read has an empty box.
	 */
	function hotspotBounds(hotspot: GraphicAssociateHotspot): Bounds {
		if (hotspot.shape === 'default') return { x: 0, y: 0, width: imageWidth ?? 0, height: imageHeight ?? 0 };
		return shapeBounds(hotspot.shape, hotspot.coords) ?? { x: 0, y: 0, width: 0, height: 0 };
	}

	/** Where an association line meets a hotspot: its shape's centre; the whole image's for the default shape. */
	function hotspotCenter(hotspot: GraphicAssociateHotspot): { x: number; y: number } {
		if (hotspot.shape === 'default') return { x: (imageWidth ?? 0) / 2, y: (imageHeight ?? 0) / 2 };
		return shapeCenter(hotspot.shape, hotspot.coords);
	}

	/**
	 * Hotspot button box in percentages of the natural image, centred on the region so the
	 * 24×24 CSS px minimum target (WCAG 2.5.8) grows symmetrically. The button takes no pointer
	 * input itself: only the shape drawn inside it does, so a press inside the bounding box but
	 * outside the shape is not on the hotspot.
	 */
	function hotspotBoxStyle(hotspot: GraphicAssociateHotspot): string {
		const bounds = hotspotBounds(hotspot);
		const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(4)}%`;
		return [
			`left: ${pct(bounds.x + bounds.width / 2, imageWidth ?? 1)}`,
			`top: ${pct(bounds.y + bounds.height / 2, imageHeight ?? 1)}`,
			`width: ${pct(bounds.width, imageWidth ?? 1)}`,
			`height: ${pct(bounds.height, imageHeight ?? 1)}`,
			'pointer-events: none',
		].join('; ');
	}

	/** The viewBox of a button's hit-area SVG: the hotspot's bounding box, never empty. */
	function hitViewBox(hotspot: GraphicAssociateHotspot): string {
		const bounds = hotspotBounds(hotspot);
		return `${bounds.x} ${bounds.y} ${Math.max(bounds.width, 1)} ${Math.max(bounds.height, 1)}`;
	}

	// The hotspots' outlines on the image, default-shape ones (the whole image) first so they
	// lie beneath the others; each keeps its authored index for its name.
	const areaOrder = $derived(
		(parsedInteraction?.associableHotspots ?? [])
			.map((hotspot, index) => ({ hotspot, index }))
			.sort((a, b) => Number(b.hotspot.shape === 'default') - Number(a.hotspot.shape === 'default')),
	);
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class="qti-graphic-associate-interaction">
	<InteractionDescription interaction={parsedInteraction} />
	<!-- Polite announcements (association made, removed, refused) that survive the changed
	     or focused controls themselves. Always rendered, before any conditional content. -->
	<div aria-live="polite" aria-atomic="true" class="qti-ga-live-region">{statusAnnouncement}</div>
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-ga-prompt qti-rich-content font-semibold mb-3">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		{#if missingDimensions && showDiagnostics}
			<div part="diagnostic" class="alert alert-error qti-ga-diagnostic" role="alert">
				{translate(
					i18n,
					'interactions.graphicAssociate.unknownImageDimensions',
					'This graphic association cannot be shown: the size of its image is unknown, so the hotspots cannot be placed. Add width and height to the image, or supply the asset dimensions.',
				)}
			</div>
		{/if}

		<div part="layout" class="qti-ga-layout flex flex-col lg:flex-row gap-4">
			<!-- Image with Hotspots -->
			<div part="image-area" class="qti-ga-image-area flex-1">
				<div
					part="stage"
					class="qti-ga-stage relative border-2 border-base-300 rounded-lg bg-base-200"
					style={stageStyle}
				>
					<!-- Borderless positioning canvas: exactly the image's aspect ratio, so the
					     percentage hotspot boxes and the overlay's viewBox align at any scale. -->
					<ImageStage
						{imageData}
						alt={imageAlt}
						description={imageDescription}
						descriptionId={imageDescriptionId}
						containerClass="qti-ga-canvas"
						capContainerWidth={false}
						svgContentClass="qti-ga-image"
						imgClass="qti-ga-image"
						errorClass="qti-ga-image qti-ga-image-error"
						mediaPart="image"
						errorPart="image-error"
						loadErrorText={translate(i18n, 'interactions.graphicAssociate.imageLoadError', 'The image could not be loaded.')}
						onImageError={warnImageFailed}
						sizing="refuse"
						bind:width={imageWidth}
						bind:height={imageHeight}
						bind:failed={imageFailed}
						bind:awaiting={awaitingNaturalSize}
					>

					{#if hasImageDimensions}
					<!-- The hotspots on the image, each in its real shape (QTI 3.0 §5.7.5–5.7.6: the
					     area its shape and coords describe) with its state: a light halo under the
					     outline keeps it visible on any image. Visual only — default-shape hotspots
					     (the whole image) first, beneath the others. -->
					<svg
						part="areas"
						class="qti-ga-areas"
						viewBox="0 0 {imageWidth} {imageHeight}"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
						pointer-events="none"
						data-disabled={canInteract ? undefined : ''}
					>
						{#each areaOrder as { hotspot } (hotspot.identifier)}
							<g
								class="qti-ga-area"
								data-selected={isHotspotSelected(hotspot.identifier) ? '' : undefined}
								data-correct={isHotspotInCorrectPair(hotspot.identifier) && !isHotspotSelected(hotspot.identifier) ? '' : undefined}
								data-unavailable={isHotspotMaxed(hotspot.identifier) || blockedHotspots.has(hotspot.identifier) ? '' : undefined}
							>
								<HotspotShape shape={hotspot.shape} coords={hotspot.coords} interactive={false} presentation={{ class: 'qti-ga-area-halo' }} />
								<HotspotShape shape={hotspot.shape} coords={hotspot.coords} interactive={false} presentation={{ class: 'qti-ga-area-outline' }} />
							</g>
						{/each}
					</svg>
					{/if}

					{#if hasImageDimensions}
					<!-- SVG overlay for drawing connection lines (natural image coordinates, scales with the stage) -->
					<svg
						part="overlay"
						class="qti-ga-overlay"
						viewBox="0 0 {imageWidth} {imageHeight}"
						aria-hidden="true"
					>
						{#each pairs as pair}
							{@const [id1, id2] = pair.split(' ')}
							{@const hotspot1 = getHotspotById(id1)}
							{@const hotspot2 = getHotspotById(id2)}
							{#if hotspot1 && hotspot2}
								{@const center1 = hotspotCenter(hotspot1)}
								{@const center2 = hotspotCenter(hotspot2)}
								{@const isCorrect = isCorrectPair(id1, id2)}
								<line
									x1={center1.x}
									y1={center1.y}
									x2={center2.x}
									y2={center2.y}
									class="qti-ga-line {isCorrect ? 'qti-ga-line-correct' : ''}"
								/>
							{/if}
						{/each}
						{#if isShowingCorrect}
							{#each correctPairs as pair}
								{@const [id1, id2] = pair.split(' ')}
								{@const hotspot1 = getHotspotById(id1)}
								{@const hotspot2 = getHotspotById(id2)}
								{@const isInUserPairs = pairs.some((p) => p === pair || p === `${id2} ${id1}`)}
								{#if hotspot1 && hotspot2 && !isInUserPairs}
									{@const center1 = hotspotCenter(hotspot1)}
									{@const center2 = hotspotCenter(hotspot2)}
									<line
										x1={center1.x}
										y1={center1.y}
										x2={center2.x}
										y2={center2.y}
										class="qti-ga-line qti-ga-line-expected"
									/>
								{/if}
							{/each}
						{/if}
					</svg>
					{/if}

					<!-- The hotspot controls: one button per hotspot over its bounding box, for the
					     keyboard and assistive technology, with its focus indicator. The button takes
					     no pointer input itself; the shape drawn inside it does (HotspotShape, the
					     same geometry as the outline), so pointer input hits the real shape and the
					     press reaches the button. A small shape grows with the button's 24 px minimum.
					     Drawn only when the stage's pixel space is known: their boxes are percentages
					     of it. -->
					{#if hasImageDimensions}
					{#each parsedInteraction.associableHotspots as hotspot}
						{@const isSelected = isHotspotSelected(hotspot.identifier)}
						{@const isMaxed = isHotspotMaxed(hotspot.identifier)}
						{@const isBlocked = blockedHotspots.has(hotspot.identifier)}
						{@const usageCount = getHotspotUsageCount(hotspot.identifier)}
						{@const isCorrect = isHotspotInCorrectPair(hotspot.identifier)}
						<!-- A maxed hotspot stays focusable: the disabled property would remove the
						     very control the candidate just activated from under their focus;
						     aria-disabled plus the handler's refusal guard instead. -->
						<button
							type="button"
							part="hotspot"
							class="qti-ga-hotspot qti-graphic-control"
							class:qti-ga-hotspot-round={hotspot.shape === 'circle' || hotspot.shape === 'ellipse'}
							class:qti-ga-hotspot-default={hotspot.shape === 'default'}
							class:qti-ga-hotspot-selected={isSelected}
							class:qti-ga-hotspot-correct={isCorrect && !isSelected}
							class:qti-ga-hotspot-unavailable={isMaxed || isBlocked}
							style={hotspotBoxStyle(hotspot)}
							onclick={() => handleHotspotClick(hotspot.identifier)}
							disabled={!canInteract}
							aria-disabled={!canInteract || isMaxed || isBlocked ? 'true' : undefined}
							aria-pressed={isSelected}
							aria-label={hotspotAriaLabel(hotspot, usageCount, isCorrect, isBlocked)}
						>
							<svg
								class="qti-ga-hit"
								viewBox={hitViewBox(hotspot)}
								preserveAspectRatio="none"
								xmlns="http://www.w3.org/2000/svg"
								aria-hidden="true"
							>
								<HotspotShape
									shape={hotspot.shape}
									coords={hotspot.coords}
									interactive={false}
									presentation={{ class: 'qti-ga-hit-area', 'pointer-events': 'visiblePainted' }}
								/>
							</svg>
							<span class="qti-ga-hotspot-label" aria-hidden="true">
								{#if isSelected}<span class="qti-ga-hotspot-check">✓</span>{/if}{hotspotName(hotspot)}
							</span>
						</button>
					{/each}
					{/if}
					</ImageStage>
				</div>
				{#if imageDescription}
					<p id={imageDescriptionId} class="qti-ga-sr-only">{imageDescription}</p>
				{/if}

				{#if selectedHotspot}
					<div class="alert alert-info mt-2" role="status">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							part="selected-icon"
							class="qti-icon stroke-current shrink-0 w-6 h-6"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<span>{translate(i18n, 'interactions.graphicAssociate.selectAnotherHotspot', 'Selected: {label}. Select another hotspot to create an association.', {
							label: hotspotNameById(selectedHotspot),
						})}</span>
					</div>
				{/if}
			</div>

			<!-- Associations List -->
			<div part="panel" class="qti-ga-panel w-full lg:w-80">
				<div class="qti-ga-card card bg-base-100 border border-base-300">
					<div class="qti-ga-card-body card-body p-4">
						<h3 class="card-title text-sm">
							{parsedInteraction.maxAssociations > 0
								? translate(i18n, 'interactions.graphicAssociate.associationsCount', 'Associations ({count}/{max})', {
										count: pairs.length,
										max: parsedInteraction.maxAssociations,
									})
								: translate(i18n, 'interactions.graphicAssociate.associationsCountUnlimited', 'Associations ({count})', {
										count: pairs.length,
									})}
						</h3>

						{#if pairs.length === 0}
							<p class="text-sm text-base-content/60">
								{translate(
									i18n,
									'interactions.graphicAssociate.clickHotspotsToAssociate',
									'Select two hotspots on the image to create an association.',
								)}
							</p>
						{:else}
							<ul class="qti-ga-pairs space-y-2">
								{#each pairs as pair, index}
									{@const [id1, id2] = pair.split(' ')}
									{@const isCorrect = isCorrectPair(id1, id2)}
									{@const first = hotspotNameById(id1)}
									{@const second = hotspotNameById(id2)}
									<li
										class="qti-ga-pair flex items-center gap-2 p-2 rounded-lg bg-base-200 border border-base-300"
										class:qti-ga-pair-correct={isCorrect}
									>
										<span class="badge badge-sm {isCorrect ? 'badge-success' : 'badge-primary'}" aria-hidden="true">{isCorrect ? '✓' : index + 1}</span>
										<span class="flex-1 text-sm">
											<span class="qti-ga-sr-only">
												{joinSentences(
													translate(i18n, 'accessibility.sentence', '{text}.', {
														text: translate(i18n, 'interactions.graphicAssociate.pairDescription', '{first} associated with {second}', { first, second }),
													}),
													isCorrect && translate(i18n, 'accessibility.correctAnswer', 'Correct answer.'),
												)}
											</span>
											<span aria-hidden="true">
												<span class="font-medium">{first}</span>
												<span class="qti-ga-pair-arrow">↔</span>
												<span class="font-medium">{second}</span>
											</span>
										</span>
										{#if canInteract}
											<button
												type="button"
												part="association-remove"
												class="qti-ga-remove btn btn-xs btn-ghost btn-circle"
												onclick={() => removePair(index)}
												aria-label={translate(i18n, 'interactions.graphicAssociate.removeAssociation', 'Remove association between {first} and {second}', { first, second })}
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													part="remove-icon"
													class="qti-icon-sm h-4 w-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													aria-hidden="true"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</button>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}

						{#if parsedInteraction.minAssociations > 0}
							<div class="text-xs text-base-content/60 mt-2">
								{translate(i18n, 'interactions.graphicAssociate.minimumRequired', 'Minimum required: {minAssociations}', {
									minAssociations: parsedInteraction.minAssociations,
								})}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
		<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(pairs)} />
	{/if}
</div>

<style>
	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex: 0 0 auto;
	}
	.qti-icon-sm {
		width: 1rem;
		height: 1rem;
		flex: 0 0 auto;
	}

	/* Minimal layout so this works without Tailwind utilities */
	.qti-ga-layout {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.qti-ga-image-area {
		flex: 1 1 520px;
		min-width: min(280px, 100%);
	}
	/* The stage frame fills the available width up to the image's natural size (+ its border).
	   No overflow clipping: focus rings and grown hit areas at the image edge must stay visible. */
	.qti-ga-stage {
		position: relative;
		width: 100%;
		box-sizing: border-box;
		border-radius: 0.75rem;
		border: 2px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}
	/* Critical: overlay must be absolutely positioned even without Tailwind utilities */
	.qti-ga-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 10;
	}
	.qti-ga-line {
		stroke: var(--pie-qti-primary, oklch(45% 0.24 277));
		stroke-width: 3px;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
	.qti-ga-line-correct {
		stroke: var(--pie-qti-success-text, #15803d);
		stroke-width: 4px;
	}
	.qti-ga-line-expected {
		stroke: var(--pie-qti-success-text, #15803d);
		stroke-width: 2px;
		stroke-dasharray: 4px 4px;
	}

	/*
	 * The hotspots on the image, in their real shapes (the outlines; the buttons below take the
	 * pointer). A light halo under a dark outline keeps each boundary visible on any image
	 * (WCAG 1.4.11).
	 */
	.qti-ga-areas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
		z-index: 5;
	}
	.qti-ga-areas :global(.qti-ga-area-halo) {
		fill: none;
		stroke: #fff;
		stroke-width: 5px;
		vector-effect: non-scaling-stroke;
	}
	.qti-ga-areas :global(.qti-ga-area-outline) {
		fill: none;
		stroke: var(--pie-qti-border-strong, #767676);
		stroke-width: 2px;
		vector-effect: non-scaling-stroke;
	}
	/* Selected: a thicker outline (and a check on the label) — never colour alone (WCAG 1.4.1) */
	.qti-ga-areas :global(.qti-ga-area[data-selected] .qti-ga-area-outline) {
		stroke: var(--pie-qti-primary, oklch(45% 0.24 277));
		stroke-width: 4px;
	}
	.qti-ga-areas :global(.qti-ga-area[data-selected] .qti-ga-area-halo) {
		stroke-width: 8px;
	}
	/* Correct answer (scorer view): dashed success outline */
	.qti-ga-areas :global(.qti-ga-area[data-correct] .qti-ga-area-outline) {
		stroke: var(--pie-qti-success-text, #15803d);
		stroke-dasharray: 6px 3px;
		stroke-width: 3px;
	}
	.qti-ga-areas :global(.qti-ga-area[data-unavailable]),
	.qti-ga-areas[data-disabled] :global(.qti-ga-area) {
		opacity: 0.6;
	}

	/*
	 * Hotspot buttons: centred on their region's bounding box (positions are percentages of the
	 * natural image), never smaller than the 24×24 CSS px target minimum. Visually only their
	 * label and focus indicator: the button takes no pointer input (inline pointer-events: none);
	 * the shape inside it does, its viewBox the bounding box stretched over the button, so a small
	 * shape grows with the button's minimum. A default-shape hotspot lies beneath the others.
	 */
	.qti-ga-hotspot {
		position: absolute;
		z-index: 20;
		transform: translate(-50%, -50%);
		min-width: 24px;
		min-height: 24px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		margin: 0;
		border: 0;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--pie-qti-base-content, #1f2937);
		font: inherit;
	}
	.qti-ga-hotspot-default {
		z-index: 15;
	}
	.qti-ga-hotspot-round {
		border-radius: 50%;
	}
	.qti-ga-hit {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.qti-ga-hit :global(.qti-ga-hit-area) {
		fill: color-mix(in srgb, var(--pie-qti-primary, #4338ca) 10%, transparent);
		stroke: none;
		cursor: pointer;
		transition: fill 120ms ease;
	}
	.qti-ga-hotspot:hover:not(:disabled) :global(.qti-ga-hit-area) {
		fill: color-mix(in srgb, var(--pie-qti-primary, #4338ca) 22%, transparent);
	}
	.qti-ga-hotspot-selected :global(.qti-ga-hit-area) {
		fill: color-mix(in srgb, var(--pie-qti-primary, #4338ca) 35%, transparent);
	}
	/* Focus: the shared offset outline ring in ImageStage's sheet (WCAG 2.4.7). */
	.qti-ga-hotspot-unavailable :global(.qti-ga-hit-area),
	.qti-ga-hotspot:disabled :global(.qti-ga-hit-area),
	.qti-ga-hotspot[aria-disabled='true'] :global(.qti-ga-hit-area) {
		cursor: not-allowed;
	}
	.qti-ga-hotspot-unavailable,
	.qti-ga-hotspot:disabled,
	.qti-ga-hotspot[aria-disabled='true'] {
		opacity: 0.6;
	}

	/* Visually hidden live region, self-contained so it hides without Tailwind. */
	.qti-ga-live-region {
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
	/* Above the hit-area SVG in the button; takes no pointer input (inherited). */
	.qti-ga-hotspot-label {
		position: relative;
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1.1;
		padding: 0 0.125rem;
		background: var(--pie-qti-base-100, #fff);
		border-radius: 0.25rem;
		color: var(--pie-qti-base-content, #1f2937);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
	.qti-ga-hotspot-selected .qti-ga-hotspot-label {
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		color: #fff;
	}
	.qti-ga-hotspot-check {
		margin-inline-end: 0.125rem;
	}
	.qti-ga-panel {
		flex: 0 0 20rem;
		min-width: min(18rem, 100%);
	}
	.qti-ga-card {
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}
	.qti-ga-card-body {
		padding: 1rem;
	}
	.qti-ga-pairs {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.qti-ga-pair-correct {
		border-color: var(--pie-qti-success-text, #15803d);
	}
	.qti-ga-pair-arrow {
		margin-inline: 0.25rem;
	}
	.qti-ga-remove {
		min-width: 24px;
		min-height: 24px;
	}
	.qti-ga-remove:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.qti-ga-sr-only {
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
