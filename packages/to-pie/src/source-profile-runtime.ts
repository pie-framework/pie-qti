import type {
	ConversionTrace,
	QtiItemDecorator,
	QtiItemHandler,
	QtiSourceProfile,
	QtiSourceProfileItemContext,
	QtiSourceProfilePackageContext,
	QtiTransformDelegate,
	SourceProfileDiagnostic,
	SourceProfileFallbackPolicy,
	SourceProfileExtractionResult,
	SourceProfileMatch,
	TransformOutput,
	TransformTraceEvent,
} from '@pie-qti/transform-types';

export interface ProfileRuntimeResult {
	matches: SourceProfileMatch[];
	extraction: SourceProfileExtractionResult;
}

export type ItemDecoratorPhase = NonNullable<QtiItemDecorator['phase']>;

export interface RunItemHandlersInput {
	profiles: readonly QtiSourceProfile[];
	runtime: ProfileRuntimeResult;
	context: QtiSourceProfileItemContext;
	delegate: QtiTransformDelegate;
	trace?: ConversionTrace;
}

export interface ItemHandlerRuntimeResult {
	output: TransformOutput | null;
	allowGenericFallback: boolean;
	diagnostics: SourceProfileDiagnostic[];
}

export function createConversionTrace(traceId = `qti-trace-${Date.now()}`): ConversionTrace {
	return {
		traceId,
		events: [],
	};
}

export function addTraceEvent(
	trace: ConversionTrace,
	event: Omit<TransformTraceEvent, 'id' | 'timestamp'>
): TransformTraceEvent {
	const next: TransformTraceEvent = {
		...event,
		id: `${trace.traceId}:${trace.events.length + 1}`,
		timestamp: new Date().toISOString(),
	};
	trace.events.push(next);
	return next;
}

export function detectItemProfiles(
	profiles: readonly QtiSourceProfile[],
	context: QtiSourceProfileItemContext,
	trace?: ConversionTrace
): ProfileRuntimeResult {
	const matches = profiles
		.flatMap((profile) => {
			const match = profile.detectItem?.(context) ?? null;
			return match ? [normalizeProfileMatch(match, profile)] : [];
		})
		.sort(compareMatches);

	for (const match of matches) {
		addTraceEvent(trace ?? createConversionTrace(), {
			kind: 'profile-detected',
			scope: match.scope,
			profileId: match.profileId,
			itemId: context.itemId,
			resourceId: context.resourceId,
			sourcePath: context.sourcePath,
			message: `Detected source profile ${match.profileId} with confidence ${match.confidence}.`,
			data: {
				confidence: match.confidence,
				evidenceCount: match.evidence.length,
				profileVersion: match.profileVersion,
				fallbackPolicy: match.fallbackPolicy,
			},
		});
	}

	return {
		matches,
		extraction: extractFromProfiles(profiles, context, trace),
	};
}

export function detectPackageProfiles(
	profiles: readonly QtiSourceProfile[],
	context: QtiSourceProfilePackageContext,
	trace?: ConversionTrace
): ProfileRuntimeResult {
	const matches = profiles
		.flatMap((profile) => {
			const match = profile.detectPackage?.(context) ?? null;
			return match ? [normalizeProfileMatch(match, profile)] : [];
		})
		.sort(compareMatches);

	for (const match of matches) {
		addTraceEvent(trace ?? createConversionTrace(), {
			kind: 'profile-detected',
			scope: match.scope,
			profileId: match.profileId,
			message: `Detected source profile ${match.profileId} with confidence ${match.confidence}.`,
			data: {
				confidence: match.confidence,
				evidenceCount: match.evidence.length,
				profileVersion: match.profileVersion,
				fallbackPolicy: match.fallbackPolicy,
			},
		});
	}

	return {
		matches,
		extraction: extractFromPackageProfiles(profiles, context, trace),
	};
}

