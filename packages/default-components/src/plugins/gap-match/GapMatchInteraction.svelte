<svelte:options customElement="pie-qti-gap-match" />

<script lang="ts">
	import type { GapMatchInteractionData, HtmlContent, PlayerSecurityConfig } from '@pie-qti/item-player';
	import { normalizeCssPixelLength, sanitizeSharedHtml } from '@pie-qti/item-player/security';
	import { joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { isCompatibleMatchGroup } from '../../shared/utils/matchGroupUtils';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';

	interface Props {
		interaction?: GapMatchInteractionData | string;
		response?: string[];
		correctResponse?: string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), security, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<GapMatchInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);
	const choicesContainerWidth = $derived(
		normalizeCssPixelLength(parsedInteraction?.choicesContainerWidth),
	);

	const pairs = $derived(Array.isArray(parsedResponse) ? parsedResponse : []);
	const correctPairs = $derived(Array.isArray(parsedCorrectResponse) ? parsedCorrectResponse : []);

	// K-02: identifier of the word currently "held" in the keyboard pick-up flow
	let pickedUpWord: string | null = $state(null);

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

	// Words that cannot be placed because they share a matchGroup with an already-placed word
	const unavailableWords = $derived.by(() => {
		if (!parsedInteraction) return new Set<string>();
		const placedGroups = new Set<string>();
		for (const pair of pairs) {
			const wordId = pair.split(' ')[0];
			const gt = parsedInteraction.gapTexts.find((g) => g.identifier === wordId);
			gt?.matchGroup?.forEach((g) => placedGroups.add(g));
		}
		return new Set(
			parsedInteraction.gapTexts
				.filter((gt) => {
					const isPlaced = pairs.some((p) => p.startsWith(`${gt.identifier} `));
					if (isPlaced) return false;
					return gt.matchGroup?.some((g) => placedGroups.has(g)) ?? false;
				})
				.map((gt) => gt.identifier)
		);
	});

	function getMatchMax(wordId: string): number {
		const gt = parsedInteraction?.gapTexts?.find((g) => g.identifier === wordId);
		return gt?.matchMax ?? 1;
	}

	function handleGapChange(gapId: string, wordId: string) {
		// Remove any existing pair for this gap (each gap holds one word)
		let newPairs = pairs.filter((p: string) => !p.endsWith(` ${gapId}`));

		// For reusable words (matchMax=0 or >1): don't remove other placements. For matchMax=1: move the word.
		const matchMax = getMatchMax(wordId);
		const currentCount = newPairs.filter((p: string) => p.startsWith(`${wordId} `)).length;
		if (matchMax === 1 || (matchMax > 0 && currentCount >= matchMax)) {
			// Single-use or at limit: remove this word from other gaps (move)
			newPairs = newPairs.filter((p: string) => !p.startsWith(`${wordId} `));
		}

		// Add new pair if a word was selected
		if (wordId) {
			const newPair = `${wordId} ${gapId}`;
			if (!newPairs.includes(newPair)) {
				newPairs.push(newPair);
			}
		}

		response = newPairs;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(newPairs);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, newPairs));
		}
	}

	function isWordUsed(wordId: string): boolean {
		const matchMax = getMatchMax(wordId);
		const count = pairs.filter((p: string) => p.startsWith(`${wordId} `)).length;
		return matchMax > 0 ? count >= matchMax : false; // matchMax=0 means unlimited, never "used"
	}

	function getSelectedWord(gapId: string): string {
		const pair = pairs.find((p: string) => p.endsWith(` ${gapId}`));
		return pair ? pair.split(' ')[0] : '';
	}

	function getCorrectWord(gapId: string): string {
		const pair = correctPairs.find((p: string) => p.endsWith(` ${gapId}`));
		return pair ? pair.split(' ')[0] : '';
	}

	function isCorrectGap(gapId: string): boolean {
		return isShowingCorrect && getCorrectWord(gapId) !== '';
	}

	function getWordText(wordId: string): string {
		const w = parsedInteraction?.gapTexts?.find((gt) => gt.identifier === wordId);
		return w?.text ?? wordId;
	}

	function onWordDragStart(e: DragEvent, wordId: string) {
		if (disabled) return;
		if (!e.dataTransfer) return;
		e.dataTransfer.setData('text/plain', wordId);
		e.dataTransfer.effectAllowed = 'move';
	}

	function selectWord(wordId: string) {
		if (disabled || isWordUsed(wordId) || unavailableWords.has(wordId)) return;
		pickedUpWord = pickedUpWord === wordId ? null : wordId;
		const item = getWordText(wordId);
		liveMessage = pickedUpWord
			? (i18n?.t('interactions.match.selected', { item }) ?? `${item} selected`)
			: (i18n?.t('common.selectionCancelled') ?? 'Selection cancelled');
	}

	// K-02: global Escape handler to cancel pick-up from anywhere in the component
	function onRootKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && pickedUpWord !== null) {
			pickedUpWord = null;
			liveMessage = i18n?.t('common.selectionCancelled') ?? 'Pick-up cancelled.';
		}
	}

	// Accessible name for a gap, composed with the held-word hint and correct-answer state.
	function gapAriaLabel(gapId: string): string {
		const selected = getSelectedWord(gapId);
		const correct = getCorrectWord(gapId);
		const isCorrect = isCorrectGap(gapId);
		if (selected) {
			const word = getWordText(selected);
			const label =
				pickedUpWord !== null
					? translate(
							i18n,
							'interactions.gapMatch.filledGapAriaLabelWithHeld',
							'Blank {gapId}, filled with {word}. Select to replace with {heldWord}.',
							{ gapId, word, heldWord: getWordText(pickedUpWord) },
						)
					: translate(i18n, 'interactions.gapMatch.filledGapAriaLabel', 'Blank {gapId}, filled with {word}. Click to clear.', {
							gapId,
							word,
						});
			return joinSentences(label, isCorrect && translate(i18n, 'accessibility.correctAnswer', 'Correct answer.'));
		}
		const label =
			pickedUpWord !== null
				? translate(i18n, 'interactions.gapMatch.blankGapAriaLabelWithHeld', 'Blank {gapId}. Select to place {heldWord} here.', {
						gapId,
						heldWord: getWordText(pickedUpWord),
					})
				: translate(i18n, 'interactions.gapMatch.blankGapAriaLabel', 'Blank {gapId}. Drop an answer here.', { gapId });
		return joinSentences(
			label,
			isCorrect &&
				correct &&
				translate(i18n, 'accessibility.correctAnswerIs', 'Correct answer: {answer}.', { answer: getWordText(correct) }),
		);
	}

	function onGapDragOver(gapId: string, e: DragEvent) {
		if (disabled) return;
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
		const wordId = e.dataTransfer?.getData('text/plain') ?? '';
		if (!wordId) return;
		handleGapChange(gapId, wordId);
	}

	function onGapClick(gapId: string) {
		if (disabled) return;
		// K-02: if a word is held, drop it into this gap
		if (pickedUpWord !== null) {
			const wordText = getWordText(pickedUpWord);
			handleGapChange(gapId, pickedUpWord);
			liveMessage =
				i18n?.t('interactions.gapMatch.placed', { word: wordText, gapId }) ??
				`Placed ${wordText} in blank ${gapId}.`;
			pickedUpWord = null;
		} else {
			// No word held: clear this gap if it has a word
			const current = getSelectedWord(gapId);
			if (current) handleGapChange(gapId, '');
		}
	}

	function clearWord(wordId: string) {
		if (disabled) return;
		const newPairs = pairs.filter((p: string) => !p.startsWith(`${wordId} `));
		response = newPairs;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(newPairs);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, newPairs));
		}
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

		<div class="qti-gm-layout">
		<!-- Available gap texts (draggable words) -->
		<div
			part="palette"
			class="qti-gm-palette flex flex-wrap gap-2 p-4 bg-base-200 rounded-lg border-2 border-base-300"
			style={choicesContainerWidth ? `width: ${choicesContainerWidth}` : undefined}
			role="group"
			aria-label={i18n?.t('interactions.gapMatch.availableLabel') ?? 'Available words to place'}
		>
			<div class="qti-gm-palette-title w-full text-sm text-base-content/70 font-semibold mb-2">
				{translate(i18n, 'interactions.gapMatch.availableHeading', 'Available words:')}
			</div>
			{#each parsedInteraction.gapTexts as gapText (gapText.identifier)}
				{@const used = isWordUsed(gapText.identifier)}
				{@const isHeld = pickedUpWord === gapText.identifier}
				{@const isUnavailable = unavailableWords.has(gapText.identifier)}
				<div class="inline-flex items-center gap-1">
					<button
						part="word"
						type="button"
						class="btn btn-md font-medium transition-all"
						class:btn-primary={!used && !isHeld && !isUnavailable}
						class:btn-success={used && !isHeld}
						class:btn-warning={isHeld}
						class:qti-gm-word-held={isHeld}
						class:cursor-grab={!disabled && !used && !isUnavailable}
						class:cursor-not-allowed={disabled || isUnavailable}
						class:opacity-40={isUnavailable}
						class:opacity-70={disabled}
						data-word-id={gapText.identifier}
						draggable={!disabled && !used && !isUnavailable}
						aria-disabled={disabled || used || isUnavailable}
						aria-pressed={isHeld}
						disabled={disabled || used}
						ondragstart={(e: DragEvent) => onWordDragStart(e, gapText.identifier)}
						onclick={() => selectWord(gapText.identifier)}
						aria-label={gapText.text}
					>
						{gapText.text}
					</button>
					{#if used && !disabled}
						<button
							type="button"
							part="word-remove"
							class="btn btn-sm btn-circle btn-error"
							onclick={() => clearWord(gapText.identifier)}
							aria-label={translate(i18n, 'interactions.gapMatch.removeFromBlanks', 'Remove {word} from the blanks', { word: gapText.text })}
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
		<button
			part="gap"
			type="button"
			data-gap-id={gapId}
			class="qti-gm-gap-target select select-bordered select-sm"
			class:qti-gm-gap-correct={showCorrect}
			class:qti-gm-gap-ready={pickedUpWord !== null}
			class:is-dragover={dragOverGap === gapId}
			data-empty={showWord === '' ? 'true' : undefined}
			aria-disabled={disabled ? 'true' : undefined}
			aria-label={gapAriaLabel(gapId)}
			ondragover={(e: DragEvent) => onGapDragOver(gapId, e)}
			ondragleave={() => onGapDragLeave(gapId)}
			ondrop={(e: DragEvent) => onGapDrop(gapId, e)}
			onclick={() => onGapClick(gapId)}
		>
			{showWord === '' ? '' : getWordText(showWord)}
		</button>
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
	/* K-02: visually hidden live region */
	.qti-gm-live-region {
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
	:global(.qti-gm-gap-target) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 6.25rem;
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
		/* Same size + base styling as a filled gap, but dashed to indicate "drop here". */
		border-style: dashed;
		border-color: color-mix(
			in oklch,
			var(--pie-qti-base-content, oklch(21% 0 0)) 18%,
			var(--pie-qti-base-300, oklch(95% 0 0))
		);
	}
	:global(.qti-gm-gap-target[data-empty='true']::before) {
		/* Ensure empty gaps reserve the same line-height as filled gaps (no visible text). */
		content: '\00a0';
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
		outline: 2px solid color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 50%, transparent);
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
	/* K-02: "held" visual for the picked-up word button */
	:global(.qti-gm-word-held) {
		outline: 3px solid var(--pie-qti-warning, oklch(84% 0.2 85));
		outline-offset: 2px;
	}
</style>
