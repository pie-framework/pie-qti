<script lang="ts">
	import '@pie-players/pie-assessment-toolkit/components/item-toolbar-element';
	import '@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element';
	import {
		assessmentToolkitRegionScopeContext,
		assessmentToolkitShellContext,
		createPackagedToolRegistry,
		ToolkitCoordinator,
		type AssessmentToolkitRegionScopeContext,
		type AssessmentToolkitShellContext,
	} from '@pie-players/pie-assessment-toolkit';
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

	const { tools = [], scopeId, scopeLabel, sourceText = '', sourceXml = '', scopeElement = null }: Props = $props();

	let shellHost = $state<HTMLElement | null>(null);
	let shellProvider: ContextProvider<typeof assessmentToolkitShellContext> | null = null;
	let shellContextRoot: ContextRoot | null = null;
	let regionScopeProvider: ContextProvider<typeof assessmentToolkitRegionScopeContext> | null = null;
	let regionScopeRoot: ContextRoot | null = null;
	let toolkitElement = $state<HTMLElement | null>(null);
	let toolkitCoordinator = $state<ToolkitCoordinator | null>(null);
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
	const toolRegistry = createPackagedToolRegistry({
		toolIds: ['textToSpeech', 'calculator'],
		toolModuleLoaders: {
			textToSpeech: () => import('@pie-players/pie-tool-tts-inline'),
			calculator: () => import('@pie-players/pie-tool-calculator-desmos'),
		},
	});
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
	const observedIconFallbackRoots = new WeakSet<Node>();
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
	const regionScopeValue = $derived.by((): AssessmentToolkitRegionScopeContext | null => {
		if (!effectiveScopeElement) return null;
		return { scopeElement: effectiveScopeElement };
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

	function clearTtsWordRangeFallbacks(highlightCoordinator: any) {
		for (const element of highlightCoordinator.__qtiSectionWordRangeFallbacks ?? []) {
			element.remove();
		}
		highlightCoordinator.__qtiSectionWordRangeFallbacks?.clear?.();
	}

	function renderTtsWordRangeFallback(highlightCoordinator: any, range: Range) {
		const rect = Array.from(range.getClientRects()).find((candidate) => candidate.width > 0 && candidate.height > 0 && candidate.x >= 0 && candidate.y >= 0);
		if (!rect) return;
		const overlay = document.createElement('span');
		overlay.setAttribute('data-pie-tts-word-element', 'true');
		overlay.setAttribute('data-pie-qti-tts-word-range-fallback', 'true');
		overlay.setAttribute('data-pie-qti-tts-word-text', normalizeTrackingText(range.toString()));
		overlay.style.position = 'absolute';
		overlay.style.left = `${rect.left + window.scrollX}px`;
		overlay.style.top = `${rect.top + window.scrollY}px`;
		overlay.style.width = `${rect.width}px`;
		overlay.style.height = `${rect.height}px`;
		overlay.style.backgroundColor = 'var(--pie-tts-word-highlight, rgba(255, 235, 59, 0.68))';
		overlay.style.borderBottom = '2px solid var(--pie-tts-word-underline, rgba(17, 24, 39, 0.7))';
		overlay.style.borderRadius = '0.12em';
		overlay.style.boxSizing = 'border-box';
		overlay.style.pointerEvents = 'none';
		overlay.style.zIndex = '2147483647';
		document.body.appendChild(overlay);
		highlightCoordinator.__qtiSectionWordRangeFallbacks ??= new Set<HTMLElement>();
		highlightCoordinator.__qtiSectionWordRangeFallbacks.add(overlay);
	}

	function createFirstWordRange(element: HTMLElement) {
		const map = collectNormalizedTextMap(element);
		const match = /\S+/.exec(map.text);
		if (!match) return null;
		return createRangeFromNormalizedSpan(map, match.index, match.index + match[0].length);
	}

	function installTtsElementHighlightFallback(coordinator: ToolkitCoordinator, scope: HTMLElement | null) {
		if (!scope) return;
		const highlightCoordinator = (coordinator as any).highlightCoordinator;
		if (!highlightCoordinator) return;
		highlightCoordinator.__qtiSectionFallbackScope = scope;
		if (highlightCoordinator.__qtiSectionFallbackInstalled) return;
		const originalHighlightWord = highlightCoordinator.highlightTTSWord?.bind(highlightCoordinator);
		const originalHighlightSentence = highlightCoordinator.highlightTTSSentence?.bind(highlightCoordinator);
		const originalClearTTSWord = highlightCoordinator.clearTTSWord?.bind(highlightCoordinator);
		const originalClearTTS = highlightCoordinator.clearTTS?.bind(highlightCoordinator);
		if (!originalHighlightSentence || !originalHighlightWord) return;

		highlightCoordinator.clearTTSWord = () => {
			clearTtsWordRangeFallbacks(highlightCoordinator);
			originalClearTTSWord?.();
		};

		highlightCoordinator.clearTTS = () => {
			clearTtsWordRangeFallbacks(highlightCoordinator);
			originalClearTTS?.();
		};

		highlightCoordinator.highlightTTSWord = (textNode: Text, startOffset: number, endOffset: number) => {
			originalHighlightWord(textNode, startOffset, endOffset);
			const activeScope = highlightCoordinator.__qtiSectionFallbackScope as HTMLElement | null;
			if (!activeScope) return;
			try {
				const range = document.createRange();
				range.setStart(textNode, startOffset);
				range.setEnd(textNode, endOffset);
				const visibleRange = resolveVisibleTrackingRange(range, activeScope);
				if (visibleRange) {
					clearTtsWordRangeFallbacks(highlightCoordinator);
					renderTtsWordRangeFallback(highlightCoordinator, visibleRange);
				}
			} catch {
				// Continue with the toolkit's native highlight if fallback geometry fails.
			}
		};

		highlightCoordinator.highlightTTSSentence = (ranges: Range[]) => {
			originalHighlightSentence(ranges);
			const activeScope = highlightCoordinator.__qtiSectionFallbackScope as HTMLElement | null;
			if (!activeScope) return;
			for (const range of ranges) {
				const block = resolveVisibleTrackingBlock(range, activeScope);
				if (!block) continue;
				block.setAttribute('data-pie-tts-sentence-element', 'true');
				highlightCoordinator.ttsSentenceElementHighlights?.add?.(block);
				const firstWordRange = createFirstWordRange(block);
				if (firstWordRange) {
					clearTtsWordRangeFallbacks(highlightCoordinator);
					renderTtsWordRangeFallback(highlightCoordinator, firstWordRange);
				}
			}
		};
		highlightCoordinator.__qtiSectionFallbackInstalled = true;
	}

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

	function createIconFallbackSvg(iconName: string): SVGSVGElement | null {
		if (typeof document === 'undefined') return null;
		const paths: Record<string, string[]> = {
			calculator: ['M6 3.5h8A1.5 1.5 0 0 1 15.5 5v10A1.5 1.5 0 0 1 14 16.5H6A1.5 1.5 0 0 1 4.5 15V5A1.5 1.5 0 0 1 6 3.5Z', 'M6.5 6.5h7', 'M7 9h1', 'M10 9h1', 'M13 9h0', 'M7 12h1', 'M10 12h1', 'M13 12h0'],
			'chevron-left': ['M12.5 4.5 7 10l5.5 5.5'],
			'chevron-right': ['M7.5 4.5 13 10l-5.5 5.5'],
			'chevron-up': ['M4.5 12.5 10 7l5.5 5.5'],
			'chevron-down': ['M4.5 7.5 10 13l5.5-5.5'],
			'magnifying-glass-minus': ['M8.5 4.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M11.5 11.5 15.5 15.5', 'M6.5 8.5h4'],
			'magnifying-glass-plus': ['M8.5 4.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M11.5 11.5 15.5 15.5', 'M6.5 8.5h4', 'M8.5 6.5v4'],
			xmark: ['M5 5l10 10', 'M15 5 5 15'],
		};
		const iconPaths = paths[iconName];
		if (!iconPaths) return null;

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('data-pie-qti-icon-fallback', iconName);
		svg.setAttribute('aria-hidden', 'true');
		svg.setAttribute('viewBox', '0 0 20 20');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('width', '1em');
		svg.setAttribute('height', '1em');
		svg.style.display = 'block';
		svg.style.pointerEvents = 'none';

		for (const pathData of iconPaths) {
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', pathData);
			path.setAttribute('stroke', 'currentColor');
			path.setAttribute('stroke-width', '1.8');
			path.setAttribute('stroke-linecap', 'round');
			path.setAttribute('stroke-linejoin', 'round');
			svg.appendChild(path);
		}

		return svg;
	}

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

	function inferFontAwesomeIconName(icon: HTMLElement, explicitIconName = '') {
		if (explicitIconName) return explicitIconName;
		const ignoredClasses = new Set(['fa-regular', 'fa-solid', 'fa-light', 'fa-thin', 'fa-duotone', 'fa-sharp']);
		const iconClass = Array.from(icon.classList).find((className) => className.startsWith('fa-') && !ignoredClasses.has(className));
		return iconClass?.replace(/^fa-/, '') ?? '';
	}

	function patchFontAwesomeIcon(icon: HTMLElement, explicitIconName = '') {
		const iconName = inferFontAwesomeIconName(icon, explicitIconName);
		if (!iconName) return;
		const renderRoot = icon.parentElement ?? icon;
		if (renderRoot.querySelector('[data-pie-qti-icon-fallback]')) return;
		const fallback = createIconFallbackSvg(iconName);
		if (!fallback) return;
		icon.style.display = 'none';
		icon.insertAdjacentElement('afterend', fallback);
	}

	function patchNdsIconButton(button: Element) {
		const renderRoot: ParentNode = (button as HTMLElement).shadowRoot ?? button;
		if (renderRoot.querySelector('[data-pie-qti-icon-fallback]')) return;
		const icon = renderRoot.querySelector('i.nds-icon-button__icon, i[class*="fa-"]') as HTMLElement | null;
		if (!icon) return;
		patchFontAwesomeIcon(icon, button.getAttribute('icon-name') ?? '');
	}

	function patchNdsIconButtons(root: ParentNode = document) {
		const buttons = queryElementsIncludingOpenShadowRoots(root, 'nds-icon-button');
		for (const button of buttons) {
			patchNdsIconButton(button);
		}
	}

	function patchPiePlayersFontAwesomeIcons(root: ParentNode = document) {
		const icons = queryElementsIncludingOpenShadowRoots(root, 'i[class*="fa-calculator"]').filter((icon): icon is HTMLElement => icon instanceof HTMLElement);
		for (const icon of icons) {
			patchFontAwesomeIcon(icon);
		}
	}

	function patchPiePlayersIconFallbacks(root: ParentNode = document) {
		patchNdsIconButtons(root);
		patchPiePlayersFontAwesomeIcons(root);
	}

	function schedulePiePlayersIconFallbackPatch(root: ParentNode = document) {
		patchPiePlayersIconFallbacks(root);
		requestAnimationFrame(() => patchPiePlayersIconFallbacks(root));
		setTimeout(() => patchPiePlayersIconFallbacks(root), 50);
		setTimeout(() => patchPiePlayersIconFallbacks(root), 250);
	}

	function observeIconFallbackRoots(observer: MutationObserver, root: ParentNode = document) {
		for (const queryRoot of collectQueryableRoots(root)) {
			if (!(queryRoot instanceof Node) || observedIconFallbackRoots.has(queryRoot)) continue;
			observer.observe(queryRoot, { childList: true, subtree: true });
			observedIconFallbackRoots.add(queryRoot);
		}
	}

	function installPiePlayersIconFallbacks() {
		if (typeof window === 'undefined' || typeof document === 'undefined') return;
		const fallbackWindow = window as typeof window & { __pieQtiNdsIconFallbackInstalled?: boolean };
		ensureFontAwesomeFallbackMarker();
		schedulePiePlayersIconFallbackPatch();
		if (fallbackWindow.__pieQtiNdsIconFallbackInstalled) return;
		fallbackWindow.__pieQtiNdsIconFallbackInstalled = true;
		const observer = new MutationObserver((mutations) => {
			observeIconFallbackRoots(observer);
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (node instanceof Element) {
						observeIconFallbackRoots(observer, node);
						schedulePiePlayersIconFallbackPatch(node);
					}
				}
			}
		});
		observeIconFallbackRoots(observer);
	}

	installPiePlayersIconFallbacks();

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

	$effect(() => {
		if (!toolkitCoordinator) return;
		installTtsElementHighlightFallback(toolkitCoordinator, effectiveScopeElement);
	});
</script>

{#if visibleTools.length > 0}
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