export async function applyItemDecorators(
	profiles: readonly QtiSourceProfile[],
	runtime: ProfileRuntimeResult,
	context: QtiSourceProfileItemContext,
	item: unknown,
	phase: ItemDecoratorPhase,
	trace?: ConversionTrace
): Promise<void> {
	const activeProfileIds = new Set(runtime.matches.map((match) => match.profileId));
	const decorators = profiles
		.filter((profile) => activeProfileIds.has(profile.id))
		.flatMap((profile) =>
			(profile.decorators ?? []).map((decorator) => ({
				profile,
				decorator,
			}))
		)
		.filter(({ decorator }) => (decorator.phase ?? 'beforeFinalize') === phase)
		.sort((left, right) => (right.decorator.priority ?? 0) - (left.decorator.priority ?? 0));

	for (const { profile, decorator } of decorators) {
		if (decorator.canApply && !decorator.canApply(context, item)) {
			continue;
		}
		await decorator.apply(context, item);
		addTraceEvent(trace ?? createConversionTrace(), {
			kind: 'finalizer-applied',
			scope: 'item',
			profileId: profile.id,
			handlerId: decorator.id,
			itemId: context.itemId,
			resourceId: context.resourceId,
			sourcePath: context.sourcePath,
			message: `Applied item decorator ${decorator.id} from source profile ${profile.id}.`,
			data: { phase },
		});
	}
}

export async function runItemHandlers({
	profiles,
	runtime,
	context,
	delegate,
	trace,
}: RunItemHandlersInput): Promise<ItemHandlerRuntimeResult> {
	const activeProfileIds = new Set(runtime.matches.map((match) => match.profileId));
	const diagnostics: SourceProfileDiagnostic[] = [];
	const handlers = profiles
		.filter((profile) => activeProfileIds.has(profile.id))
		.flatMap((profile) =>
			(profile.itemHandlers ?? []).map((handler) => ({
				profile,
				handler,
			}))
		)
		.sort((left, right) => (right.handler.priority ?? 0) - (left.handler.priority ?? 0));

	if (runtime.matches.length > 0 && handlers.length === 0) {
		for (const match of runtime.matches) {
			const profile = profiles.find((candidate) => candidate.id === match.profileId);
			const policy = profile?.fallbackPolicy ?? 'allow-generic';
			const diagnostic = createNoHandlerDiagnostic(match, profile?.fallbackPolicy, context);
			diagnostics.push(diagnostic);
			addDiagnostic(trace, diagnostic);
			if (policy === 'block-generic') {
				return { output: null, allowGenericFallback: false, diagnostics };
			}
		}
	}

	for (const { profile, handler } of handlers) {
		const canHandle = evaluateItemHandler(profile.id, handler, context, trace);
		if (!canHandle) {
			addTraceEvent(trace ?? createConversionTrace(), {
				kind: 'handler-skipped',
				scope: 'item',
				profileId: profile.id,
				handlerId: handler.id,
				itemId: context.itemId,
				resourceId: context.resourceId,
				sourcePath: context.sourcePath,
				message: `Source profile item handler ${handler.id} did not match this item.`,
			});
			continue;
		}

		addTraceEvent(trace ?? createConversionTrace(), {
			kind: 'handler-selected',
			scope: 'item',
			profileId: profile.id,
			handlerId: handler.id,
			itemId: context.itemId,
			resourceId: context.resourceId,
			sourcePath: context.sourcePath,
			message: `Selected source profile item handler ${handler.id}.`,
			data: typeof canHandle === 'object' ? { match: canHandle } : undefined,
		});

		try {
			const output = await handler.transform(
				context,
				createTracedDelegate(profile.id, handler.id, context, delegate, trace)
			);
			if (output) {
				addTraceEvent(trace ?? createConversionTrace(), {
					kind: 'handler-selected',
					scope: 'item',
					profileId: profile.id,
					handlerId: handler.id,
					itemId: context.itemId,
					resourceId: context.resourceId,
					sourcePath: context.sourcePath,
					message: `Source profile item handler ${handler.id} produced a transform output.`,
				});
				return { output, allowGenericFallback: false, diagnostics };
			}
			const policy = handler.fallbackPolicy ?? profile.fallbackPolicy ?? 'allow-generic';
			const diagnostic = createNoOutputDiagnostic(profile.id, handler.id, policy, context);
			diagnostics.push(diagnostic);
			addDiagnostic(trace, diagnostic);
			addTraceEvent(trace ?? createConversionTrace(), {
				kind: 'fallback',
				scope: 'item',
				profileId: profile.id,
				handlerId: handler.id,
				itemId: context.itemId,
				resourceId: context.resourceId,
				sourcePath: context.sourcePath,
				message:
					policy === 'block-generic'
						? `Source profile item handler ${handler.id} returned no output and blocks generic fallback.`
						: `Source profile item handler ${handler.id} returned no output; continuing handler selection.`,
			});
			if (policy === 'block-generic') {
				return { output: null, allowGenericFallback: false, diagnostics };
			}
		} catch (error) {
			const diagnostic = createHandlerErrorDiagnostic(profile.id, handler.id, context, error as Error);
			diagnostics.push(diagnostic);
			addDiagnostic(trace, diagnostic);
			throw error;
		}
	}

	if (runtime.matches.length > 0) {
		const blockingMatches = runtime.matches.filter((match) => {
			const profile = profiles.find((candidate) => candidate.id === match.profileId);
			return profile?.fallbackPolicy === 'block-generic';
		});
		for (const match of blockingMatches) {
			const diagnostic = createUnhandledProfileDiagnostic(match, context);
			diagnostics.push(diagnostic);
			addDiagnostic(trace, diagnostic);
		}
		if (blockingMatches.length > 0) {
			return { output: null, allowGenericFallback: false, diagnostics };
		}
	}

	return { output: null, allowGenericFallback: true, diagnostics };
}

