import type {
	ConversionTrace,
	QtiItemDecorator,
	QtiItemHandler,
	QtiSourceProfile,
	QtiSourceProfileItemContext,
	QtiSourceProfilePackageContext,
	QtiTransformDelegate,
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
			return match ? [{ ...match, profileId: match.profileId || profile.id }] : [];
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
			return match ? [{ ...match, profileId: match.profileId || profile.id }] : [];
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
}: RunItemHandlersInput): Promise<TransformOutput | null> {
	const activeProfileIds = new Set(runtime.matches.map((match) => match.profileId));
	const handlers = profiles
		.filter((profile) => activeProfileIds.has(profile.id))
		.flatMap((profile) =>
			(profile.itemHandlers ?? []).map((handler) => ({
				profile,
				handler,
			}))
		)
		.sort((left, right) => (right.handler.priority ?? 0) - (left.handler.priority ?? 0));

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
				return output;
			}
			addTraceEvent(trace ?? createConversionTrace(), {
				kind: 'fallback',
				scope: 'item',
				profileId: profile.id,
				handlerId: handler.id,
				itemId: context.itemId,
				resourceId: context.resourceId,
				sourcePath: context.sourcePath,
				message: `Source profile item handler ${handler.id} returned no output; continuing handler selection.`,
			});
		} catch (error) {
			addTraceEvent(trace ?? createConversionTrace(), {
				kind: 'error',
				scope: 'item',
				profileId: profile.id,
				handlerId: handler.id,
				itemId: context.itemId,
				resourceId: context.resourceId,
				sourcePath: context.sourcePath,
				message: `Source profile item handler ${handler.id} failed: ${(error as Error).message}`,
			});
			throw error;
		}
	}

	return null;
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
		warnings: extracted.warnings?.length ?? 0,
	};
}

function compareMatches(left: SourceProfileMatch, right: SourceProfileMatch) {
	return right.confidence - left.confidence || left.profileId.localeCompare(right.profileId);
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
