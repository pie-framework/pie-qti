<script lang="ts" module>
	let nextItemBodyScopeId = 0;
</script>

<script lang="ts">
	import { mount as mountComponent, unmount, untrack, type ComponentProps } from 'svelte';
	import { getItemSessionBinding, type ItemSession, type ItemSessionTransition } from '../core/ItemSession';
	import type { InteractionResponseValue, QTIChangeEventDetail } from '../web-components';
	import type { ExtractedPci } from '../pci/types';
	import type { PlayerSecurityConfig } from '../types';
	import type {
		BlockInteractionMount,
		InlineInteractionMount,
		ItemInteractionMount,
		ItemPresentation,
	} from '../presentation/itemPresentationPlan';
	import {
		contentLanguageAttributes,
		interfaceLocaleAttributes,
		translate,
		type I18nProvider,
		type LanguageAttributes,
	} from '@pie-qti/i18n';
	import type { QtiHeuristicsConfig } from '@pie-qti/ims-cp-core';
	import { typesetAction } from './actions/typesetAction';
	import { glossaryAction } from '../catalog/glossaryAction';
	import { isWithinPnpSurface } from '../pnp/applyPnp';
	import { assignProps } from '@pie-qti/qti-common';
	import { createItemBodyRenderer, type MountedInteraction } from './utils/itemBodyRenderer';
	import { sentenceContextId } from './utils/sentenceContext';
	import {
		isCandidateAttemptFeedback,
		nextFeedbackAnnouncement,
	} from '../presentation/feedbackAnnouncement';
	import InlineChoice from '../interactions/inline-choice/InlineChoice.svelte';
	import InlineTextEntry from '../interactions/text-entry/InlineTextEntry.svelte';

	type ItemResponseValue = InteractionResponseValue | null;
	type ItemResponseMap = Record<string, ItemResponseValue>;
	type QtiChangeDomEvent = CustomEvent<QTIChangeEventDetail<ItemResponseValue>>;

	interface Props {
		session: ItemSession;
		/** Makes session-internal transitions visible to Svelte's dependency tracking. */
		revision: number;
		disabled?: boolean;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onResponseChange?: (responseId: string, value: ItemResponseValue) => void;
		onError?: (error: unknown) => void;
		heuristicsConfig?: QtiHeuristicsConfig; // Optional heuristics configuration
		/** Render role-visible rubricBlock content authored inside itemBody. */
		renderItemBodyRubrics?: boolean;
	}

	let {
		session,
		revision,
		disabled = false,
		i18n,
		typeset,
		onResponseChange,
		onError,
		heuristicsConfig,
		renderItemBodyRubrics = true,
	}: Props = $props();
	const itemBodyScope = `qti-item-body-${++nextItemBodyScopeId}`;
	const itemBodyScopeSelector = `[data-qti-item-body-scope="${itemBodyScope}"]`;

	const binding = $derived(getItemSessionBinding(session));
	const sessionView = $derived.by(() => {
		void revision;
		return session.state();
	});
	const responses = $derived(sessionView.responses as ItemResponseMap);
	const presentation = $derived.by(() => {
		void revision;
		return session.present({
			disabled,
			heuristicsConfig,
			itemBodyScopeSelector,
			renderItemBodyRubrics,
			onComponentError: (interaction, error) =>
				console.error(`Failed to get tag name for ${interaction.type}:`, error)
		});
	});
	// The item body is a content root: `lang` and `dir` are the item's declared
	// language and its direction, never the interface locale's. Content that
	// declares none inherits both from the player's chrome. `direction` is an
	// inherited CSS property, so it reaches interactions inside shadow roots;
	// glossary lookups and read-aloud read `lang`.
	const contentAttributes = $derived(contentLanguageAttributes(presentation.contentLanguage));
	const bodyMarkup = $derived.by(() => {
		const node = presentation.flow.find((entry) => entry.kind === 'html');
		return node?.kind === 'html' ? String(node.html) : '';
	});
	const security = $derived(binding.getSecurityConfig());
	const bodyParams = $derived<BodyParams>({ presentation, responses, i18n, typeset, security });
	// Glossary triggers live in the body markup, so they are applied again whenever it is replaced.
	const glossaryParams = $derived.by(() => {
		void bodyMarkup;
		return { player: binding };
	});

	function handleResponseChange(responseId: string, value: ItemResponseValue) {
		try {
			session.dispatch({ action: 'setResponse', responseIdentifier: responseId, value });
			onResponseChange?.(responseId, value);
		} catch (error) {
			if (onError) {
				onError(error);
				return;
			}
			throw error;
		}
	}

	// Handle qti:change events from web components
	function handleQtiChange(event: QtiChangeDomEvent) {
		const { responseId, value } = event.detail;
		handleResponseChange(responseId, value);
	}

	const createPciHost = (data: ExtractedPci) => binding.createPciHost(data);

	// In runes mode, prefer explicit DOM listener wiring to avoid edge cases with
	// custom events bubbling out of shadow DOM (and to keep typing sane for dynamic elements).
	let rootEl: HTMLDivElement | null = $state(null);
	$effect(() => {
		if (!rootEl) return;
		void revision;
		// Display needs are applied once, by the outermost surface that renders this item.
		// Inside a section player's surface (`applyPnpToSurface`), the section applies them to
		// its passages, rubrics, tool bars and this item alike — including the candidate's own
		// display settings — so the item body applies none that would override them.
		if (!isWithinPnpSurface(rootEl)) binding.applyPnp(rootEl);
		const handler = (e: Event) => handleQtiChange(e as QtiChangeDomEvent);
		const el = rootEl; // Capture reference for cleanup
		el.addEventListener('qti-change', handler as EventListener);
		return () => {
			el.removeEventListener('qti-change', handler as EventListener);
		};
	});

	/**
	 * Status message for the integrated feedback the candidate's attempt showed (WCAG 4.1.3). The
	 * attempt splices feedbackInline and feedbackBlock into the body without moving focus, so the
	 * persistent live region below says what appeared. Feedback text is item content, read in the
	 * item's language; the fallback phrase for feedback with no text is interface text, read in the
	 * interface language.
	 */
	let feedbackAnnouncement = $state<{ text: string; language?: LanguageAttributes }>({ text: '' });

	// Only the candidate's own attempt announces. Initial render, restore, review and scorer views
	// dispatch no attempt, and a re-render is no session transition at all. A new session starts
	// silent.
	$effect(() => {
		const current = session;
		feedbackAnnouncement = { text: '' };
		let unsubscribe: (() => void) | undefined;
		try {
			unsubscribe = current.subscribe((transition) => announceAttemptFeedback(current, transition));
		} catch {
			// A disposed session has no attempt left to announce.
		}
		return () => unsubscribe?.();
	});

	function announceAttemptFeedback(source: ItemSession, transition: ItemSessionTransition) {
		if (transition.current.disposed || !isCandidateAttemptFeedback(transition, transition.current.role)) return;
		let shownPresentation: ItemPresentation;
		try {
			shownPresentation = source.present({ heuristicsConfig, itemBodyScopeSelector, renderItemBodyRubrics });
		} catch {
			return; // The body reports a presentation failure itself; there is nothing to announce.
		}
		const { shown, text } = shownPresentation.shownFeedback;
		if (!shown) {
			feedbackAnnouncement = { text: '' };
			return;
		}
		const message = text || translate(i18n, 'feedback.shown', 'Feedback is shown.');
		feedbackAnnouncement = {
			text: nextFeedbackAnnouncement(feedbackAnnouncement.text, message),
			language: text
				? contentLanguageAttributes(shownPresentation.contentLanguage)
				: interfaceLocaleAttributes(i18n),
		};
	}

	interface BodyParams {
		presentation: ItemPresentation;
		responses: ItemResponseMap;
		i18n: I18nProvider | undefined;
		typeset: ((element: HTMLElement) => void) | undefined;
		security: PlayerSecurityConfig | undefined;
	}

	/**
	 * Renders the item body and mounts every interaction into the slot that marks its authored
	 * position, so block interactions sit between the paragraphs, layout columns and table cells
	 * they were authored in and inline interactions stay in their sentence. Interactions are keyed:
	 * a response change updates props and never remounts.
	 */
	function itemBodyContent(node: HTMLElement, initial: BodyParams) {
		let params = initial;
		let nextContextId = 0;
		const contextId = () => `${itemBodyScope}-context-${++nextContextId}`;

		const correctAnswerFor = (responseId: string): string | null =>
			params.presentation.capabilities.canViewCorrectResponses
				? ((params.presentation.correctResponses[responseId] ?? null) as string | null)
				: null;
		const stringResponse = (responseId: string): string => {
			const response = params.responses[responseId];
			return typeof response === 'string' ? response : '';
		};

		function blockProps(mount: BlockInteractionMount): Record<string, unknown> {
			return {
				i18n: params.i18n,
				typeset: params.typeset,
				interaction: mount.interaction,
				response: mount.response,
				stringResponse: mount.stringResponse,
				correctResponse: mount.correctResponse,
				pnp: mount.pnp,
				eliminationTool: mount.eliminationTool,
				answerMasking: mount.answerMasking,
				structuredLabelSupport: mount.structuredLabelSupport,
				disabled: mount.disabled,
				// Avoid invalid ARIA role values on custom-element hosts.
				// Components default to candidate when role is omitted.
				role: mount.componentRole,
				security: params.security,
				createPciHost,
			};
		}

		function createBlock(mount: BlockInteractionMount): MountedInteraction<ItemInteractionMount> {
			const element = node.ownerDocument.createElement(mount.tagName);
			applyAttributes(element, mount.interaction.readAloud);
			let latest = mount;
			let destroyed = false;
			assignProps(element, blockProps(latest));
			if (!customElements.get(mount.tagName)) {
				// Props set before the element is defined shadow its accessors; set them again once it is.
				void customElements.whenDefined(mount.tagName).then(() => {
					if (!destroyed) upgradeProps(element, blockProps(latest));
				});
			}
			return {
				element,
				update(next) {
					latest = next as BlockInteractionMount;
					assignProps(element, blockProps(latest));
				},
				destroy() {
					destroyed = true;
				},
			};
		}

		function createInline(mount: InlineInteractionMount): MountedInteraction<ItemInteractionMount> {
			// The wrapper is the component's mount target and carries the read-aloud attributes;
			// moving it moves the control and its delegated event handling together.
			const element = node.ownerDocument.createElement('span');
			element.className = 'qti-inline-interaction';
			applyAttributes(element, mount.interaction.readAloud);
			const shared = () => ({
				position: mount.position,
				response: stringResponse(mount.interaction.responseId),
				correctAnswer: correctAnswerFor(mount.interaction.responseId),
				disabled: params.presentation.disabled,
				i18n: params.i18n,
				onResponseChange: handleResponseChange,
			});

			if (mount.renderer === 'text-entry') {
				const props: ComponentProps<typeof InlineTextEntry> = $state({ interaction: mount.interaction, ...shared(), stringResponse: mount.stringResponse });
				const instance = mountComponent(InlineTextEntry, { target: element, props });
				return {
					element,
					update(next) {
						if (next.placement !== 'inline' || next.renderer !== 'text-entry') return;
						mount = next;
						Object.assign(props, { interaction: next.interaction, ...shared(), stringResponse: next.stringResponse });
					},
					placed(slot) {
						props.contextId = slot ? sentenceContextId(slot, node, contextId) : undefined;
					},
					destroy() {
						void unmount(instance);
					},
				};
			}

			const props: ComponentProps<typeof InlineChoice> = $state({ interaction: mount.interaction, ...shared() });
			const instance = mountComponent(InlineChoice, { target: element, props });
			return {
				element,
				update(next) {
					if (next.placement !== 'inline' || next.renderer !== 'inline-choice') return;
					mount = next;
					Object.assign(props, { interaction: next.interaction, ...shared() });
				},
				placed(slot) {
					props.contextId = slot ? sentenceContextId(slot, node, contextId) : undefined;
				},
				destroy() {
					void unmount(instance);
				},
			};
		}

		const renderer = createItemBodyRenderer<ItemInteractionMount>(node, {
			create: (mount) => (mount.placement === 'block' ? createBlock(mount) : createInline(mount)),
			onError: (mount, error) => console.error(`Failed to render ${mount.interaction.type}:`, error),
		});

		const render = () =>
			untrack(() => {
				const htmlNode = params.presentation.flow.find((entry) => entry.kind === 'html');
				const mounts = params.presentation.flow.flatMap((entry) =>
					entry.kind === 'interaction' ? [entry.mount] : []
				);
				renderer.render(htmlNode?.kind === 'html' ? htmlNode.html : '', mounts);
			});
		render();

		return {
			update(next: BodyParams) {
				params = next;
				render();
			},
			destroy() {
				renderer.destroy();
			},
		};
	}

	function applyAttributes(element: HTMLElement, attributes: Readonly<Record<string, string>> | undefined) {
		for (const [name, value] of Object.entries(attributes ?? {})) element.setAttribute(name, value);
	}

	/** Re-run property assignment through the element's own accessors once it is upgraded. */
	function upgradeProps(element: HTMLElement, props: Record<string, unknown>) {
		const target = element as unknown as Record<string, unknown>;
		for (const [key, value] of Object.entries(props)) {
			if (value === undefined) continue;
			if (Object.prototype.hasOwnProperty.call(target, key)) delete target[key];
			target[key] = value;
		}
	}