function extractFromProfiles(
	profiles: readonly QtiSourceProfile[],
	context: QtiSourceProfileItemContext,
	trace?: ConversionTrace
): SourceProfileExtractionResult {
	const result: SourceProfileExtractionResult = {};
	for (const profile of profiles) {
		const extracted = profile.extractItem?.(context);
		if (!extracted) continue;
		mergeExtraction(result, extracted);
		addTraceEvent(trace ?? createConversionTrace(), {
			kind: 'metadata-extracted',
			scope: 'item',
			profileId: profile.id,
			itemId: context.itemId,
			resourceId: context.resourceId,
			sourcePath: context.sourcePath,
			message: `Ran item extraction for source profile ${profile.id}.`,
			data: extractionCounts(extracted),
		});
	}
	return result;
}

function extractFromPackageProfiles(
	profiles: readonly QtiSourceProfile[],
	context: QtiSourceProfilePackageContext,
	trace?: ConversionTrace
): SourceProfileExtractionResult {
	const result: SourceProfileExtractionResult = {};
	for (const profile of profiles) {
		const extracted = profile.extractPackage?.(context);
		if (!extracted) continue;
		mergeExtraction(result, extracted);
		addTraceEvent(trace ?? createConversionTrace(), {
			kind: 'metadata-extracted',
			scope: 'package',
			profileId: profile.id,
			message: `Ran package extraction for source profile ${profile.id}.`,
			data: extractionCounts(extracted),
		});
	}
	return result;
}

