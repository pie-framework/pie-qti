<script lang="ts">
	import type { InteractionData } from '../types';
	import type { Player } from '../core/Player';
	// @ts-expect-error - Svelte-check can't resolve workspace packages, but runtime works correctly
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import { typesetAction } from './actions/typesetAction';
	import { assignProps } from './utils/assignProps';

	interface Props {
		player: Player;
		responses?: Record<string, any>;
		disabled?: boolean;
		role?: 'candidate' | 'scorer' | 'author' | 'tutor' | 'proctor' | 'testConstructor';
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onResponseChange?: (responseId: string, value: any) => void;
		outcomeValues?: Record<string, any>; // Needed for feedbackInline visibility
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
	}: Props = $props();

	// Get the component registry from the player
	const componentRegistry = $derived(player.getComponentRegistry());

	// Process interactions
	const interactions = $derived<InteractionData[]>(player.getInteractionData());

	// Get correct responses when role is scorer
	const correctResponses = $derived.by(() => {
		return role === 'scorer' ? player.getCorrectResponses() : {};
	});

	// Get components for block-level interactions only (not inline interactions)
	// Inline interactions (textEntry, inlineChoice) are rendered within the HTML via InlineInteractionRenderer
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

	// Helper function to clean up feedback text formatting
	function cleanFeedbackText(content: string): string {
		if (!content) return content;
		
		// Replace "Incorrect;" or "<strong>Incorrect;</strong>" with "Incorrect " (space after, no semicolon)
		content = content.replace(/<strong>Incorrect;<\/strong>/gi, '<strong>Incorrect</strong> ');
		content = content.replace(/Incorrect;/gi, 'Incorrect ');
		
		// Replace "Correct;" or "<strong>Correct;</strong>" with "Correct " (space after, no semicolon)
		content = content.replace(/<strong>Correct;<\/strong>/gi, '<strong>Correct</strong> ');
		content = content.replace(/Correct;/gi, 'Correct ');
		
		return content;
	}

	// Get item body HTML and process interactions
	// Block interactions are kept in HTML but wrapped with a hidden marker (see styles below)
	// Inline interactions are replaced with placeholders
	const itemBodyHtml = $derived.by(() => {
		let html = player.getItemBodyHtml();
		
		// Debug: Log HTML extraction details
		const htmlStr = typeof html === 'string' ? html : String(html);
		if (!htmlStr || htmlStr.trim().length === 0) {
			console.warn('[ItemBody] WARNING: getItemBodyHtml() returned empty HTML!');
		} else {
			const hasParagraphs = htmlStr.includes('<p');
			const hasImages = htmlStr.includes('<img') || htmlStr.includes('<object');
			const hasInteractions = /<(\w+Interaction)/i.test(htmlStr);
			console.log('[ItemBody] Extracted HTML:', {
				length: htmlStr.length,
				hasParagraphs,
				hasImages,
				hasInteractions,
				first200Chars: htmlStr.substring(0, 200),
				fullHtml: htmlStr.length < 500 ? htmlStr : htmlStr.substring(0, 500) + '...',
			});
		}

		// Replace inline interactions with placeholders (they need to be rendered in-flow)
		html = html
			.replace(
				/<textEntryInteraction[^>]*responseIdentifier="([^"]+)"[^>]*?(?:\/>|><\/textEntryInteraction>)/gi,
				'[TEXTENTRY:$1]'
			)
			.replace(
				/<inlineChoiceInteraction[^>]*responseIdentifier="([^"]+)"[^>]*>[\s\S]*?<\/inlineChoiceInteraction>/gi,
				'[INLINECHOICE:$1]'
			);

		// Process feedbackInline elements - conditionally show/hide based on outcome values
		html = html.replace(
			/<feedbackInline[^>]*outcomeIdentifier="([^"]+)"[^>]*identifier="([^"]+)"[^>]*showHide="([^"]+)"[^>]*>([\s\S]*?)<\/feedbackInline>/gi,
			(match, outcomeId, feedbackId, showHide) => {
				// Check if this feedback should be visible
				const outcomeValue = outcomeValues[outcomeId];
				
				// If outcomeValue is undefined/null/empty, hide feedback (no response processed yet)
				if (outcomeValue === undefined || outcomeValue === null || outcomeValue === '') {
					return '';
				}
				
				const shouldShow = showHide.toLowerCase() === 'show'
					? outcomeValue === feedbackId
					: outcomeValue !== feedbackId;

				// If should not show, return empty string (remove from HTML)
				if (!shouldShow) {
					return '';
				}

				// If should show, return the content without the feedbackInline wrapper
				// Add spacing before feedback content for better readability
				let content = match.replace(/<feedbackInline[^>]*>/, '').replace(/<\/feedbackInline>/, '');
				content = cleanFeedbackText(content);
				return ` <span class="qti-feedback-inline">${content}</span>`;
			}
		);

		// Wrap all block-level *Interaction elements with a hidden marker
		// This is extensible - any element ending in "Interaction" will be hidden
		// Use a more robust regex that handles nested content better
		const interactionRegex = /<(\w+Interaction)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
		let lastIndex = 0;
		let processedHtml = '';
		let match: RegExpExecArray | null;
		
		// Reset regex lastIndex
		interactionRegex.lastIndex = 0;
		
		while ((match = interactionRegex.exec(html)) !== null) {
			// Add content before the interaction (this is the stem!)
			if (match.index > lastIndex) {
				processedHtml += html.substring(lastIndex, match.index);
			}
			
			const tagName = match[1];
			const fullMatch = match[0];
			
			// Skip inline interactions (already handled above)
			if (tagName.toLowerCase() === 'textentryinteraction' ||
			    tagName.toLowerCase() === 'inlinechoiceinteraction') {
				processedHtml += fullMatch;
			} else {
				// Wrap block interactions with a hidden span
				processedHtml += `<span class="qti-hidden-interaction">${fullMatch}</span>`;
			}
			
			lastIndex = match.index + fullMatch.length;
		}
		
		// Add any remaining content after the last interaction
		if (lastIndex < html.length) {
			processedHtml += html.substring(lastIndex);
		}
		
		// If no interactions were found, use original HTML
		if (processedHtml === '') {
			processedHtml = html;
		}
		
		// Debug: Log processed HTML
		console.log('[ItemBody] After processing interactions:', {
			originalLength: html.length,
			processedLength: processedHtml.length,
			hasParagraphs: processedHtml.includes('<p'),
			hasImages: processedHtml.includes('<img') || processedHtml.includes('<object'),
			hasHiddenInteractions: processedHtml.includes('qti-hidden-interaction'),
			preview: processedHtml.substring(0, 300),
		});
		
		return processedHtml;
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
				const segmentContent = html.substring(lastIndex, match.index);
				result.push({ type: 'html', content: segmentContent });
				console.log('[ItemBody] Added HTML segment before inline interaction:', {
					length: segmentContent.length,
					hasParagraphs: segmentContent.includes('<p'),
					hasImages: segmentContent.includes('<img') || segmentContent.includes('<object'),
					preview: segmentContent.substring(0, 200),
				});
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
			const remainingContent = html.substring(lastIndex);
			result.push({ type: 'html', content: remainingContent });
			console.log('[ItemBody] Added final HTML segment:', {
				length: remainingContent.length,
				hasParagraphs: remainingContent.includes('<p'),
				hasImages: remainingContent.includes('<img') || remainingContent.includes('<object'),
				hasHiddenInteractions: remainingContent.includes('qti-hidden-interaction'),
				preview: remainingContent.substring(0, 300),
			});
		}

		if (result.length === 0) {
			result.push({ type: 'html', content: html });
			console.log('[ItemBody] No inline interactions found, using full HTML as single segment:', {
				length: html.length,
				hasParagraphs: html.includes('<p'),
				hasImages: html.includes('<img') || html.includes('<object'),
				preview: html.substring(0, 300),
			});
		}

		console.log('[ItemBody] Final inlineSegments:', {
			totalSegments: result.length,
			htmlSegments: result.filter(s => s.type === 'html').length,
			totalHtmlLength: result.filter(s => s.type === 'html').reduce((sum, s) => sum + (s.content?.length || 0), 0),
		});

		return result;
	});

	function handleResponseChange(responseId: string, value: any) {
		onResponseChange(responseId, value);
	}

	function handleTextEntryInput(responseId: string, e: Event) {
		const value = (e.currentTarget as HTMLInputElement | null)?.value ?? '';
		handleResponseChange(responseId, value);
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

<div bind:this={rootEl} class="qti-item-body" use:typesetAction={{ typeset }}>
	<!-- Item body with inline interactions -->
	<div class="prose max-w-none mb-4">
		<div class="inline-interaction-container">
			{#each inlineSegments as segment}
				{#if segment.type === 'html'}
					{@html segment.content}
				{:else if segment.type === 'textEntry'}
					{@const correctAnswer = role === 'scorer' ? (correctResponses[segment.interaction.responseId] ?? null) : null}
					{@const displayValue = role === 'scorer' && correctAnswer !== null ? correctAnswer : (responses[segment.interaction.responseId] || '')}
					<input
						type="text"
						class="input input-bordered input-sm inline-input"
						class:border-success={correctAnswer !== null}
						class:bg-success={correctAnswer !== null}
						class:bg-opacity-10={correctAnswer !== null}
						style="width: {segment.interaction.expectedLength * 8}px; min-width: 100px; display: inline-block; margin: 0 4px;"
						placeholder="..."
						aria-label={`Text entry ${segment.interaction.responseId}${correctAnswer ? '. Correct answer: ' + correctAnswer : ''}`}
						value={displayValue}
						oninput={(e) => handleTextEntryInput(segment.interaction.responseId, e)}
						{disabled}
					/>
				{:else if segment.type === 'inlineChoice'}
					{@const correctAnswer = role === 'scorer' ? (correctResponses[segment.interaction.responseId] ?? null) : null}
					{@const userResponse = responses[segment.interaction.responseId] || ''}
					{@const displayValue = role === 'scorer' && correctAnswer !== null ? correctAnswer : userResponse}
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
							{disabled}
						>
							<option value="">{i18n?.t('interactions.inline.selectPlaceholder', 'Select...')}</option>
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
				correctResponse: role === 'scorer' ? correctRespForInteraction : null,
				disabled,
				role,
				outcomeValues,
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

	/* Feedback inline spacing */
	:global(.qti-item-body .qti-feedback-inline) {
		display: inline-block;
		margin-left: 0.5rem;
		padding-left: 0.5rem;
		border-left: 2px solid var(--color-base-content, currentColor);
		opacity: 0.8;
	}
</style>
