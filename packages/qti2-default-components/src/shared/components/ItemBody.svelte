<script lang="ts">
	import type { InteractionData, Player } from '@pie-qti/qti2-item-player';
	import { typesetAction } from '../actions/typesetAction';

	interface Props {
		player: Player;
		responses?: Record<string, any>;
		disabled?: boolean;
		typeset?: (element: HTMLElement) => void;
		onResponseChange?: (responseId: string, value: any) => void;
	}

	let {
		player,
		responses = {},
		disabled = false,
		typeset,
		onResponseChange = () => {},
	}: Props = $props();

	// Get the component registry from the player
	const componentRegistry = $derived(player.getComponentRegistry());

	// Process interactions
	const interactions = $derived<InteractionData[]>(player.getInteractionData());

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

	// Get item body HTML and remove interaction elements (they're rendered separately)
	const itemBodyHtml = $derived.by(() => {
		let html = player.getItemBodyHtml();

		// Remove block interactions from HTML
		html = html
			.replace(/<choiceInteraction[\s\S]*?<\/choiceInteraction>/gi, '')
			.replace(
				/<textEntryInteraction[^>]*responseIdentifier="([^"]+)"[^>]*?(?:\/>|><\/textEntryInteraction>)/gi,
				'[TEXTENTRY:$1]'
			)
			.replace(/<extendedTextInteraction[\s\S]*?<\/extendedTextInteraction>/gi, '')
			.replace(
				/<inlineChoiceInteraction[^>]*responseIdentifier="([^"]+)"[^>]*>[\s\S]*?<\/inlineChoiceInteraction>/gi,
				'[INLINECHOICE:$1]'
			)
			.replace(/<orderInteraction[\s\S]*?<\/orderInteraction>/gi, '')
			.replace(/<matchInteraction[\s\S]*?<\/matchInteraction>/gi, '')
			.replace(/<associateInteraction[\s\S]*?<\/associateInteraction>/gi, '')
			.replace(/<gapMatchInteraction[\s\S]*?<\/gapMatchInteraction>/gi, '')
			.replace(/<sliderInteraction[\s\S]*?<\/sliderInteraction>/gi, '')
			.replace(/<hotspotInteraction[\s\S]*?<\/hotspotInteraction>/gi, '')
			.replace(/<graphicGapMatchInteraction[\s\S]*?<\/graphicGapMatchInteraction>/gi, '')
			.replace(/<graphicOrderInteraction[\s\S]*?<\/graphicOrderInteraction>/gi, '')
			.replace(/<graphicAssociateInteraction[\s\S]*?<\/graphicAssociateInteraction>/gi, '')
			.replace(/<positionObjectInteraction[\s\S]*?<\/positionObjectInteraction>/gi, '')
			.replace(/<endAttemptInteraction[\s\S]*?<\/endAttemptInteraction>/gi, '')
			.replace(/<uploadInteraction[\s\S]*?<\/uploadInteraction>/gi, '')
			.replace(/<drawingInteraction[\s\S]*?<\/drawingInteraction>/gi, '')
			.replace(/<mediaInteraction[\s\S]*?<\/mediaInteraction>/gi, '')
			.replace(/<hottextInteraction[\s\S]*?<\/hottextInteraction>/gi, '')
			.replace(/<selectPointInteraction[\s\S]*?<\/selectPointInteraction>/gi, '')
			.replace(/<customInteraction[\s\S]*?<\/customInteraction>/gi, '');

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
		rootEl.addEventListener('qti-change', handler as EventListener);
		return () => rootEl.removeEventListener('qti-change', handler as EventListener);
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
</script>

<div bind:this={rootEl} class="qti-item-body" use:typesetAction={{ typeset }}>
	<!-- Item body with inline interactions -->
	<div class="prose max-w-none mb-4">
		<div class="inline-interaction-container">
			{#each inlineSegments as segment}
				{#if segment.type === 'html'}
					{@html segment.content}
				{:else if segment.type === 'textEntry'}
					<input
						type="text"
						class="input input-bordered input-sm inline-input"
						style="width: {segment.interaction.expectedLength * 8}px; min-width: 100px; display: inline-block; margin: 0 4px;"
						placeholder="..."
						aria-label={`Text entry ${segment.interaction.responseId}`}
						value={responses[segment.interaction.responseId] || ''}
						on:input={(e) => handleResponseChange(segment.interaction.responseId, e.currentTarget.value)}
					/>
				{:else if segment.type === 'inlineChoice'}
					<select
						class="select select-bordered select-sm inline-select"
						style="display: inline-block; margin: 0 4px; width: auto; min-width: 120px;"
						aria-label={`Inline choice ${segment.interaction.responseId}`}
						value={responses[segment.interaction.responseId] || ''}
						on:change={(e) => handleResponseChange(segment.interaction.responseId, e.currentTarget.value)}
					>
						<option value="">Select...</option>
						{#each segment.interaction.choices as choice}
							<option value={choice.identifier}>{choice.text}</option>
						{/each}
					</select>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Block interactions rendered dynamically as web components -->
	{#each interactionComponents as { interaction, tagName } (interactionKey(interaction))}
		{@const wcProps = {
			interaction: JSON.stringify(interaction),
			response: JSON.stringify(responses[interaction.responseId] ?? null),
			disabled: disabled ? true : undefined,
		}}
		<svelte:element
			this={tagName}
			{...wcProps}
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
</style>
