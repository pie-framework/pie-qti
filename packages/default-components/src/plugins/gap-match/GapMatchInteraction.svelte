<svelte:options customElement="pie-qti-gap-match" />

<script lang="ts">
	import type { GapMatchInteractionData, HtmlContent, PlayerSecurityConfig } from '@pie-qti/item-player';
	import type { InteractionProps } from '../../shared/utils/interactionProps';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { normalizeCssPixelLength, sanitizeSharedHtml } from '@pie-qti/item-player/security';
	import { formatList, joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import { tick } from 'svelte';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { exceedsLimit, isAtLimit, limitMessage } from '../../shared/utils/capacity';
	import { isCompatibleMatchGroup, matchGroupBlockedIds, type MatchGroupBearer } from '../../shared/utils/matchGroupUtils';
	import { choiceAccessibleName } from '../../shared/utils/choiceName';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import {
		countPairsForSource,
		getSourceForTarget,
		placeSourceOnTarget,
		removePairBySource,
	} from '../../shared/utils/pairHelpers';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { createPickUpPlace } from '../../shared/components/pickUpPlace.svelte';

	interface Props extends InteractionProps<'gapMatchInteraction', string[]> {
		security?: PlayerSecurityConfig;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), security, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage). Correct-answer mode is the
	// scorer's view of an item that has a correct response (the shared shell's rule).
	const shell = $derived(
		createInteractionShell<GapMatchInteractionData, string[], string[]>({ interaction, response, correctResponse, role, listResponse: true }),
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);
	const choicesContainerWidth = $derived(
		normalizeCssPixelLength(parsedInteraction?.choicesContainerWidth),
	);

	const pairs = $derived(Array.isArray(parsedResponse) ? parsedResponse : []);
	const correctPairs = $derived(Array.isArray(parsedCorrectResponse) ? parsedCorrectResponse : []);

	// K-02: the word "held" in the pick-up flow, and the word a pointer drag carries: its data
	// is unreadable during dragover, so the gaps that refuse it (matchGroup) are known from here.
	const pickUp = createPickUpPlace();

	// K-02: live region message for screen reader announcements
	let liveMessage: string = $state('');

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Gap currently under a drag operation (drives the drag-over highlight)
	let dragOverGap: string | null = $state(null);

	/**
	 * The prompt, split on the extractor's `[GAP:id]` text markers so each gap renders as a live
	 * control between sanitized HTML segments. Each segment is sanitized and handed to the
	 * `{@html}` sink independently: every sink call stays policy-checked, so the Trusted Types
	 * guarantee holds without post-egress string surgery on sanitized markup.
	 */
	type PromptSegment = { html: HtmlContent; gapId?: string };

	const promptSegments = $derived.by((): PromptSegment[] => {
		const source = parsedInteraction?.promptText;
		if (typeof source !== 'string') {
			// TrustedHTML (or null) cannot be marker-split as a string; it renders whole, without live gaps.
			return source ? [{ html: source }] : [];
		}
		const segments: PromptSegment[] = [];
		const marker = /\[GAP:([^\]]+)\]/g;
		let cursor = 0;
		let match: RegExpExecArray | null;
		while ((match = marker.exec(source))) {
			if (match.index > cursor) segments.push({ html: sanitizeSharedHtml(source.slice(cursor, match.index), security) });
			segments.push({ html: '', gapId: match[1] ?? '' });
			cursor = match.index + match[0].length;
		}
		if (cursor < source.length) segments.push({ html: sanitizeSharedHtml(source.slice(cursor), security) });
		return segments;
	});

	/** 1-based position of each gap in reading order, for localized-ordinal names. */
	const gapPositions = $derived.by(() => {
		const positions = new Map<string, number>();
		let count = 0;
		for (const segment of promptSegments) {
			if (segment.gapId && !positions.has(segment.gapId)) positions.set(segment.gapId, (count += 1));
		}
		return { positions, total: count };
	});

	/**
	 * Gaps authored `required` (QTI 2.1 gap; QTI 3.0 §5.55.5): a valid response fills each of
	 * them, which response validation enforces, so the candidate is told which ones (WCAG
	 * 3.3.2). Each shows a visible mark — a character a legend explains, not a colour alone —
	 * and, since a gap is a button and `aria-required` is not allowed on that role, states
	 * the requirement as its accessible description.
	 */
	const requiredGapIds = $derived(new Set(parsedInteraction?.requiredGaps ?? []));
	const requiredDescription = $derived(
		translate(i18n, 'accessibility.sentence', '{text}.', { text: translate(i18n, 'common.required', 'Required') }),
	);

	/** The id of a required gap's description: per instance, and by position, so any identifier is safe. */
	function requiredDescriptionId(gapId: string): string {
		return `${uid}-gap-${gapPositions.positions.get(gapId) ?? 0}-required`;
	}

	/**
	 * The draggable pool: gapText words and gapImg image tiles share one identifier
	 * space and one set of placement rules, so everything downstream (palette,
	 * drop handling, pick-up flow, matchMax/matchGroup constraints) works on this
	 * combined list. Image choices are named by their alt text; a word or image
	 * whose content carries no readable text is named by its presented position in
	 * the palette ("Choice 3"), never by its identifier, which is meaningless and
	 * potentially answer-leaking to candidates using a screen reader.
	 */
	type PaletteWord = {
		identifier: string;
		kind: 'text' | 'image';
		/** Readable name: gapText content, the image's alt text, else a localized ordinal. */
		name: string;
		src?: string;
		width?: number;
		height?: number;
		matchMax: number;
		/** Gaps this choice must fill at least (QTI matchMin); absent means none. */
		matchMin?: number;
		matchGroup?: string[];
	};

	const paletteWords = $derived.by((): PaletteWord[] => {
		const interaction = parsedInteraction;
		if (!interaction) return [];
		const words: PaletteWord[] = (interaction.gapTexts ?? []).map((gapText) => ({
			identifier: gapText.identifier,
			kind: 'text' as const,
			name: gapText.text,
			matchMax: gapText.matchMax,
			...(gapText.matchMin ? { matchMin: gapText.matchMin } : {}),
			...(gapText.matchGroup ? { matchGroup: gapText.matchGroup } : {}),
		}));
		for (const gapImage of interaction.gapImages ?? []) {
			words.push({
				identifier: gapImage.identifier,
				kind: 'image',
				// The image's alt text names it; the gapImg's authored objectLabel stands
				// in when the image carries none (QTI objectLabel / object-label).
				name: gapImage.alt || gapImage.objectLabel || '',
				src: gapImage.src,
				...(gapImage.width !== undefined ? { width: gapImage.width } : {}),
				...(gapImage.height !== undefined ? { height: gapImage.height } : {}),
				matchMax: gapImage.matchMax,
				...(gapImage.matchMin ? { matchMin: gapImage.matchMin } : {}),
				...(gapImage.matchGroup ? { matchGroup: gapImage.matchGroup } : {}),
			});
		}
		// Content-less words take the ordinal of their palette position (1-based, as
		// presented after shuffle); an authored name passes through unchanged.
		words.forEach((word, index) => {
			word.name = choiceAccessibleName({ i18n, label: word.name, position: index + 1 });
		});
		return words;
	});

	/**
	 * Minimum requirement (each choice's matchMin): the choices the response does not place
	 * often enough yet, the minimum response validation enforces, are named on the question;
	 * the author's message wins. It describes the word palette. Only while the candidate can
	 * still answer.
	 */
	const uid = $props.id();
	const minHintId = `${uid}-min-hint`;
	const wordsShortOfMinimum = $derived(
		paletteWords.filter(
			(word) => (word.matchMin ?? 0) > 0 && countPairsForSource(pairs, word.identifier) < (word.matchMin ?? 0),
		),
	);
	const minHint = $derived.by(() => {
		if (disabled || role !== 'candidate' || wordsShortOfMinimum.length === 0) return '';
		return (
			parsedInteraction?.minSelectionsMessage?.trim() ||
			translate(i18n, 'interactions.gapMatch.minPlacementsHint', 'Still to place in the blanks: {words}.', {
				words: formatList(
					i18n,
					wordsShortOfMinimum.map((word) => word.name),
				),
			})
		);
	});

	/** A gap as a pairing target: its identifier and its authored matchGroup. */
	function gapBearer(gapId: string): MatchGroupBearer {
		return { identifier: gapId, matchGroup: parsedInteraction?.gapMatchGroups?.[gapId] };
	}

	/**
	 * Whether `matchGroup` lets a word go into a gap: the word's `matchGroup` names the gaps
	 * it may fill and the gap's names the words it accepts, read by the same rule response
	 * validation applies (`isCompatibleMatchGroup`), so the UI and validation agree.
	 */
	function canPlaceWord(wordId: string, gapId: string): boolean {
		const word = paletteWords.find((w) => w.identifier === wordId);
		if (!word) return false;
		return isCompatibleMatchGroup(word, gapBearer(gapId));
	}

	// Gaps the dragged or held word may not fill (matchGroup); they stay focusable but are
	// marked unavailable, and refuse a drop. An active drag is what a drop would place.
	const blockedGapIds = $derived.by(() => {
		const wordId = pickUp.active;
		if (wordId === null) return new Set<string>();
		const gapIds = [...gapPositions.positions.keys()];
		const word = paletteWords.find((w) => w.identifier === wordId);
		// A word the palette does not have goes in no gap.
		if (!word) return new Set(gapIds);
		return matchGroupBlockedIds(word, gapIds.map(gapBearer));
	});

	function getMatchMax(wordId: string): number {
		const word = paletteWords.find((g) => g.identifier === wordId);
		return word?.matchMax ?? 1;
	}

	/** The interaction's `maxAssociations` (QTI: 0 means no restriction). */
	const maxAssociations = $derived(Number(parsedInteraction?.maxAssociations ?? 0));

	/** Announce a refused placement: the author's data-max-selections-message wins. */
	function announceAssociationLimit() {
		liveMessage = limitMessage(
			parsedInteraction?.maxSelectionsMessage,
			translate(i18n, 'interactions.gapMatch.associationLimitReached', 'Association not possible: the limit of {max} is reached.', {
				max: maxAssociations,
			}),
		);
	}

	/**
	 * Place `wordId` in `gapId`, or clear the gap when `wordId` is empty. Returns whether the
	 * response changed: a placement the gap refuses (matchGroup) or one past `maxAssociations`
	 * is refused, the latter announced, so an over-limit response never reaches the submit
	 * that would reject it.
	 */
	function handleGapChange(gapId: string, wordId: string): boolean {
		// matchGroup: refuse a placement the gap does not accept (clearing stays allowed).
		if (wordId && !canPlaceWord(wordId, gapId)) return false;

		// Each gap holds one word. A reusable word (matchMax=0, or below its matchMax) keeps its
		// other placements; a single-use word, or one at its matchMax, moves. An empty wordId
		// clears the gap.
		const newPairs = placeSourceOnTarget(pairs, wordId, gapId, getMatchMax(wordId));

		// maxAssociations: refuse a placement that would exceed the interaction's cap. Replacing
		// a gap's word or moving a single-use word keeps the count, so it is still allowed.
		if (wordId && exceedsLimit(newPairs.length, maxAssociations)) {
			announceAssociationLimit();
			return false;
		}

		response = newPairs;
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: newPairs, onChange });
		return true;
	}

	function isWordUsed(wordId: string): boolean {
		// matchMax=0 means unlimited: such a word is never "used".
		return isAtLimit(countPairsForSource(pairs, wordId), getMatchMax(wordId));
	}

	function getSelectedWord(gapId: string): string {
		return getSourceForTarget(pairs, gapId) ?? '';
	}

	function getCorrectWord(gapId: string): string {
		return getSourceForTarget(correctPairs, gapId) ?? '';
	}

	function isCorrectGap(gapId: string): boolean {
		return isShowingCorrect && getCorrectWord(gapId) !== '';
	}

	function getWordText(wordId: string): string {
		const word = paletteWords.find((w) => w.identifier === wordId);
		// An unknown id has no name to substitute: the identifier stays out of
		// announcements, as it stays out of every accessible name.
		return word?.name ?? '';
	}

	function onWordDragStart(e: DragEvent, wordId: string) {
		if (disabled) return;
		if (!e.dataTransfer) return;
		e.dataTransfer.setData('text/plain', wordId);
		e.dataTransfer.effectAllowed = 'move';
		pickUp.startDrag(wordId);
	}

	function onWordDragEnd() {
		pickUp.endDrag();
		dragOverGap = null;
	}

	function selectWord(wordId: string) {
		if (disabled || isWordUsed(wordId)) return;
		pickUp.toggle(wordId);
		const word = getWordText(wordId);
		liveMessage = pickUp.held
			? translate(i18n, 'interactions.gapMatch.wordSelected', '{word} picked up. Select a blank to place it, or press Escape to cancel.', { word })
			: translate(i18n, 'interactions.gapMatch.pickUpCancelled', 'Pick-up of {word} cancelled.', { word });
	}

	// K-02: global Escape handler to cancel pick-up from anywhere in the component.
	// Focus returns to the word that was held, since the gap it was hovering lost
	// its "ready" state and the word is what the user resumes from.
	function onRootKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		const wordId = pickUp.release();
		if (wordId === null) return;
		liveMessage = translate(i18n, 'interactions.gapMatch.pickUpCancelled', 'Pick-up of {word} cancelled.', {
			word: getWordText(wordId),
		});
		void tick().then(() => {
			const heldButton = Array.from(
				rootElement?.querySelectorAll<HTMLButtonElement>('[data-word-id]') ?? []
			).find((button) => button.dataset.wordId === wordId);
			heldButton?.focus();
		});
	}

	// Accessible name for a gap, composed with the held-word hint and correct-answer state.
	// Gaps are named with localized ordinals ("Blank 2 of 4"), never the raw QTI gap
	// identifier, which can leak the answer to screen reader users. Reading order puts
	// each inline gap in its sentence, so the surrounding context is already available
	// to assistive technology without a describedby copy of the whole passage.
	function gapAriaLabel(gapId: string): string {
		const selected = getSelectedWord(gapId);
		const correct = getCorrectWord(gapId);
		const isCorrect = isCorrectGap(gapId);
		const held = pickUp.held;
		// matchGroup: the held or dragged word may not go here.
		const notCompatible =
			blockedGapIds.has(gapId) &&
			translate(i18n, 'interactions.gapMatch.notCompatibleSentence', 'Not compatible with the selected word.');
		const ordinals = {
			position: gapPositions.positions.get(gapId) ?? 0,
			total: gapPositions.total,
		};
		if (selected) {
			const word = getWordText(selected);
			const label =
				held !== null
					? translate(
							i18n,
							'interactions.gapMatch.filledGapAriaLabelWithHeld',
							'Blank {position} of {total}, filled with {word}. Select to replace with {heldWord}.',
							{ ...ordinals, word, heldWord: getWordText(held) },
						)
					: translate(i18n, 'interactions.gapMatch.filledGapAriaLabel', 'Blank {position} of {total}, filled with {word}. Select to clear.', {
							...ordinals,
							word,
						});
			return joinSentences(label, notCompatible, isCorrect && translate(i18n, 'accessibility.correctAnswer', 'Correct answer.'));
		}
		const label =
			held !== null
				? translate(i18n, 'interactions.gapMatch.blankGapAriaLabelWithHeld', 'Blank {position} of {total}. Select to place {heldWord} here.', {
						...ordinals,
						heldWord: getWordText(held),
					})
				: translate(i18n, 'interactions.gapMatch.blankGapAriaLabel', 'Blank {position} of {total}. Drop an answer here.', ordinals);
		return joinSentences(
			label,
			notCompatible,
			isCorrect &&
				correct &&
				translate(i18n, 'accessibility.correctAnswerIs', 'Correct answer: {answer}.', { answer: getWordText(correct) }),
		);
	}

	function onGapDragOver(gapId: string, e: DragEvent) {
		if (disabled) return;
		// matchGroup: not a drop target for the dragged word; leave the browser's "no drop" feedback.
		if (blockedGapIds.has(gapId)) return;
		e.preventDefault();
		dragOverGap = gapId;
	}

	function onGapDragLeave(gapId: string) {
		if (dragOverGap === gapId) dragOverGap = null;
	}

	function onGapDrop(gapId: string, e: DragEvent) {
		if (disabled) return;
		e.preventDefault();
		dragOverGap = null;
		pickUp.endDrag();
		const wordId = e.dataTransfer?.getData('text/plain') ?? '';
		if (!wordId) return;
		// handleGapChange refuses a word the gap does not accept (matchGroup).
		handleGapChange(gapId, wordId);
	}

	function onGapClick(gapId: string) {
		if (disabled) return;
		// K-02: if a word is held, drop it into this gap. A refused placement keeps it held, so
		// the candidate can place it elsewhere (replacing a word) or cancel: matchGroup (this
		// gap does not accept the held word) and maxAssociations (announced by handleGapChange).
		if (pickUp.held !== null) {
			const placed = pickUp.place(gapId, (wordId) => {
				if (!canPlaceWord(wordId, gapId)) {
					liveMessage = translate(i18n, 'interactions.gapMatch.notCompatibleSentence', 'Not compatible with the selected word.');
					return false;
				}
				return handleGapChange(gapId, wordId);
			});
			if (placed === null) return;
			liveMessage = translate(i18n, 'interactions.gapMatch.placed', 'Placed {word} in blank {position} of {total}.', {
				word: getWordText(placed),
				position: gapPositions.positions.get(gapId) ?? 0,
				total: gapPositions.total,
			});
		} else {
			// No word held: clear this gap if it has a word
			const current = getSelectedWord(gapId);
			if (current) handleGapChange(gapId, '');
		}
	}

	async function clearWord(wordId: string) {
		if (disabled) return;
		const wordName = getWordText(wordId);
		const newPairs = removePairBySource(pairs, wordId);
		response = newPairs;
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: newPairs, onChange });
		// The removal is announced: the focused remove button vanishes with the placements,
		// so the live region is what tells assistive technology what just happened.
		liveMessage = translate(i18n, 'interactions.gapMatch.wordRemovedFromBlanks', '{word} removed from the blanks.', { word: wordName });
		// The remove button is gone, which would drop keyboard focus to the document.
		// Focus returns to the now-enabled word button instead.
		await tick();
		const wordButton = Array.from(rootElement?.querySelectorAll<HTMLButtonElement>('[data-word-id]') ?? []).find(
			(button) => button.dataset.wordId === wordId,
		);
		wordButton?.focus();
	}

