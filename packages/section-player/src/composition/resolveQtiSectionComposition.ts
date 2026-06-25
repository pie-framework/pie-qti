import { sanitizeResourceUrl } from '@pie-qti/item-player/security';
import type {
	QtiResolvedStylesheetRef,
	QtiSectionDiagnostic,
	QtiSectionModel,
	QtiSectionSnapshot,
	QtiSectionToolConfig,
	QtiSharedContext,
	QtiSharedHtmlBlock,
	QtiSharedStimulus,
	ResolveQtiSectionCompositionOptions,
	ResolvedQtiSectionComposition,
} from '../contracts/index.js';
import { isQtiViewVisibleForRole } from '../visibility/role-view.js';

function emptySharedContext(): QtiSharedContext {
	return {
		passages: [],
		stimuli: [],
		rubricBlocks: [],
		testFeedback: [],
		stylesheets: [],
		catalogSources: [],
		assetDiagnostics: [],
	};
}

function resolveActiveIndex(options: ResolveQtiSectionCompositionOptions, diagnostics: QtiSectionDiagnostic[]): number {
	if (options.activeItemIdentifier) {
		const index = options.section.itemRefs.findIndex((item) => item.identifier === options.activeItemIdentifier);
		if (index >= 0) return index;

		diagnostics.push({
			severity: 'error',
			source: 'section-player',
			code: 'active-item-not-found',
			message: `Active item "${options.activeItemIdentifier}" was not found in section "${options.section.identifier}".`,
		});
	}

	if (
		typeof options.activeItemIndex === 'number' &&
		options.activeItemIndex >= 0 &&
		options.activeItemIndex < options.section.itemRefs.length
	) {
		return options.activeItemIndex;
	}

	return 0;
}

function resolveLayout(section: QtiSectionModel, sharedContext: QtiSharedContext): ResolvedQtiSectionComposition['layout'] {
	if (section.layoutPreference === 'split-pane') return 'split-pane';
	if (section.layoutPreference === 'vertical') return 'vertical';
	return sharedContext.passages.length > 0 ? 'split-pane' : 'vertical';
}

function filterToolsForRole(tools: QtiSectionToolConfig[] | undefined, role: QtiSectionModel['role']): QtiSectionToolConfig[] | undefined {
	const filtered = (tools ?? []).filter((tool) => tool.enabled !== false && isQtiViewVisibleForRole(tool.view, role ?? 'candidate'));
	return filtered.length > 0 ? filtered : undefined;
}

function resolveSharedHtmlBlockTools(block: QtiSharedHtmlBlock, role: QtiSectionModel['role']): QtiSharedHtmlBlock {
	const tools = filterToolsForRole(block.tools, role);
	return tools === block.tools ? block : { ...block, tools };
}

function resolveItemTools(item: QtiSectionModel['itemRefs'][number], role: QtiSectionModel['role']): QtiSectionModel['itemRefs'][number] {
	const tools = filterToolsForRole(item.tools, role);
	return tools === item.tools ? item : { ...item, tools };
}

function sharedAssetDiagnostic(href: string, path: string): QtiSectionDiagnostic {
	return {
		severity: 'error',
		source: 'security',
		code: 'shared-asset-url-blocked',
		message: `Shared asset URL "${href}" was blocked by the section asset URL policy.`,
		path,
	};
}

function resolveSharedStylesheetRef(
	stylesheet: QtiResolvedStylesheetRef,
	options: ResolveQtiSectionCompositionOptions,
	diagnostics: QtiSectionDiagnostic[],
	path: string,
	ownerHref?: string,
): QtiResolvedStylesheetRef {
	const packageHref = stylesheet.resolvedHref ?? stylesheet.href;
	const preflightHref = sanitizeResourceUrl(
		packageHref,
		{ ...(options.security?.urlPolicy ?? {}), assetBaseUrl: undefined },
		'link',
	);
	const evidence: QtiResolvedStylesheetRef = {
		...stylesheet,
		resolvedHref: preflightHref ?? packageHref,
	};

	if (!preflightHref) {
		diagnostics.push(sharedAssetDiagnostic(packageHref, path));
		return evidence;
	}

	const resolvedBrowserHref = options.host?.resolvePackageUrl
		? options.host.resolvePackageUrl(packageHref, {
			ownerHref,
			referenceKind: 'stylesheet',
			})
		: packageHref;

	if (!resolvedBrowserHref) {
		diagnostics.push(sharedAssetDiagnostic(packageHref, path));
		return evidence;
	}

	const browserHref = sanitizeResourceUrl(resolvedBrowserHref, options.security?.urlPolicy, 'link');
	if (!browserHref) {
		diagnostics.push(sharedAssetDiagnostic(resolvedBrowserHref, path));
		return evidence;
	}

	const hostSanitizedHref = options.host?.sanitizeAssetUrl
		? options.host.sanitizeAssetUrl(browserHref, {
			source: stylesheet.source,
			kind: 'link',
			})
		: browserHref;

	if (!hostSanitizedHref) {
		diagnostics.push(sharedAssetDiagnostic(browserHref, path));
		return evidence;
	}

	const finalBrowserHref = sanitizeResourceUrl(hostSanitizedHref, options.security?.urlPolicy, 'link');
	if (!finalBrowserHref) {
		diagnostics.push(sharedAssetDiagnostic(hostSanitizedHref, path));
		return evidence;
	}

	return {
		...evidence,
		renderHref: finalBrowserHref,
		browserHref: finalBrowserHref,
	};
}

