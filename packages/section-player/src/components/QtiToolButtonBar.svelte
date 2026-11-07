<script lang="ts">
	import { ToolkitCoordinator, ToolRegistry } from '@pie-players/pie-assessment-toolkit';
	// pie-assessment-toolkit 0.3.65 moved the concrete tool registrations out of the
	// toolkit core, so a host composes the capabilities it wants. The registrations
	// are imported individually rather than through createPackagedToolRegistry(),
	// whose PACKAGED_TOOL_REGISTRATIONS registers all the packaged tools.
	import {
		calculatorToolRegistration,
		DEFAULT_TOOL_MODULE_LOADERS,
		protractorToolRegistration,
		rulerToolRegistration,
		ttsToolRegistration,
	} from '@pie-players/pie-default-tool-loaders';
	import { interfaceLocaleAttributes, type I18nProvider } from '@pie-qti/i18n';
	import type { PnpProfile } from '@pie-qti/item-player';
	import type { QtiSectionToolConfig } from '../contracts/index.js';
	import type { QtiDisplaySettingsControls } from '../tools/display-settings.js';
	import type { SpokenCatalog } from '../tts/spoken-catalogs.js';
	import { companionMaterialsOf, companionToolIds } from '../tools/pnp-tool-supports.js';
	import { resolveSectionTtsProviderConfig, toolkitAssessmentOf } from '../tools/section-tool-config.js';

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
		/**
		 * The assessment the scope belongs to. It names the toolkit's assessment
		 * (its element ids and its policy provenance); without it the scope id stands in.
		 */
		assessmentId?: string;
		/** The candidate's PNP. Its tool supports refine what the tool bar shows. */
		pnp?: PnpProfile;
		/** The section's display settings dialog; present, the bar opens it from its own button. */
		displaySettingsControls?: QtiDisplaySettingsControls | null;
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
		assessmentId,
		pnp,
		displaySettingsControls = null,
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
	const rulerTool = $derived(visibleTools.find((tool) => tool.toolId === 'ruler'));
	const protractorTool = $derived(visibleTools.find((tool) => tool.toolId === 'protractor'));
	const hasToolkitTools = $derived(visibleTools.length > 0);
	const displaySettingsLabel = $derived(
		i18n?.t('sectionPlayer.displaySettings.title', 'Display settings') ?? 'Display settings',
	);
	const toolbarTools = $derived(
		[
			hasTts ? 'textToSpeech' : '',
			calculatorTool ? 'calculator' : '',
			rulerTool ? 'ruler' : '',
			protractorTool ? 'protractor' : '',
		]
			.filter(Boolean)
			.join(','),
	);
	const contentKind = $derived(scopeLabel === 'passage' ? 'rubric-block-stimulus' : 'assessment-item');
	const level = $derived(scopeLabel === 'passage' ? 'passage' : 'item');
	const sourceMarkup = $derived(sourceXml.trim() || sourceText.trim());
	// The assessment the tool policy names: identity from the host, the candidate's
	// tool supports as its profile, so enforcement refines the bar by the PNP.
	const toolkitAssessmentId = $derived(assessmentId ?? `qti-section-${scopeId}`);
	const assessmentEntity = $derived(toolkitAssessmentOf(toolkitAssessmentId, pnp));
	// The toolkit core ships no default tag map either: a map names capabilities, so
	// it belongs to whoever decides which exist. These entries mirror PACKAGED_TOOL_TAG_MAP.
	const toolRegistry = (() => {
		const registry = new ToolRegistry();
		registry.register(ttsToolRegistration);
		registry.register(calculatorToolRegistration);
		registry.register(rulerToolRegistration);
		registry.register(protractorToolRegistration);
		registry.setComponentOverrides({
			toolTagMap: {
				textToSpeech: 'pie-tool-tts-inline',
				calculator: 'pie-tool-calculator',
				ruler: 'pie-tool-ruler',
				protractor: 'pie-tool-protractor',
			},
		});
		registry.setToolModuleLoaders({
			textToSpeech: () => import('@pie-players/pie-tool-tts-inline'),
			calculator: () => import('@pie-players/pie-tool-calculator-desmos'),
			// The packaged loaders keep the measurement overlays out of the initial
			// bundle: their modules load when a ruler or protractor first renders.
			ruler: DEFAULT_TOOL_MODULE_LOADERS.ruler,
			protractor: DEFAULT_TOOL_MODULE_LOADERS.protractor,
		});
		return registry;
	})();
	const ttsProvider = $derived(visibleTools.find((tool) => tool.toolId === 'textToSpeech')?.provider ?? {});
	const calculatorType = $derived(calculatorTool?.renderParams?.calculatorType);
	// The tools the item's companion materials list, among those the bar shows.
	const requiredToolIds = $derived.by(() => {
		if (level !== 'item') return [];
		const shown = new Set(visibleTools.map((tool) => String(tool.toolId)));
		return companionToolIds(companionMaterialsOf(sourceXml)).filter((toolId) => shown.has(toolId));
	});
	const scopeSettings = $derived.by(() => {
		const settings: Record<string, unknown> = {};
		// The calculator opens the type its item's `toolParameters` name.
		if (typeof calculatorType === 'string') settings.toolParameters = { calculator: { type: calculatorType } };
		// The item's companion materials are its requirements: under PNP enforcement a
		// required tool skips the toolkit's content check, so a ruler an item asks for
		// shows even where its markup holds no math the check recognises.
		if (requiredToolIds.length > 0) settings.requiredTools = requiredToolIds;
		return Object.keys(settings).length > 0 ? settings : null;
	});
	const toolsConfig = $derived({
		// PNP/profile policy refines the bar: the bound assessment's profile (the
		// candidate's supports) protects granted tools and withdraws prohibited ones.
		pnpEnforcement: 'on' as const,
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
		if (!hasToolkitTools || toolkitElementsReady) return;
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
		// A bar holding only the display settings button needs no toolkit.
		if (toolkitCoordinator || !hasToolkitTools) return;
		const coordinator = new ToolkitCoordinator({
			assessmentId: toolkitAssessmentId,
			lazyInit: false,
			toolConfigStrictness: 'off',
			tools: toolsConfig as any,
			toolRegistry,
		});
		// Bind the candidate's profile so enforcement reads it; the coordinator is
		// ours, so the toolkit element will not apply its own assessment property.
		coordinator.updateAssessment(assessmentEntity as any);
		toolkitCoordinator = coordinator;
	});

	$effect(() => {
		if (!toolkitCoordinator) return;
		toolkitCoordinator.updateAssessment(assessmentEntity as any);
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

{#if hasToolkitTools || displaySettingsControls}
	<span bind:this={shellHost} class="qti-pie-tool-shell">
		{#if displaySettingsControls}
			<button
				type="button"
				class="qti-display-settings-button"
				data-testid="section-display-settings-button"
				aria-haspopup="dialog"
				onclick={() => void displaySettingsControls?.openDialog()}
			>
				<svg
					class="qti-display-settings-icon"
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<!-- Magnifier with a plus: the shared idiom for adjusting text size. -->
					<circle cx="11" cy="11" r="7" />
					<line x1="8.5" y1="11" x2="13.5" y2="11" />
					<line x1="11" y1="8.5" x2="11" y2="13.5" />
					<line x1="16.5" y1="16.5" x2="21" y2="21" />
				</svg>
				<span class="qti-display-settings-label">{displaySettingsLabel}</span>
			</button>
		{/if}
		{#if hasToolkitTools && toolkitCoordinator && toolkitElementsReady}
			<pie-assessment-toolkit
				bind:this={toolkitElement}
				assessment-id={toolkitAssessmentId}
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
		margin-inline-start: auto;
		align-items: center;
		gap: var(--pie-qti-space-2, 0.5rem);
	}

	pie-assessment-toolkit,
	pie-item-scope {
		display: inline-flex;
	}

	.qti-display-settings-button {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--pie-qti-space-1, 0.25rem);
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-3, 0.75rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		cursor: pointer;
	}

	.qti-display-settings-button:hover {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.qti-display-settings-button:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.qti-display-settings-icon {
		inline-size: 1.25rem;
		block-size: 1.25rem;
		flex: none;
	}
</style>
