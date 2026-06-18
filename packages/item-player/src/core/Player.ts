import {
	type AreaMapEntry,
	type AreaMapping,
	type BaseType,
	buildOutcomeProcessingAst,
	buildResponseProcessingAst,
	buildTemplateProcessingAst,
	type Cardinality,
	childElements,
	coerceBaseValue,
	DeclarationContext,
	type DeclarationMap,
	evalExpr,
	execProgram,
	findDescendants,
	findFirstDescendant,
	getAttr,
	OperatorRegistry,
	type ProcessingProgram,
	type QtiValue,
	qtiNull,
	qtiValue,
	toBoolean,
	toNumber,
	toStringValue,
} from '@pie-qti/qti-processing';
import type { ElementNameMapper, AttributeNameMapper } from '@pie-qti/qti-common';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import {
	Qti2xElementNameMapper,
	Qti2xAttributeNameMapper,
	Qti3ElementNameMapper,
	Qti3AttributeNameMapper,
	detectQtiVersion,
} from '@pie-qti/qti-common';
import type { AssessmentItemDocument } from '../document/AssessmentItemDocument.js';
import { parseAssessmentItemDocument } from '../document/AssessmentItemDocument.js';
import type { ExtractionRegistry } from '../extraction/ExtractionRegistry.js';
import { createExtractionRegistry } from '../extraction/ExtractionRegistry.js';
import { extractInteractionData } from '../extraction/interactionExtractionPipeline.js';
import { getStandardInteractionExtractors } from '../interactions/modules.js';
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
	PlayerConfig,
	PlayerSecurityConfig,
	QTIRole,
	RubricBlock,
	RubricBlockOptions,
	ScoringResult,
	SerializedItemSessionState,
	SerializedItemSessionVariable,
} from '../types/index.js';
import type { InteractionData } from '../interactions/index.js';
import type { ResponseValidationResult } from '../types/responseValidation.js';
import type { ComponentRegistry } from './ComponentRegistry.js';
import { createComponentRegistry } from './ComponentRegistry.js';
import { createSeededRng } from './random.js';
import { sanitizeHtml } from './sanitizer.js';
import { toTrustedHtml } from './trustedTypes.js';
import { sanitizeResourceUrl } from './urlPolicy.js';
import type { PnpProfile } from '../pnp/types.js';
import { applyPnpToRoot } from '../pnp/applyPnp.js';
import type { CatalogIndex } from '../catalog/types.js';
import { extractCatalog, extractCatalogFromItemXml, mergeCatalogs } from '../catalog/catalogExtractor.js';
import { getCatalogEntry } from '../catalog/catalogLookup.js';
import { PciHost } from '../pci/PciHost.js';
import type { ExtractedPci } from '../pci/types.js';

type DeclKind = 'response' | 'outcome' | 'template';

export class Player {
	private role: QTIRole;
	private config: PlayerConfig;
	private itemXml: string;
	private itemDocument: AssessmentItemDocument;
	private assessmentItem: Element;
	private decls: DeclarationMap;
	private ctx: DeclarationContext;
	private rng: () => number;
	private ops: OperatorRegistry;
	private extractionRegistry: ExtractionRegistry;
	private componentRegistry: ComponentRegistry;
	private i18nProvider: any; // I18nProvider from @pie-qti/i18n
	private mapper: ElementNameMapper;

	private responseProcessingProgram: ProcessingProgram | null = null;
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
	private sessionStartedAt: number;
	private accumulatedDurationMs = 0;

