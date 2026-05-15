import type {
	ConversionTrace,
	QtiSourceProfile,
	QtiSourceProfileItemContext,
	QtiSourceProfilePackageContext,
	SourceProfileExtractionResult,
	SourceProfileMatch,
	TransformTraceEvent,
} from '@pie-qti/transform-types';

export interface ProfileRuntimeResult {
	matches: SourceProfileMatch[];
	extraction: SourceProfileExtractionResult;
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
