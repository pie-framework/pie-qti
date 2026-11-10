import {
	type BaseType,
	buildOutcomeProcessingAst,
	buildResponseProcessingAst,
	buildTemplateProcessingAst,
	type Cardinality,
	DeclarationContext,
	type DeclarationMap,
	durationSecondsFromMilliseconds,
	evalExpr,
	execProgram,
	findAssessmentItem,
	getAttr,
	isElement,
	isNullValue,
	localName,
	OperatorRegistry,
	parseXml,
	type ProcessingProgram,
	type QtiValue,
	qtiNull,
	qtiValue,
	toBoolean,
	toNumber,
	toStringValue,
} from '@pie-qti/qti-processing';
import type { ElementNameMapper, AttributeNameMapper, QtiVersion } from '@pie-qti/qti-common';
import { prepareContentMarkup } from '@pie-qti/qti-common/accessibility';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import { DefaultI18nProvider, type I18nProvider } from '@pie-qti/i18n';
import {
	detectQtiVersion,
	detectQtiVersionDetailed,
	isShownByIdentifier,
	type QtiVersionDetection,
} from '@pie-qti/qti-common';
import type {
	AssessmentItemDocument,
	ResponseProcessingDescriptor,
} from '../document/AssessmentItemDocument.js';
import { parseAssessmentItemDocument } from '../document/AssessmentItemDocument.js';
import type { ContentHandler, ContentHandlers } from '../document/contentPass.js';
import { printVariable, readPrintedVariableOptions } from '../document/printedVariable.js';
import {
	createExtractionRegistry,
	registerFrameworkDeliveryFields,
	type ExtractionRegistry,
} from '../extraction/ExtractionRegistry.js';
import { extractInteractionData } from '../extraction/interactionExtractionPipeline.js';
import { getStandardInteractionModules } from '../interactions/modules.js';
import type {
	AdaptiveAttemptResult,
	CompletionStatus,
	HtmlContent,
	ItemSessionAction,
	ItemSessionActionCommand,
	ItemLifecycleStatus,
	ItemSessionActionResult,
	ItemSessionState,
	ModalFeedback,
	ItemSessionEngineConfig,
	PlayerSecurityConfig,
	QTIRole,
	RubricBlock,
	RubricBlockOptions,
	ScoringResult,
	SerializedItemSessionState,
	SerializedItemSessionVariable,
} from '../types/index.js';
import type { BaseInteractionData, TextEntryInteractionData } from '../interactions/shared/types.js';
import type { ResponseValidationResult } from '../types/responseValidation.js';
import type { ComponentRegistry } from './ComponentRegistry.js';
import { createComponentRegistry } from './ComponentRegistry.js';
import { collectItemDiagnostics, type QtiItemDiagnostic, reportItemDiagnostics } from './compliance.js';
import { type MatchGroupConstraints, readMatchGroupConstraints } from './matchGroups.js';
import { createSeededRng } from './random.js';
import {
	resolveResponseProcessingTemplate,
	UnsupportedResponseProcessingTemplateError,
} from './responseProcessingTemplates.js';
import { sanitizeHtml } from './sanitizer.js';
import { toTrustedHtml } from './trustedTypes.js';
import { sanitizeResourceUrl } from './urlPolicy.js';
import { enforceItemXmlLimits } from './parsingLimits.js';
import type { PnpProfile } from '../pnp/types.js';
import { applyPnpToRoot } from '../pnp/applyPnp.js';
import type { CatalogIndex } from '../catalog/types.js';
import { extractCatalog, extractCatalogFromItemXml, mergeCatalogs } from '../catalog/catalogExtractor.js';
import { getCatalogEntryWithAliases } from '../catalog/catalogLookup.js';
import { PciHost } from '../pci/PciHost.js';
import { cloneValue } from '../utils/cloneFreeze.js';
import { attributeNameMapperForVersion, elementNameMapperForVersion } from './nameMappers.js';
import {
	buildDeclarationMap,
	ensureBuiltinDeclarations,
	type DeclKind,
} from './declarations/declarationBuilder.js';
import { coerceToDeclarationValue } from './declarations/declarationValues.js';
import {
	isAttempted,
	validateAttemptResponses,
	validateResponses,
} from './processing/responseValidation.js';
import type { ExtractedPci, PciInteractionStatus } from '../pci/types.js';
import { createTextEntryStringResponse, textEntryStringIdentifier } from '../interactions/text-entry/response.js';

/** Choices a template variable can show or hide, by canonical name. */
const TEMPLATE_CHOICES = [
	'simplechoice',
	'simpleassociablechoice',
	'gaptext',
	'gapimg',
	'gap',
	'hottext',
	'inlinechoice',
	'hotspotchoice',
	'associablehotspot',
] as const;

/** Immutable source-derived artifacts shared by sessions from one definition. */
interface PreparedPlayerDefinition {
	readonly identifier: string;
	readonly mapper: ElementNameMapper;
	readonly attributeMapper: AttributeNameMapper;
	readonly itemDocument: AssessmentItemDocument;
	readonly declarations: DeclarationMap;
	readonly responseProcessing: ResponseProcessingDescriptor;
	readonly responseProcessingProgram: ProcessingProgram | null;
	readonly templateProcessingProgram: ProcessingProgram | null;
	readonly outcomeProcessingProgram: ProcessingProgram | null;
	readonly catalogIndex: CatalogIndex;
	readonly stimulusCatalogIndexes: Map<string, CatalogIndex>;
	readonly diagnostics: readonly QtiItemDiagnostic[];
	readonly matchGroupConstraints: ReadonlyMap<string, MatchGroupConstraints>;
}

interface PlayerConstructionOptions {
	/** Compile source-derived artifacts without starting an item attempt. */
	readonly compileOnly?: boolean;
	/** Restore supplies template variables, so avoid an observable throwaway template run. */
	readonly skipTemplateProcessing?: boolean;
}

/** @internal Used by AssessmentItemDefinition; deliberately absent from the package root API. */
export function preparePlayerDefinitionInternal(config: ItemSessionEngineConfig): unknown {
	const compiler = new Player(config, undefined, { compileOnly: true });
	try {
		return compiler.capturePreparedDefinition();
	} finally {
		compiler.destroy();
	}
}

/** @internal Used by ItemSession; deliberately absent from the package root API. */
export function createPlayerFromPreparedInternal(
	config: ItemSessionEngineConfig,
	prepared: unknown,
	skipTemplateProcessing = false,
): Player {
	return new Player(config, prepared as PreparedPlayerDefinition, {
		skipTemplateProcessing,
	});
}

export class Player {
	private role: QTIRole;
	/** @internal Engine modules read the resolved configuration through the host. */
	config: ItemSessionEngineConfig;
	private itemXml: string;
	/** @internal Engine modules read the parsed item document through the host. */
	itemDocument: AssessmentItemDocument;
	/** @internal Engine modules read the session's declarations through the host. */
	decls: DeclarationMap;
	private sourceDeclarations: DeclarationMap;
	/** @internal Engine modules read the variable context through the host. */
	ctx: DeclarationContext;
	/** @internal Engine modules read the session's random stream through the host. */
	rng: () => number;
	/** @internal Engine modules read the operator registry through the host. */
	ops: OperatorRegistry;
	private extractionRegistry: ExtractionRegistry;
	private interactionDataCache: readonly BaseInteractionData[] | null = null;
	/** Template variables declared with `mathVariable`, substituted into MathML. */
	private mathVariableIds: ReadonlySet<string> | null = null;
	/** Template variables declared with `paramVariable`, substituted into `<param>` values. */
	private paramVariableIds: ReadonlySet<string> | null = null;
	private componentRegistry: ComponentRegistry;
	private i18nProvider: I18nProvider;
	private mapper: ElementNameMapper;
	/** The item's detected QTI version ('unknown' when nothing identified it). */
	private qtiVersion: QtiVersion;

	private warnedImpliedZeroMaxScore = false;
	private responseProcessingProgram: ProcessingProgram | null = null;
	private responseProcessing: ResponseProcessingDescriptor;
	private templateProcessingProgram: ProcessingProgram | null = null;
	private outcomeProcessingProgram: ProcessingProgram | null = null;
	private _pnp: PnpProfile | undefined;
	private _rootEl: HTMLElement | undefined;
	private _catalogIndex: CatalogIndex = new Map();
	private _stimulusCatalogIndexes: Map<string, CatalogIndex> = new Map();
	private _pciHosts: Map<string, PciHost> = new Map();
	private _pnpChangeListeners = new Set<(pnp: PnpProfile | undefined) => void>();
	private sessionGuid: string;
	private lifecycleStatus: ItemLifecycleStatus = 'initial';
	/**
	 * End-attempt responses the candidate turned true since the attempt last ended: the
	 * interactions that invoke the next response processing (see settleEndAttemptResponses).
	 */
	private readonly endAttemptActivations = new Set<string>();
	private diagnostics: readonly QtiItemDiagnostic[] = [];
	/** @internal matchGroup constraints of the item's pairing interactions, by response identifier. */
	matchGroupConstraints: ReadonlyMap<string, MatchGroupConstraints> = new Map();
	private sessionStartedAt: number;
	private accumulatedDurationMs = 0;
	/** Time on task at the last duration update, in milliseconds. */
	private durationMs = 0;

