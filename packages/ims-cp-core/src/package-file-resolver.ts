import {
	DEFAULT_HEURISTICS_CONFIG,
	normalizeHeuristicsConfig,
	type QtiHeuristicsConfig,
} from './qti-heuristics.js';

export type PackageReferenceKind =
	| 'media-asset'
	| 'stylesheet'
	| 'catalog-file'
	| 'source-xml'
	| 'assessment-item-ref'
	| 'other-asset';

export type PackageReferenceResolutionStrategy =
	| 'source-relative'
	| 'package-root'
	| 'unique-suffix'
	| 'unique-basename';

export type PackageReferenceUnresolvedStatus = 'skipped' | 'unsafe' | 'ambiguous' | 'missing';

export interface PackageReferenceDiagnostic {
	severity: 'info' | 'warning' | 'error';
	code: string;
	message: string;
	sourcePath?: string;
	reference?: string;
	candidatePaths?: string[];
}

export interface PackageFileIndex {
	readonly exactPaths: ReadonlySet<string>;
	readonly pathsBySuffix: ReadonlyMap<string, readonly string[]>;
	readonly pathsByBasename: ReadonlyMap<string, readonly string[]>;
	readonly diagnostics: readonly PackageReferenceDiagnostic[];
}

export interface ResolvePackageReferenceInput {
	readonly fileIndex: PackageFileIndex;
	readonly rawHref: string;
	readonly sourcePath?: string;
	readonly referenceKind: PackageReferenceKind;
	readonly heuristicsConfig?: QtiHeuristicsConfig;
	readonly manifestEvidencePaths?: ReadonlySet<string>;
}

export interface ResolvedPackageReference {
	readonly status: 'resolved';
	readonly rawHref: string;
	readonly lookupHref: string;
	readonly renderHref: string;
	readonly resolvedPath: string;
	readonly strategy: PackageReferenceResolutionStrategy;
	readonly heuristic: boolean;
	readonly queryAndFragment: string;
	readonly diagnostics: readonly PackageReferenceDiagnostic[];
}

export interface UnresolvedPackageReference {
	readonly status: PackageReferenceUnresolvedStatus;
	readonly rawHref: string;
	readonly lookupHref: string;
	readonly queryAndFragment: string;
	readonly diagnostics: readonly PackageReferenceDiagnostic[];
	readonly candidatePaths?: readonly string[];
}

export type PackageReferenceResolution = ResolvedPackageReference | UnresolvedPackageReference;

interface NormalizedPathResult {
	path: string;
	unsafe: boolean;
}

export function buildPackageFileIndex(paths: readonly string[]): PackageFileIndex {
	const exactPaths = new Set<string>();
	const pathsBySuffix = new Map<string, string[]>();
	const pathsByBasename = new Map<string, string[]>();
	const diagnostics: PackageReferenceDiagnostic[] = [];

	for (const rawPath of paths) {
		const normalized = normalizePackagePath('', rawPath);
		if (hasUnsafeEncodedPathToken(rawPath) || normalized.unsafe || !normalized.path) {
			diagnostics.push({
				severity: 'warning',
				code: 'IMS_CP_FILE_INDEX_UNSAFE_PATH',
				message: `Package file index skipped unsafe path: ${rawPath}.`,
				reference: rawPath,
			});
			continue;
		}
		if (exactPaths.has(normalized.path)) {
			diagnostics.push({
				severity: 'warning',
				code: 'IMS_CP_FILE_INDEX_COLLISION',
				message: `Package file index saw duplicate canonical path: ${normalized.path}.`,
				reference: rawPath,
				candidatePaths: [normalized.path],
			});
			continue;
		}
		exactPaths.add(normalized.path);
		addSuffixes(pathsBySuffix, normalized.path);
		const basename = basenameOf(normalized.path);
		if (basename) {
			mapArrayFor(pathsByBasename, lookupKey(basename)).push(normalized.path);
		}
	}

	return { exactPaths, pathsBySuffix, pathsByBasename, diagnostics };
}

