<svelte:options customElement="pie-qti-gap-match" />

<script lang="ts">
	import type { GapMatchInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: GapMatchInteractionData | string;
		response?: string[];
		correctResponse?: string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<GapMatchInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);

	const pairs = $derived(Array.isArray(parsedResponse) ? parsedResponse : []);
	const correctPairs = $derived(Array.isArray(parsedCorrectResponse) ? parsedCorrectResponse : []);

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Rendered prompt container - we keep the original HTML structure and insert live gap targets.
	let promptContainer: HTMLDivElement | undefined = $state();

	// Track cleanup functions for event listeners to prevent memory leaks
	let cleanupFunctions: (() => void)[] = [];

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

	function renderPromptWithGaps() {
		if (!promptContainer || !parsedInteraction?.promptText) return;

		// Clean up any existing event listeners before creating new ones
		cleanupFunctions.forEach(cleanup => cleanup());
		cleanupFunctions = [];

		// Replace placeholders with marker spans so we can keep the original HTML structure.
		const html = parsedInteraction.promptText.replace(/\[GAP:([^\]]+)\]/g, (_m, gapId) => {
			const safe = String(gapId).replace(/"/g, '&quot;');
			return `<span data-gap-placeholder="${safe}"></span>`;
		});

		const tpl = document.createElement('template');
		tpl.innerHTML = html;
		promptContainer.innerHTML = '';
		promptContainer.appendChild(tpl.content.cloneNode(true));

		const placeholders = Array.from(
			promptContainer.querySelectorAll<HTMLSpanElement>('[data-gap-placeholder]')
		);
		for (const ph of placeholders) {
			const gapId = ph.getAttribute('data-gap-placeholder') ?? '';
			if (!gapId) continue;

			const btn = document.createElement('button');
			btn.type = 'button';
			btn.setAttribute('part', 'gap');
			btn.setAttribute('data-gap-id', gapId);
			// Match the look/feel of other interactions (DaisyUI input/select styling when present).
			btn.className = 'qti-gm-gap-target select select-bordered select-sm';

			const selected = getSelectedWord(gapId);
			const correct = getCorrectWord(gapId);
			const isCorrect = isCorrectGap(gapId);
			if (selected) {
				const word = getWordText(selected);
				btn.textContent = word;
				btn.removeAttribute('data-empty');
				if (isCorrect) {
					btn.classList.add('qti-gm-gap-correct');
				}
				const filledAriaLabel = i18n?.t('interactions.gapMatch.filledGapAriaLabel', { gapId, word }) ?? `Blank ${gapId}, filled with ${word}. Click to clear.${isCorrect ? ' Correct answer.' : ''}`;
				btn.setAttribute('aria-label', filledAriaLabel);
			} else {
				// Keep the gap visually blank (no letters), but still accessible.
				btn.textContent = '';
				btn.setAttribute('data-empty', 'true');
				if (isCorrect && correct) {
					const correctWord = getWordText(correct);
					btn.textContent = correctWord;
					btn.classList.add('qti-gm-gap-correct');
					btn.removeAttribute('data-empty');
				}
				const ariaLabel = i18n?.t('interactions.gapMatch.blankGapAriaLabel', { gapId }) ?? `Blank ${gapId}. Drop an answer here.${isCorrect ? ' Correct answer: ' + getWordText(correct) : ''}`;
				btn.setAttribute('aria-label', ariaLabel);
			}
			if (disabled) btn.setAttribute('aria-disabled', 'true');

			const onDragEnter = (e: DragEvent) => {
				if (disabled) return;
				e.preventDefault();
				btn.classList.add('is-dragover');
			};

			const onDragOver = (e: DragEvent) => {
				if (disabled) return;
				e.preventDefault();
				btn.classList.add('is-dragover');
			};

			const onDragLeave = () => {
				btn.classList.remove('is-dragover');
			};

			const onDrop = (e: DragEvent) => {
				if (disabled) return;
				e.preventDefault();
				btn.classList.remove('is-dragover');
				const wordId = e.dataTransfer?.getData('text/plain') ?? '';
				if (!wordId) return;
				handleGapChange(gapId, wordId);
			};

			const onClick = () => {
				if (disabled) return;
				const current = getSelectedWord(gapId);
				if (current) handleGapChange(gapId, '');
			};

			btn.addEventListener('dragenter', onDragEnter);
			btn.addEventListener('dragover', onDragOver);
			btn.addEventListener('dragleave', onDragLeave);
			btn.addEventListener('drop', onDrop);
			btn.addEventListener('click', onClick);

			// Store cleanup functions to remove event listeners later
			cleanupFunctions.push(() => {
				btn.removeEventListener('dragenter', onDragEnter);
				btn.removeEventListener('dragover', onDragOver);
				btn.removeEventListener('dragleave', onDragLeave);
				btn.removeEventListener('drop', onDrop);
				btn.removeEventListener('click', onClick);
			});

			ph.replaceWith(btn);
		}
	}

	// Re-render prompt when interaction or response changes (keeps selected word labels in sync)
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		parsedInteraction?.promptText;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		pairs.length;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		correctPairs.length;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		isShowingCorrect;
		renderPromptWithGaps();
	});
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-gap-match-interaction space-y-3">
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-gm-prompt font-semibold">{@html parsedInteraction.prompt}</p>
		{/if}

		<!-- Available gap texts (draggable words) -->
		<div
			part="palette"
			class="qti-gm-palette flex flex-wrap gap-2 p-4 bg-base-200 rounded-lg border-2 border-base-300"
			role="group"
			aria-label={i18n?.t('interactions.gapMatch.availableLabel') ?? 'Available words to place'}
		>
			<div class="qti-gm-palette-title w-full text-sm text-base-content/70 font-semibold mb-2">
				Available words:
			</div>
			{#each parsedInteraction.gapTexts as gapText (gapText.identifier)}
				{@const used = isWordUsed(gapText.identifier)}
				<div class="inline-flex items-center gap-1">
					<button
						part="word"
						type="button"
						class="btn btn-md font-medium transition-all"
						class:btn-primary={!used}
						class:btn-success={used}
						class:cursor-grab={!disabled && !used}
						class:cursor-not-allowed={disabled}
						class:opacity-70={disabled}
						data-word-id={gapText.identifier}
						draggable={!disabled && !used}
						aria-disabled={disabled || used}
						disabled={disabled || used}
						ondragstart={(e: DragEvent) => onWordDragStart(e, gapText.identifier)}
					>
						{gapText.text}
					</button>
					{#if used && !disabled}
						<button
							type="button"
							part="word-remove"
							class="btn btn-sm btn-circle btn-error"
							onclick={() => clearWord(gapText.identifier)}
							aria-label="Remove {gapText.text} from the blanks"
							title={i18n?.t('interactions.gapMatch.removeWord') ?? 'Remove word'}
						>
							✕
						</button>
					{/if}
				</div>
			{/each}
		</div>

	<!-- Render the text with gaps as drop targets, preserving original HTML structure -->
	<div part="text" class="qti-gm-text p-4 bg-base-100 border border-base-300 rounded">
		<div bind:this={promptContainer} class="qti-gm-inline"></div>
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
	.qti-gm-palette {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 0.75rem;
		border: 2px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
		align-items: center;
	}
	.qti-gm-text {
		padding: 1rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-100, oklch(100% 0 0));
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
		/* Same size + base styling as a filled gap, but dashed to indicate “drop here”. */
		border-style: dashed;
		border-color: color-mix(
			in oklch,
			var(--color-base-content, oklch(21% 0 0)) 18%,
			var(--color-base-300, oklch(95% 0 0))
		);
	}
	:global(.qti-gm-gap-target[data-empty='true']::before) {
		/* Ensure empty gaps reserve the same line-height as filled gaps (no visible text). */
		content: '\00a0';
	}
	:global(.qti-gm-gap-target.is-dragover) {
		border-color: var(--color-primary, oklch(45% 0.24 277));
		box-shadow:
			0 0 0 3px color-mix(in oklch, var(--color-primary, oklch(45% 0.24 277)) 28%, transparent),
			inset 0 -2px 0 var(--color-base-300, oklch(95% 0 0));
		background: color-mix(in oklch, var(--color-primary, oklch(45% 0.24 277)) 8%, transparent);
	}
	:global(.qti-gm-gap-target[aria-disabled='true']) {
		opacity: 0.6;
		cursor: not-allowed;
	}
	:global(.qti-gm-gap-target.qti-gm-gap-correct) {
		border-color: var(--color-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--color-success, oklch(76% 0.177 163.223)) 8%, transparent);
	}
	:global(.qti-gm-gap-target:focus-visible) {
		outline: 2px solid hsl(var(--p, 240 100% 50%) / 0.5);
		outline-offset: 2px;
	}
	:global(.qti-gm-gap-target:hover) {
		border-color: color-mix(
			in oklch,
			var(--color-primary, oklch(45% 0.24 277)) 22%,
			var(--color-base-300, oklch(95% 0 0))
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
</style>