function mergeExtraction(target: SourceProfileExtractionResult, source: SourceProfileExtractionResult) {
	if (source.standardCandidates?.length) {
		target.standardCandidates = [...(target.standardCandidates ?? []), ...source.standardCandidates];
	}
	if (source.rubricCandidates?.length) {
		target.rubricCandidates = [...(target.rubricCandidates ?? []), ...source.rubricCandidates];
	}
	if (source.sidecars?.length) {
		target.sidecars = [...(target.sidecars ?? []), ...source.sidecars];
	}
	if (source.diagnostics?.length) {
		target.diagnostics = [...(target.diagnostics ?? []), ...source.diagnostics];
	}
	if (source.warnings?.length) {
		target.warnings = [...(target.warnings ?? []), ...source.warnings];
	}
	if (source.traceEvents?.length) {
		target.traceEvents = [...(target.traceEvents ?? []), ...source.traceEvents];
	}
	if (source.metadata) {
		target.metadata = {
			...(target.metadata ?? {}),
			...source.metadata,
		};
	}
}

function extractionCounts(extracted: SourceProfileExtractionResult): Record<string, number> {
	return {
		standardCandidates: extracted.standardCandidates?.length ?? 0,
		rubricCandidates: extracted.rubricCandidates?.length ?? 0,
		sidecars: extracted.sidecars?.length ?? 0,
		diagnostics: extracted.diagnostics?.length ?? 0,
		warnings: extracted.warnings?.length ?? 0,
	};
}

function compareMatches(left: SourceProfileMatch, right: SourceProfileMatch) {
	return right.confidence - left.confidence || left.profileId.localeCompare(right.profileId);
}

function normalizeProfileMatch(match: SourceProfileMatch, profile: QtiSourceProfile): SourceProfileMatch {
	return {
		...match,
		profileId: match.profileId || profile.id,
		profileVersion: match.profileVersion ?? profile.version,
		fallbackPolicy: match.fallbackPolicy ?? profile.fallbackPolicy ?? 'allow-generic',
		capabilities: match.capabilities ?? profile.capabilities,
	};
}

function evaluateItemHandler(
	profileId: string,
	handler: QtiItemHandler,
	context: QtiSourceProfileItemContext,
	trace?: ConversionTrace
): boolean | SourceProfileMatch {
	try {
		return handler.canHandle(context);
	} catch (error) {
		addTraceEvent(trace ?? createConversionTrace(), {
			kind: 'error',
			scope: 'item',
			profileId,
			handlerId: handler.id,
			itemId: context.itemId,
			resourceId: context.resourceId,
			sourcePath: context.sourcePath,
			message: `Source profile item handler ${handler.id} canHandle failed: ${(error as Error).message}`,
		});
		throw error;
	}
}

function createTracedDelegate(
	profileId: string,
	handlerId: string,
	context: QtiSourceProfileItemContext,
	delegate: QtiTransformDelegate,
	trace?: ConversionTrace
): QtiTransformDelegate {
	return {
		continue: async () => {
			addTraceEvent(trace ?? createConversionTrace(), {
				kind: 'handler-delegated',
				scope: 'item',
				profileId,
				handlerId,
				itemId: context.itemId,
				resourceId: context.resourceId,
				sourcePath: context.sourcePath,
				message: `Source profile item handler ${handlerId} delegated to the generic QTI transform.`,
			});
			return delegate.continue();
		},
		transformWithBuiltIn: async (builtInHandlerId, overrides) => {
			addTraceEvent(trace ?? createConversionTrace(), {
				kind: 'handler-delegated',
				scope: 'item',
				profileId,
				handlerId,
				itemId: context.itemId,
				resourceId: context.resourceId,
				sourcePath: context.sourcePath,
				message: `Source profile item handler ${handlerId} delegated to built-in handler ${builtInHandlerId}.`,
				data: { builtInHandlerId, overrideKeys: Object.keys(overrides ?? {}) },
			});
			return delegate.transformWithBuiltIn(builtInHandlerId, overrides);
		},
	};
}