	constructor(config: PlayerConfig) {
		this.config = config;
		this.itemXml = config.itemXml ?? '';
		this.role = config.role ?? 'candidate';
		this.sessionGuid = createSessionGuid();
		this.sessionStartedAt = Date.now();
		this.rng = config.rng ?? (typeof config.seed === 'number' ? createSeededRng(config.seed) : Math.random);

		// Auto-detect QTI version and create appropriate mappers if not provided
		if (!config.elementNameMapper) {
			const version = detectQtiVersion(this.itemXml);
			if (version === '3.0') {
				this.mapper = new Qti3ElementNameMapper();
				// Set in config so it's available to extraction utils
				(config as any).elementNameMapper = this.mapper;
				// Also set attribute mapper if not provided
				if (!config.attributeNameMapper) {
					(config as any).attributeNameMapper = new Qti3AttributeNameMapper();
				}
			} else {
				this.mapper = new Qti2xElementNameMapper();
				(config as any).elementNameMapper = this.mapper;
				if (!config.attributeNameMapper) {
					(config as any).attributeNameMapper = new Qti2xAttributeNameMapper();
				}
			}
		} else {
			this.mapper = config.elementNameMapper as ElementNameMapper;
			if (!config.attributeNameMapper) {
				(config as any).attributeNameMapper =
					this.mapper.version === '3.0'
						? new Qti3AttributeNameMapper()
						: new Qti2xAttributeNameMapper();
			}
		}

		this.itemDocument = parseAssessmentItemDocument({
			itemXml: this.itemXml,
			elementNameMapper: this.mapper,
			attributeNameMapper: config.attributeNameMapper as AttributeNameMapper,
			security: this.config.security,
		});
		this.assessmentItem = this.itemDocument.getAssessmentItem();

		this.decls = this.buildDeclarations();
		this.ensureBuiltinDeclarations(this.decls);
		this.ctx = new DeclarationContext(this.decls);
		this.ops = new OperatorRegistry();

		// Restore session state (outcomes + responses) before running templateProcessing.
		if (config.sessionState) {
			this.applySessionState(config.sessionState);
		}

		// Extraction + rendering registries (for interaction rendering)
		// Pass the element name mapper to the extraction registry for QTI version handling
		this.extractionRegistry = (config.extractionRegistry as ExtractionRegistry | undefined) ?? createExtractionRegistry(this.mapper);
		this.componentRegistry = (config.componentRegistry as ComponentRegistry | undefined) ?? createComponentRegistry();

		// I18n provider (defaults to a simple fallback if not provided)
		this.i18nProvider = config.i18nProvider ?? this.createDefaultI18nProvider();

		// Register standard interaction extractors (idempotent per-registry instance)
		for (const ex of getStandardInteractionExtractors()) {
			try {
				this.extractionRegistry.register(ex as any);
			} catch {
				// ignore duplicates if a caller pre-registered
			}
		}

		// Plugins can further extend registries
		for (const p of (config.plugins ?? []) as any[]) {
			try {
				p?.registerExtractors?.(this.extractionRegistry);
				p?.registerComponents?.(this.componentRegistry);
			} catch {
				// plugin errors shouldn't prevent core parsing
			}
		}

		// Build ASTs once.
		const templateProcessing = this.itemDocument.getProcessingElement('template');
		if (templateProcessing) {
			this.templateProcessingProgram = buildTemplateProcessingAst(templateProcessing, {
				elementNameMapper: this.mapper,
			});
			this.execTemplateProcessing();
		}

		const responseProcessing = this.itemDocument.getProcessingElement('response');
		if (responseProcessing) {
			this.responseProcessingProgram = buildResponseProcessingAst(responseProcessing, {
				elementNameMapper: this.mapper,
			});
		}

		const outcomeProcessing = this.itemDocument.getProcessingElement('outcome');
		if (outcomeProcessing) {
			this.outcomeProcessingProgram = buildOutcomeProcessingAst(outcomeProcessing, {
				elementNameMapper: this.mapper,
			});
		}

		// Apply initial responses after templateProcessing (so template vars are ready).
		if (config.responses) {
			this.setResponses(config.responses as Record<string, unknown>);
		}

		// Detect and log QTI version for compatibility awareness
		const detectedVersion = this.detectQTIVersion();
		if (detectedVersion === 'unknown') {
			console.warn('[QTI Player] Could not detect QTI version. Assuming QTI 2.2 compatibility.');
		} else if (detectedVersion === '2.0') {
			console.warn(
				'[QTI Player] QTI 2.0 detected. Some features may not be fully supported. QTI 2.2 is recommended.'
			);
		} else if (detectedVersion === '2.1') {
			console.info(
				'[QTI Player] QTI 2.1 detected. Using QTI 2.2 compatibility mode with CC2 template support.'
			);
		}

		// Store PNP profile for later use (applyPnpToRoot is called once a root element is available).
		this._pnp = config.pnp;

		// Build catalog index from resolved delivery context, legacy shared catalog XML, and item XML.
		// Item/global entries are merged first; item-level entries win on global collisions.
		// Stimulus entries are kept separately so rendered stimulus terms can avoid ID collisions.
		let mergedCatalog: CatalogIndex = new Map();
		for (const source of config.deliveryContext?.catalogSources ?? []) {
			const sourceCatalog = extractCatalog(source.xml);
			if (source.scope === 'stimulus' && source.stimulusIdentifier) {
				const existing = this._stimulusCatalogIndexes.get(source.stimulusIdentifier) ?? new Map();
				this._stimulusCatalogIndexes.set(source.stimulusIdentifier, mergeCatalogs(existing, sourceCatalog));
			} else {
				mergedCatalog = mergeCatalogs(mergedCatalog, sourceCatalog);
			}
		}
		if (config.catalogXml) {
			mergedCatalog = mergeCatalogs(mergedCatalog, extractCatalogFromItemXml(config.catalogXml));
		}
		this._catalogIndex = mergeCatalogs(mergedCatalog, extractCatalogFromItemXml(this.itemXml));

		// Check strict compliance if enabled
		if (this.config.strictQtiCompliance?.enabled) {
			this.validateStrictCompliance();
		}
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
	): string | null {
		const stimulusHtml = options?.stimulusIdentifier
			? getCatalogEntry(this._stimulusCatalogIndexes.get(options.stimulusIdentifier) ?? new Map(), idref, usage, lang)
			: null;
		const html = stimulusHtml ?? getCatalogEntry(this._catalogIndex, idref, usage, lang);
		if (html === null) return null;
		if (looksLikeCatalogUrl(html)) {
			return sanitizeResourceUrl(html.trim(), this.config.security?.urlPolicy, 'img');
		}
		return this.sanitizeHtmlContent(html);
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
		const baseUrl = this.config.pciBaseUrl ?? (typeof document !== 'undefined' ? document.baseURI : '');
		const host = new PciHost(data, baseUrl);

		// Wire response changes back into the player's declaration context
		host.onResponseChange((responseId: string, value: unknown) => {
			const d = this.decls[responseId];
			if (d) {
				d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, value);
			}
		});