	constructor(config: ItemSessionEngineConfig);
	/** @internal Definition-backed sessions use the module-local factory above. */
	constructor(
		config: ItemSessionEngineConfig,
		prepared: PreparedPlayerDefinition | undefined,
		construction?: PlayerConstructionOptions,
	);
	constructor(
		config: ItemSessionEngineConfig,
		prepared?: PreparedPlayerDefinition,
		construction: PlayerConstructionOptions = {},
	) {
		this.config = config;
		this.itemXml = config.itemXml ?? '';
		this.role = config.role ?? 'candidate';
		this.sessionGuid = createSessionGuid();
		this.sessionStartedAt = Date.now();
		this.rng = config.rng ?? (typeof config.seed === 'number' ? createSeededRng(config.seed) : Math.random);

		// Resolve QTI-version mappers without mutating caller-owned configuration.
		// The detected version also drives per-version spec defaults during extraction
		// (e.g. graphicGapMatchInteraction maxAssociations); detect it once, here.
		this.qtiVersion = config.qtiVersion ?? detectQtiVersion(this.itemXml);
		this.mapper =
			prepared?.mapper ??
			config.elementNameMapper ??
			elementNameMapperForVersion(this.qtiVersion);
		const attributeMapper =
			prepared?.attributeMapper ??
			config.attributeNameMapper ??
			attributeNameMapperForVersion(this.mapper.version);
		this.config = {
			...config,
			elementNameMapper: this.mapper,
			attributeNameMapper: attributeMapper,
			qtiVersion: this.qtiVersion,
		};

		if (prepared) {
			this.itemDocument = prepared.itemDocument;
			this.decls = cloneValue(prepared.declarations);
		} else {
			// Read-aloud markup: suppression restated as the attribute the PIE tools read, and SSML
			// docked as catalog idrefs and unwrapped from the visible body. The section player derives
			// the same `spoken` cards from the same XML.
			enforceItemXmlLimits(this.itemXml, this.config.security);
			this.itemXml = prepareContentMarkup(this.itemXml, [], { hidingStyles: false }).xml;
			this.itemDocument = parseAssessmentItemDocument({
				itemXml: this.itemXml,
				elementNameMapper: this.mapper,
				attributeNameMapper: attributeMapper as AttributeNameMapper,
				security: this.config.security,
			});
			this.decls = buildDeclarationMap({
				itemDocument: this.itemDocument,
				mapper: this.mapper,
				attributeMapper: this.config.attributeNameMapper,
			});
			ensureBuiltinDeclarations(this.decls);
		}
		this.applyContextVariables(config.contextVariables);
		this.applyTemplateDefaults(config.templateDefaults);
		this.sourceDeclarations = cloneValue(this.decls);
		this.ctx = new DeclarationContext(this.decls);
		this.ops = new OperatorRegistry();

		// Extraction + rendering registries (for interaction rendering)
		// Pass the element name mapper to the extraction registry for QTI version handling
		this.extractionRegistry =
			(this.config.extractionRegistry as ExtractionRegistry | undefined) ??
			createExtractionRegistry(this.mapper);
		this.componentRegistry =
			(this.config.componentRegistry as ComponentRegistry | undefined) ??
			createComponentRegistry();

		// I18n provider (defaults to a simple fallback if not provided)
		this.i18nProvider = this.config.i18nProvider ?? this.createDefaultI18nProvider();

		if (!this.extractionRegistry.isSealed()) {
			// Register standard interaction extractors.
			for (const module of getStandardInteractionModules()) {
				this.extractionRegistry.register(module.extractor as any);
				registerFrameworkDeliveryFields(
					this.extractionRegistry,
					module.type,
					module.delivery,
				);
			}

			this.extractionRegistry.seal();
		}

		// Build ASTs once.
		const processingBuildOptions = {
			elementNameMapper: this.mapper,
			resolveProcessingFragment: this.config.resolveProcessingFragment,
			maxProcessingFragmentDepth: this.config.processingFragmentLimits?.maxDepth,
			maxProcessingFragmentCharacters: this.config.processingFragmentLimits?.maxCharacters,
		};
		const templateProcessing = prepared ? null : this.itemDocument.getProcessingElement('template');
		this.templateProcessingProgram =
			prepared?.templateProcessingProgram ??
			(templateProcessing
				? buildTemplateProcessingAst(templateProcessing, processingBuildOptions)
				: null);
		if (
			this.templateProcessingProgram &&
			!construction.compileOnly &&
			!construction.skipTemplateProcessing
		) {
			this.execTemplateProcessing();
		}

		const responseProcessing = prepared ? null : this.itemDocument.getProcessingElement('response');
		this.responseProcessing = prepared?.responseProcessing ?? this.itemDocument.describeResponseProcessing();
		if (!prepared) this.assertSupportedResponseProcessing();
		this.responseProcessingProgram =
			prepared?.responseProcessingProgram ??
			(responseProcessing
				? buildResponseProcessingAst(responseProcessing, processingBuildOptions)
				: null);

		const outcomeProcessing = prepared ? null : this.itemDocument.getProcessingElement('outcome');
		this.outcomeProcessingProgram =
			prepared?.outcomeProcessingProgram ??
			(outcomeProcessing
				? buildOutcomeProcessingAst(outcomeProcessing, processingBuildOptions)
				: null);

		// QTI 2.1 is delivered through the QTI 2.2 code path; other version findings are diagnostics.
		const versionDetection = prepared ? null : detectQtiVersionDetailed(config.itemXml ?? '');
		if (versionDetection?.version === '2.1' && !this.config.strictQtiCompliance?.enabled) {
			console.info(
				'[QTI Player] QTI 2.1 detected. Using QTI 2.2 compatibility mode with CC2 template support.'
			);
		}

		// Store PNP profile for later use (applyPnpToRoot is called once a root element is available).
		this._pnp = this.config.pnp;

		// Build the catalog index from shared catalog XML, item XML, and resolved delivery context.
		// Sanitized item-level delivery context entries win over raw item XML on collisions.
		// Stimulus entries are kept separately so rendered stimulus terms can avoid ID collisions.
		// Package (shared catalog file) entries merge first: they hold the lowest
		// precedence, below catalogXml and the item's own catalogs (QTI 3.0 §6.3).
		if (prepared) {
			this._catalogIndex = prepared.catalogIndex;
			this._stimulusCatalogIndexes = prepared.stimulusCatalogIndexes;
		} else {
			let mergedCatalog: CatalogIndex = new Map();
			let deliveryItemCatalog: CatalogIndex = new Map();
			for (const source of this.config.deliveryContext?.catalogSources ?? []) {
				const sourceCatalog = extractCatalog(source.xml);
				if (source.scope === 'stimulus' && source.stimulusIdentifier) {
					const existing = this._stimulusCatalogIndexes.get(source.stimulusIdentifier) ?? new Map();
					this._stimulusCatalogIndexes.set(
						source.stimulusIdentifier,
						mergeCatalogs(existing, sourceCatalog),
					);
				} else if (source.scope === 'package') {
					mergedCatalog = mergeCatalogs(mergedCatalog, sourceCatalog);
				} else {
					deliveryItemCatalog = mergeCatalogs(deliveryItemCatalog, sourceCatalog);
				}
			}
			if (this.config.catalogXml) {
				mergedCatalog = mergeCatalogs(
					mergedCatalog,
					extractCatalogFromItemXml(this.config.catalogXml),
				);
			}
			mergedCatalog = mergeCatalogs(mergedCatalog, extractCatalogFromItemXml(this.itemXml));
			this._catalogIndex = mergeCatalogs(mergedCatalog, deliveryItemCatalog);
		}

		// Checks that read the item as authored, before the content pass: matchGroup constraints, and
		// compliance findings, reported (or rejected, in strict mode) once, when the item compiles.
		if (prepared) {
			this.matchGroupConstraints = prepared.matchGroupConstraints;
			this.diagnostics = prepared.diagnostics;
		} else {
			const sourceItem = findAssessmentItem(parseXml(config.itemXml ?? ''));
			this.matchGroupConstraints = readMatchGroupConstraints(sourceItem, this.mapper);
			this.diagnostics = this.compileDiagnostics(config.itemXml ?? '', sourceItem, versionDetection ?? undefined);
		}
	}

	/** @internal Definition compiler capture; parser artifacts remain module-private. */
	capturePreparedDefinition(): PreparedPlayerDefinition {
		const identifier = this.itemDocument.getAssessmentItemAttribute('identifier')?.trim();
		if (!identifier) {
			throw new Error('AssessmentItemDefinition requires an assessment-item identifier');
		}
		return Object.freeze({
			identifier,
			mapper: this.mapper,
			attributeMapper: this.config.attributeNameMapper as AttributeNameMapper,
			itemDocument: this.itemDocument,
			declarations: cloneValue(this.sourceDeclarations),
			responseProcessing: this.responseProcessing,
			responseProcessingProgram: this.responseProcessingProgram,
			templateProcessingProgram: this.templateProcessingProgram,
			outcomeProcessingProgram: this.outcomeProcessingProgram,
			catalogIndex: this._catalogIndex,
			stimulusCatalogIndexes: this._stimulusCatalogIndexes,
			diagnostics: this.diagnostics,
			matchGroupConstraints: this.matchGroupConstraints,
		});
	}

	/** The item's QTI compliance findings from compilation; empty when it compiled cleanly. */
	public getDiagnostics(): readonly QtiItemDiagnostic[] {
		return this.diagnostics;
	}

	/**
	 * Apply the PNP profile to a player root element.
	 * Call this once the root DOM element is available (e.g. after mounting).
	 * The player stores the element reference so updatePnp() can re-apply without re-parsing the item.
	 */
	public applyPnp(rootEl: HTMLElement): void {
		this._rootEl = rootEl;
		applyPnpToRoot(rootEl, this._pnp);
	}

