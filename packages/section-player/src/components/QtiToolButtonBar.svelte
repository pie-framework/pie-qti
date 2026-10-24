<script lang="ts">
	import { ToolkitCoordinator, ToolRegistry } from '@pie-players/pie-assessment-toolkit';
	import { interfaceLocaleAttributes, type I18nProvider } from '@pie-qti/i18n';
	// pie-assessment-toolkit 0.3.65 moved the concrete tool registrations out of the
	// toolkit core, so a host composes the capabilities it wants. The two
	// registrations are imported individually rather than through
	// createPackagedToolRegistry(), whose PACKAGED_TOOL_REGISTRATIONS statically
	// references all eleven packaged tools and so drags every one into the bundle.
	import {
		calculatorToolRegistration,
		ttsToolRegistration,
	} from '@pie-players/pie-default-tool-loaders';
	import type { QtiSectionToolConfig } from '../contracts/index.js';
	import type { SpokenCatalog } from '../tts/spoken-catalogs.js';
	import { resolveSectionTtsProviderConfig } from '../tools/section-tool-config.js';

	interface Props {
		tools?: QtiSectionToolConfig[];
		scopeId: string;
		scopeLabel: string;
		sourceText?: string;
		sourceXml?: string;
		/** The spoken cards the scope's SSML makes, resolved through its `data-catalog-idref`s. */
		accessibilityCatalogs?: SpokenCatalog[];
		/** The scope's content language, from its `xml:lang`; sets the tools' language and TTS voice. */
		language?: string;
		scopeElement?: HTMLElement | null;
		/** The section's interface locale, which the toolkit takes as its own. */
		i18n?: I18nProvider;
	}

	const {
		tools = [],
		scopeId,
		scopeLabel,
		sourceText = '',
		sourceXml = '',
		accessibilityCatalogs = [],
		language,
		scopeElement = null,
		i18n,
	}: Props = $props();

	let shellHost = $state<HTMLElement | null>(null);
	let toolkitElement = $state<HTMLElement | null>(null);
	let toolkitCoordinator = $state<ToolkitCoordinator | null>(null);
	let toolkitElementsReady = $state(false);
	// The toolkit's `locale` attribute is its only locale driver: its chrome stamps
	// that locale's lang/dir and renders from its own catalogs.
	const interfaceLocale = $derived(interfaceLocaleAttributes(i18n)?.lang);
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
				textToSpeech: 'pie-tool-tts-inline',
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
	const calculatorType = $derived(calculatorTool?.renderParams?.calculatorType);
	// The calculator opens the type its item's `toolParameters` name.
	const scopeSettings = $derived(
		typeof calculatorType === 'string' ? { toolParameters: { calculator: { type: calculatorType } } } : null,
	);
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
			textToSpeech: resolveSectionTtsProviderConfig(ttsProvider, language),
			calculator: {
				provider: {
					id: 'calculator-desmos',
				},
			},
		},
	});
	const toolEntity = $derived({
		id: scopeId,
		accessibilityCatalogs,
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
				},
			],
		},
	});
	const effectiveScopeElement = $derived(scopeElement || shellHost);

	$effect(() => {
		if (visibleTools.length === 0 || toolkitElementsReady) return;
		let cancelled = false;
		void Promise.all([
			import('@pie-players/pie-assessment-toolkit/components/item-scope-element'),
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
				locale={interfaceLocale}
				lazy-init={false}
			>
				<pie-item-scope
					item-id={scopeId}
					canonical-item-id={scopeId}
					content-kind={contentKind}
					region-policy="default"
					scopeElement={effectiveScopeElement}
					item={toolEntity}
					settings={scopeSettings}
				>
					<pie-item-toolbar
						{level}
						scope-id={scopeId}
						item-id={scopeId}
						catalog-id={scopeId}
						tools={toolbarTools}
						{contentKind}
						size="md"
						{language}
						{toolRegistry}
					></pie-item-toolbar>
				</pie-item-scope>
			</pie-assessment-toolkit>
		{/if}
	</span>
{/if}

<style>
	.qti-pie-tool-shell {
		display: inline-flex;
		margin-left: auto;
	}

	pie-assessment-toolkit,
	pie-item-scope {
		display: inline-flex;
	}
</style>