</script>

<div
	bind:this={rootEl}
	class="qti-item-body"
	data-qti-item-body-scope={itemBodyScope}
	lang={contentAttributes?.lang}
	dir={contentAttributes?.dir}
	use:typesetAction={{ typeset }}
>
	{#if presentation.scopedCss}
		<svelte:element this={'style'} data-qti-stylesheets="resolved">
			{presentation.scopedCss}
		</svelte:element>
	{/if}

	<!-- The authored body, with every interaction mounted at its authored position. -->
	<div
		class="qti-item-body-content"
		use:itemBodyContent={bodyParams}
		use:glossaryAction={glossaryParams}
	></div>
</div>

<!--
	Status messages for the feedback the candidate's attempt showed (WCAG 4.1.3): one polite region,
	in the DOM from the first render so that a later change is announced. It sits outside the body
	root, so typesetting and display settings leave it alone, and it carries its own language.
-->
<div
	class="qti-feedback-announcer"
	role="status"
	aria-live="polite"
	aria-atomic="true"
	lang={feedbackAnnouncement.language?.lang}
	dir={feedbackAnnouncement.language?.dir}
>{feedbackAnnouncement.text}</div>

<style>
	/* Allow the whole item body to shrink inside flex/grid layouts (prevents overflow). */
	.qti-item-body {
		max-width: 100%;
		min-width: 0;
	}

	/* Read by screen readers, never seen: the feedback status message region. */
	.qti-feedback-announcer {
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

	.qti-item-body-content {
		max-width: none;
		margin-bottom: 1rem;
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
		pie-qti-portable-custom,
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

	/*
	 * Each interaction mounts into the empty slot that replaced its element in the body. A block
	 * slot takes its own line wherever it was authored, also inside a paragraph; an inline slot
	 * stays in the sentence.
	 */
	:global(.qti-item-body .qti-interaction-slot--block) {
		display: block;
		max-width: 100%;
		min-width: 0;
		margin-block: 1rem;
	}

	/* Interactions whose element is not in the body render after it. */
	:global(.qti-item-body .qti-item-body-unslotted) {
		display: flow-root;
	}

	/*
	 * Interaction markup with no interaction data behind it (nothing renders it) stays hidden
	 * rather than showing raw prompt and choice text.
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
		margin-inline-start: 0.5rem;
		padding-inline-start: 0.5rem;
		border-inline-start: 2px solid var(--pie-qti-base-content, currentColor);
		opacity: 0.8;
	}

	/* QTI 3.0 Shared Stimulus: stimulus blocks that were prepended before the item body */
	:global(.qti-stimulus-block) {
		margin-bottom: 1rem;
	}

	/* QTI rubricBlock / qti-rubric-block content rendered in item-body source order. */
	:global(.qti-item-body .qti-rubric-block) {
		display: block;
		max-width: 100%;
		min-width: 0;
		margin: 1rem 0;
		padding: 1rem;
		overflow-x: auto;
		border: 1px solid var(--pie-qti-base-300, #d1d5db);
		border-inline-start: 4px solid var(--pie-qti-primary, #2563eb);
		border-radius: 0.5rem;
		background: var(--pie-qti-base-200, #f8fafc);
	}

	:global(.qti-item-body .qti-rubric-block > :first-child) {
		margin-top: 0;
	}

	:global(.qti-item-body .qti-rubric-block > :last-child) {
		margin-bottom: 0;
	}

	:global(.qti-item-body .qti-rubric-block table) {
		max-width: 100%;
		border-collapse: collapse;
	}

	:global(.qti-item-body .qti-rubric-block th),
	:global(.qti-item-body .qti-rubric-block td) {
		padding: 0.5rem;
		border: 1px solid var(--pie-qti-base-300, #d1d5db);
		vertical-align: top;
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