	/**
	 * Update the PNP profile mid-session without re-parsing the item XML.
	 * Deep-merges the partial profile into the current profile and re-applies.
	 */
	public updatePnp(partial: Partial<PnpProfile>): void {
		this._pnp = mergePnp(this._pnp, partial);
		if (this._rootEl) {
			applyPnpToRoot(this._rootEl, this._pnp);
		}
		for (const listener of this._pnpChangeListeners) {
			listener(this._pnp);
		}
	}

	/** The language the item's content is written in, from the nearest `xml:lang` on its body. */
	public getContentLanguage(): string | undefined {
		return this.itemDocument.getContentLanguage();
	}

	/** Return the current resolved PNP profile. */
	public getPnp(): PnpProfile | undefined {
		return this._pnp;
	}

	public onPnpChange(listener: (pnp: PnpProfile | undefined) => void): () => void {
		this._pnpChangeListeners.add(listener);
		return () => this._pnpChangeListeners.delete(listener);
	}

	/** Return the package/assessment-resolved delivery context, if one was supplied. */
	public getDeliveryContext(): ResolvedItemDeliveryContext | undefined {
		return this.config.deliveryContext;
	}

	/**
	 * Look up a catalog entry by card identifier, usage type, and optional language.
	 * Returns the HTML string for the matched entry, or null if not found.
	 *
	 * Language fallback: exact match → prefix match → no-lang entry → null.
	 */
	public getCatalogEntry(
		idref: string,
		usage: string,
		lang?: string,
		options?: { stimulusIdentifier?: string }
	): HtmlContent | null {
		const stimulusHtml = options?.stimulusIdentifier
			? getCatalogEntryWithAliases(this._stimulusCatalogIndexes.get(options.stimulusIdentifier) ?? new Map(), idref, usage, lang)
			: null;
		const html =
			stimulusHtml ?? getCatalogEntryWithAliases(this._catalogIndex, idref, usage, lang);
		if (html === null) return null;
		if (looksLikeCatalogUrl(html)) {
			return sanitizeResourceUrl(html.trim(), this.config.security?.urlPolicy, 'img');
		}
		return toTrustedHtml(
			this.sanitizeHtmlContent(html),
			this.config.security?.trustedTypesPolicyName,
		);
	}

	/** Sanitize externally resolved item-adjacent HTML before it reaches a rendering sink. */
	public sanitizeHtmlContent(html: string): string {
		return sanitizeHtml(html, { security: this.config.security });
	}

	/**
	 * Create a PciHost for an extracted PCI and register it for response tracking.
	 * The caller is responsible for calling host.load() and
	 * host.initialize(domNode) once the DOM element is available.
	 */
	public createPciHost(data: ExtractedPci): PciHost {
		const host = new PciHost(data, {
			baseUrl: this.config.pci?.baseUrl,
			moduleResolver: this.config.pci?.moduleResolver,
			sandbox: this.config.pci?.sandbox,
			modulePolicy: this.config.pci?.modulePolicy,
			responseDeclaration: (() => {
				const d = this.decls[data.responseIdentifier];
				return d ? { baseType: d.baseType, cardinality: d.cardinality } : undefined;
			})(),
			status: () => this.pciInteractionStatus(),
			contentLanguage: this.getContentLanguage(),
		});

		// Wire response changes back into the player's declaration context
		host.onResponseChange((responseId: string, value: unknown) => {
			if (this.lifecycleStatus !== 'initial' && this.lifecycleStatus !== 'interacting') return;
			const d = this.decls[responseId];
			if (d) {
				d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, value, d.identifier);
			}
		});

