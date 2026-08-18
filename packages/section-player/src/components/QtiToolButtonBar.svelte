<script lang="ts">
	import {
		assessmentToolkitRegionScopeContext,
		assessmentToolkitShellContext,
		ToolkitCoordinator,
		ToolRegistry,
		type AssessmentToolkitRegionScopeContext,
		type AssessmentToolkitShellContext,
	} from '@pie-players/pie-assessment-toolkit';
	// pie-assessment-toolkit 0.3.65 moved the concrete tool registrations out of the
	// toolkit core, so a host composes the capabilities it wants. The two
	// registrations are imported individually rather than through
	// createPackagedToolRegistry(), whose PACKAGED_TOOL_REGISTRATIONS statically
	// references all eleven packaged tools and so drags every one into the bundle.
	import {
		calculatorToolRegistration,
		ttsToolRegistration,
	} from '@pie-players/pie-default-tool-loaders';
	import { ContextProvider, ContextRoot } from '@pie-players/pie-context';
	import type { QtiSectionToolConfig } from '../contracts/index.js';
	import { resolveSectionTtsProviderConfig } from '../tools/section-tool-config.js';

	interface Props {
		tools?: QtiSectionToolConfig[];
		scopeId: string;
		scopeLabel: string;
		sourceText?: string;
		sourceXml?: string;
		scopeElement?: HTMLElement | null;
	}

	type TtsHighlightContext = {
		scopeElement?: HTMLElement | null;
	};

	type TtsHighlightTargetResolver = {
		resolveWordRange?: (range: Range, context: TtsHighlightContext) => Range | null | undefined;
		resolveSentenceRanges?: (ranges: Range[], context: TtsHighlightContext) => Array<Range | HTMLElement> | null | undefined;
	};

	type QtiRegionScopeContext = AssessmentToolkitRegionScopeContext & {
		ttsHighlightTargetResolver?: TtsHighlightTargetResolver | null;
	};

	const { tools = [], scopeId, scopeLabel, sourceText = '', sourceXml = '', scopeElement = null }: Props = $props();

	let shellHost = $state<HTMLElement | null>(null);
	let shellProvider: ContextProvider<typeof assessmentToolkitShellContext> | null = null;
	let shellContextRoot: ContextRoot | null = null;
	let regionScopeProvider: ContextProvider<typeof assessmentToolkitRegionScopeContext> | null = null;
	let regionScopeRoot: ContextRoot | null = null;
	let toolkitElement = $state<HTMLElement | null>(null);
	let toolkitCoordinator = $state<ToolkitCoordinator | null>(null);
	let toolkitElementsReady = $state(false);
	const visibleTools = $derived(tools.filter((tool) => tool.enabled !== false));
	const hasTts = $derived(visibleTools.some((tool) => tool.toolId === 'textToSpeech'));
	const calculatorTool = $derived(visibleTools.find((tool) => tool.toolId === 'calculator'));
	const toolbarTools = $derived(
		[
			hasTts ? 'textToSpeech' : '',
			calculatorTool ? 'calculator' : '',
		]
			.filter(Boolean)
			.join(','),
	);
	const contentKind = $derived(scopeLabel === 'passage' ? 'rubric-block-stimulus' : 'assessment-item');
	const level = $derived(scopeLabel === 'passage' ? 'passage' : 'item');
	const sourceMarkup = $derived(sourceXml.trim() || sourceText.trim());
	// The toolkit core no longer ships a default tag map either, for the same reason:
	// a map names capabilities, so it belongs to whoever decides which exist. These
	// two entries mirror PACKAGED_TOOL_TAG_MAP.
	const toolRegistry = (() => {
		const registry = new ToolRegistry();
		registry.register(ttsToolRegistration);
		registry.register(calculatorToolRegistration);
		registry.setComponentOverrides({
			toolTagMap: {
				textToSpeech: 'pie-tool-text-to-speech',
				calculator: 'pie-tool-calculator',
			},
		});
		registry.setToolModuleLoaders({
			textToSpeech: () => import('@pie-players/pie-tool-tts-inline'),
			calculator: () => import('@pie-players/pie-tool-calculator-desmos'),
		});
		return registry;
	})();
	const ttsProvider = $derived(visibleTools.find((tool) => tool.toolId === 'textToSpeech')?.provider ?? {});
	const calculatorParams = $derived(calculatorTool?.renderParams ?? {});
	const toolsConfig = $derived({
		pnpEnforcement: 'off',
		policy: {
			allowed: visibleTools.map((tool) => String(tool.toolId)),
			blocked: [],
		},
		placement: {
			section: [],
			item: level === 'item' ? visibleTools.map((tool) => String(tool.toolId)) : [],
			passage: level === 'passage' ? visibleTools.map((tool) => String(tool.toolId)) : [],
		},
		providers: {
			textToSpeech: resolveSectionTtsProviderConfig(ttsProvider),
			calculator: {
				provider: {
					id: 'calculator-desmos',
				},
			},
		},
	});
	const toolEntity = $derived({
		id: scopeId,
		config: {
			markup: sourceMarkup,
			content: sourceMarkup,
			elements: {
				[scopeId]: sourceMarkup,
			},
			models: [
				{
					id: scopeId,
					prompt: sourceMarkup,
					markup: sourceMarkup,
					...calculatorParams,
				},
			],
		},
	});
	const effectiveScopeElement = $derived(scopeElement || shellHost);
	const readableTrackingSelector =
		'p,h1,h2,h3,h4,h5,h6,li,label,td,th,blockquote,figcaption,[role="heading"],[role="listitem"],[role="radio"],.qti-choice-prompt,.qti-choice-text';
	const shellContextValue = $derived.by((): AssessmentToolkitShellContext | null => {
		if (!effectiveScopeElement) return null;
		return {
			kind: level === 'passage' ? 'passage' : 'item',
			itemId: scopeId,
			canonicalItemId: scopeId,
			contentKind,
			regionPolicy: 'default',
			scopeElement: effectiveScopeElement,
			item: toolEntity,
			contextVersion: Date.now(),
		};
	});
	const ttsHighlightTargetResolver: TtsHighlightTargetResolver = {
		resolveWordRange: (range, context) => {
			const scope = context.scopeElement ?? effectiveScopeElement;
			if (!scope) return range;
			return resolveVisibleTrackingRange(range, scope);
		},
		resolveSentenceRanges: (ranges, context) => {
			const scope = context.scopeElement ?? effectiveScopeElement;
			if (!scope) return ranges;
			const targets = ranges
				.map((range) => resolveVisibleTrackingBlock(range, scope))
				.filter((target): target is HTMLElement => target instanceof HTMLElement);
			return targets.length > 0 ? targets : ranges;
		},
	};

	$effect(() => {
		if (visibleTools.length === 0 || toolkitElementsReady) return;
		let cancelled = false;
		void Promise.all([
			import('@pie-players/pie-assessment-toolkit/components/item-toolbar-element'),
			import('@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element'),
		])
			.then(() => {
				if (!cancelled) toolkitElementsReady = true;
			})
			.catch((error) => {
				if (!cancelled) console.error('Unable to load assessment toolkit elements:', error);
			});
		return () => {
			cancelled = true;
		};
	});
	const regionScopeValue = $derived.by((): QtiRegionScopeContext | null => {
		if (!effectiveScopeElement) return null;
		return {
			scopeElement: effectiveScopeElement,
			ttsHighlightTargetResolver,
		};
	});

	type TextPosition = { node: Text; offset: number };

	function normalizeTrackingText(value: string) {
		return value.replace(/\s+/g, ' ').trim();
	}

	function isVisibleTrackingElement(element: Element) {
		const rect = element.getBoundingClientRect();
		const style = window.getComputedStyle(element);
		return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && rect.x >= 0 && rect.y >= 0;
	}

	function isProjectionElement(element: Element | null) {
		return !!element?.closest('[data-qti-tts-readable-projection]');
	}

	function nearestReadableBlock(node: Node | null, scope: HTMLElement): HTMLElement | null {
		const start = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
		const block = start?.closest?.(readableTrackingSelector);
		return block instanceof HTMLElement && scope.contains(block) ? block : scope;
	}

	function findVisibleTrackingBlock(sourceBlock: HTMLElement, scope: HTMLElement) {
		const sourceText = normalizeTrackingText(sourceBlock.textContent ?? '');
		if (!sourceText) return null;
		const candidates = queryElementsIncludingOpenShadowRoots(scope, readableTrackingSelector).filter(
			(candidate): candidate is HTMLElement =>
				candidate instanceof HTMLElement &&
				!isProjectionElement(candidate) &&
				isVisibleTrackingElement(candidate) &&
				normalizeTrackingText(candidate.textContent ?? '') === sourceText,
		);
		return candidates
			.sort((left, right) => {
				const leftRect = left.getBoundingClientRect();
				const rightRect = right.getBoundingClientRect();
				return leftRect.width * leftRect.height - rightRect.width * rightRect.height;
			})[0] ?? null;
	}

	function resolveVisibleTrackingBlock(range: Range, scope: HTMLElement) {
		const sourceBlock = nearestReadableBlock(range.startContainer, scope);
		if (!sourceBlock) return null;
		if (!isProjectionElement(sourceBlock)) return sourceBlock;
		return findVisibleTrackingBlock(sourceBlock, scope);
	}

	function collectNormalizedTextMap(root: Element) {
		const text: string[] = [];
		const positions: TextPosition[] = [];
		let lastWasWhitespace = true;
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let node = walker.nextNode();

		while (node) {
			const textNode = node as Text;
			const raw = textNode.textContent ?? '';
			for (let offset = 0; offset < raw.length; offset += 1) {
				const char = raw[offset];
				if (/\s/.test(char)) {
					if (!lastWasWhitespace) {
						text.push(' ');
						positions.push({ node: textNode, offset });
						lastWasWhitespace = true;
					}
					continue;
				}
				text.push(char);
				positions.push({ node: textNode, offset });
				lastWasWhitespace = false;
			}
			node = walker.nextNode();
		}

		while (text[text.length - 1] === ' ') {
			text.pop();
			positions.pop();
		}

		return { text: text.join(''), positions };
	}

	function findNormalizedPosition(positions: TextPosition[], node: Node, offset: number) {
		return positions.findIndex((position) => position.node === node && position.offset === offset);
	}

	function createRangeFromNormalizedSpan(map: { positions: TextPosition[] }, startIndex: number, endIndex: number) {
		const start = map.positions[startIndex];
		const end = map.positions[endIndex - 1];
		if (!start || !end) return null;
		const range = document.createRange();
		range.setStart(start.node, start.offset);
		range.setEnd(end.node, end.offset + 1);
		return range;
	}

	function mapProjectionRangeToVisibleRange(range: Range, sourceBlock: HTMLElement, visibleBlock: HTMLElement) {
		const sourceMap = collectNormalizedTextMap(sourceBlock);
		const visibleMap = collectNormalizedTextMap(visibleBlock);
		if (sourceMap.text !== visibleMap.text) return null;

		const startIndex = findNormalizedPosition(sourceMap.positions, range.startContainer, range.startOffset);
		const endIndex = findNormalizedPosition(sourceMap.positions, range.endContainer, Math.max(range.endOffset - 1, 0));
		if (startIndex < 0 || endIndex < startIndex) return null;
		return createRangeFromNormalizedSpan(visibleMap, startIndex, endIndex + 1);
	}

	function resolveVisibleTrackingRange(range: Range, scope: HTMLElement) {
		const sourceBlock = nearestReadableBlock(range.startContainer, scope);
		if (!sourceBlock || !isProjectionElement(sourceBlock)) return range;
		const visibleBlock = findVisibleTrackingBlock(sourceBlock, scope);
		if (!visibleBlock) return null;
		return mapProjectionRangeToVisibleRange(range, sourceBlock, visibleBlock);
	}

	/**
	 * Stop pie-assessment-toolkit from injecting FontAwesome into this page.
	 *
	 * Its ItemToolBar appends FontAwesome Free from jsDelivr plus host-relative
	 * /_fa-pro/*.min.css links at import time, expecting the embedding app to serve
	 * FontAwesome Pro — Quiz Engine does; this repo does not, so those requests 404.
	 * The injection is skipped when a stylesheet whose href matches
	 * /font.?awesome|fa-?pro/i is already present, so a dummy data: URL suppresses it.
	 *
	 * This runs regardless of the `ndsIcons` opt-in: the toolkit injects on import, not
	 * on the decision to render vendored icon buttons. Removing it brings the 404s back,
	 * which apps/demo/tests/playwright/section-player.pw.ts asserts against.
	 */
	function ensureFontAwesomeFallbackMarker() {
		if (typeof document === 'undefined') return;
		const hasFontAwesomeLink = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).some((link) =>
			/font.?awesome|fa-?pro/i.test((link as HTMLLinkElement).href),
		);
		if (hasFontAwesomeLink) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'data:text/css;charset=utf-8,/*fontawesome-pie-qti-fallback*/';
		document.head.appendChild(link);
	}

	ensureFontAwesomeFallbackMarker();

	function collectQueryableRoots(root: ParentNode, roots: ParentNode[] = [], seen = new WeakSet<object>()) {
		if (seen.has(root)) return roots;
		seen.add(root);
		roots.push(root);

		const elements: Element[] = [];
		if (root instanceof Element) elements.push(root);
		elements.push(...Array.from(root.querySelectorAll('*')));

		for (const element of elements) {
			if (element.shadowRoot) {
				collectQueryableRoots(element.shadowRoot, roots, seen);
			}
		}

		return roots;
	}

	function queryElementsIncludingOpenShadowRoots(root: ParentNode, selector: string) {
		const elements: Element[] = [];
		for (const queryRoot of collectQueryableRoots(root)) {
			if (queryRoot instanceof Element && queryRoot.matches(selector)) {
				elements.push(queryRoot);
			}
			elements.push(...Array.from(queryRoot.querySelectorAll(selector)));
		}
		return elements;
	}

	$effect(() => {
		if (toolkitCoordinator) return;
		toolkitCoordinator = new ToolkitCoordinator({
			assessmentId: `qti-section-demo-${scopeId}`,
			lazyInit: false,
			toolConfigStrictness: 'off',
			tools: toolsConfig as any,
			toolRegistry,
		});
	});

	$effect(() => {
		if (!shellHost || !shellContextValue) return;
		shellProvider = new ContextProvider(shellHost, {
			context: assessmentToolkitShellContext,
			initialValue: shellContextValue,
		});
		shellProvider.connect();
		shellContextRoot = new ContextRoot(shellHost);
		shellContextRoot.attach();

		return () => {
			shellContextRoot?.detach();
			shellContextRoot = null;
			shellProvider?.disconnect();
			shellProvider = null;
		};
	});

	$effect(() => {
		if (!shellContextValue) return;
		shellProvider?.setValue(shellContextValue);
	});

	$effect(() => {
		if (!shellHost || !regionScopeValue) return;
		regionScopeProvider = new ContextProvider(shellHost, {
			context: assessmentToolkitRegionScopeContext,
			initialValue: regionScopeValue,
		});
		regionScopeProvider.connect();
		regionScopeRoot = new ContextRoot(shellHost);
		regionScopeRoot.attach();

		return () => {
			regionScopeRoot?.detach();
			regionScopeRoot = null;
			regionScopeProvider?.disconnect();
			regionScopeProvider = null;
		};
	});

	$effect(() => {
		if (!regionScopeValue) return;
		regionScopeProvider?.setValue(regionScopeValue);
	});

	$effect(() => {
		if (!toolkitCoordinator) return;
		toolkitElement?.dispatchEvent(
			new CustomEvent('qti-toolkit-coordinator-ready', {
				bubbles: true,
				composed: true,
				detail: {
					scopeId,
					level,
					coordinator: toolkitCoordinator,
				},
			}),
		);
	});
</script>

{#if visibleTools.length > 0 && toolkitElementsReady}
	<span bind:this={shellHost} class="qti-pie-tool-shell">
		{#if toolkitCoordinator}
			<pie-assessment-toolkit
				bind:this={toolkitElement}
				assessment-id="qti-section-demo"
				section-id={`section-${scopeId}`}
				tools={toolsConfig}
				{toolRegistry}
				coordinator={toolkitCoordinator}
				lazy-init={false}
			>
				<pie-item-toolbar
					{level}
					scope-id={scopeId}
					item-id={scopeId}
					catalog-id={scopeId}
					tools={toolbarTools}
					{contentKind}
					size="md"
					language="en-US"
					scopeElement={effectiveScopeElement}
					{toolRegistry}
					item={toolEntity}
				></pie-item-toolbar>
			</pie-assessment-toolkit>
		{/if}
	</span>
{/if}

<style>
	.qti-pie-tool-shell {
		display: inline-flex;
		margin-left: auto;
	}

	pie-assessment-toolkit {
		display: inline-flex;
	}
</style>
