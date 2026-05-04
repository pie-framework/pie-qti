<script lang="ts">
	import type { InteractionData } from '../types';
	import type { Player } from '../core/Player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import { normalizeHeuristicsConfig, type QtiHeuristicsConfig } from '@pie-qti/ims-cp-core';
	import { processFeedbackInline } from './utils/feedbackUtils';
	import { typesetAction } from './actions/typesetAction';
	import { glossaryAction } from '../catalog/glossaryAction';
	import { assignProps } from './utils/assignProps';
	import { getRoleCapabilities } from '../core/rolePolicy';

	interface Props {
		player: Player;
		responses?: Record<string, any>;
		disabled?: boolean;
		role?: 'candidate' | 'scorer' | 'author' | 'tutor' | 'proctor' | 'testConstructor';
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onResponseChange?: (responseId: string, value: any) => void;
		outcomeValues?: Record<string, any>; // Needed for feedbackInline visibility
		heuristicsConfig?: QtiHeuristicsConfig; // Optional heuristics configuration
		/** QTI 3.0 shared stimulus content: map of stimulus identifier → HTML string */
		stimulusContent?: Record<string, string>;
	}

	let {
		player,
		responses = {},
		disabled = false,
		role = 'candidate',
		i18n,
		typeset,
		onResponseChange = () => {},
		outcomeValues = {},
		heuristicsConfig,
		stimulusContent = {},
	}: Props = $props();

	// Normalize heuristics configuration with defaults
	const heuristics = $derived(normalizeHeuristicsConfig(heuristicsConfig));

	// Get the component registry from the player
	const componentRegistry = $derived(player.getComponentRegistry());
	const roleCapabilities = $derived(getRoleCapabilities(role));
	const effectiveDisabled = $derived(disabled || roleCapabilities.isReadOnly);

	// Process interactions
	const interactions = $derived<InteractionData[]>(player.getInteractionData());

	// Get correct responses for roles allowed by policy.
	const correctResponses = $derived.by(() => {
		return roleCapabilities.canViewCorrectResponses ? player.getCorrectResponses() : {};
	});

	// Get components for block-level interactions only (not inline interactions).
	// Type is always normalized to QTI 2.x camelCase by Player (qti-text-entry-interaction → textEntryInteraction).
	const interactionComponents = $derived(
		interactions
			.filter(
				(interaction) =>
					interaction.type !== 'textEntryInteraction' &&
					interaction.type !== 'inlineChoiceInteraction'
			)
			.map((interaction) => {
				try {
					// Get the web component tag name from the registry
					const tagName = componentRegistry.getTagName(interaction);
					return {
						interaction,
						tagName,
					};
				} catch (error) {
					console.error(`Failed to get tag name for ${interaction.type}:`, error);
					return null;
				}
			})
			.filter((item): item is NonNullable<typeof item> => item !== null)
	);

	// Get item body HTML and process interactions
	// Block interactions are kept in HTML but wrapped with a hidden marker (see styles below)
	// Inline interactions are replaced with placeholders
	const itemBodyHtml = $derived.by(() => {
		let html = player.getItemBodyHtml();

		// QTI 3.0 Shared Stimulus: inject stimulus HTML at data-stimulus-idref docking points.
		// Any stimulus identifier that has no docking div is prepended to the body.
		if (stimulusContent && Object.keys(stimulusContent).length > 0) {
			const docked = new Set<string>();
			// Replace docking divs: <div ... data-stimulus-idref="ID" ...></div>
			html = html.replace(
				/<div([^>]*)\bdata-stimulus-idref="([^"]+)"([^>]*)>\s*<\/div>/gi,
				(match, before, identifier, after) => {
					const content = stimulusContent[identifier];
					if (content) {
						docked.add(identifier);
						// Preserve any other attributes on the docking div
						return `<div${before} data-stimulus-idref="${identifier}"${after} class="qti-stimulus-dock">${content}</div>`;
					}
					return match; // no content found — leave as-is
				}
			);
			// Prepend any stimuli that had no docking div
			const undocked = Object.entries(stimulusContent)
				.filter(([id]) => !docked.has(id))
				.map(([, content]) => `<div class="qti-stimulus-block">${content}</div>`)
				.join('');
			if (undocked) {
				html = undocked + html;
			}
		}

		// Replace inline interactions with placeholders (they need to be rendered in-flow).
		// Handles both QTI 2.x camelCase and QTI 3.0 kebab-case element names.
		html = html
			// QTI 2.x: <textEntryInteraction responseIdentifier="..." />
			.replace(
				/<textEntryInteraction[^>]*responseIdentifier="([^"]+)"[^>]*?(?:\/>|><\/textEntryInteraction>)/gi,
				'[TEXTENTRY:$1]'
			)
			// QTI 3.0: <qti-text-entry-interaction response-identifier="..." />
			.replace(
				/<qti-text-entry-interaction[^>]*response-identifier="([^"]+)"[^>]*?(?:\/>|><\/qti-text-entry-interaction>)/gi,
				'[TEXTENTRY:$1]'
			)
			// QTI 2.x: <inlineChoiceInteraction responseIdentifier="...">...</inlineChoiceInteraction>
			.replace(
				/<inlineChoiceInteraction[^>]*responseIdentifier="([^"]+)"[^>]*>[\s\S]*?<\/inlineChoiceInteraction>/gi,
				'[INLINECHOICE:$1]'
			)
			// QTI 3.0: <qti-inline-choice-interaction response-identifier="...">...</qti-inline-choice-interaction>
			.replace(
				/<qti-inline-choice-interaction[^>]*response-identifier="([^"]+)"[^>]*>[\s\S]*?<\/qti-inline-choice-interaction>/gi,
				'[INLINECHOICE:$1]'
			);

		// Process feedbackInline elements - conditionally show/hide based on outcome values
		html = processFeedbackInline(html, {
			outcomeValues,
			applyHeuristics: heuristics.feedbackTextFormatting,
			wrapWithSpan: false
		});

		// Wrap all block-level interaction elements with a hidden marker.
		// Matches both QTI 2.x camelCase (*Interaction) and QTI 3.0 kebab-case (qti-*-interaction).
		html = html.replace(
			/<(\w+Interaction|qti-[\w-]+-interaction)(\s[^>]*)?>[\s\S]*?<\/\1>/gi,
			(match, tagName) => {
				const lower = tagName.toLowerCase();
				// Skip inline interactions (already replaced with placeholders above)
				if (lower === 'textentryinteraction' || lower === 'inlinechoiceinteraction' ||
				    lower === 'qti-text-entry-interaction' || lower === 'qti-inline-choice-interaction') {
					return match;
				}
				// Wrap block interactions with a hidden span
				return `<span class="qti-hidden-interaction">${match}</span>`;
			}
		);

		return html;
	});

	// Inline interaction parsing (textEntry, inlineChoice) — kept local to avoid TS issues
	// around component props inference in runes mode.
	interface ParsedSegment {
		type: 'html' | 'textEntry' | 'inlineChoice';
		content?: string;
		interaction?: any;
	}

	const inlineSegments = $derived.by(() => {
		const html = itemBodyHtml;
		const result: ParsedSegment[] = [];

		let lastIndex = 0;
		let match: RegExpExecArray | null;

		// Find placeholders in order.
		const combinedPattern = /\[TEXTENTRY:([^\]]+)\]|\[INLINECHOICE:([^\]]+)\]/g;

		while ((match = combinedPattern.exec(html)) !== null) {
			if (match.index > lastIndex) {
				result.push({ type: 'html', content: html.substring(lastIndex, match.index) });
			}

			if (match[0].startsWith('[TEXTENTRY:')) {
				const responseId = match[1];
				const interaction = (interactions as any[]).find((i) => i.responseId === responseId);
				if (interaction) result.push({ type: 'textEntry', interaction });
			} else if (match[0].startsWith('[INLINECHOICE:')) {
				const responseId = match[2];
				const interaction = (interactions as any[]).find((i) => i.responseId === responseId);
				if (interaction) result.push({ type: 'inlineChoice', interaction });
			}

			lastIndex = match.index + match[0].length;
		}

		if (lastIndex < html.length) {
			result.push({ type: 'html', content: html.substring(lastIndex) });
		}

		if (result.length === 0) {
			result.push({ type: 'html', content: html });
		}

		return result;
	});

	function handleResponseChange(responseId: string, value: any) {
		onResponseChange(responseId, value);
	}

	let textEntryErrors = $state<Map<string, string>>(new Map());

	function handleTextEntryInput(responseId: string, e: Event) {
		const input = e.currentTarget as HTMLInputElement | null;
		const value = input?.value ?? '';
		handleResponseChange(responseId, value);
		if (input?.validity.valid) {
			const m = new Map(textEntryErrors);
			m.delete(responseId);
			textEntryErrors = m;
		}
	}

	function handleTextEntryInvalid(responseId: string, e: Event, customMessage?: string | null) {
		e.preventDefault();
		const msg = customMessage
			?? i18n?.t('interactions.textEntry.patternError', 'Please match the required format')
			?? 'Please match the required format';
		textEntryErrors = new Map(textEntryErrors).set(responseId, msg);
	}

	function handleTextEntryBlur(e: Event) {
		(e.currentTarget as HTMLInputElement | null)?.checkValidity();
	}

	function handleInlineChoiceChange(responseId: string, e: Event) {
		const value = (e.currentTarget as HTMLSelectElement | null)?.value ?? '';
		handleResponseChange(responseId, value);
	}

	// Helper to find correct choice for inline choice interactions
	function findCorrectChoice(choices: any[], correctAnswer: string | null): any {
		if (!correctAnswer) return null;
		return choices.find((c: any) => c.identifier === correctAnswer) || null;
	}

	// Handle qti:change events from web components
	function handleQtiChange(event: CustomEvent) {
		const { responseId, value } = event.detail;
		handleResponseChange(responseId, value);
	}

	// In runes mode, prefer explicit DOM listener wiring to avoid edge cases with
	// custom events bubbling out of shadow DOM (and to keep typing sane for dynamic elements).
	let rootEl: HTMLDivElement | null = $state(null);
	$effect(() => {
		if (!rootEl) return;
		const handler = (e: Event) => handleQtiChange(e as CustomEvent);
		const el = rootEl; // Capture reference for cleanup
		el.addEventListener('qti-change', handler as EventListener);
		return () => {
			el.removeEventListener('qti-change', handler as EventListener);
		};
	});

	// Ensure web-component instances are not accidentally reused across items when
	// different items share the same responseId (common in QTI demos: "RESPONSE").
	function interactionKey(interaction: InteractionData): string {
		const anyInteraction = interaction as any;
		const ids =
			Array.isArray(anyInteraction?.choices) && anyInteraction.choices.length > 0
				? anyInteraction.choices.map((c: any) => c?.identifier).filter(Boolean).join(',')
				: '';
		// Include prompt if present to further reduce accidental reuse.
		const prompt = typeof anyInteraction?.prompt === 'string' ? anyInteraction.prompt : '';
		return `${interaction.type}|${interaction.responseId}|${ids}|${prompt}`;
	}

	// Action to set typeset and i18n on web components when they mount
	function setWebComponentProps(
		node: HTMLElement,
		params: {
			i18n?: I18nProvider;
			typeset?: (el: HTMLElement) => void;
			[key: string]: unknown;
		}
	) {
		// Use microtask to ensure custom element is fully initialized
		queueMicrotask(() => {
			if (!node) return;
			assignProps(node, params);
		});

		return {
			update(
				newParams: {
					i18n?: I18nProvider;
					typeset?: (el: HTMLElement) => void;
					[key: string]: unknown;
				}
			) {
				assignProps(node, newParams);
			},
			destroy() {}
		};
	}