		this._pciHosts.set(data.responseIdentifier, host);
		return host;
	}

	/**
	 * Offer a response value to the PCI identified by responseIdentifier. A
	 * mounted module that has already reported a response keeps it.
	 */
	public offerPciResponse(responseIdentifier: string, value: unknown): void {
		this._pciHosts.get(responseIdentifier)?.offerResponse(value);
	}

	/**
	 * Authoritatively replace a PCI's response, discarding in-progress candidate
	 * state. Session restore and reset-to-default use this.
	 */
	public restorePciResponse(responseIdentifier: string, value: unknown): void {
		this._pciHosts.get(responseIdentifier)?.restore(value);
	}

	/**
	 * The QTI 3.0 §6.1 interaction status a PCI instantiates with: 'solution' when
	 * correct responses are exposed, 'review' for non-candidate roles otherwise,
	 * 'closed' once the attempt finished, 'interacting' while the candidate works.
	 * Hosts that know better pass their own `status` to the PciHost options.
	 */
	private pciInteractionStatus(): PciInteractionStatus {
		if (this.role !== 'candidate') return 'review';
		if (this.lifecycleStatus === 'closed') return 'closed';
		return 'interacting';
	}

	/**
	 * Destroy all PCI hosts. Call on player teardown.
	 */
	public destroyPciHosts(): void {
		for (const host of this._pciHosts.values()) {
			host.destroy();
		}
		this._pciHosts.clear();
	}

	/** Breaking-change API: returns the typed declaration map */
	public getDeclarations(): DeclarationMap {
		return this.decls;
	}

	/**
	 * Apply candidate response values to the declaration context.
	 *
	 * Every candidate interaction reaches this method, including a PCI reporting
	 * its own change, so a mounted PCI module is offered the value rather than
	 * force-fed it. Use `restoreResponses()` when the caller's value must replace
	 * in-progress module state.
	 */
	public setResponses(responses: Record<string, unknown>): void {
		const endAttemptIds = this.getEndAttemptResponseIdentifiers().filter((id) => id in responses);
		const wasTrue = new Set(endAttemptIds.filter((id) => this.isResponseTrue(id)));
		this.applyResponses(responses, (id, value) => this.offerPciResponse(id, value));
		for (const id of endAttemptIds) {
			if (!this.isResponseTrue(id)) this.endAttemptActivations.delete(id);
			else if (!wasTrue.has(id)) this.endAttemptActivations.add(id);
		}
	}

	/**
	 * Apply response values authoritatively, discarding in-progress PCI candidate
	 * state. State replacement and explicit host overrides use this.
	 */
	public restoreResponses(responses: Record<string, unknown>): void {
		this.applyResponses(responses, (id, value) => this.restorePciResponse(id, value));
		// A replaced value is the state as it stands, not the candidate activating an interaction.
		for (const id of Object.keys(responses)) this.endAttemptActivations.delete(id);
	}

	private applyResponses(
		responses: Record<string, unknown>,
		applyToPci: (responseIdentifier: string, value: unknown) => void
	): void {
		for (const [id, raw] of Object.entries(responses)) {
			const d = this.decls[id];
			if (!d) continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, raw, d.identifier);
			// Only a response a textEntryInteraction binds can carry a stringIdentifier companion.
			if (this.itemDocument.getTextEntryBase(id) !== undefined) this.applyTextEntryStringResponse(id, raw);
			applyToPci(id, this.qtiValueToPci(d.value));
		}
	}

	/**
	 * textEntryInteraction@stringIdentifier (QTI ASI §5.122.3; `string-identifier` in QTI 3.0):
	 * writing the text entry's response also writes the response its stringIdentifier names, with
	 * the text as entered before the numeric response reads it — "3.50" where the float response
	 * is 3.5 — or NULL for an empty field, so response processing can score that lexical form. A
	 * stringIdentifier that repeats the response, or names no declared response, is ignored.
	 */
	private applyTextEntryStringResponse(responseId: string, raw: unknown): void {
		const interaction = this.getInteractionData().find(
			(candidate): candidate is TextEntryInteractionData =>
				candidate.type === 'textEntryInteraction' && candidate.responseId === responseId,
		);
		const stringIdentifier = interaction ? textEntryStringIdentifier(interaction) : undefined;
		const companion = stringIdentifier ? this.decls[stringIdentifier] : undefined;
		if (!interaction || !companion || (companion as any).__kind !== 'response') return;
		companion.value = this.coerceToDeclarationValue(
			companion.baseType,
			companion.cardinality,
			createTextEntryStringResponse(raw, interaction),
			companion.identifier,
		);
	}

	/**
	 * Destroy all resources owned by this player instance (PCI modules, etc.).
	 * Call when unmounting to prevent memory leaks.
	 */
	public destroy(): void {
		this.destroyPciHosts();
	}

	public processResponses(): ScoringResult {
		return this.runResponseProcessing({ finalizeNonAdaptiveAttempt: true });
	}

	public saveItemSession(): SerializedItemSessionState {
		this.freezeDuration();
		return this.serializeItemSession();
	}

	public restoreItemSession(state: SerializedItemSessionState): void {
		this.sessionGuid = state.sessionGuid;
		this.interactionDataCache = null;
		this.endAttemptActivations.clear();
		this.lifecycleStatus = state.lifecycleStatus;
		this.accumulatedDurationMs = Math.max(0, Number(state.duration) || 0);
		this.sessionStartedAt = Date.now();
		this.applySerializedVariables(state.responseVariables);
		this.applySerializedVariables(state.outcomeVariables);
		this.applySerializedVariables(state.templateVariables);
		this.applySerializedVariables(state.contextVariables);
		this.updateDuration();
	}

	/** @internal ItemSession uses this to activate a restored delivery handoff. */
	public getLifecycleStatus(): ItemLifecycleStatus {
		return this.lifecycleStatus;
	}

	/** @internal ItemSession uses this to resume a suspended delivery handoff. */
	public activateAttempt(): void {
		if (this.lifecycleStatus === 'suspended') this.lifecycleStatus = 'interacting';
	}

	public suspendAttempt(): ItemSessionActionResult {
		return this.runItemSessionAction({ action: 'suspendAttempt' });
	}

	public endAttempt(options: { countAttempt?: boolean; validateResponses?: boolean } = {}): ItemSessionActionResult {
		return this.runItemSessionAction({ action: 'endAttempt', ...options });
	}

	public scoreAttempt(): ItemSessionActionResult {
		return this.runItemSessionAction({ action: 'scoreAttempt' });
	}

	public newTemplate(options: { resetResponses?: boolean } = {}): ItemSessionActionResult {
		return this.runItemSessionAction({ action: 'newTemplate', ...options });
	}

	public runItemSessionAction(command: ItemSessionActionCommand): ItemSessionActionResult {
		switch (command.action) {
			case 'suspendAttempt':
				return this.runSuspendAttemptAction();
			case 'endAttempt':
				return this.runEndAttemptAction(command);
			case 'scoreAttempt':
				return this.runScoreAttemptAction();
			case 'newTemplate':
				return this.runNewTemplateAction(command);
			case 'submitAttempt':
				return this.runSubmitAttemptAction(command.countAttempt ?? true);
		}
	}

	private runSuspendAttemptAction(): ItemSessionActionResult {
		const validation = this.validateResponses(this.getResponses());
		this.lifecycleStatus = 'suspended';
		const sessionState = this.saveItemSession();
		return this.createItemSessionActionResult('suspendAttempt', sessionState, { validation });
	}

	private runEndAttemptAction(options: { countAttempt?: boolean; validateResponses?: boolean }): ItemSessionActionResult {
		const validate = options.validateResponses ?? false;
		const validation = validate ? this.validateAttemptResponses(this.getResponses()) : undefined;
		if (validation && !validation.valid) {
			return this.createItemSessionActionResult('endAttempt', this.saveItemSession(), { validation });
		}

		// QTI countAttempt=false (hint / "show me"): response processing runs so outcomes and
		// feedback compute, but the attempt is not counted and the session stays open for the
		// candidate to continue — only a counted attempt finalizes a non-adaptive item.
		const countAttempt = options.countAttempt ?? true;
		// The adaptive path settles the end-attempt responses in runAdaptiveSubmitAttempt.
		if (!this.isAdaptive()) this.settleEndAttemptResponses();
		const scoring = this.isAdaptive()
			? this.runAdaptiveSubmitAttempt(countAttempt)
			: this.runResponseProcessing({
					finalizeNonAdaptiveAttempt: countAttempt,
					countAttempt,
				});
		this.lifecycleStatus = scoring.completed ? 'closed' : 'interacting';

		return this.createItemSessionActionResult('endAttempt', this.saveItemSession(), {
			completed: scoring.completed,
			validation,
			scoring,
		});
	}

	private runScoreAttemptAction(): ItemSessionActionResult {
		const scoring = this.runResponseProcessing({ finalizeNonAdaptiveAttempt: false });
		return this.createItemSessionActionResult('scoreAttempt', this.saveItemSession(), {
			completed: scoring.completed,
			scoring,
		});
	}

	private runNewTemplateAction(options: { resetResponses?: boolean }): ItemSessionActionResult {
		this.restoreDeclaredTemplateRuleTargets();
		this.resetOutcomesToDefault();
		if (options.resetResponses ?? true) {
			this.resetResponsesToDefault();
		}
		this.resetTemplatesToDefault();
		this.ctx.setValue('completionStatus', qtiValue('identifier', 'single', 'not_attempted'));
		this.ctx.setValue('numAttempts', qtiValue('integer', 'single', 0));
		this.execTemplateProcessing();
		this.lifecycleStatus = 'initial';
		this.accumulatedDurationMs = 0;
		this.sessionStartedAt = Date.now();
		this.updateDuration();

		return this.createItemSessionActionResult('newTemplate', this.serializeItemSession());
	}

	private runSubmitAttemptAction(countAttempt: boolean): ItemSessionActionResult {
		const scoring = this.runAdaptiveSubmitAttempt(countAttempt);
		return this.createItemSessionActionResult('submitAttempt', this.saveItemSession(), {
			completed: scoring.completed,
			scoring,
		});
	}

	private createItemSessionActionResult(
		action: ItemSessionAction,
		sessionState: SerializedItemSessionState,
		options: {
			completed?: boolean;
			validation?: ResponseValidationResult;
			scoring?: ScoringResult;
		} = {}
	): ItemSessionActionResult {
		return {
			action,
			lifecycleStatus: this.lifecycleStatus,
			completionStatus: this.getCompletionStatus(),
			numAttempts: this.getNumAttempts(),
			duration: sessionState.duration,
			completed: options.completed ?? this.isCompleted(),
			sessionState,
			validation: options.validation,
			scoring: options.scoring,
		};
	}

	public getSecurityConfig(): PlayerSecurityConfig | undefined {
		return this.config.security;
	}

	/**
	 * Get the i18n provider instance
	 * @returns I18nProvider instance
	 */
	public getI18nProvider(): I18nProvider {
		return this.i18nProvider;
	}

	/**
	 * The provider used when the host passes none: English, from the catalog
	 * `@pie-qti/i18n` bundles eagerly.
	 */
	private createDefaultI18nProvider(): I18nProvider {
		return new DefaultI18nProvider('en-US');
	}

	/**
	 * The item's QTI compliance findings (see `collectItemDiagnostics`): errors in strict mode,
	 * warnings otherwise. Strict mode with `rejectUnknownExtensions` throws a `QtiComplianceError`
	 * on any finding; otherwise they are logged unless `logDeviations` is false.
	 */
	private compileDiagnostics(
		sourceXml: string,
		sourceItem: Element,
		versionDetection?: QtiVersionDetection,
	): readonly QtiItemDiagnostic[] {
		const compliance = this.config.strictQtiCompliance;
		const strict = compliance?.enabled === true;
		const diagnostics = Object.freeze(
			collectItemDiagnostics({
				itemXml: sourceXml,
				item: sourceItem,
				versionDetection,
				elementNameMapper: this.mapper,
				extractionRegistry: this.extractionRegistry,
				responseIdentifiers: new Set(
					Object.values(this.decls)
						.filter((d) => (d as any).__kind === 'response')
						.map((d) => d.identifier),
				),
				strict,
			}),
		);
		reportItemDiagnostics(diagnostics, {
			itemIdentifier: this.itemDocument.getAssessmentItemAttribute('identifier') ?? undefined,
			reject: strict && compliance?.rejectUnknownExtensions === true,
			log: compliance?.logDeviations !== false,
		});
		return diagnostics;
	}

	private resetOutcomesToDefault(): void {
		for (const d of Object.values(this.decls)) {
			if ((d as any).__kind !== 'outcome') continue;
			// Built-in stateful variables must survive across processing runs.
			// They are updated by the runtime (adaptive attempt tracking), not by outcome defaults.
			if (d.identifier === 'numAttempts' || d.identifier === 'completionStatus' || d.identifier === 'duration') continue;
			this.ctx.resetToDefault(d.identifier);
		}
	}

	private resetResponsesToDefault(): void {
		this.endAttemptActivations.clear();
		for (const d of Object.values(this.decls)) {
			if ((d as any).__kind !== 'response') continue;
			this.ctx.resetToDefault(d.identifier);
			this.restorePciResponse(d.identifier, this.qtiValueToPci(d.value));
		}
	}

	private resetTemplatesToDefault(): void {
		for (const d of Object.values(this.decls)) {
			if (!d.isTemplate) continue;
			this.ctx.resetToDefault(d.identifier);
		}
	}

	/**
	 * QTI ASI §10.3 with §5.1: template processing runs on a fresh instance of the item, so a new
	 * template instance starts from the declarations, not from the instance before it. The
	 * template rules setDefaultValue and setCorrectResponse change response and outcome
	 * declarations for one instance; their declared defaults and correct responses come back
	 * here, before the variables reset and template processing runs again. Template variables
	 * keep their defaults: template rules do not change them, and they hold the
	 * assessmentItemRef's templateDefault values (applied at session start, carried by a
	 * snapshot), which apply to every instance.
	 */
	private restoreDeclaredTemplateRuleTargets(): void {
		for (const d of Object.values(this.decls)) {
			const kind = (d as any).__kind as DeclKind | undefined;
			if (kind !== 'response' && kind !== 'outcome') continue;
			const declared = this.sourceDeclarations[d.identifier];
			if (!declared) continue;
			const fields = d as { defaultValue?: QtiValue; correctResponse?: QtiValue };
			if (declared.defaultValue) fields.defaultValue = cloneValue(declared.defaultValue);
			else delete fields.defaultValue;
			if (kind !== 'response') continue;
			if (declared.correctResponse) fields.correctResponse = cloneValue(declared.correctResponse);
			else delete fields.correctResponse;
		}
	}

	/**
	 * A MAXSCORE declared without a <defaultValue> is 0 per the numeric outcome rule, so an item
	 * that never assigns it scores against a maximum of zero. That is the spec-correct reading of
	 * under-specified content, and silently substituting 1 would make this engine disagree with a
	 * conformant one — so surface the authoring gap instead of masking it.
	 */
	private warnOnceOnImpliedZeroMaxScore(outcomes: Record<string, unknown>): void {
		if (this.warnedImpliedZeroMaxScore) return;
		if (!this.decls.MAXSCORE?.impliedNumericDefault) return;
		if (outcomes.MAXSCORE !== 0) return;
		this.warnedImpliedZeroMaxScore = true;
		console.warn(
			`[QTI Player] MAXSCORE is 0 for item "${this.itemDocument.getAssessmentItemAttribute('identifier') ?? 'unknown'}": its outcomeDeclaration ` +
				'has no <defaultValue>, so QTI initializes it to 0 and response processing never assigned it. ' +
				'Declare <defaultValue> on the MAXSCORE outcomeDeclaration to score against a real maximum.',
		);
	}

	private runResponseProcessing(options: {
		finalizeNonAdaptiveAttempt: boolean;
		countAttempt?: boolean;
	}): ScoringResult {
		this.updateDuration();
		// QTI ASI §5.1: numAttempts starts at 0 and is incremented at the start of each attempt,
		// so the response processing that ends a counted attempt reads that attempt's own
		// number (1 on the first). The adaptive path counts in runAdaptiveSubmitAttempt; an
		// uncounted attempt (countAttempt=false) and a scoring pass (scoreAttempt) do not count.
		const countsAttempt = options.finalizeNonAdaptiveAttempt && (options.countAttempt ?? true);
		if (!this.isAdaptive() && countsAttempt) {
			this.ctx.setValue('numAttempts', qtiValue('integer', 'single', this.getNumAttempts() + 1));
		}
		// QTI ASI §5.2: for a non-adaptive item, outcome variables are reset to their defaults
		// before each invocation of response processing. An adaptive item's outcomes "retain the
		// values that were assigned to them during the previous invocation" (§5.2, §8), so they
		// carry across attempts — and across a save/restore, which restores them as saved. They
		// start from their defaults only at session start and on newTemplate.
		if (!this.isAdaptive()) {
			this.resetOutcomesToDefault();
		}

		// Execute response processing if present
		if (this.responseProcessing.present) {
			// If responseProcessing has explicit statements, run the compiled program.
			// Otherwise, fall back to template-based processing (responseProcessing@template).
			if (this.responseProcessing.hasStatements) {
				this.execResponseProcessingProgram();
			} else if (this.responseProcessing.template) {
				this.execResponseProcessingTemplate(this.responseProcessing.template);
			}
		}

		// Execute outcome processing if present (runs after responseProcessing)
		this.execOutcomeProcessingProgram();

		// Compatibility: processResponses() has historically finalized non-adaptive items.
		// New scoreAttempt() uses this same engine with finalization disabled.
		if (!this.isAdaptive() && options.finalizeNonAdaptiveAttempt) {
			this.ctx.setValue('completionStatus', qtiValue('identifier', 'single', 'completed'));
		}

		const outcomes = this.collectOutcomes();

		this.warnOnceOnImpliedZeroMaxScore(outcomes);

		const score = Number(outcomes.SCORE ?? 0);
		const maxScore = Number(outcomes.MAXSCORE ?? 1);
		const completionStatus = (outcomes.completionStatus as CompletionStatus | undefined) ?? 'not_attempted';
		const completed = completionStatus === 'completed' || (!this.isAdaptive() && options.finalizeNonAdaptiveAttempt);

		return {
			score,
			maxScore,
			completed,
			outcomeValues: outcomes,
			correct: this.responsesMatchCorrect(),
			modalFeedback: this.getModalFeedback(outcomes),
		};
	}

	/**
	 * QTI item correctness, as test-level `numberCorrect` reads it: every declared response matches
	 * its correct response. Undefined when the item has no response or one declares no correct
	 * response.
	 */
	private responsesMatchCorrect(): boolean | undefined {
		const responses = Object.values(this.decls).filter((d) => (d as any).__kind === 'response');
		if (responses.length === 0 || responses.some((d) => d.correctResponse?.kind !== 'value')) return undefined;
		const env = this.processingEnv();
		return responses.every((d) =>
			toBoolean(
				evalExpr(env, {
					kind: 'expr.match',
					id: `correct-${d.identifier}`,
					a: { kind: 'expr.variable', id: `correct-${d.identifier}-response`, identifier: d.identifier },
					b: { kind: 'expr.correct', id: `correct-${d.identifier}-correct`, identifier: d.identifier },
				} as any),
			),
		);
	}

	public getItemBodyHtml(): HtmlContent {
		const inner = this.itemDocument.serializeItemBodyChildren(this.contentHandlers({ feedback: false }));
		if (!inner) return '';

		return this.renderHtmlContent(inner);
	}

	/**
	 * Extract rubric blocks for the current role.
	 *
	 * QTI uses `<rubricBlock view="...">` to provide role-specific guidance.
	 * We return sanitized HTML for host rendering. `scope: "direct"` rubrics
	 * are assessmentItem children; `scope: "itemBody"` rubrics are authored in
	 * the rendered item body flow.
	 */
	public getRubrics(options: RubricBlockOptions = {}): RubricBlock[] {
		const role = this.role;
		const rubrics = this.itemDocument.readRubricBlocks(this.contentHandlers());
		if (rubrics.length === 0) return [];

		const blocks: RubricBlock[] = [];
		for (const rubric of rubrics) {
			const { scope } = rubric;
			if (options.scope && options.scope !== 'all' && scope !== options.scope) continue;

			const view = [...rubric.view];

			// If view is specified, show only when it includes the current role.
			if (view.length > 0 && role && !view.includes(role)) continue;

			const html = this.renderHtmlContent(rubric.content);

			blocks.push({ view, html, scope, use: rubric.use });
		}

		return blocks;
	}

	public getComponentRegistry(): ComponentRegistry {
		return this.componentRegistry;
	}

	/**
	 * Canonical interaction API (new): extracted, typed interaction data.
	 */
	public getInteractionData(): readonly BaseInteractionData[] {
		if (this.interactionDataCache) return this.interactionDataCache;
		this.interactionDataCache = extractInteractionData({
			document: this.itemDocument,
			extractionRegistry: this.extractionRegistry,
			declarations: this.decls,
			config: this.config,
			// Seeds `shuffle`. The GUID is persisted in saved state and restored, so a
			// resumed session reproduces the order the candidate already saw, while a
			// different candidate or a new attempt gets a different one.
			sessionGuid: this.sessionGuid,
			// Template content resolves before extraction, so interactions are extracted again
			// when template values change. Choice feedback resolves in presentation.
			contentHandlers: this.contentHandlers({ feedback: false }),
		});
		return this.interactionDataCache;
	}

	/**
	 * Convenience API (used by tests/bench): returns a minimal interaction list with QTI-ish field names.
	 */
	public getInteractions(): Array<{ type: string; responseIdentifier: string } & Record<string, any>> {
		return this.getInteractionData().map((i: any) => ({
			...i,
			responseIdentifier: i.responseId,
		}));
	}

	public getResponseInteractions(): Array<{ type: string; responseIdentifier: string } & Record<string, any>> {
		return this.getInteractions().filter((i) => i.type !== 'endAttemptInteraction');
	}

	/**
	 * Returns response identifiers of endAttempt interactions with countAttempt="false".
	 * Used to detect hint-only submissions (e.g. Request Hint button).
	 */
	public getHintEndAttemptIdentifiers(): string[] {
		return this.getInteractions()
			.filter((i: any) => i.type === 'endAttemptInteraction' && i.countAttempt === false)
			.map((i: any) => i.responseIdentifier);
	}

	private getEndAttemptResponseIdentifiers(): string[] {
		return this.getInteractions()
			.filter((i) => i.type === 'endAttemptInteraction')
			.map((i) => i.responseIdentifier);
	}

	private isResponseTrue(responseIdentifier: string): boolean {
		return toBoolean(this.ctx.getValue(responseIdentifier));
	}

	/**
	 * QTI endAttemptInteraction (QTI 3.0 §5.45): "If the candidate invokes response processing
	 * using an end-attempt interaction then the associated response variable is set to true. If
	 * response processing is invoked in any other way […] then the associated response variable
	 * is set to false. The default value of the response variable is always ignored." The
	 * interactions that invoke this attempt's processing are the ones the candidate turned true
	 * since the attempt last ended; a value restored with the session invokes nothing. Rescoring
	 * (scoreAttempt) replays the last submission and leaves these responses as they are.
	 */
	private settleEndAttemptResponses(): void {
		for (const id of this.getEndAttemptResponseIdentifiers()) {
			const d = this.decls[id];
			if (!d) continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, this.endAttemptActivations.has(id), d.identifier);
		}
		this.endAttemptActivations.clear();
	}

	public getResponseIdentifiers(): string[] {
		return this.getResponseInteractions().map((i) => i.responseIdentifier);
	}

	public isAdaptive(): boolean {
		return (this.itemDocument.getAssessmentItemAttribute('adaptive') || '').toLowerCase() === 'true';
	}

	public getNumAttempts(): number {
		return Math.max(0, Math.floor(toNumber(this.ctx.getValue('numAttempts')) || 0));
	}

	public getCompletionStatus(): CompletionStatus {
		const s = (toStringValue(this.ctx.getValue('completionStatus')) || '').trim() as CompletionStatus;
		return (s || 'not_attempted') as CompletionStatus;
	}

	public isCompleted(): boolean {
		return this.getCompletionStatus() === 'completed';
	}

	private runAdaptiveSubmitAttempt(countAttempt: boolean = true): AdaptiveAttemptResult {
		if (this.isCompleted()) {
			throw new Error('Cannot submit: item is already completed');
		}
		this.settleEndAttemptResponses();

		// QTI adaptive semantics: numAttempts should reflect the attempt being processed.
		if (this.isAdaptive() && countAttempt) {
			const next = this.getNumAttempts() + 1;
			this.ctx.setValue('numAttempts', qtiValue('integer', 'single', next));
			// Promote completionStatus from not_attempted -> unknown on first submission unless RP sets it.
			if (this.getCompletionStatus() === 'not_attempted') {
				this.ctx.setValue('completionStatus', qtiValue('identifier', 'single', 'unknown'));
			}
		}

		// A non-adaptive item counts (and finalizes) only a counted attempt, as endAttempt does.
		const base = this.isAdaptive()
			? this.processResponses()
			: this.runResponseProcessing({ finalizeNonAdaptiveAttempt: countAttempt, countAttempt });
		const completionStatus = this.getCompletionStatus();
		const completed = completionStatus === 'completed';
		const canContinue = this.isAdaptive() ? !completed : false;

		return {
			...base,
			completed,
			numAttempts: this.getNumAttempts(),
			completionStatus,
			canContinue,
		};
	}

	public getResponses(): Record<string, any> {
		const out: Record<string, any> = {};
		for (const d of Object.values(this.decls)) {
			if ((d as any).__kind !== 'response') continue;
			const pciHost = this._pciHosts.get(d.identifier);
			if (pciHost) {
				const currentResponse = pciHost.getResponse();
				d.value = this.coerceToDeclarationValue(
					d.baseType,
					d.cardinality,
					currentResponse,
					d.identifier
				);
			}
			out[d.identifier] = this.qtiValueToPublic(d.value);
		}
		return out;
	}

	/**
	 * Get correct response for a specific response identifier
	 * @param responseId - The response identifier
	 * @returns The correct response value, or undefined if not available
	 */
	public getCorrectResponse(responseId: string): any | undefined {
		const decl = this.decls[responseId];
		if (!decl || (decl as any).__kind !== 'response') return undefined;
		const respDecl = decl as any; // ResponseDeclaration from qti-processing
		if (!respDecl.correctResponse) return undefined;
		if (respDecl.correctResponse.kind !== 'value') return undefined;
		return this.qtiValueToPublic(respDecl.correctResponse);
	}

	/**
	 * Get all correct responses as a map
	 * @returns Map of responseId to correct response value
	 */
	public getCorrectResponses(): Record<string, any> {
		const out: Record<string, any> = {};
		for (const d of Object.values(this.decls)) {
			if ((d as any).__kind !== 'response') continue;
			const respDecl = d as any;
			if (!respDecl.correctResponse || respDecl.correctResponse.kind !== 'value') continue;
			out[d.identifier] = this.qtiValueToPublic(respDecl.correctResponse);
		}
		return out;
	}

	public getTemplateVariables(): Record<string, any> {
		const out: Record<string, any> = {};
		for (const d of Object.values(this.decls)) {
			if (!d.isTemplate) continue;
			out[d.identifier] = this.qtiValueToPublic(d.value);
		}
		return out;
	}

	public setTemplateVariables(vars: Record<string, any>): void {
		this.interactionDataCache = null;
		for (const [id, raw] of Object.entries(vars)) {
			const d = this.decls[id];
			if (!d?.isTemplate) continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, raw, d.identifier);
		}
	}

	public getSessionState(): ItemSessionState {
		const out: ItemSessionState = {};
		for (const d of Object.values(this.decls)) {
			out[d.identifier] = this.qtiValueToPublic(d.value);
		}
		return out;
	}

	public validateResponses(responses: Record<string, any>): ResponseValidationResult {
		return validateResponses(this, responses);
	}

	/**
	 * The validation `endAttempt({ validateResponses: true })` gates on (QTI ASI §4
	 * itemSessionControl validateResponses). An invalid response "does not satisfy the
	 * constraints imposed by the interaction": beyond a malformed value or a matchGroup
	 * pairing (`validateResponses`), an interaction that requires input — minChoices,
	 * minAssociations, minStrings, minPlays, matchMin — rejects an incomplete one. Those
	 * entries turn invalid with an `incomplete` issue, so the result reads invalid through
	 * the same channel as every other rejection.
	 *
	 * An item with no response at all is a skip, which allowSkipping governs ("delivery
	 * engines must ensure that the candidate can choose to submit no response" when it is
	 * true). The item cannot see allowSkipping, so completeness applies only once the
	 * candidate has responded and a skip is the caller's decision.
	 */
	private validateAttemptResponses(responses: Record<string, any>): ResponseValidationResult {
		return validateAttemptResponses(this, responses);
	}

	public getProgress(responses: Record<string, any>): { total: number; answered: number; unanswered: number } {
		const v = this.validateResponses(responses);
		const required = Object.values(v.entries).filter((e) => e.required);
		const answered = required.filter((e) => e.complete).length;
		const total = required.length;
		return { total, answered, unanswered: Math.max(0, total - answered) };
	}

	public canSubmitResponses(responses: Record<string, any>): boolean {
		const v = this.validateResponses(responses);
		const required = Object.values(v.entries).filter((e) => e.required);
		return v.valid && required.every((e) => e.complete);
	}

	/**
	 * True if the learner has made any meaningful interaction, even if submission is not yet allowed.
	 * Used by assessment/session controllers to track "answered" state.
	 */
	public isAttempted(responses: Record<string, any>): boolean {
		return isAttempted(this, responses);
	}

	// ----------------------------------------------------------------------------
	// Execution
	// ----------------------------------------------------------------------------

	/**
	 * The evaluator's environment, which reads responses in the item's content language and
	 * compares strings with the host's string comparison folds.
	 */
	private processingEnv() {
		return {
			ctx: this.ctx,
			ops: this.ops,
			rng: this.rng,
			language: this.getContentLanguage(),
			stringComparison: this.config.stringComparison,
			customOperators: this.config.customOperators,
		};
	}

	private execTemplateProcessing(): void {
		this.interactionDataCache = null;
		if (!this.templateProcessingProgram) return;
		execProgram(
			this.processingEnv(),
			this.templateProcessingProgram
		);
	}

	private execResponseProcessingProgram(): void {
		if (!this.responseProcessingProgram) return;
		execProgram(
			this.processingEnv(),
			this.responseProcessingProgram
		);
	}

	private execOutcomeProcessingProgram(): void {
		if (!this.outcomeProcessingProgram) return;
		execProgram(
			this.processingEnv(),
			this.outcomeProcessingProgram
		);
	}

	private execResponseProcessingTemplate(templateUrl: string): void {
		const name = resolveResponseProcessingTemplate(templateUrl);
		// Compilation rejects unsupported templates; this guards a hand-built prepared definition.
		if (!name) throw this.unsupportedTemplateError(templateUrl);

		const responseMatchesCorrect = (): boolean => {
			const expression = {
				kind: 'expr.match',
				id: 'fixed-template-match',
				a: { kind: 'expr.variable', id: 'fixed-template-response', identifier: 'RESPONSE' },
				b: { kind: 'expr.correct', id: 'fixed-template-correct', identifier: 'RESPONSE' },
			} as any;
			return toBoolean(
				evalExpr(
					this.processingEnv(),
					expression,
				),
			);
		};

		const setScore = (value: number): void => {
			this.ctx.setValue('SCORE', qtiValue('float', 'single', value));
		};

		const setIdentifierOutcome = (identifier: string, value: string): void => {
			this.ctx.setValue(identifier, qtiValue('identifier', 'single', value));
		};

		const mapResponse = (point: boolean): number => {
			const response = this.ctx.getValue('RESPONSE');
			// The official templates guard with isNull, which reads an empty container or empty string
			// as NULL too (QTI ASI §5): a cleared response scores 0, rather than being mapped, whose
			// result the mapping's bounds could clamp away from 0.
			if (isNullValue(response)) return 0;
			const mapped = evalExpr(
				this.processingEnv(),
				{
					kind: point ? 'expr.mapResponsePoint' : 'expr.mapResponse',
					id: point ? 'fixed-template-map-response-point' : 'fixed-template-map-response',
					identifier: 'RESPONSE',
				} as any,
			);
			const value = toNumber(mapped);
			return Number.isFinite(value) ? value : 0;
		};

		switch (name) {
			case 'match_correct':
			case 'cc2_match': {
				setScore(responseMatchesCorrect() ? 1 : 0);
				return;
			}
			case 'cc2_match_basic': {
				if (responseMatchesCorrect()) {
					const maxScore = toNumber(this.ctx.getValue('MAXSCORE'));
					this.ctx.setValue(
						'SCORE',
						Number.isFinite(maxScore) ? qtiValue('float', 'single', maxScore) : qtiNull('float', 'single'),
					);
					setIdentifierOutcome('FEEDBACKBASIC', 'correct');
				} else {
					setIdentifierOutcome('FEEDBACKBASIC', 'incorrect');
				}
				return;
			}
			case 'match_nothing':
			case 'cc2_match_nothing': { // Official IMS QTI 3.0 rptemplate
				const isEmptyResponse = (v: QtiValue | undefined): boolean => {
					if (!v) return true;
					if (v.kind === 'null') return true;
					if (v.kind === 'invalid') return false;
					if (v.value === null || v.value === undefined) return true;
					if (Array.isArray(v.value)) return v.value.length === 0;
					if (typeof v.value === 'string') return v.value.trim().length === 0;
					return false;
				};

				const allEmpty = isEmptyResponse(this.ctx.getValue('RESPONSE'));
				const max = toNumber(this.ctx.getValue('MAXSCORE'));
				this.ctx.setValue('SCORE', qtiValue('float', 'single', allEmpty ? (Number.isFinite(max) ? max : 1) : 0));
				return;
			}
			case 'map_response': {
				setScore(mapResponse(false));
				return;
			}
			case 'cc2_map_response': {
				const score = mapResponse(false);
				setScore(score);
				const maxScore = toNumber(this.ctx.getValue('MAXSCORE'));
				setIdentifierOutcome(
					'FEEDBACK',
					Number.isFinite(maxScore) && score === maxScore ? 'correct' : 'incorrect',
				);
				return;
			}
			case 'map_response_point':
			case 'cc2_map_response_point': { // Official IMS QTI 3.0 rptemplate
				setScore(mapResponse(true));
				return;
			}
			case 'no_response_processing': {
				// The standard empty template: outcomes keep their defaults (unscored item).
				return;
			}
		}
	}

	/**
	 * A template reference is the item's only scoring rule when responseProcessing has no rules of
	 * its own. Without a built-in program for that template the item would score its defaults
	 * silently, so compilation fails instead (docs/SPEC-GAPS-PLAN.md G-19).
	 */
	private assertSupportedResponseProcessing(): void {
		const { present, hasStatements, template } = this.responseProcessing;
		if (!present || hasStatements || !template) return;
		if (resolveResponseProcessingTemplate(template)) return;
		throw this.unsupportedTemplateError(template);
	}

	private unsupportedTemplateError(templateUri: string): UnsupportedResponseProcessingTemplateError {
		return new UnsupportedResponseProcessingTemplateError(
			templateUri,
			this.itemDocument.getAssessmentItemAttribute('identifier') ?? undefined,
		);
	}

	// ----------------------------------------------------------------------------
	// Declarations
	// ----------------------------------------------------------------------------

	/** Host-supplied context values, e.g. `QTI_CONTEXT`; identifiers that are not context variables are ignored. */
	private applyContextVariables(values: Readonly<Record<string, unknown>> | undefined): void {
		for (const [id, raw] of Object.entries(values ?? {})) {
			const d = this.decls[id];
			if ((d as any)?.__kind !== 'context') continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, raw, d.identifier);
		}
	}

	/** Test-supplied template defaults; identifiers that are not template variables are ignored. */
	private applyTemplateDefaults(values: Readonly<Record<string, unknown>> | undefined): void {
		for (const [id, raw] of Object.entries(values ?? {})) {
			const d = this.decls[id];
			if (!d?.isTemplate) continue;
			d.defaultValue = this.coerceToDeclarationValue(d.baseType, d.cardinality, raw, d.identifier);
			d.value = d.defaultValue;
		}
	}

	private applySerializedVariables(vars: Record<string, SerializedItemSessionVariable>): void {
		for (const v of Object.values(vars)) {
			const d = this.decls[v.identifier];
			if (!d) continue;
			// Restore the declaration's default value first: template processing is
			// skipped on restore (QTI ASI §10.3 fixes its effects for the session), so
			// a default changed by setDefaultValue — including to NULL — must come from
			// the snapshot. defaultValue is always serialized, so it applies as-is:
			// null restores the NULL default a setDefaultValue rule set, never the
			// default parsed from the item XML. Later resets (attempt starts, outcome
			// resets at response-processing start, templateConstraint restarts) then
			// use the restored default; a new template instance (newTemplate) starts
			// from the declarations instead.
			d.defaultValue = this.coerceToDeclarationValue(d.baseType, d.cardinality, v.defaultValue, d.identifier);
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, v.value, d.identifier);
			if ((d as any).__kind === 'response') {
				// A correctResponse computed by setCorrectResponse is also a fixed
				// template-rule effect; restoring it keeps a resumed session scoring
				// identically to the session that was saved. The snapshot writes the
				// field whenever the variable has or had a correct response, so it
				// applies as-is: null restores the NULL correct response a
				// setCorrectResponse rule set. When the field is absent the variable
				// has no correct response, and the fresh declaration (parsed from the
				// same item XML) has none either.
				if (v.correctResponse !== undefined) {
					d.correctResponse = this.coerceToDeclarationValue(d.baseType, d.cardinality, v.correctResponse, d.identifier);
				}
				this.restorePciResponse(d.identifier, this.qtiValueToPci(d.value));
			}
		}
	}

	private serializeItemSession(): SerializedItemSessionState {
		const responseVariables: Record<string, SerializedItemSessionVariable> = {};
		const outcomeVariables: Record<string, SerializedItemSessionVariable> = {};
		const templateVariables: Record<string, SerializedItemSessionVariable> = {};
		const contextVariables: Record<string, SerializedItemSessionVariable> = {};
		const contextIds = new Set(['completionStatus', 'numAttempts', 'duration']);

		for (const d of Object.values(this.decls)) {
			const variable = this.serializeVariable(d);
			if (d.isTemplate) {
				templateVariables[d.identifier] = { ...variable, kind: 'template' };
			} else if (contextIds.has(d.identifier) || (d as any).__kind === 'context') {
				contextVariables[d.identifier] = { ...variable, kind: 'context' };
			} else if ((d as any).__kind === 'response') {
				responseVariables[d.identifier] = { ...variable, kind: 'response' };
			} else if ((d as any).__kind === 'outcome') {
				outcomeVariables[d.identifier] = { ...variable, kind: 'outcome' };
			}
		}

		const validation = this.validateResponses(this.getResponses());
		return {
			itemIdentifier: this.itemDocument.getAssessmentItemAttribute('identifier') ?? undefined,
			sessionGuid: this.sessionGuid,
			lifecycleStatus: this.lifecycleStatus,
			completionStatus: this.getCompletionStatus(),
			numAttempts: this.getNumAttempts(),
			duration: this.getDuration(),
			responseVariables,
			outcomeVariables,
			templateVariables,
			contextVariables,
			validationMessages: validation.issues,
			savedAt: new Date().toISOString(),
		};
	}

	private serializeVariable(d: DeclarationMap[string]): SerializedItemSessionVariable {
		const variable: SerializedItemSessionVariable = {
			identifier: d.identifier,
			kind: ((d as any).__kind ?? (d.isTemplate ? 'template' : 'context')) as SerializedItemSessionVariable['kind'],
			...(d.baseType ? { baseType: d.baseType } : {}),
			cardinality: d.cardinality,
			value: this.qtiValueToSerializable(d.value),
			defaultValue: this.qtiValueToSerializable(d.defaultValue),
		};
		// A correctResponse is part of the session state a template rule
		// (setCorrectResponse, QTI ASI §10.3) can compute, so it must survive a
		// snapshot for the restored session to score identically. Written whenever
		// the variable has or had a correct response — from the XML or from template
		// processing — with null for a NULL correct response, so restore can tell
		// "no correct response" (field absent) from "its correct response is NULL".
		if ((d as any).__kind === 'response' && d.correctResponse !== undefined) {
			variable.correctResponse = this.qtiValueToSerializable(d.correctResponse);
		}
		return variable;
	}

	private qtiValueToSerializable(value: QtiValue | undefined): any {
		if (!value || value.kind !== 'value') return null;
		if (value.cardinality !== 'record') return cloneValue(value.value);

		const serialized: Record<string, unknown> = {};
		for (const [fieldIdentifier, fieldValue] of Object.entries(value.value as Record<string, QtiValue>)) {
			serialized[fieldIdentifier] = {
				...(fieldValue.baseType ? { baseType: fieldValue.baseType } : {}),
				cardinality: fieldValue.cardinality ?? 'single',
				value: this.qtiValueToSerializable(fieldValue),
			};
		}
		return serialized;
	}

	/**
	 * A value as a PCI host receives it: the public value, except that a record keeps each field's
	 * base type and cardinality (its serialized form). A record declaration types none of its
	 * fields, so the host could not write them into QTI variable JSON otherwise.
	 */
	private qtiValueToPci(value: QtiValue | undefined): unknown {
		return value?.kind === 'value' && value.cardinality === 'record'
			? this.qtiValueToSerializable(value)
			: this.qtiValueToPublic(value);
	}

	private qtiValueToPublic(value: QtiValue | undefined): any {
		if (!value || value.kind !== 'value') return null;
		if (value.cardinality !== 'record') return cloneValue(value.value);

		const record: Record<string, unknown> = {};
		for (const [fieldIdentifier, fieldValue] of Object.entries(value.value as Record<string, QtiValue>)) {
			record[fieldIdentifier] = this.qtiValueToPublic(fieldValue);
		}
		return record;
	}

	private updateDuration(): void {
		const elapsedMs = Math.max(0, Date.now() - this.sessionStartedAt);
		this.durationMs = Math.max(0, Math.floor(this.accumulatedDurationMs + elapsedMs));
		// QTI 2.2/3.0: the built-in `duration` response variable is a float of seconds, truncated.
		// The host-facing `duration` fields of serialized sessions and action results stay in
		// milliseconds (see getDuration).
		this.ctx.setValue(
			'duration',
			qtiValue('duration', 'single', durationSecondsFromMilliseconds(this.durationMs)),
		);
	}

	private freezeDuration(): number {
		this.updateDuration();
		this.accumulatedDurationMs = this.durationMs;
		this.sessionStartedAt = Date.now();
		return this.durationMs;
	}

	/** Time on task in whole milliseconds, as the host-facing session fields report it. */
	private getDuration(): number {
		return this.durationMs;
	}

	/** Raw values read as a declaration's QTI base type and cardinality; see declarations/declarationValues. */
	private coerceToDeclarationValue(
		baseType: BaseType | undefined,
		cardinality: Cardinality,
		raw: unknown,
		identifier?: string,
	): QtiValue {
		return coerceToDeclarationValue({ itemDocument: this.itemDocument }, baseType, cardinality, raw, identifier);
	}

	private collectOutcomes(): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		for (const d of Object.values(this.decls)) {
			if ((d as any).__kind !== 'outcome') continue;
			if (d.value.kind === 'value') out[d.identifier] = this.qtiValueToPublic(d.value);
			else if (d.value.kind === 'null') out[d.identifier] = null;
		}
		// Ensure MAXSCORE always has a value (fallback to 1.0 if null or missing)
		if (out.MAXSCORE === null || out.MAXSCORE === undefined) {
			out.MAXSCORE = 1.0;
		}
		return out;
	}

	// ----------------------------------------------------------------------------
	// Item content pass: printedVariable, feedback, templates
	// ----------------------------------------------------------------------------

	/**
	 * The item content pass's handlers, reading the session's current variable values. QTI 3 wraps
	 * rubric content in `qti-content-body`, which is unwrapped so a rubric renders as in QTI 2.2.
	 * Feedback resolves here for rubric and modal feedback content; item body and choice feedback
	 * resolve in presentation, which takes the outcome values to present as input.
	 */
	private contentHandlers({ feedback = true }: { feedback?: boolean } = {}): ContentHandlers {
		const conditional = (variable: string) => (element: Element) =>
			this.isShownByVariable(element, variable, getAttr(element, 'identifier')) ? Array.from(element.childNodes) : [];
		const handlers = new Map<string, ContentHandler>([
			['printedvariable', (element) => this.printedVariableNodes(element)],
			['contentbody', (element) => Array.from(element.childNodes)],
			['templateinline', conditional('templateIdentifier')],
			['templateblock', conditional('templateIdentifier')],
			['param', (element) => this.expandParamVariable(element)],
		]);
		for (const choice of TEMPLATE_CHOICES) {
			handlers.set(choice, (element) =>
				!getAttr(element, 'templateIdentifier') ||
				this.isShownByVariable(element, 'templateIdentifier', getAttr(element, 'identifier'))
					? undefined
					: [],
			);
		}
		if (this.mathVariables().size > 0) {
			handlers.set('mi', (element) => this.mathVariableNodes(element, 'mn'));
			handlers.set('ci', (element) => this.mathVariableNodes(element, 'cn'));
		}
		if (feedback) {
			handlers.set('feedbackinline', conditional('outcomeIdentifier'));
			handlers.set('feedbackblock', conditional('outcomeIdentifier'));
		}
		return handlers;
	}

	/**
	 * Whether `element` shows: the variable named by its `variableAttribute` against `identifier`,
	 * by the shared visibility rule. A missing variable or identifier hides it.
	 */
	private isShownByVariable(element: Element, variableAttribute: string, identifier: string | null): boolean {
		const variable = (getAttr(element, variableAttribute) || '').trim();
		const id = (identifier || '').trim();
		if (!variable || !id) return false;
		const current = this.ctx.getValue(variable);
		return isShownByIdentifier(current.kind === 'value' ? current.value : null, id, getAttr(element, 'showHide'));
	}

	private mathVariables(): ReadonlySet<string> {
		this.mathVariableIds ??= new Set(
			this.itemDocument
				.findDeclarationElements('template')
				.filter((el) => getAttr(el, 'mathVariable')?.trim() === 'true')
				.map((el) => (getAttr(el, 'identifier') || '').trim()),
		);
		return this.mathVariableIds;
	}

	private paramVariables(): ReadonlySet<string> {
		this.paramVariableIds ??= new Set(
			this.itemDocument
				.findDeclarationElements('template')
				.filter((el) => getAttr(el, 'paramVariable')?.trim() === 'true')
				.map((el) => (getAttr(el, 'identifier') || '').trim()),
		);
		return this.paramVariableIds;
	}

	/**
	 * templateDeclaration@paramVariable (QTI 2.2 ASI TemplateDeclaration, `paramVariable`
	 * characteristic; QTI 3.0 `param-variable`): a `<param>` inside an `<object>` whose `value`
	 * names such a template variable is delivered with the variable's current value in place of
	 * the variable's name, so a plugin-style object receives its computed parameter instead of a
	 * literal.
	 *
	 * This resolves in the content pass — not in `prepareContentMarkup` (which runs once on the
	 * raw XML, before template variables exist) and not on a stored copy — because template
	 * variables change during the session (`setTemplateVariables`, `newTemplate`, restore).
	 * Resolving with the pass means every (re)render, like printedVariable, delivers the value
	 * the session holds at that moment.
	 *
	 * The spec defines substitution for a param value naming a declared `paramVariable`
	 * variable. It is silent on a value naming an undeclared variable or one without the flag:
	 * those, and NULL or container (multiple/ordered/record) values — a param carries one
	 * opaque string, and joining container values would be invented semantics — deliver the
	 * authored value unchanged, which is also the safe reading.
	 */
	private expandParamVariable(element: Element): undefined {
		const value = getAttr(element, 'value')?.trim();
		if (!value || !this.paramVariables().has(value)) return undefined;
		const parent = element.parentNode;
		if (
			!isElement(parent) ||
			this.mapper.toCanonical(localName(parent) ?? '') !== 'object'
		) {
			return undefined;
		}
		const current = this.ctx.getValue(value);
		if (current.kind !== 'value' || current.cardinality !== 'single') return undefined;
		// The pass resolves a clone, so this rewrite cannot touch the parsed source.
		element.setAttribute('value', String(current.value));
		return undefined;
	}

	/**
	 * A MathML `mi` or `ci` naming a math variable, with the variable's single value in its place:
	 * a number as `mn` or `cn` (`numberName`), any other value as the element's text. NULL and
	 * container values leave the element as authored.
	 */
	private mathVariableNodes(element: Element, numberName: string): Node[] | undefined {
		const identifier = (element.textContent || '').trim();
		const document = element.ownerDocument;
		if (!document || !this.mathVariables().has(identifier)) return undefined;
		const value = this.ctx.getValue(identifier);
		if (value.kind !== 'value' || value.cardinality !== 'single') return undefined;
		const text = String(value.value);
		if (value.baseType !== 'integer' && value.baseType !== 'float') {
			// The pass resolves a copy, and the element is not walked again, so this cannot cycle.
			element.textContent = text;
			return undefined;
		}
		const name = element.prefix ? `${element.prefix}:${numberName}` : numberName;
		const replacement = document.createElementNS(element.namespaceURI, name);
		replacement.appendChild(document.createTextNode(text));
		return [replacement];
	}

	private printedVariableNodes(element: Element): Node[] {
		const identifier = (getAttr(element, 'identifier') || '').trim();
		const document = element.ownerDocument;
		if (!identifier || !document) return [];
		const variable = (id: string): QtiValue => this.ctx.getValue(id);
		const printed = printVariable(variable(identifier), readPrintedVariableOptions(element, variable));
		return printed.map((segment) => {
			if (typeof segment === 'string') return document.createTextNode(segment);
			const sup = document.createElementNS(element.namespaceURI, 'sup');
			sup.appendChild(document.createTextNode(segment.superscript));
			return sup;
		});
	}

	private renderHtmlContent(html: string): HtmlContent {
		const sanitized = sanitizeHtml(html, { security: this.config.security });
		return toTrustedHtml(sanitized, this.config.security?.trustedTypesPolicyName);
	}

	private getModalFeedback(outcomes: Record<string, any>): ModalFeedback[] {
		const active: ModalFeedback[] = [];

		for (const feedback of this.itemDocument.readModalFeedback(this.contentHandlers())) {
			const { identifier, outcomeIdentifier, showHide, title } = feedback;
			const content = this.renderHtmlContent(feedback.content);

			if (isShownByIdentifier(outcomes[outcomeIdentifier], identifier, showHide) && content) {
				active.push({ identifier, outcomeIdentifier, showHide, content, title });
			}
		}
		return active;
	}
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function mergePnp(base: PnpProfile | undefined, partial: Partial<PnpProfile>): PnpProfile {
	return {
		display: { ...(base?.display ?? {}), ...(partial.display ?? {}) },
		content: { ...(base?.content ?? {}), ...(partial.content ?? {}) },
		cognitive: { ...(base?.cognitive ?? {}), ...(partial.cognitive ?? {}) },
		...(base?.tools || partial.tools ? { tools: { ...(base?.tools ?? {}), ...(partial.tools ?? {}) } } : {}),
	};
}