function addDiagnostic(trace: ConversionTrace | undefined, diagnostic: SourceProfileDiagnostic): void {
	if (!trace) return;
	trace.diagnostics = [...(trace.diagnostics ?? []), diagnostic];
	addTraceEvent(trace, {
		kind:
			diagnostic.severity === 'error'
				? 'error'
				: diagnostic.severity === 'warning'
					? 'warning'
					: 'diagnostic',
		scope: diagnostic.scope,
		profileId: diagnostic.profileId,
		handlerId: diagnostic.handlerId,
		itemId: diagnostic.itemId,
		resourceId: diagnostic.resourceId,
		sourcePath: diagnostic.sourcePath,
		message: diagnostic.message,
		data: {
			code: diagnostic.code,
			severity: diagnostic.severity,
			metadata: diagnostic.metadata,
		},
	});
}

function createNoHandlerDiagnostic(
	match: SourceProfileMatch,
	policy: SourceProfileFallbackPolicy | undefined,
	context: QtiSourceProfileItemContext
): SourceProfileDiagnostic {
	const fallbackPolicy = policy ?? 'allow-generic';
	return {
		code:
			fallbackPolicy === 'block-generic'
				? 'QTI_PROFILE_REQUIRES_HANDLER'
				: 'QTI_PROFILE_GENERIC_FALLBACK',
		severity: fallbackPolicy === 'block-generic' ? 'error' : 'info',
		scope: 'item',
		profileId: match.profileId,
		itemId: context.itemId,
		resourceId: context.resourceId,
		sourcePath: context.sourcePath,
		message:
			fallbackPolicy === 'block-generic'
				? `Source profile ${match.profileId} matched this item but did not provide an item handler, and generic fallback is disabled.`
				: `Source profile ${match.profileId} matched this item but did not provide an item handler; generic fallback remains allowed.`,
		evidence: match.evidence,
		metadata: { fallbackPolicy },
	};
}

function createNoOutputDiagnostic(
	profileId: string,
	handlerId: string,
	policy: SourceProfileFallbackPolicy,
	context: QtiSourceProfileItemContext
): SourceProfileDiagnostic {
	return {
		code:
			policy === 'block-generic'
				? 'QTI_PROFILE_HANDLER_BLOCKED_FALLBACK'
				: 'QTI_PROFILE_HANDLER_NO_OUTPUT',
		severity: policy === 'block-generic' ? 'error' : 'warning',
		scope: 'item',
		profileId,
		handlerId,
		itemId: context.itemId,
		resourceId: context.resourceId,
		sourcePath: context.sourcePath,
		message:
			policy === 'block-generic'
				? `Source profile item handler ${handlerId} returned no output, and generic fallback is disabled.`
				: `Source profile item handler ${handlerId} returned no output; generic fallback remains allowed.`,
		metadata: { fallbackPolicy: policy },
	};
}

function createUnhandledProfileDiagnostic(
	match: SourceProfileMatch,
	context: QtiSourceProfileItemContext
): SourceProfileDiagnostic {
	return {
		code: 'QTI_PROFILE_UNHANDLED_BLOCKED_FALLBACK',
		severity: 'error',
		scope: 'item',
		profileId: match.profileId,
		itemId: context.itemId,
		resourceId: context.resourceId,
		sourcePath: context.sourcePath,
		message: `Source profile ${match.profileId} matched this item, but no source-profile handler produced output and generic fallback is disabled.`,
		evidence: match.evidence,
		metadata: { fallbackPolicy: 'block-generic' },
	};
}

function createHandlerErrorDiagnostic(
	profileId: string,
	handlerId: string,
	context: QtiSourceProfileItemContext,
	error: Error
): SourceProfileDiagnostic {
	return {
		code: 'QTI_PROFILE_HANDLER_ERROR',
		severity: 'error',
		scope: 'item',
		profileId,
		handlerId,
		itemId: context.itemId,
		resourceId: context.resourceId,
		sourcePath: context.sourcePath,
		message: `Source profile item handler ${handlerId} failed: ${error.message}`,
	};
}