		this._pciHosts.set(data.responseIdentifier, host);
		return host;
	}

	/**
	 * Push a response value into the PCI identified by responseIdentifier.
	 * Called from setResponses() so session restore reaches PCI modules.
	 */
	public setPciResponse(responseIdentifier: string, value: unknown): void {
		this._pciHosts.get(responseIdentifier)?.setResponse(value);
	}

	/**
	 * Disable/enable all PCI hosts based on role.
	 * 'candidate' = enabled; any other role = disabled.
	 */
	public syncPciDisabledState(): void {
		const disabled = this.role !== 'candidate';
		for (const host of this._pciHosts.values()) {
			if (disabled) host.disable(); else host.enable();
		}
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

	public setResponses(responses: Record<string, unknown>): void {
		for (const [id, raw] of Object.entries(responses)) {
			const d = this.decls[id];
			if (!d) continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, raw);
			// Push restored responses into any mounted PCI modules
			this.setPciResponse(id, raw);
		}
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
		this.lifecycleStatus = state.lifecycleStatus;
		this.accumulatedDurationMs = Math.max(0, Number(state.duration) || 0);
		this.sessionStartedAt = Date.now();
		this.applySerializedVariables(state.responseVariables);
		this.applySerializedVariables(state.outcomeVariables);
		this.applySerializedVariables(state.templateVariables);
		this.applySerializedVariables(state.contextVariables);
		this.updateDuration();
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
		const validation = validate ? this.validateResponses(this.getResponses()) : undefined;
		if (validation && !validation.valid) {
			return this.createItemSessionActionResult('endAttempt', this.saveItemSession(), { validation });
		}

		const scoring = this.isAdaptive()
			? this.runAdaptiveSubmitAttempt(options.countAttempt ?? true)
			: this.runResponseProcessing({
					finalizeNonAdaptiveAttempt: true,
					countAttempt: options.countAttempt ?? true,
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

	public getTrustedTypesPolicyName(): string | undefined {
		return this.config.security?.trustedTypesPolicyName;
	}

	/**
	 * Get the i18n provider instance
	 * @returns I18nProvider instance
	 */
	public getI18nProvider(): any {
		return this.i18nProvider;
	}

	/**
	 * Get attribute value with QTI version support.
	 * Tries the attribute mapper's native form first, then falls back to direct lookup.
	 * @param el - Element to get attribute from
	 * @param canonicalName - Canonical (lowercase) attribute name
	 * @returns Attribute value or null
	 */
	private getAttrMapped(el: Element, canonicalName: string): string | null {
		// Try mapped attribute name first (e.g., 'mapkey' -> 'map-key' for QTI 3.0)
		if (this.config.attributeNameMapper) {
			const nativeName = this.config.attributeNameMapper.toNative(canonicalName);
			const value = el.getAttribute(nativeName);
			if (value !== null) return value;
		}
		// Fallback to canonical name (for QTI 2.x compatibility)
		return getAttr(el, canonicalName);
	}

	/**
	 * Create a simple fallback i18n provider when none is provided
	 * This avoids a hard dependency on @pie-qti/i18n
	 */
	private createDefaultI18nProvider(): any {
		return {
			getLocale: () => 'en-US',
			setLocale: () => {},
			t: (key: string) => key, // Fallback to key
			plural: (key: string) => key,
			formatNumber: (value: number) => value.toString(),
			formatDate: (date: Date) => date.toISOString(),
		};
	}

	/**
	 * Detects the QTI version from the assessmentItem element.
	 * Checks both namespace URI and version attribute.
	 *
	 * @returns QTI version string ('2.0', '2.1', '2.2') or 'unknown'
	 */
	private detectQTIVersion(): string {
		const ns = (this.assessmentItem as any).namespaceURI;
		if (ns?.includes('v3p0') || ns?.includes('imsqtiasi_v3p0')) return '3.0';
		if (ns?.includes('v2p2') || ns?.includes('imsqti_v2p2')) return '2.2';
		if (ns?.includes('v2p1') || ns?.includes('imsqti_v2p1')) return '2.1';
		if (ns?.includes('v2p0') || ns?.includes('imsqti_v2p0')) return '2.0';

		// Check element name for QTI 3.0
		const localName = (this.assessmentItem as any).localName || (this.assessmentItem as any).tagName;
		if (localName === 'qti-assessment-item' || localName === 'qti-assessment-test') {
			return '3.0';
		}

		const versionAttr = getAttr(this.assessmentItem, 'version');
		if (versionAttr?.startsWith('3.')) return '3.0';
		if (versionAttr === '2.0') return '2.0';
		if (versionAttr === '2.1') return '2.1';
		if (versionAttr === '2.2') return '2.2';

		return 'unknown';
	}

	/**
	 * Validates strict QTI 2.2 compliance if enabled in configuration.
	 * Logs warnings or throws errors based on config settings.
	 */
	private validateStrictCompliance(): void {
		const config = this.config.strictQtiCompliance;
		if (!config?.enabled) return;

		const version = this.detectQTIVersion();
		if (version !== '2.2') {
			const message = `[QTI Player] Strict compliance enabled but item version is ${version}, not 2.2`;
			if (config.rejectUnknownExtensions) {
				throw new Error(message);
			} else if (config.logDeviations !== false) {
				console.warn(message);
			}
		}

		// Future: Add validation for non-standard elements/attributes
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
		for (const d of Object.values(this.decls)) {
			if ((d as any).__kind !== 'response') continue;
			this.ctx.resetToDefault(d.identifier);
			this.setPciResponse(d.identifier, d.value.kind === 'value' ? d.value.value : null);
		}
	}

	private resetTemplatesToDefault(): void {
		for (const d of Object.values(this.decls)) {
			if (!d.isTemplate) continue;
			this.ctx.resetToDefault(d.identifier);
		}
	}

	private runResponseProcessing(options: {
		finalizeNonAdaptiveAttempt: boolean;
		countAttempt?: boolean;
	}): ScoringResult {
		this.updateDuration();
		// Spec-aligned behavior: each processing run starts from outcome defaults.
		// This prevents stale outcomes when response/outcome processing doesn't set every variable.
		this.resetOutcomesToDefault();

		// Execute response processing if present
		const rpEl = this.itemDocument.getProcessingElement('response');
		if (rpEl) {
			// If responseProcessing has explicit statements, run the compiled program.
			// Otherwise, fall back to template-based processing (responseProcessing@template).
			const hasStatements = childElements(rpEl).length > 0;
			if (hasStatements) {
				this.execResponseProcessingProgram();
			} else {
				const templateUrl = getAttr(rpEl, 'template');
				if (templateUrl) this.execResponseProcessingTemplate(templateUrl);
			}
		}

		// Execute outcome processing if present (runs after responseProcessing)
		this.execOutcomeProcessingProgram();

		// Compatibility: processResponses() has historically finalized non-adaptive items.
		// New scoreAttempt() uses this same engine with finalization disabled.
		if (!this.isAdaptive() && options.finalizeNonAdaptiveAttempt) {
			this.ctx.setValue('completionStatus', qtiValue('identifier', 'single', 'completed'));
			if (options.countAttempt ?? true) {
				const currentAttempts = this.getNumAttempts();
				this.ctx.setValue('numAttempts', qtiValue('integer', 'single', currentAttempts + 1));
			}
		}

		const outcomes = this.collectOutcomes();

		const score = Number(outcomes.SCORE ?? 0);
		const maxScore = Number(outcomes.MAXSCORE ?? 1);
		const completionStatus = (outcomes.completionStatus as CompletionStatus | undefined) ?? 'not_attempted';
		const completed = completionStatus === 'completed' || (!this.isAdaptive() && options.finalizeNonAdaptiveAttempt);

		return {
			score,
			maxScore,
			completed,
			outcomeValues: outcomes,
			modalFeedback: this.getModalFeedback(outcomes),
		};
	}

	public getItemBodyHtml(): HtmlContent {
		const inner = this.itemDocument.serializeItemBodyChildren();
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
		const rubricEls = this.itemDocument.findRubricElements();
		if (rubricEls.length === 0) return [];

		const blocks: RubricBlock[] = [];
		for (const el of rubricEls) {
			const scope = this.itemDocument.rubricElementScope(el);
			if (options.scope && options.scope !== 'all' && scope !== options.scope) continue;

			const viewRaw = (getAttr(el, 'view') || '').trim();
			const view = viewRaw ? viewRaw.split(/[\s,]+/).filter(Boolean) : [];
			const use = (getAttr(el, 'use') || '').trim() || undefined;

			// If view is specified, show only when it includes the current role.
			if (view.length > 0 && role && !view.includes(role)) continue;

			const contentRaw = this.itemDocument.serializeChildren(el) || (el.textContent || '');
			const printed = this.renderPrintedVariables(contentRaw);
			const sanitized = sanitizeHtml(printed, { security: this.config.security });
			const html = toTrustedHtml(sanitized, this.config.security?.trustedTypesPolicyName);

			blocks.push({ view, html, scope, use });
		}

		return blocks;
	}

	public getComponentRegistry(): ComponentRegistry {
		return this.componentRegistry;
	}

	public getExtractionRegistry(): ExtractionRegistry {
		return this.extractionRegistry;
	}

	/**
	 * Canonical interaction API (new): extracted, typed interaction data.
	 */
	public getInteractionData(): InteractionData[] {
		return extractInteractionData({
			document: this.itemDocument,
			extractionRegistry: this.extractionRegistry,
			declarations: this.decls,
			config: this.config,
		});
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

	public submitAttempt(countAttempt: boolean = true): AdaptiveAttemptResult {
		const result = this.runItemSessionAction({ action: 'submitAttempt', countAttempt });
		return result.scoring as AdaptiveAttemptResult;
	}

	private runAdaptiveSubmitAttempt(countAttempt: boolean = true): AdaptiveAttemptResult {
		if (this.isCompleted()) {
			throw new Error('Cannot submit: item is already completed');
		}

		// QTI adaptive semantics: numAttempts should reflect the attempt being processed.
		if (this.isAdaptive() && countAttempt) {
			const next = this.getNumAttempts() + 1;
			this.ctx.setValue('numAttempts', qtiValue('integer', 'single', next));
			// Promote completionStatus from not_attempted -> unknown on first submission unless RP sets it.
			if (this.getCompletionStatus() === 'not_attempted') {
				this.ctx.setValue('completionStatus', qtiValue('identifier', 'single', 'unknown'));
			}
		}

		const base = this.processResponses();
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
			out[d.identifier] = d.value.kind === 'value' ? d.value.value : null;
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
		return respDecl.correctResponse.value;
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
			out[d.identifier] = respDecl.correctResponse.value;
		}
		return out;
	}

	public getTemplateVariables(): Record<string, any> {
		const out: Record<string, any> = {};
		for (const d of Object.values(this.decls)) {
			if (!d.isTemplate) continue;
			out[d.identifier] = d.value.kind === 'value' ? d.value.value : null;
		}
		return out;
	}

	public setTemplateVariables(vars: Record<string, any>): void {
		for (const [id, raw] of Object.entries(vars)) {
			const d = this.decls[id];
			if (!d?.isTemplate) continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, raw);
		}
	}

	public getSessionState(): ItemSessionState {
		const out: ItemSessionState = {};
		for (const d of Object.values(this.decls)) {
			out[d.identifier] = d.value.kind === 'value' ? d.value.value : null;
		}
		return out;
	}

	public validateResponses(responses: Record<string, any>): ResponseValidationResult {
		const interactions = this.getInteractions();
		const entries: ResponseValidationResult['entries'] = {};
		const issues: ResponseValidationResult['issues'] = [];

		for (const i of interactions) {
			const responseId = i.responseIdentifier;
			const decl = this.decls[responseId];
			const value = responses[responseId];

			const required =
				i.type !== 'endAttemptInteraction' &&
				(i.type !== 'mediaInteraction' || (typeof i.minPlays === 'number' && i.minPlays > 0));

			let complete = !required;
			if (i.type === 'mediaInteraction' && required) {
				const minPlays = Number(i.minPlays || 0);
				complete = Number(value || 0) >= minPlays;
			} else if (required) {
				if (Array.isArray(value)) {
					complete = value.length > 0;
					// Enforce minChoices / minAssociations where applicable
					const minChoices = Number(i.minChoices || i.minAssociations || 0);
					if (complete && minChoices > 0) {
						complete = value.length >= minChoices;
					}
					// Enforce matchMin per-choice: each pairing entry "id1 id2" in value must
					// appear at least matchMin times for the relevant choice.
					// Collect all choice arrays that can carry matchMin across all pairing interaction types.
					const choices: Array<{ identifier: string; matchMin?: number }> = [
						...(i.choices ?? []),
						...(i.gapTexts ?? []),
						...(i.gapImages ?? []),
						...(i.sourceSet ?? []),
						...(i.targetSet ?? []),
						...(i.associableHotspots ?? []),
					];
					for (const choice of choices) {
						const min = Number(choice.matchMin || 0);
						if (min > 0) {
							const count = (value as string[]).filter((p) => {
								const parts = p.split(' ');
								return parts[0] === choice.identifier || parts[1] === choice.identifier;
							}).length;
							if (count < min) {
								complete = false;
								break;
							}
						}
					}
				} else {
					complete = value !== null && value !== undefined && value !== '';
				}
			}

			const errors: string[] = [];
			const warnings: string[] = [];

			if (decl) {
				if (decl.cardinality === 'multiple' || decl.cardinality === 'ordered') {
					if (!(value === null || value === undefined || Array.isArray(value))) {
						errors.push(`Expected an array for ${decl.cardinality} response '${responseId}'`);
					}
				} else {
					if (Array.isArray(value)) {
						errors.push(`Expected a single value for response '${responseId}'`);
					}
				}
			}

			const valid = errors.length === 0;
			entries[responseId] = {
				responseId,
				interactionType: i.type,
				required,
				complete,
				valid,
				errors,
				warnings,
			};

			for (const e of errors) {
				issues.push({
					responseId,
					code: 'invalid_shape',
					message: e,
					severity: 'error',
				});
			}
		}

		const allValid = Object.values(entries).every((e) => e.valid);
		return { valid: allValid, entries, issues };
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
		for (const i of this.getResponseInteractions()) {
			const id = i.responseIdentifier;
			const v = responses[id];
			if (i.type === 'mediaInteraction') {
				if (Number(v || 0) > 0) return true;
				continue;
			}
			if (Array.isArray(v)) {
				if (v.length > 0) return true;
				continue;
			}
			if (v !== null && v !== undefined && v !== '') return true;
		}
		return false;
	}

	// ----------------------------------------------------------------------------
	// Execution
	// ----------------------------------------------------------------------------

	private execTemplateProcessing(): void {
		if (!this.templateProcessingProgram) return;
		execProgram(
			{
				ctx: this.ctx,
				ops: this.ops,
				rng: this.rng,
				customOperators: this.config.customOperators,
			},
			this.templateProcessingProgram
		);
	}

	private execResponseProcessingProgram(): void {
		if (!this.responseProcessingProgram) return;
		execProgram(
			{
				ctx: this.ctx,
				ops: this.ops,
				rng: this.rng,
				customOperators: this.config.customOperators,
			},
			this.responseProcessingProgram
		);
	}

	private execOutcomeProcessingProgram(): void {
		if (!this.outcomeProcessingProgram) return;
		execProgram(
			{
				ctx: this.ctx,
				ops: this.ops,
				rng: this.rng,
				customOperators: this.config.customOperators,
			},
			this.outcomeProcessingProgram
		);
	}

	private execResponseProcessingTemplate(templateUrl: string): void {
		const name = templateUrl.split('/').pop()?.toLowerCase().replace(/\.xml$/, '');
		if (!name) {
			console.warn(`[QTI Player] Could not extract template name from URL: ${templateUrl}`);
			return;
		}

		const responseDeclIds = Object.values(this.decls)
			.filter((d) => (d as any).__kind === 'response')
			.map((d) => d.identifier);

		switch (name) {
			case 'match_correct':
			case 'cc2_match': { // CC2_match is an alias for match_correct (QTI 2.1 compatibility)
				const allCorrect = responseDeclIds.every((id) => {
					const expr = { kind: 'expr.match', id: 'tmp', a: { kind: 'expr.variable', id: 'tmp', identifier: id }, b: { kind: 'expr.correct', id: 'tmp', identifier: id } } as any;
					// Use evaluator match semantics by evaluating a constructed MatchExpr
					return toBoolean(
						evalExpr(
							{ ctx: this.ctx, ops: this.ops, rng: this.rng, customOperators: this.config.customOperators },
							expr
						)
					);
				});

				const max = toNumber(this.ctx.getValue('MAXSCORE'));
				this.ctx.setValue('SCORE', qtiValue('float', 'single', allCorrect ? (Number.isFinite(max) ? max : 1) : 0));
				return;
			}
			case 'match_nothing':
			case 'cc2_match_nothing': { // QTI 2.1 compatibility
				const isEmptyResponse = (v: QtiValue | undefined): boolean => {
					if (!v) return true;
					if (v.kind === 'null') return true;
					if (v.kind === 'invalid') return false;
					if (v.value === null || v.value === undefined) return true;
					if (Array.isArray(v.value)) return v.value.length === 0;
					if (typeof v.value === 'string') return v.value.trim().length === 0;
					return false;
				};

				const allEmpty = responseDeclIds.every((id) => isEmptyResponse(this.ctx.getValue(id)));
				const max = toNumber(this.ctx.getValue('MAXSCORE'));
				this.ctx.setValue('SCORE', qtiValue('float', 'single', allEmpty ? (Number.isFinite(max) ? max : 1) : 0));
				return;
			}
			case 'map_response':
			case 'cc2_map_response': { // QTI 2.1 compatibility
				let total = 0;
				for (const id of responseDeclIds) {
					const d = this.decls[id];
					if (!d.mapping) continue;
					const v = evalExpr(
						{ ctx: this.ctx, ops: this.ops, rng: this.rng },
						{ kind: 'expr.mapResponse', id: 'tmp', identifier: id } as any
					);
					total += toNumber(v) || 0;
				}
				this.ctx.setValue('SCORE', qtiValue('float', 'single', total));
				return;
			}
			case 'map_response_point':
			case 'cc2_map_response_point': { // QTI 2.1 compatibility
				let total = 0;
				for (const id of responseDeclIds) {
					const d = this.decls[id];
					if (!d.areaMapping) continue;
					const v = evalExpr(
						{ ctx: this.ctx, ops: this.ops, rng: this.rng },
						{ kind: 'expr.mapResponsePoint', id: 'tmp', identifier: id } as any
					);
					total += toNumber(v) || 0;
				}
				this.ctx.setValue('SCORE', qtiValue('float', 'single', total));
				return;
			}
			default:
				console.warn(`[QTI Player] Unsupported response processing template: ${name}`);
				return;
		}
	}

	// ----------------------------------------------------------------------------
	// Declarations
	// ----------------------------------------------------------------------------

	private buildDeclarations(): DeclarationMap {
		const decls: DeclarationMap = {};

		const addDecl = (kind: DeclKind, el: Element) => {
			const identifier = this.getAttrMapped(el, 'identifier');
			const cardinality = (this.getAttrMapped(el, 'cardinality') || 'single') as Cardinality;
			const baseType = (this.getAttrMapped(el, 'baseType') || 'string') as BaseType;
			if (!identifier) return;

			const defaultValue = this.parseDefaultValue(el, baseType, cardinality);
			decls[identifier] = {
				identifier,
				baseType,
				cardinality,
				defaultValue,
				value: defaultValue,
				isTemplate: kind === 'template',
				// @ts-expect-error internal marker for templates
				__kind: kind,
			};

			// Response + outcome declarations may define mappings used by mapResponse/mapOutcome.
			// (Templates do not participate in mapping.)
			if (kind === 'response' || kind === 'outcome') {
				const mappingEl = findFirstDescendant(el, this.mapper.toNative('mapping'));
				if (mappingEl) {
					decls[identifier].mapping = this.parseMapping(mappingEl, baseType);
				}
			}

			// Outcome declarations may define a lookup table (matchTable or interpolationTable)
			// used by the lookupOutcomeValue rule.
			if (kind === 'outcome') {
				const matchTableEl = findFirstDescendant(el, this.mapper.toNative('matchtable'));
				const interpolationTableEl = findFirstDescendant(el, this.mapper.toNative('interpolationtable'));
				if (matchTableEl) {
					decls[identifier].lookupTable = this.parseMatchTable(matchTableEl);
				} else if (interpolationTableEl) {
					decls[identifier].lookupTable = this.parseInterpolationTable(interpolationTableEl);
				}
			}

			if (kind === 'response') {
				const correctEl = findFirstDescendant(el, this.mapper.toNative('correctresponse'));
				if (correctEl) {
					decls[identifier].correctResponse = this.parseCorrectResponse(correctEl, baseType, cardinality);
				}
				const areaMappingEl = findFirstDescendant(el, this.mapper.toNative('areamapping'));
				if (areaMappingEl) {
					decls[identifier].areaMapping = this.parseAreaMapping(areaMappingEl);
				}
			}
		};

		for (const el of this.itemDocument.findDeclarationElements('response')) addDecl('response', el);
		for (const el of this.itemDocument.findDeclarationElements('outcome')) addDecl('outcome', el);
		for (const el of this.itemDocument.findDeclarationElements('template')) addDecl('template', el);

		return decls;
	}

	private parseMatchTable(el: Element) {
		const defaultValueRaw = (getAttr(el, 'defaultValue') || '').trim();
		const defaultValue = defaultValueRaw ? Number(defaultValueRaw) : undefined;
		return {
			kind: 'table.matchTable' as const,
			defaultValue: Number.isFinite(defaultValue as any) ? defaultValue : undefined,
			entries: findDescendants(el, this.mapper.toNative('matchtableentry')).map((e) => ({
				sourceValue: (getAttr(e, 'sourceValue') || '').trim(),
				targetValue: (getAttr(e, 'targetValue') || '').trim(),
			})),
		};
	}

	private parseInterpolationTable(el: Element) {
		const defaultValueRaw = (getAttr(el, 'defaultValue') || '').trim();
		const defaultValue = defaultValueRaw ? Number(defaultValueRaw) : undefined;
		const interpolationMethod = (getAttr(el, 'interpolationMethod') || 'linear').trim();
		return {
			kind: 'table.interpolationTable' as const,
			defaultValue: Number.isFinite(defaultValue as any) ? defaultValue : undefined,
			interpolationMethod,
			entries: findDescendants(el, this.mapper.toNative('interpolationtableentry'))
				.map((e) => ({
					sourceValue: Number((getAttr(e, 'sourceValue') || '').trim()),
					targetValue: Number((getAttr(e, 'targetValue') || '').trim()),
				}))
				.filter((e) => Number.isFinite(e.sourceValue) && Number.isFinite(e.targetValue)),
		};
	}

	private ensureBuiltinDeclarations(decls: DeclarationMap): void {
		// completionStatus + numAttempts are defined in QTI (esp. adaptive items) and commonly used
		// without explicit outcomeDeclaration in authoring content.
		if (!decls.completionStatus) {
			decls.completionStatus = {
				identifier: 'completionStatus',
				baseType: 'identifier',
				cardinality: 'single',
				value: qtiValue('identifier', 'single', 'not_attempted'),
				isTemplate: false,
				// @ts-expect-error internal marker
				__kind: 'outcome',
			};
		}

		if (!decls.numAttempts) {
			decls.numAttempts = {
				identifier: 'numAttempts',
				baseType: 'integer',
				cardinality: 'single',
				defaultValue: qtiValue('integer', 'single', 0),
				value: qtiValue('integer', 'single', 0),
				isTemplate: false,
				// @ts-expect-error internal marker
				__kind: 'outcome',
			};
		}

		if (!decls.duration) {
			decls.duration = {
				identifier: 'duration',
				baseType: 'duration',
				cardinality: 'single',
				defaultValue: qtiValue('duration', 'single', 0),
				value: qtiValue('duration', 'single', 0),
				isTemplate: false,
				// @ts-expect-error internal marker
				__kind: 'outcome',
			};
		}

		// Common scoring defaults
		if (!decls.SCORE) {
			decls.SCORE = {
				identifier: 'SCORE',
				baseType: 'float',
				cardinality: 'single',
				value: qtiValue('float', 'single', 0),
				isTemplate: false,
				// @ts-expect-error internal marker
				__kind: 'outcome',
			};
		}
		if (!decls.MAXSCORE) {
			decls.MAXSCORE = {
				identifier: 'MAXSCORE',
				baseType: 'float',
				cardinality: 'single',
				value: qtiValue('float', 'single', 1),
				isTemplate: false,
				// @ts-expect-error internal marker
				__kind: 'outcome',
			};
		}
	}

	private applySessionState(state: ItemSessionState): void {
		for (const [id, raw] of Object.entries(state)) {
			const d = this.decls[id];
			if (!d) continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, raw);
		}
		const restoredDuration = Number(state.duration);
		if (Number.isFinite(restoredDuration) && restoredDuration >= 0) {
			this.accumulatedDurationMs = restoredDuration;
			this.sessionStartedAt = Date.now();
			this.updateDuration();
		}
	}

	private applySerializedVariables(vars: Record<string, SerializedItemSessionVariable>): void {
		for (const v of Object.values(vars)) {
			const d = this.decls[v.identifier];
			if (!d) continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, v.value);
			if ((d as any).__kind === 'response') {
				this.setPciResponse(d.identifier, v.value);
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
			} else if (contextIds.has(d.identifier)) {
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
		return {
			identifier: d.identifier,
			kind: ((d as any).__kind ?? (d.isTemplate ? 'template' : 'context')) as SerializedItemSessionVariable['kind'],
			baseType: d.baseType,
			cardinality: d.cardinality,
			value: this.qtiValueToSerializable(d.value),
			defaultValue: this.qtiValueToSerializable(d.defaultValue),
		};
	}

	private qtiValueToSerializable(value: QtiValue | undefined): any {
		if (!value || value.kind !== 'value') return null;
		return value.value;
	}

	private updateDuration(): void {
		const elapsedMs = Math.max(0, Date.now() - this.sessionStartedAt);
		const durationMs = this.accumulatedDurationMs + elapsedMs;
		this.ctx.setValue('duration', qtiValue('duration', 'single', durationMs));
	}

	private freezeDuration(): number {
		this.updateDuration();
		const duration = this.getDuration();
		this.accumulatedDurationMs = duration;
		this.sessionStartedAt = Date.now();
		return duration;
	}

	private getDuration(): number {
		const value = this.ctx.getValue('duration');
		return Math.max(0, Math.floor(toNumber(value) || 0));
	}

	private parseDefaultValue(declEl: Element, baseType: BaseType, cardinality: Cardinality): QtiValue {
		const defaultEl = findFirstDescendant(declEl, this.mapper.toNative('defaultvalue'));
		if (!defaultEl) return qtiNull(baseType, cardinality);
		const values = findDescendants(defaultEl, this.mapper.toNative('value')).map((v) => (v.textContent || '').trim());
		if (cardinality === 'multiple' || cardinality === 'ordered') {
			return qtiValue(
				baseType,
				cardinality,
				values.map((t) => {
					const v = coerceBaseValue(baseType, t);
					return v.kind === 'value' ? v.value : null;
				})
			);
		}
		return coerceBaseValue(baseType, values[0] ?? '');
	}

	private parseCorrectResponse(correctEl: Element, baseType: BaseType, cardinality: Cardinality): QtiValue {
		const values = findDescendants(correctEl, this.mapper.toNative('value')).map((v) => (v.textContent || '').trim());
		if (cardinality === 'multiple' || cardinality === 'ordered') {
			return qtiValue(
				baseType,
				cardinality,
				values.map((t) => {
					const v = coerceBaseValue(baseType, t);
					return v.kind === 'value' ? v.value : null;
				})
			);
		}
		return coerceBaseValue(baseType, values[0] ?? '');
	}

	private parseMapping(mappingEl: Element, baseType: BaseType) {
		const defaultValue = Number(this.getAttrMapped(mappingEl, 'defaultValue') || 0);
		const lowerBound = this.getAttrMapped(mappingEl, 'lowerBound') ? Number(this.getAttrMapped(mappingEl, 'lowerBound')) : undefined;
		const upperBound = this.getAttrMapped(mappingEl, 'upperBound') ? Number(this.getAttrMapped(mappingEl, 'upperBound')) : undefined;
		const mappingCaseSensitive = this.getAttrMapped(mappingEl, 'caseSensitive') || 'true';
		const entries: Record<string, any> = {};

		const normalizePairKey = (k: string): string => {
			const parts = k.trim().split(/\s+/).filter(Boolean);
			if (parts.length === 2) return [...parts].sort().join(' ');
			return k.trim();
		};

		const normalizeDirectedPairKey = (k: string): string => {
			const parts = k.trim().split(/\s+/).filter(Boolean);
			if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
			return k.trim();
		};

		for (const e of findDescendants(mappingEl, this.mapper.toNative('mapentry'))) {
			const mapKey = this.getAttrMapped(e, 'mapKey');
			const mappedValue = this.getAttrMapped(e, 'mappedValue');
			if (!mapKey || mappedValue === null) continue;
			const effectiveCaseSensitive = this.getAttrMapped(e, 'caseSensitive') || mappingCaseSensitive || 'true';
			const storedKey =
				baseType === 'pair'
					? normalizePairKey(mapKey)
					: baseType === 'directedPair'
						? normalizeDirectedPairKey(mapKey)
						: mapKey;
			entries[storedKey] = { mapKey: storedKey, mappedValue: Number(mappedValue), caseSensitive: effectiveCaseSensitive };
			if (effectiveCaseSensitive !== 'true') {
				const lowerKey = storedKey.toLowerCase();
				entries[lowerKey] = {
					mapKey: lowerKey,
					mappedValue: Number(mappedValue),
					caseSensitive: effectiveCaseSensitive,
				};
			}
		}

		return { defaultValue, lowerBound, upperBound, caseSensitive: mappingCaseSensitive, entries };
	}

	private parseAreaMapping(areaMappingEl: Element): AreaMapping {
		const defaultValue = Number(getAttr(areaMappingEl, 'defaultValue') || 0);
		const lowerBound = getAttr(areaMappingEl, 'lowerBound')
			? Number(getAttr(areaMappingEl, 'lowerBound'))
			: undefined;
		const upperBound = getAttr(areaMappingEl, 'upperBound')
			? Number(getAttr(areaMappingEl, 'upperBound'))
			: undefined;

		const entries: AreaMapEntry[] = [];
		for (const e of findDescendants(areaMappingEl, this.mapper.toNative('areamapentry'))) {
			const shape = (getAttr(e, 'shape') || 'default') as AreaMapEntry['shape'];
			const coords = String(getAttr(e, 'coords') || '');
			const mappedValue = Number(getAttr(e, 'mappedValue') || 0);
			entries.push({ shape, coords, mappedValue });
		}

		return { defaultValue, lowerBound, upperBound, entries };
	}

	private coerceToDeclarationValue(baseType: BaseType, cardinality: Cardinality, raw: unknown): QtiValue {
		if (raw === null || raw === undefined) return qtiNull(baseType, cardinality);

		// Allow callers to pass fully-formed QtiValue (e.g. session restore).
		if (typeof raw === 'object' && raw && 'kind' in raw) {
			return raw as QtiValue;
		}

		// For file types, preserve QTIFileResponse objects directly
		if (baseType === 'file') {
			if (cardinality === 'multiple' || cardinality === 'ordered') {
				const arr = Array.isArray(raw) ? raw : [raw];
				// For file types, preserve objects (QTIFileResponse) directly
				return qtiValue(baseType, cardinality, arr.filter((v) => v !== null && v !== undefined));
			}
			// For single file, preserve the object directly
			return qtiValue(baseType, cardinality, raw);
		}

		if (cardinality === 'multiple' || cardinality === 'ordered') {
			const arr = Array.isArray(raw) ? raw : [raw];
			const coerced = arr
				.map((v) => String(v ?? '').trim())
				.filter((s) => s.length > 0)
				.map((t) => {
					const v = coerceBaseValue(baseType, t);
					return v.kind === 'value' ? v.value : null;
				})
				.filter((v) => v !== null);
			// Multiple/ordered can legitimately be an empty container (distinct from null).
			return qtiValue(baseType, cardinality, coerced);
		}

		const t = String(raw ?? '').trim();
		if (t.length === 0) return qtiNull(baseType, cardinality);
		return coerceBaseValue(baseType, t);
	}

	private collectOutcomes(): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		for (const d of Object.values(this.decls)) {
			if ((d as any).__kind !== 'outcome') continue;
			if (d.value.kind === 'value') out[d.identifier] = d.value.value;
			else if (d.value.kind === 'null') out[d.identifier] = null;
		}
		// Ensure MAXSCORE always has a value (fallback to 1.0 if null or missing)
		if (out.MAXSCORE === null || out.MAXSCORE === undefined) {
			out.MAXSCORE = 1.0;
		}
		return out;
	}

	// ----------------------------------------------------------------------------
	// printedVariable + feedback
	// ----------------------------------------------------------------------------

	private renderPrintedVariables(html: string): string {
		const readIdentifier = (attrs: string): string | null => {
			const m = attrs.match(/identifier\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
			return (m?.[1] || m?.[2] || m?.[3] || '').trim() || null;
		};

		const renderId = (id: string | null): string => {
			if (!id) return '';
			const v = this.ctx.getValue(id);
			if (v.kind !== 'value') return '';
			if (Array.isArray(v.value)) return v.value.map(String).join(', ');
			return String(v.value);
		};

		let out = html.replace(/<printedVariable\b([^>]*)>([\s\S]*?)<\/printedVariable>/gi, (_m, attrs) =>
			renderId(readIdentifier(String(attrs)))
		);
		out = out.replace(/<printedVariable\b([^>]*)\/>/gi, (_m, attrs) => renderId(readIdentifier(String(attrs))));
		return out;
	}

	private renderHtmlContent(html: string): HtmlContent {
		const printed = this.renderPrintedVariables(html);
		const sanitized = sanitizeHtml(printed, { security: this.config.security });
		return toTrustedHtml(sanitized, this.config.security?.trustedTypesPolicyName);
	}

	private getModalFeedback(outcomes: Record<string, any>): ModalFeedback[] {
		const feedbackEls = this.itemDocument.findModalFeedbackElements();
		const active: ModalFeedback[] = [];

		for (const el of feedbackEls) {
			const identifier = this.getAttrMapped(el, 'identifier') || '';
			const outcomeIdentifier = this.getAttrMapped(el, 'outcomeIdentifier') || '';
			const showHide = (this.getAttrMapped(el, 'showHide') || 'show') as 'show' | 'hide';
			const title = this.getAttrMapped(el, 'title') || undefined;

			const contentRaw = this.itemDocument.serializeChildren(el) || (el.textContent || '');
			const sanitized = sanitizeHtml(contentRaw, { security: this.config.security });
			const content = toTrustedHtml(sanitized, this.config.security?.trustedTypesPolicyName);

			const outcomeValue = outcomes[outcomeIdentifier];
			const shouldShow = showHide === 'show' ? outcomeValue === identifier : outcomeValue !== identifier;
			if (shouldShow && content) {
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
	};
}

function createSessionGuid(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `item-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function looksLikeCatalogUrl(value: string): boolean {
	const trimmed = value.trim();
	return /^(https?:\/\/|\/\/|\/|\.{0,2}\/|data:|blob:)/i.test(trimmed) ||
		/\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|mp4|webm|pdf)(\?.*)?$/i.test(trimmed);
}