function createSessionGuid(): string {
	// `Crypto` is typed as always providing `randomUUID`, but it is restricted to secure
	// contexts and so is genuinely absent when the player is served over plain HTTP.
	// Reading through a `Partial<Crypto>` keeps TypeScript from narrowing the fallback
	// branch to `never` on the strength of a type that overstates what is available.
	const webCrypto: Partial<Crypto> | undefined = typeof crypto !== 'undefined' ? crypto : undefined;

	if (typeof webCrypto?.randomUUID === 'function') {
		return webCrypto.randomUUID();
	}
	// `getRandomValues` carries no secure-context restriction and offers the same entropy
	// guarantee, so it covers the plain-HTTP case. The previous fallback here used
	// `Math.random()`, which is not a CSPRNG and left session GUIDs predictable in
	// exactly the environments that reached it.
	if (typeof webCrypto?.getRandomValues === 'function') {
		const bytes = new Uint8Array(16);
		webCrypto.getRandomValues(bytes);
		const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
		return `item-session-${hex}`;
	}
	throw new Error(
		'No Web Crypto API available: cannot generate a session GUID. @pie-qti/item-player ' +
			'requires crypto.randomUUID or crypto.getRandomValues (present in all supported ' +
			'browsers and in Node >= 20).',
	);
}

function looksLikeCatalogUrl(value: string): boolean {
	const trimmed = value.trim();
	return /^(https?:\/\/|\/\/|\/|\.{0,2}\/|data:|blob:)/i.test(trimmed) ||
		/\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|mp4|webm|pdf)(\?.*)?$/i.test(trimmed);
}