</script>

<ShadowBaseStyles />

<!-- K-02: visually-hidden live region for screen reader announcements -->
<div
	aria-live="polite"
	aria-atomic="true"
	class="qti-gm-live-region"
>
	{liveMessage}
</div>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class={['qti-gap-match-interaction space-y-3', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')} onkeydown={onRootKeydown}>
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}

		<p>{i18n?.t('interactions.gapMatch.pointerInstructions') ?? 'Select a word, then select a blank. You can also drag and drop.'}</p>
		{#if requiredGapIds.size > 0}
			<p part="required-legend" class="qti-gm-required-legend">
				{translate(i18n, 'interactions.gapMatch.requiredBlanksLegend', 'Blanks marked * are required.')}
			</p>
		{/if}

		<div class="qti-gm-layout">
		<!-- Available gap texts (draggable words) -->
		<div
			part="palette"
			class="qti-gm-palette flex flex-wrap gap-2 p-4 bg-base-200 rounded-lg border-2 border-base-300"
			style={choicesContainerWidth ? `width: ${choicesContainerWidth}` : undefined}
			role="group"
			aria-label={i18n?.t('interactions.gapMatch.availableLabel') ?? 'Available words to place'}
			aria-describedby={minHint ? minHintId : undefined}
		>
			<div class="qti-gm-palette-title w-full text-sm text-base-content/70 font-semibold mb-2">
				{translate(i18n, 'interactions.gapMatch.availableHeading', 'Available words:')}
			</div>
			{#each paletteWords as word (word.identifier)}
				{@const used = isWordUsed(word.identifier)}
				{@const isHeld = pickUp.isHeld(word.identifier)}
				<div class="inline-flex items-center gap-1">
					<button
						part="word"
						type="button"
						class="btn btn-md font-medium transition-all"
						class:btn-primary={!used && !isHeld}
						class:btn-success={used && !isHeld}
						class:btn-warning={isHeld}
						class:qti-gm-word-held={isHeld}
						class:cursor-grab={!disabled && !used}
						class:cursor-not-allowed={disabled}
						class:opacity-70={disabled}
						data-word-id={word.identifier}
						draggable={!disabled && !used}
						aria-disabled={disabled || used}
						aria-pressed={isHeld}
						disabled={disabled || used}
						ondragstart={(e: DragEvent) => onWordDragStart(e, word.identifier)}
						ondragend={onWordDragEnd}
						onclick={() => selectWord(word.identifier)}
						aria-label={word.name}
					>
						{#if word.kind === 'image'}
							<!-- alt="" on the tile: the button's aria-label is the image's alt text. -->
							<img class="qti-gm-word-img" src={word.src} alt="" width={word.width} height={word.height} />
						{:else}
							{word.name}
						{/if}
					</button>
					{#if used && !disabled}
						<button
							type="button"
							part="word-remove"
							class="qti-gm-word-remove btn btn-sm btn-circle btn-error"
							onclick={() => clearWord(word.identifier)}
							aria-label={translate(i18n, 'interactions.gapMatch.removeFromBlanks', 'Remove {word} from the blanks', { word: word.name })}
							title={i18n?.t('interactions.gapMatch.removeWord') ?? 'Remove word'}
						>
							✕
						</button>
					{/if}
				</div>
			{/each}
		</div>

	{#snippet gapButton(gapId: string)}
		{@const selected = getSelectedWord(gapId)}
		{@const showCorrect = isCorrectGap(gapId)}
		{@const showWord = selected || (showCorrect ? getCorrectWord(gapId) : '')}
		{@const shownWord = showWord === '' ? null : paletteWords.find((w) => w.identifier === showWord)}
		{@const required = requiredGapIds.has(gapId)}
		<button
			part="gap"
			type="button"
			data-gap-id={gapId}
			class="qti-gm-gap-target select select-bordered select-sm"
			class:qti-gm-gap-correct={showCorrect}
			class:qti-gm-gap-ready={pickUp.held !== null && !blockedGapIds.has(gapId)}
			class:is-dragover={dragOverGap === gapId}
			data-empty={showWord === '' ? 'true' : undefined}
			data-required={required ? 'true' : undefined}
			aria-disabled={disabled || blockedGapIds.has(gapId) ? 'true' : undefined}
			aria-label={gapAriaLabel(gapId)}
			aria-describedby={required ? requiredDescriptionId(gapId) : undefined}
			ondragover={(e: DragEvent) => onGapDragOver(gapId, e)}
			ondragleave={() => onGapDragLeave(gapId)}
			ondrop={(e: DragEvent) => onGapDrop(gapId, e)}
			onclick={() => onGapClick(gapId)}
		>
			{#if shownWord?.kind === 'image'}
				<img class="qti-gm-gap-img" src={shownWord.src} alt="" width={shownWord.width} height={shownWord.height} />
			{:else}
				{showWord === '' ? '' : getWordText(showWord)}
			{/if}{#if required}<span class="qti-gm-gap-required-mark" aria-hidden="true">*</span>{/if}
		</button>
		{#if required}
			<!-- Hidden, yet still the gap's description (aria-describedby reads hidden text), so
			     reading the sentence does not say it twice. -->
			<span id={requiredDescriptionId(gapId)} hidden>{requiredDescription}</span>
		{/if}
	{/snippet}
	{#if promptSegments.length > 0}
		<!-- The prompt with live gap controls, rendered once. The extractor's promptText IS the
		     prompt with <gap> elements rewritten to [GAP:id] markers; rendering `prompt` as well
		     would show the sentence twice, once with dead markers. -->
		<div part="text" class="qti-gm-text qti-rich-content p-4 bg-base-100 border border-base-300 rounded">
			<div class="qti-gm-inline">
				{#each promptSegments as seg, i (i)}
					{#if seg.gapId}{@render gapButton(seg.gapId)}{:else}{@html seg.html}{/if}
				{/each}
			</div>
		</div>
	{:else if parsedInteraction.prompt}
		<!-- No marker text available (e.g. hand-built data): fall back to the static prompt. -->
		<div part="prompt" class="qti-gm-prompt qti-rich-content font-semibold">
			{@html parsedInteraction.prompt}
		</div>
	{/if}
		</div>
		<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(pairs)} />
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-gap-match-interaction {
		display: grid;
		gap: 0.75rem;
	}
	.qti-gm-prompt {
		margin: 0;
	}
	/* qti-choices-top|bottom|left|right: the word palette's side of the text; top by default */
	.qti-gm-layout {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.qti-gap-match-interaction.qti-choices-bottom .qti-gm-layout { flex-direction: column-reverse; }
	.qti-gap-match-interaction.qti-choices-left .qti-gm-layout { flex-direction: row; }
	.qti-gap-match-interaction.qti-choices-right .qti-gm-layout { flex-direction: row-reverse; }
	.qti-gap-match-interaction:is(.qti-choices-left, .qti-choices-right) .qti-gm-palette {
		flex: 0 0 auto;
		max-width: 40%;
		align-content: flex-start;
	}
	.qti-gap-match-interaction:is(.qti-choices-left, .qti-choices-right) .qti-gm-text {
		flex: 1 1 0;
		min-width: 0;
	}
	.qti-gm-palette {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 0.75rem;
		border: 2px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		align-items: center;
	}
	.qti-gm-text {
		padding: 1rem;
		border-radius: 0.75rem;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}
	:global(.qti-gm-gap-target) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 6.25rem;
		/* K-12 target size: the blanks are this interaction's primary targets
		   (WCAG 2.5.8 minimum is 24px; primary controls aim at 44px). */
		min-height: 2.75rem;
		margin: 0 0.25rem;
		/* Height/padding/border/background should come from DaisyUI `select select-sm`
		   (or ShadowBaseStyles fallback), so empty and filled gaps match exactly. */
		font: inherit;
		vertical-align: baseline;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			box-shadow 120ms ease,
			background-color 120ms ease;
	}
	:global(.qti-gm-gap-target[data-empty='true']) {
		/* Same size + base styling as a filled gap, but dashed to indicate "drop here".
		   1.4.11: the blank's boundary is a control boundary and needs 3:1, which a
		   washed-out base-300 blend cannot provide on the page background. */
		border-style: dashed;
		border-color: var(--pie-qti-border-strong, #767676);
	}
	:global(.qti-gm-gap-target[data-empty='true']::before) {
		/* Ensure empty gaps reserve the same line-height as filled gaps (no visible text). */
		content: '\00a0';
	}
	/* Required gap (QTI gap `required`): an asterisk, which the legend explains, so the cue is
	   a character and not a colour alone (WCAG 1.4.1); the text token keeps it at 4.5:1. */
	.qti-gm-gap-required-mark {
		margin-inline-start: 0.125rem;
		font-weight: 700;
		color: var(--pie-qti-error-text, #b91c1c);
	}
	.qti-gm-required-legend {
		margin: 0;
		font-size: 0.875rem;
	}
	:global(.qti-gm-gap-target.is-dragover) {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		box-shadow:
			0 0 0 3px color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 28%, transparent),
			inset 0 -2px 0 var(--pie-qti-base-300, oklch(95% 0 0));
		background: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 8%, transparent);
	}
	:global(.qti-gm-gap-target[aria-disabled='true']) {
		opacity: 0.6;
		cursor: not-allowed;
	}
	:global(.qti-gm-gap-target.qti-gm-gap-correct) {
		border-color: var(--pie-qti-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 8%, transparent);
	}
	/* K-02: "ready to receive" visual for gap targets when a word is held */
	:global(.qti-gm-gap-target.qti-gm-gap-ready) {
		border-style: dashed;
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 22%, transparent);
	}
	:global(.qti-gm-gap-target:focus-visible) {
		/* No alpha: a 50% primary ring measures 2.64:1, below the 3:1 focus indicator. */
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	:global(.qti-gm-gap-target:hover) {
		border-color: color-mix(
			in oklch,
			var(--pie-qti-primary, oklch(45% 0.24 277)) 22%,
			var(--pie-qti-base-300, oklch(95% 0 0))
		);
	}
	.qti-gm-palette [part='word'][aria-disabled='true'] {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.qti-gm-palette [part='word'][draggable='true'] {
		cursor: grab;
	}
	.qti-gm-palette [part='word'][draggable='true']:active {
		cursor: grabbing;
	}
	/* K-02: "held" visual for the picked-up word button. 1.4.11: warning yellow
	   reads 1.68:1 against the palette; a control-state cue needs 3:1. */
	:global(.qti-gm-word-held) {
		outline: 3px solid var(--pie-qti-border-strong, #767676);
		outline-offset: 2px;
	}
	/* Image choice tiles in the palette and inside filled gaps. */
	:global(.qti-gm-word-img),
	:global(.qti-gm-gap-img) {
		max-height: 2rem;
		width: auto;
		display: block;
	}
	/* K-12 target size for the per-word clear button (matches the match clear button). */
	:global(.qti-gm-word-remove) {
		width: 2.75rem;
		height: 2.75rem;
		font-size: 1rem;
	}
</style>