</script>

<div bind:this={rootEl} class="qti-item-body" use:typesetAction={{ typeset }} use:glossaryAction={{ player }}>
	<!-- Item body with inline interactions -->
	<div class="prose max-w-none mb-4">
		<div class="inline-interaction-container">
			{#each inlineSegments as segment}
				{#if segment.type === 'html'}
					{@html segment.content}
				{:else if segment.type === 'textEntry'}
					{@const correctAnswer = roleCapabilities.canViewCorrectResponses ? (correctResponses[segment.interaction.responseId] ?? null) : null}
					{@const displayValue = roleCapabilities.canViewCorrectResponses && correctAnswer !== null ? correctAnswer : (responses[segment.interaction.responseId] || '')}
					{@const inputWidthClass = (segment.interaction.interactionClasses ?? []).find((c: string) => c.startsWith('qti-input-width-'))}
					{@const extraClasses = (segment.interaction.interactionClasses ?? []).filter((c: string) => !c.startsWith('qti-input-width-')).join(' ')}
					<input
						type="text"
						class={['input input-bordered input-sm inline-input', inputWidthClass ?? '', extraClasses].filter(Boolean).join(' ')}
						class:border-success={correctAnswer !== null}
						class:bg-success={correctAnswer !== null}
						class:bg-opacity-10={correctAnswer !== null}
						style={inputWidthClass ? 'min-width: 100px; display: inline-block; margin: 0 4px;' : `width: ${segment.interaction.expectedLength * 8}px; min-width: 100px; display: inline-block; margin: 0 4px;`}
						placeholder={segment.interaction.placeholderText || '...'}
						pattern={segment.interaction.patternMask || undefined}
						title={segment.interaction.patternMask ? `Format: ${segment.interaction.patternMask}` : undefined}
						data-format={segment.interaction.format || undefined}
						aria-label={`Text entry ${segment.interaction.responseId}${correctAnswer ? '. Correct answer: ' + correctAnswer : ''}`}
						aria-invalid={textEntryErrors.has(segment.interaction.responseId) ? 'true' : undefined}
						aria-describedby={textEntryErrors.has(segment.interaction.responseId) ? `${segment.interaction.responseId}-error` : undefined}
						value={displayValue}
						oninput={(e) => handleTextEntryInput(segment.interaction.responseId, e)}
						oninvalid={(e) => handleTextEntryInvalid(segment.interaction.responseId, e, segment.interaction.patternMaskMessage)}
						onblur={handleTextEntryBlur}
						disabled={effectiveDisabled}
					/>
					{#if textEntryErrors.has(segment.interaction.responseId)}
						<span
							id="{segment.interaction.responseId}-error"
							role="alert"
							class="qti-text-entry-error text-error text-xs"
							style="display: block;"
						>{textEntryErrors.get(segment.interaction.responseId)}</span>
					{/if}
				{:else if segment.type === 'inlineChoice'}
					{@const correctAnswer = roleCapabilities.canViewCorrectResponses ? (correctResponses[segment.interaction.responseId] ?? null) : null}
					{@const userResponse = responses[segment.interaction.responseId] || ''}
					{@const displayValue = roleCapabilities.canViewCorrectResponses && correctAnswer !== null ? correctAnswer : userResponse}
					{@const correctChoice = findCorrectChoice(segment.interaction.choices, correctAnswer)}
					<span class="inline-choice-wrapper" style="display: inline-block; position: relative;">
						<select
							class="select select-bordered select-sm inline-select"
							class:border-success={correctAnswer !== null}
							class:bg-success={correctAnswer !== null}
							class:bg-opacity-10={correctAnswer !== null}
							style="display: inline-block; margin: 0 4px; width: auto; min-width: 120px;"
							aria-label={`Inline choice ${segment.interaction.responseId}${correctAnswer && correctChoice ? '. Correct answer: ' + (correctChoice as any).text : ''}`}
							value={displayValue}
							onchange={(e) => handleInlineChoiceChange(segment.interaction.responseId, e)}
							disabled={effectiveDisabled}
						>
							<option value="">{segment.interaction.label ?? i18n?.t('interactions.inline.selectPlaceholder', 'Select...')}</option>
							{#each segment.interaction.choices as choice}
								{@const isCorrect = correctAnswer === choice.identifier}
								<option value={choice.identifier}>
									{choice.text}{isCorrect ? ' ✓' : ''}
								</option>
							{/each}
						</select>
						{#if correctAnswer !== null && correctChoice}
							<span class="badge badge-success badge-sm" style="position: absolute; top: -1.5rem; left: 0; white-space: nowrap; font-size: 0.7rem;">
								{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}: {(correctChoice as any).text}
							</span>
						{/if}
					</span>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Block interactions rendered dynamically as web components -->
	{#each interactionComponents as { interaction, tagName } (interactionKey(interaction))}
		{@const correctRespForInteraction = correctResponses[interaction.responseId] ?? null}
		<svelte:element
			this={tagName}
			use:setWebComponentProps={{
				i18n,
				typeset,
				interaction,
				response: responses[interaction.responseId] ?? null,
				correctResponse: roleCapabilities.canViewCorrectResponses ? correctRespForInteraction : null,
				disabled: effectiveDisabled,
				// Avoid invalid ARIA role values on custom-element hosts.
				// Components default to candidate when role is omitted.
				role: roleCapabilities.canViewCorrectResponses ? 'scorer' : undefined,
			}}
		/>
	{/each}
</div>

<style>
	/* Allow the whole item body to shrink inside flex/grid layouts (prevents overflow). */
	.qti-item-body {
		max-width: 100%;
		min-width: 0;
	}

	/*
	 * Custom elements default to inline; force them to be block-level and width-contained.
	 * This prevents wide interactions (SVGs, tables, canvases) from spilling outside panels.
	 */
	:global(.qti-item-body :is(
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
		min-width: 0;
	}

	/* Keep inline interactions from breaking paragraph flow */
	.inline-interaction-container :global(p) {
		display: inline;
	}

	/*
	 * Hide all QTI interaction elements wrapped with qti-hidden-interaction.
	 * These are rendered separately as web components above.
	 * Keeping them in the HTML (but hidden) makes debugging easier and is fully extensible.
	 * Any *Interaction element will be automatically wrapped and hidden - no hardcoded list needed!
	 */
	:global(.qti-item-body .qti-hidden-interaction) {
		display: none !important;
	}

	/*
	 * Style for inline feedback elements that appear within choice text or other content.
	 * Provides visual distinction and spacing for feedback that appears inline with content.
	 */
	:global(.qti-feedback-inline) {
		display: inline-block;
		margin-left: 0.5rem;
		padding-left: 0.5rem;
		border-left: 2px solid var(--color-base-content, currentColor);
		opacity: 0.8;
	}

	/* QTI 3.0 Shared Stimulus: stimulus blocks that were prepended before the item body */
	:global(.qti-stimulus-block) {
		margin-bottom: 1rem;
	}

	/* QTI 3.0 Shared Vocabulary: qti-input-width-N sets minimum input width in character units. */
	:global(.qti-input-width-1)  { min-width: 1ch; }
	:global(.qti-input-width-2)  { min-width: 2ch; }
	:global(.qti-input-width-3)  { min-width: 3ch; }
	:global(.qti-input-width-4)  { min-width: 4ch; }
	:global(.qti-input-width-5)  { min-width: 5ch; }
	:global(.qti-input-width-6)  { min-width: 6ch; }
	:global(.qti-input-width-10) { min-width: 10ch; }
	:global(.qti-input-width-15) { min-width: 15ch; }
	:global(.qti-input-width-20) { min-width: 20ch; }
	:global(.qti-input-width-25) { min-width: 25ch; }
	:global(.qti-input-width-30) { min-width: 30ch; }
	:global(.qti-input-width-35) { min-width: 35ch; }
	:global(.qti-input-width-40) { min-width: 40ch; }
	:global(.qti-input-width-45) { min-width: 45ch; }
	:global(.qti-input-width-50) { min-width: 50ch; }
	:global(.qti-input-width-72) { min-width: 72ch; }
</style>