export function resolvePackageReference(input: ResolvePackageReferenceInput): PackageReferenceResolution {
	const rawHref = input.rawHref;
	const trimmed = String(rawHref ?? '').trim();
	const split = splitLookupHref(trimmed);
	const lookupHref = split.lookupHref.replaceAll('\\', '/').trim();
	const diagnostics: PackageReferenceDiagnostic[] = [];

	if (!lookupHref || lookupHref.startsWith('#') || isExternalHref(lookupHref)) {
		return {
			status: 'skipped',
			rawHref,
			lookupHref,
			queryAndFragment: split.queryAndFragment,
			diagnostics,
		};
	}
	if (lookupHref.startsWith('/') || hasUnsafeEncodedPathToken(lookupHref)) {
		return unsafeResolution(rawHref, lookupHref, split.queryAndFragment, input.sourcePath);
	}

	const sourceBase = input.sourcePath ? dirname(input.sourcePath) : '';
	const sourceCandidate = normalizePackagePath(sourceBase, lookupHref);
	if (sourceCandidate.unsafe) {
		return unsafeResolution(rawHref, lookupHref, split.queryAndFragment, input.sourcePath);
	}
	const sourceMatch = exactMatch(input.fileIndex, sourceCandidate.path);
	if (sourceMatch) {
		return resolved(rawHref, lookupHref, split.queryAndFragment, sourceMatch, 'source-relative', false, diagnostics);
	}

	const rootCandidate = normalizePackagePath('', lookupHref);
	if (!rootCandidate.unsafe) {
		const rootMatch = exactMatch(input.fileIndex, rootCandidate.path);
		if (rootMatch) {
			return resolved(rawHref, lookupHref, split.queryAndFragment, rootMatch, 'package-root', false, diagnostics);
		}
	}

	const heuristics = normalizeHeuristicsConfig(input.heuristicsConfig ?? DEFAULT_HEURISTICS_CONFIG);
	if (!heuristics.enabled || !heuristics.lenientPackageResourcePaths) {
		return missing(rawHref, lookupHref, split.queryAndFragment, input.sourcePath, [
			{
				severity: 'info',
				code: 'IMS_CP_REFERENCE_HEURISTIC_DISABLED',
				message: `Heuristic package path resolution is disabled for ${lookupHref}.`,
				sourcePath: input.sourcePath,
				reference: rawHref,
			},
		]);
	}

	const suffixKeys = suffixLookupKeys(sourceCandidate.path, rootCandidate.path, lookupHref);
	let ambiguousSuffixMatches: readonly string[] = [];
	let suffixKey = suffixKeys[0] ?? '';
	let eligibleSuffixMatches: readonly string[] = [];
	for (const key of suffixKeys) {
		if (!canUseSingleSegmentSuffix(input.referenceKind) && !key.includes('/')) {
			continue;
		}
		const suffixMatches = uniqueSorted(input.fileIndex.pathsBySuffix.get(lookupKey(key)) ?? []);
		const eligibleMatches = filterManifestEvidence(suffixMatches, input);
		if (eligibleMatches.length === 1) {
			suffixKey = key;
			eligibleSuffixMatches = eligibleMatches;
			break;
		}
		if (eligibleMatches.length > 1 && ambiguousSuffixMatches.length === 0) {
			suffixKey = key;
			ambiguousSuffixMatches = eligibleMatches;
		}
	}
	if (eligibleSuffixMatches.length === 1) {
		return resolved(
			rawHref,
			lookupHref,
			split.queryAndFragment,
			eligibleSuffixMatches[0],
			'unique-suffix',
			true,
			diagnostics
		);
	}
	if (ambiguousSuffixMatches.length > 1) {
		return ambiguous(rawHref, lookupHref, split.queryAndFragment, input.sourcePath, ambiguousSuffixMatches);
	}

	if (!canUseBasenameHeuristic(input.referenceKind, heuristics)) {
		return missing(rawHref, lookupHref, split.queryAndFragment, input.sourcePath, diagnostics);
	}
	const basename = basenameOf(suffixKey);
	const basenameMatches = uniqueSorted(input.fileIndex.pathsByBasename.get(lookupKey(basename)) ?? []);
	if (basenameMatches.length === 1) {
		return resolved(
			rawHref,
			lookupHref,
			split.queryAndFragment,
			basenameMatches[0],
			'unique-basename',
			true,
			diagnostics
		);
	}
	if (basenameMatches.length > 1) {
		return ambiguous(rawHref, lookupHref, split.queryAndFragment, input.sourcePath, basenameMatches);
	}

	return missing(rawHref, lookupHref, split.queryAndFragment, input.sourcePath, diagnostics);
}

function exactMatch(fileIndex: PackageFileIndex, path: string): string | null {
	return path && fileIndex.exactPaths.has(path) ? path : null;
}

function resolved(
	rawHref: string,
	lookupHref: string,
	queryAndFragment: string,
	resolvedPath: string,
	strategy: PackageReferenceResolutionStrategy,
	heuristic: boolean,
	diagnostics: readonly PackageReferenceDiagnostic[]
): ResolvedPackageReference {
	return {
		status: 'resolved',
		rawHref,
		lookupHref,
		renderHref: `${resolvedPath}${queryAndFragment}`,
		resolvedPath,
		strategy,
		heuristic,
		queryAndFragment,
		diagnostics,
	};
}

function missing(
	rawHref: string,
	lookupHref: string,
	queryAndFragment: string,
	sourcePath: string | undefined,
	diagnostics: readonly PackageReferenceDiagnostic[]
): UnresolvedPackageReference {
	return {
		status: 'missing',
		rawHref,
		lookupHref,
		queryAndFragment,
		diagnostics: diagnostics.length > 0
			? diagnostics
			: [
					{
						severity: 'warning',
						code: 'IMS_CP_REFERENCE_MISSING',
						message: `Package reference could not be resolved: ${lookupHref}.`,
						sourcePath,
						reference: rawHref,
					},
				],
	};
}

