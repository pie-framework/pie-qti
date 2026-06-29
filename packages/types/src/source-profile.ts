import type { TransformOutput, TransformWarning } from './transform/plugin.js';

export type QtiProfileScope = 'package' | 'resource' | 'item' | 'interaction' | 'asset';

export type ProfileCapability =
	| 'detect'
	| 'conformance-repair'
	| 'metadata'
	| 'standards'
	| 'assets'
	| 'passages'
	| 'rubrics'
	| 'interactions'
	| 'package-assembly'
	| string;

export type SourceProfileFallbackPolicy = 'allow-generic' | 'block-generic';

export interface DetectionEvidence {
	type: string;
	message: string;
	scope?: QtiProfileScope;
	sourcePath?: string;
	resourceId?: string;
	itemId?: string;
	value?: string;
	snippet?: string;
}

export interface SourceProfileMatch {
	profileId: string;
	profileVersion?: string;
	confidence: number;
	scope: QtiProfileScope;
	resourceId?: string;
	itemId?: string;
	sourcePath?: string;
	vendor?: string;
	product?: string;
	authoringTool?: string;
	packageFamily?: string;
	qtiVersions?: string[];
	fallbackPolicy?: SourceProfileFallbackPolicy;
	capabilities?: ProfileCapability[];
	evidence: DetectionEvidence[];
	metadata?: Record<string, unknown>;
}

export interface SourceProfileDiagnostic {
	code: string;
	severity: 'info' | 'warning' | 'error';
	message: string;
	scope: QtiProfileScope;
	profileId?: string;
	handlerId?: string;
	resourceId?: string;
	itemId?: string;
	sourcePath?: string;
	evidence?: DetectionEvidence[];
	metadata?: Record<string, unknown>;
}

export interface StandardCandidate {
	id: string;
	rawValue: string;
	label?: string;
	namespace?: string;
	sourcePath?: string;
	resourceId?: string;
	itemId?: string;
	artifactId?: string;
	matchHint?: 'case' | 'asn' | 'human-code' | 'vendor-mapping' | string;
	profileId?: string;
	evidence?: DetectionEvidence[];
	metadata?: Record<string, unknown>;
}

export interface RubricCandidate {
	id: string;
	sourcePath?: string;
	resourceId?: string;
	itemId?: string;
	profileId?: string;
	kind?: 'simple' | 'holistic' | 'multi-trait' | 'rationale' | 'unknown' | string;
	content?: string;
	evidence?: DetectionEvidence[];
	metadata?: Record<string, unknown>;
}

export interface PackageAssetRef {
	rawHref: string;
	resolvedPath: string;
	basePath?: string;
	usage: 'image' | 'stylesheet' | 'audio' | 'video' | 'html' | 'catalog' | 'source-qti' | 'other' | string;
	ownerResourceId?: string;
	ownerItemId?: string;
	sourceElement?: string;
	sourceAttribute?: string;
}

export interface SidecarArtifact {
	id: string;
	kind:
		| 'asset'
		| 'passage'
		| 'stimulus'
		| 'stylesheet'
		| 'catalog'
		| 'rubric'
		| 'source-qti'
		| 'manifest'
		| 'diagnostics'
		| string;
	sourcePath?: string;
	sourceResourceId?: string;
	mimeType?: string;
	sha256?: string;
	content?: string | Uint8Array;
	storageUri?: string;
	referencedBy: string[];
	metadata?: Record<string, unknown>;
}

export interface TransformTraceEvent {
	id: string;
	kind:
		| 'profile-detected'
		| 'profile-selected'
		| 'package-analyzed'
		| 'resource-analyzed'
		| 'handler-selected'
		| 'handler-delegated'
		| 'finalizer-applied'
		| 'asset-resolved'
		| 'sidecar-emitted'
		| 'metadata-extracted'
		| 'standards-extracted'
		| 'rubric-extracted'
		| 'fallback'
		| 'warning'
		| 'error'
		| string;
	scope: QtiProfileScope;
	timestamp: string;
	message: string;
	profileId?: string;
	handlerId?: string;
	resourceId?: string;
	itemId?: string;
	sourcePath?: string;
	data?: Record<string, unknown>;
}

export interface ConversionTrace {
	traceId: string;
	events: TransformTraceEvent[];
	profiles?: SourceProfileMatch[];
	diagnostics?: SourceProfileDiagnostic[];
	standardCandidates?: StandardCandidate[];
	rubricCandidates?: RubricCandidate[];
	sidecars?: SidecarArtifact[];
}

export interface QtiSourceProfilePackageContext {
	packageId?: string;
	manifestXml?: string;
	manifest?: unknown;
	packageGraph?: unknown;
	files?: readonly string[];
	metadata?: Record<string, unknown>;
}

export interface QtiSourceProfileResourceContext {
	package?: QtiSourceProfilePackageContext;
	resourceId?: string;
	resourceType?: string;
	sourcePath?: string;
	xml?: string;
	metadata?: Record<string, unknown>;
}

export interface QtiSourceProfileItemContext extends QtiSourceProfileResourceContext {
	itemId?: string;
	qtiVersion?: string;
	interactionTypes?: readonly string[];
	responseProcessingXml?: string;
}

export interface SourceProfileExtractionResult {
	standardCandidates?: StandardCandidate[];
	rubricCandidates?: RubricCandidate[];
	sidecars?: SidecarArtifact[];
	diagnostics?: SourceProfileDiagnostic[];
	warnings?: TransformWarning[];
	traceEvents?: TransformTraceEvent[];
	metadata?: Record<string, unknown>;
}

export interface QtiTransformDelegate {
	continue(): Promise<TransformOutput>;
	transformWithBuiltIn(handlerId: string, overrides?: Record<string, unknown>): Promise<unknown>;
}

export interface QtiItemHandler {
	id: string;
	priority?: number;
	fallbackPolicy?: SourceProfileFallbackPolicy;
	canHandle(context: QtiSourceProfileItemContext): boolean | SourceProfileMatch;
	transform(
		context: QtiSourceProfileItemContext,
		delegate: QtiTransformDelegate
	): Promise<TransformOutput | null>;
}

export interface QtiItemDecorator {
	id: string;
	phase?: 'afterModel' | 'beforeFinalize' | 'afterFinalize';
	priority?: number;
	canApply?(context: QtiSourceProfileItemContext, item: unknown): boolean;
	apply(context: QtiSourceProfileItemContext, item: unknown): Promise<void> | void;
}

export interface QtiSourceProfile {
	id: string;
	version?: string;
	label?: string;
	vendor?: string;
	product?: string;
	priority?: number;
	fallbackPolicy?: SourceProfileFallbackPolicy;
	capabilities?: ProfileCapability[];
	detectPackage?(context: QtiSourceProfilePackageContext): SourceProfileMatch | null;
	detectResource?(context: QtiSourceProfileResourceContext): SourceProfileMatch | null;
	detectItem?(context: QtiSourceProfileItemContext): SourceProfileMatch | null;
	extractPackage?(context: QtiSourceProfilePackageContext): SourceProfileExtractionResult | null;
	extractResource?(context: QtiSourceProfileResourceContext): SourceProfileExtractionResult | null;
	extractItem?(context: QtiSourceProfileItemContext): SourceProfileExtractionResult | null;
	itemHandlers?: QtiItemHandler[];
	decorators?: QtiItemDecorator[];
}
