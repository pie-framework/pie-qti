import {
	type BaseType,
	buildOutcomeProcessingAst,
	buildResponseProcessingAst,
	buildTemplateProcessingAst,
	type Cardinality,
	DeclarationContext,
	type DeclarationMap,
	findAssessmentItem,
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
	type QtiVersionDetection,
} from '@pie-qti/qti-common';
import type {
	AssessmentItemDocument,
	ResponseProcessingDescriptor,
} from '../document/AssessmentItemDocument.js';
import { parseAssessmentItemDocument } from '../document/AssessmentItemDocument.js';
import type { ContentHandlers } from '../document/contentPass.js';
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
import { contentHandlers } from './rendering/contentPass.js';
import { itemBodyHtml, modalFeedbackOf, rubricsOf } from './rendering/htmlRender.js';
import {
	applySerializedVariables,
	freezeDuration,
	serializeItemSession,
	updateDuration,
} from './serialization/sessionState.js';
import { qtiValueToPci, qtiValueToPublic } from './serialization/valueForms.js';
import {
	buildDeclarationMap,
	ensureBuiltinDeclarations,
} from './declarations/declarationBuilder.js';
import { coerceToDeclarationValue } from './declarations/declarationValues.js';
import {
	isAttempted,
	validateAttemptResponses,
	validateResponses,
} from './processing/responseValidation.js';
import {
	assertSupportedResponseProcessing,
	execTemplateProcessingProgram,
	resetOutcomesToDefault,
	resetResponsesToDefault,
	resetTemplatesToDefault,
	restoreDeclaredTemplateRuleTargets,
	runResponseProcessing,
} from './processing/responseProcessing.js';
import type { ExtractedPci, PciInteractionStatus } from '../pci/types.js';
import { PciHostSession } from '../pci/sessionHosts.js';
import { createTextEntryStringResponse, textEntryStringIdentifier } from '../interactions/text-entry/response.js';

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
	/** @internal Rendering resolves rubric views against the session's role. */
	role: QTIRole;
	/** @internal Engine modules read the resolved configuration through the host. */
	config: ItemSessionEngineConfig;
	private itemXml: string;
	/** @internal Engine modules read the parsed item document through the host. */
	itemDocument: AssessmentItemDocument;
	/** @internal Engine modules read the session's declarations through the host. */
	decls: DeclarationMap;
	/** @internal The declarations as compiled from the item source, before any template rule changed them. */
	sourceDeclarations: DeclarationMap;
	/** @internal Engine modules read the variable context through the host. */
	ctx: DeclarationContext;
	/** @internal Engine modules read the session's random stream through the host. */
	rng: () => number;
	/** @internal Engine modules read the operator registry through the host. */
	ops: OperatorRegistry;
	private extractionRegistry: ExtractionRegistry;
	private interactionDataCache: readonly BaseInteractionData[] | null = null;
	/** Template variables declared with `mathVariable`, substituted into MathML. @internal */
	mathVariableIds: ReadonlySet<string> | null = null;
	/** Template variables declared with `paramVariable`, substituted into `<param>` values. @internal */
	paramVariableIds: ReadonlySet<string> | null = null;
	private componentRegistry: ComponentRegistry;
	private i18nProvider: I18nProvider;
	/** @internal Engine modules resolve canonical element names through the host. */
	mapper: ElementNameMapper;
	/** The item's detected QTI version ('unknown' when nothing identified it). */
	private qtiVersion: QtiVersion;

	/** @internal Set once the implied-zero MAXSCORE warning has fired. */
	warnedImpliedZeroMaxScore = false;
	/** @internal Compiled processing programs, shared by the sessions of one definition. */
	responseProcessingProgram: ProcessingProgram | null = null;
	/** @internal */
	responseProcessing: ResponseProcessingDescriptor;
	/** @internal */
	templateProcessingProgram: ProcessingProgram | null = null;
	/** @internal */
	outcomeProcessingProgram: ProcessingProgram | null = null;
	private _pnp: PnpProfile | undefined;
	private _rootEl: HTMLElement | undefined;
	private _catalogIndex: CatalogIndex = new Map();
	private _stimulusCatalogIndexes: Map<string, CatalogIndex> = new Map();
	/** @internal The PCI hosts of this session, by response identifier. */
	private readonly pciSession = new PciHostSession();
	private _pnpChangeListeners = new Set<(pnp: PnpProfile | undefined) => void>();
	/** @internal The shuffle seed, persisted in saved state and restored. */
	sessionGuid: string;
	/** @internal The item-session lifecycle stage; action orchestration mutates it. */
	lifecycleStatus: ItemLifecycleStatus = 'initial';
	/**
	 * End-attempt responses the candidate turned true since the attempt last ended: the
	 * interactions that invoke the next response processing (see settleEndAttemptResponses).
	 * @internal Response resets read and clear it through the host.
	 */
	readonly endAttemptActivations = new Set<string>();
	private diagnostics: readonly QtiItemDiagnostic[] = [];
	/** @internal matchGroup constraints of the item's pairing interactions, by response identifier. */
	matchGroupConstraints: ReadonlyMap<string, MatchGroupConstraints> = new Map();
	/** @internal When the current duration clock window started. */
	sessionStartedAt: number;
	/** @internal Time on task accumulated before the current clock window. */
	accumulatedDurationMs = 0;
	/** Time on task at the last duration update, in milliseconds. @internal */
	durationMs = 0;

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
		if (!prepared) assertSupportedResponseProcessing(this);
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

	public createPciHost(data: ExtractedPci): PciHost {
		return this.pciSession.create(data, {
			pci: this.config.pci,
			decls: this.decls,
			lifecycleStatus: () => this.lifecycleStatus,
			interactionStatus: () => this.pciInteractionStatus(),
			contentLanguage: () => this.getContentLanguage(),
			coerceToDeclarationValue: (baseType, cardinality, raw, identifier) =>
				this.coerceToDeclarationValue(baseType, cardinality, raw, identifier),
		});
	}

	private pciInteractionStatus(): PciInteractionStatus {
		if (this.role !== 'candidate') return 'review';
		if (this.lifecycleStatus === 'closed') return 'closed';
		return 'interacting';
	}

	/**
	 * Offer a response value to the PCI identified by responseIdentifier. A
	 * mounted module that has already reported a response keeps it.
	 */
	public offerPciResponse(responseIdentifier: string, value: unknown): void {
		this.pciSession.offer(responseIdentifier, value);
	}

	/**
	 * Authoritatively replace a PCI's response, discarding in-progress candidate
	 * state. Session restore and reset-to-default use this.
	 */
	public restorePciResponse(responseIdentifier: string, value: unknown): void {
		this.pciSession.restore(responseIdentifier, value);
	}

	/**
	 * Destroy all PCI hosts. Call on player teardown.
	 */
	public destroyPciHosts(): void {
		this.pciSession.destroyAll();
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
		resetOutcomesToDefault(this);
	}

	private resetResponsesToDefault(): void {
		resetResponsesToDefault(this);
	}

	private resetTemplatesToDefault(): void {
		resetTemplatesToDefault(this);
	}

	private restoreDeclaredTemplateRuleTargets(): void {
		restoreDeclaredTemplateRuleTargets(this);
	}

	private runResponseProcessing(options: {
		finalizeNonAdaptiveAttempt: boolean;
		countAttempt?: boolean;
	}): ScoringResult {
		return runResponseProcessing(this, options);
	}

	public getItemBodyHtml(): HtmlContent {
		return itemBodyHtml(this, this.contentHandlers({ feedback: false }));
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
		return rubricsOf(this, this.contentHandlers(), options);
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
			const pciHost = this.pciSession.get(d.identifier);
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
	 * Template processing re-extracts the item's interactions, so the interaction cache
	 * drops before the program runs.
	 */
	private execTemplateProcessing(): void {
		this.interactionDataCache = null;
		execTemplateProcessingProgram(this);
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
		applySerializedVariables(this, vars);
	}

	private serializeItemSession(): SerializedItemSessionState {
		return serializeItemSession(this);
	}

	/** @internal Value forms shared with PCI hosts and the serializer. */
	qtiValueToPci(value: QtiValue | undefined): unknown {
		return qtiValueToPci(value);
	}

	/** @internal */
	qtiValueToPublic(value: QtiValue | undefined): any {
		return qtiValueToPublic(value);
	}

	/** @internal Response processing runs start by bringing the duration variable current. */
	updateDuration(): void {
		updateDuration(this);
	}

	private freezeDuration(): number {
		return freezeDuration(this);
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


	// ----------------------------------------------------------------------------
	// Item content pass: printedVariable, feedback, templates
	// ----------------------------------------------------------------------------

	private contentHandlers({ feedback = true }: { feedback?: boolean } = {}): ContentHandlers {
		return contentHandlers(this, { feedback });
	}

	/** @internal Scoring resolves the attempt's active modal feedback. */
	getModalFeedback(outcomes: Record<string, any>): ModalFeedback[] {
		return modalFeedbackOf(this, this.contentHandlers(), outcomes);
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