function ambiguous(
	rawHref: string,
	lookupHref: string,
	queryAndFragment: string,
	sourcePath: string | undefined,
	candidatePaths: readonly string[]
): UnresolvedPackageReference {
	return {
		status: 'ambiguous',
		rawHref,
		lookupHref,
		queryAndFragment,
		candidatePaths,
		diagnostics: [
			{
				severity: 'warning',
				code: 'IMS_CP_REFERENCE_AMBIGUOUS',
				message: `Package reference is ambiguous: ${lookupHref} matched ${candidatePaths.length} files.`,
				sourcePath,
				reference: rawHref,
				candidatePaths: [...candidatePaths],
			},
		],
	};
}

function unsafeResolution(
	rawHref: string,
	lookupHref: string,
	queryAndFragment: string,
	sourcePath: string | undefined
): UnresolvedPackageReference {
	return {
		status: 'unsafe',
		rawHref,
		lookupHref,
		queryAndFragment,
		diagnostics: [
			{
				severity: 'error',
				code: 'IMS_CP_REFERENCE_UNSAFE',
				message: `Package reference escapes the package root or uses an absolute package path: ${lookupHref}.`,
				sourcePath,
				reference: rawHref,
			},
		],
	};
}

function splitLookupHref(rawHref: string): { lookupHref: string; queryAndFragment: string } {
	const queryIndex = rawHref.indexOf('?');
	const fragmentIndex = rawHref.indexOf('#');
	const indexes = [queryIndex, fragmentIndex].filter((index) => index >= 0);
	if (indexes.length === 0) {
		return { lookupHref: rawHref, queryAndFragment: '' };
	}
	const splitIndex = Math.min(...indexes);
	return {
		lookupHref: rawHref.slice(0, splitIndex),
		queryAndFragment: rawHref.slice(splitIndex),
	};
}

function isExternalHref(href: string): boolean {
	return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

function hasUnsafeEncodedPathToken(href: string): boolean {
	let current = href;
	for (let i = 0; i < 3; i += 1) {
		if (/%(?:2e|2f|5c)/i.test(current)) {
			return true;
		}
		const decoded = safeDecodeURIComponent(current);
		if (decoded === current) {
			return false;
		}
		current = decoded;
	}
	return /%(?:2e|2f|5c)/i.test(current);
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function normalizePackagePath(basePath: string | undefined, href: string): NormalizedPathResult {
	const raw = href.replaceAll('\\', '/').trim();
	if (!raw || raw.startsWith('/')) {
		return { path: '', unsafe: raw.startsWith('/') };
	}
	const parts = [...(basePath ? basePath.replaceAll('\\', '/').split('/') : []), ...raw.split('/')];
	const normalized: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') {
			if (normalized.length === 0) {
				return { path: '', unsafe: true };
			}
			normalized.pop();
			continue;
		}
		normalized.push(part);
	}
	return { path: normalized.join('/'), unsafe: false };
}

function suffixLookupKeys(sourceCandidate: string, rootCandidate: string, lookupHref: string): string[] {
	return uniqueStrings([
		rootCandidate,
		normalizePackagePath('', lookupHref).path,
		sourceCandidate,
		lookupHref.replaceAll('\\', '/').replace(/^\/+/, ''),
	].filter(Boolean));
}

function canUseBasenameHeuristic(
	referenceKind: PackageReferenceKind,
	heuristics: ReturnType<typeof normalizeHeuristicsConfig>
): boolean {
	if (!heuristics.lenientAssetBasenames) return false;
	return referenceKind === 'media-asset';
}

function canUseSingleSegmentSuffix(referenceKind: PackageReferenceKind): boolean {
	return referenceKind === 'media-asset';
}

function filterManifestEvidence(
	matches: readonly string[],
	input: ResolvePackageReferenceInput
): readonly string[] {
	if (input.referenceKind !== 'source-xml' && input.referenceKind !== 'assessment-item-ref') {
		return matches;
	}
	const evidence = input.manifestEvidencePaths;
	if (!evidence) return [];
	return matches.filter((match) => evidence.has(match));
}

function addSuffixes(index: Map<string, string[]>, path: string): void {
	const parts = path.split('/');
	for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
		const suffix = parts.slice(partIndex).join('/');
		if (suffix) {
			mapArrayFor(index, lookupKey(suffix)).push(path);
		}
	}
}

function lookupKey(value: string): string {
	return value.toLowerCase();
}

function mapArrayFor<K, V>(map: Map<K, V[]>, key: K): V[] {
	const existing = map.get(key);
	if (existing) return existing;
	const next: V[] = [];
	map.set(key, next);
	return next;
}

function basenameOf(path: string): string {
	const index = path.lastIndexOf('/');
	return index === -1 ? path : path.slice(index + 1);
}

function dirname(path: string): string {
	const normalized = path.replaceAll('\\', '/');
	const index = normalized.lastIndexOf('/');
	return index === -1 ? '' : normalized.slice(0, index);
}

function uniqueSorted(values: readonly string[]): string[] {
	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uniqueStrings(values: readonly string[]): string[] {
	return [...new Set(values)];
}