function resolveStimulusStylesheets(
	stimulus: QtiSharedStimulus,
	options: ResolveQtiSectionCompositionOptions,
	diagnostics: QtiSectionDiagnostic[],
	stimulusIndex: number,
): QtiSharedStimulus {
	if (!stimulus.stylesheets) return stimulus;

	return {
		...stimulus,
		stylesheets: stimulus.stylesheets.map((stylesheet, stylesheetIndex) =>
			resolveSharedStylesheetRef(
				stylesheet,
				options,
				diagnostics,
				`sharedContext.stimuli[${stimulusIndex}].stylesheets[${stylesheetIndex}].href`,
				stimulus.href ?? stimulus.source,
			),
		),
	};
}

function resolveSharedContext(
	options: ResolveQtiSectionCompositionOptions,
	diagnostics: QtiSectionDiagnostic[],
): QtiSharedContext {
	const sharedContext = options.section.sharedContext ?? emptySharedContext();
	const role = options.section.role ?? 'candidate';
	const filterBlock = (block: { view?: string[] }) => isQtiViewVisibleForRole(block.view, role);

	return {
		...sharedContext,
		passages: sharedContext.passages.filter(filterBlock).map((block) => resolveSharedHtmlBlockTools(block, role)),
		stimuli: sharedContext.stimuli.map((stimulus, stimulusIndex) =>
			resolveStimulusStylesheets(stimulus, options, diagnostics, stimulusIndex),
		),
		rubricBlocks: sharedContext.rubricBlocks.filter(filterBlock).map((block) => resolveSharedHtmlBlockTools(block, role)),
		testFeedback: sharedContext.testFeedback.filter(filterBlock).map((block) => resolveSharedHtmlBlockTools(block, role)),
		stylesheets: sharedContext.stylesheets.map((stylesheet, index) =>
			resolveSharedStylesheetRef(stylesheet, options, diagnostics, `sharedContext.stylesheets[${index}].href`),
		),
	};
}

function resolveResponsesByItemIdentifier(
	options: ResolveQtiSectionCompositionOptions,
): Record<string, Record<string, unknown>> {
	if (options.responsesByItemIdentifier) return options.responsesByItemIdentifier;

	return Object.fromEntries(
		options.section.itemRefs.map((item) => [item.identifier, item.responses ?? {}]),
	) as Record<string, Record<string, unknown>>;
}

export function resolveQtiSectionComposition(
	options: ResolveQtiSectionCompositionOptions,
): ResolvedQtiSectionComposition {
	const diagnostics: QtiSectionDiagnostic[] = [...(options.section.diagnostics ?? [])];

	if (options.section.itemRefs.length === 0) {
		diagnostics.push({
			severity: 'error',
			source: 'section-player',
			code: 'empty-section',
			message: `Section "${options.section.identifier}" does not contain any item refs.`,
		});
	}

	const activeItemIndex = resolveActiveIndex(options, diagnostics);
	const role = options.section.role ?? 'candidate';
	const itemRefs = options.section.itemRefs.map((item) => resolveItemTools(item, role));
	const activeItem = itemRefs[activeItemIndex] ?? {
		identifier: '',
		itemXml: '',
	};
	const sharedContext = resolveSharedContext(options, diagnostics);
	const tools = filterToolsForRole(options.section.tools, role);
	const snapshot: QtiSectionSnapshot = {
		sectionIdentifier: options.section.identifier,
		activeItemIdentifier: activeItem.identifier,
		activeItemIndex,
		itemCount: itemRefs.length,
		responses: resolveResponsesByItemIdentifier(options),
	};

	return {
		section: {
			...options.section,
			tools,
			itemRefs,
			sharedContext,
		},
		activeItem,
		activeItemIndex,
		sharedContext,
		layout: resolveLayout(options.section, sharedContext),
		canPrevious: options.canPrevious ?? activeItemIndex > 0,
		canNext: options.canNext ?? activeItemIndex < options.section.itemRefs.length - 1,
		snapshot,
		diagnostics: [...diagnostics, ...sharedContext.assetDiagnostics],
		security: options.security,
		host: options.host,
	};
}
