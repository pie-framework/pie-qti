import { type ManifestResource, type ParsedManifest, parseManifest } from './manifest-parser.js';

export type PackageDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface PackageDiagnostic {
	severity: PackageDiagnosticSeverity;
	code: string;
	message: string;
	resourceId?: string;
	sourcePath?: string;
	reference?: string;
}

export type QtiPackageVersion = '2.1' | '2.2' | '3.0' | 'unknown' | 'conflicting';
export type QtiVersionConfidence = 'high' | 'medium' | 'low' | 'none' | 'conflicting';

export interface QtiVersionSignal {
	source: 'manifest' | 'qti_xml' | 'schema_location' | 'package_metadata';
	version: Exclude<QtiPackageVersion, 'unknown' | 'conflicting'>;
	confidence: Exclude<QtiVersionConfidence, 'none' | 'conflicting'>;
	evidence: string;
	resourceId?: string;
	sourcePath?: string;
}

export interface QtiPackageVersionDiagnostic {
	version: QtiPackageVersion;
	confidence: QtiVersionConfidence;
	signals: QtiVersionSignal[];
	diagnostics: PackageDiagnostic[];
}

export interface PackageFileAccess {
	readText(path: string): Promise<string | null | undefined> | string | null | undefined;
	readBuffer?(path: string): Promise<Uint8Array | null | undefined> | Uint8Array | null | undefined;
	exists?(path: string): Promise<boolean> | boolean;
	listFiles?(): Promise<string[]> | string[];
	resolvePreviewUrl?(path: string): Promise<string | null | undefined> | string | null | undefined;
}

export type PackageResourceKind = 'item' | 'test' | 'passage' | 'asset' | 'webcontent' | 'other';

export interface PackageResourceNode {
	identifier: string;
	type: string;
	kind: PackageResourceKind;
	href?: string;
	resolvedHref?: string;
	xmlBase?: string;
	files: string[];
	resolvedFiles: string[];
	dependencies: string[];
	metadata?: ManifestResource['metadata'];
}

export interface PackageReference {
	kind: 'manifest-dependency' | 'assessment-item-ref' | 'asset' | 'stylesheet' | 'object' | 'catalog';
	rawHref: string;
	resolvedPath?: string;
	sourcePath?: string;
	sourceElement?: string;
	sourceAttribute?: string;
	targetResourceId?: string;
}

export interface PackageAssetRef {
	rawHref: string;
	resolvedPath: string;
	usage: 'image' | 'stylesheet' | 'audio' | 'video' | 'html' | 'catalog' | 'source-qti' | 'other';
	ownerResourceId?: string;
	ownerResourceIds?: string[];
	sourcePath?: string;
	sourcePaths?: string[];
	sourceElement?: string;
	sourceAttribute?: string;
}

export interface PackageResourceClosure {
	resourceId: string;
	resourceIds: string[];
	filePaths: string[];
	assetPaths: string[];
	diagnostics: PackageDiagnostic[];
}

export interface PackageEntrypoint {
	resourceId: string;
	kind: 'item' | 'test' | 'passage';
	href?: string;
}

export type PackageRelationshipKind = 'manifest-dependency' | 'assessment-item-ref' | 'shared-asset';

export interface PackageRelationshipHint {
	kind: PackageRelationshipKind;
	sourceResourceId?: string;
	sourceResourceIds?: string[];
	targetResourceId?: string;
	targetPath?: string;
	rawHref?: string;
	sourcePath?: string;
	sourceElement?: string;
	sourceAttribute?: string;
}

export interface AnalyzedContentPackage {
	packageId: string;
	manifest: ParsedManifest;
	resources: Map<string, PackageResourceNode>;
	entrypoints: PackageEntrypoint[];
	references: Map<string, PackageReference[]>;
	closures: Map<string, PackageResourceClosure>;
	assets: Map<string, PackageAssetRef>;
	qtiVersion: QtiPackageVersionDiagnostic;
	diagnostics: PackageDiagnostic[];
	files: string[];
}

export interface SerializedContentPackageEvidence {
	packageId: string;
	manifestIdentifier?: string;
	entrypoints: PackageEntrypoint[];
	resources: PackageResourceNode[];
	references: Array<PackageReference & { resourceId: string }>;
	closures: PackageResourceClosure[];
	assets: PackageAssetRef[];
	relationshipHints: PackageRelationshipHint[];
	qtiVersion: QtiPackageVersionDiagnostic;
	diagnostics: PackageDiagnostic[];
	files: string[];
}

export interface AnalyzeContentPackageInput {
	packageId?: string;
	manifestXml: string;
	basePath?: string;
	fileAccess?: PackageFileAccess;
}

const ASSET_EXTENSIONS: Record<string, PackageAssetRef['usage']> = {
	'.apng': 'image',
	'.avif': 'image',
	'.gif': 'image',
	'.jpg': 'image',
	'.jpeg': 'image',
	'.png': 'image',
	'.svg': 'image',
	'.webp': 'image',
	'.css': 'stylesheet',
	'.mp3': 'audio',
	'.m4a': 'audio',
	'.ogg': 'audio',
	'.wav': 'audio',
	'.mp4': 'video',
	'.mov': 'video',
	'.webm': 'video',
	'.html': 'html',
	'.htm': 'html',
	'.xml': 'source-qti',
};

export async function analyzeContentPackage({
	packageId,
	manifestXml,
	basePath,
	fileAccess,
}: AnalyzeContentPackageInput): Promise<AnalyzedContentPackage> {
	const manifest = parseManifest(manifestXml, basePath);
	const diagnostics: PackageDiagnostic[] = [];
	const resources = new Map<string, PackageResourceNode>();
	const references = new Map<string, PackageReference[]>();
	const assets = new Map<string, PackageAssetRef>();
	const files = fileAccess?.listFiles ? await fileAccess.listFiles() : [];
	const listedFiles = fileAccess?.listFiles ? new Set(files) : undefined;
	const versionSignals: QtiVersionSignal[] = [
		...detectManifestVersionSignals(manifestXml),
		...detectResourceTypeVersionSignals(manifest.resources.values()),
	];

	for (const resource of manifest.resources.values()) {
		const node = toResourceNode(resource, manifest);
		resources.set(node.identifier, node);
		for (const filePath of node.resolvedFiles) {
			maybeRegisterAsset(assets, filePath, {
				ownerResourceId: node.identifier,
				sourcePath: node.resolvedHref,
			});
			if (fileAccess && !(await packagePathExists(filePath, fileAccess, listedFiles))) {
				diagnostics.push({
					severity: 'warning',
					code: 'IMS_CP_MISSING_FILE',
					message: `Resource ${node.identifier} declares missing package file ${filePath}.`,
					resourceId: node.identifier,
					sourcePath: node.resolvedHref,
					reference: filePath,
				});
			}
		}
	}

	for (const node of resources.values()) {
		const resourceReferences: PackageReference[] = [];
		for (const dependency of node.dependencies) {
			if (resources.has(dependency)) {
				resourceReferences.push({
					kind: 'manifest-dependency',
					rawHref: dependency,
					targetResourceId: dependency,
				});
			} else {
				diagnostics.push({
					severity: 'warning',
					code: 'IMS_CP_DANGLING_DEPENDENCY',
					message: `Resource ${node.identifier} depends on missing resource ${dependency}.`,
					resourceId: node.identifier,
					reference: dependency,
				});
			}
		}

		if (fileAccess && node.resolvedHref && isXmlLike(node.resolvedHref)) {
			const xml = await fileAccess.readText(node.resolvedHref);
			if (xml) {
				versionSignals.push(...detectQtiXmlVersionSignals(xml, node));
				const discovered = discoverReferences(xml, node);
				for (const reference of discovered.references) {
					if (reference.kind === 'assessment-item-ref' && reference.resolvedPath) {
						const target = findResourceByResolvedHref(resources, reference.resolvedPath);
						if (target) {
							reference.targetResourceId = target.identifier;
						} else {
							diagnostics.push({
								severity: 'warning',
								code: 'IMS_CP_DANGLING_ITEM_REF',
								message: `Resource ${node.identifier} references missing assessment item ${reference.rawHref}.`,
								resourceId: node.identifier,
								sourcePath: node.resolvedHref,
								reference: reference.rawHref,
							});
						}
					}
					resourceReferences.push(reference);
				}
				for (const asset of discovered.assets) {
					registerAsset(assets, asset);
					if (!(await packagePathExists(asset.resolvedPath, fileAccess, listedFiles))) {
						diagnostics.push({
							severity: 'warning',
							code: 'IMS_CP_MISSING_ASSET',
							message: `Resource ${node.identifier} references missing package asset ${asset.resolvedPath}.`,
							resourceId: node.identifier,
							sourcePath: node.resolvedHref,
							reference: asset.rawHref,
						});
					}
				}
			} else if (!hasMissingFileDiagnostic(diagnostics, node.identifier, node.resolvedHref)) {
				diagnostics.push({
					severity: 'warning',
					code: 'IMS_CP_MISSING_FILE',
					message: `Resource ${node.identifier} could not read package XML file ${node.resolvedHref}.`,
					resourceId: node.identifier,
					sourcePath: node.resolvedHref,
					reference: node.resolvedHref,
				});
			}
		}

		references.set(node.identifier, resourceReferences);
	}

	const closures = new Map<string, PackageResourceClosure>();
	for (const entrypoint of [...manifest.tests, ...manifest.items, ...manifest.passages]) {
		closures.set(entrypoint.identifier, buildClosure(entrypoint.identifier, resources, references, diagnostics));
	}
	const qtiVersion = summarizeQtiVersion(versionSignals);
	const packageDiagnostics = [...diagnostics, ...qtiVersion.diagnostics];

	return {
		packageId: packageId ?? manifest.identifier ?? 'qti-package',
		manifest,
		resources,
		entrypoints: [
			...manifest.tests.map((resource) => toEntrypoint(resource, 'test')),
			...manifest.items.map((resource) => toEntrypoint(resource, 'item')),
			...manifest.passages.map((resource) => toEntrypoint(resource, 'passage')),
		],
		references,
		closures,
		assets,
		qtiVersion,
		diagnostics: packageDiagnostics,
		files,
	};
}

export function serializeContentPackageEvidence(
	packageGraph: AnalyzedContentPackage
): SerializedContentPackageEvidence {
	const resources = [...packageGraph.resources.values()]
		.map((resource) => ({
			...resource,
			files: sortStrings(resource.files),
			resolvedFiles: sortStrings(resource.resolvedFiles),
			dependencies: sortStrings(resource.dependencies),
		}))
		.sort(compareBy((resource) => resource.identifier));
	const references = [...packageGraph.references.entries()]
		.flatMap(([resourceId, resourceReferences]) =>
			resourceReferences.map((reference) => ({ resourceId, ...reference }))
		)
		.sort(compareReferenceEvidence);
	const assets = [...packageGraph.assets.values()]
		.map((asset) => ({
			...asset,
			ownerResourceIds: asset.ownerResourceIds ? sortStrings(asset.ownerResourceIds) : undefined,
			sourcePaths: asset.sourcePaths ? sortStrings(asset.sourcePaths) : undefined,
		}))
		.sort(compareBy((asset) => asset.resolvedPath));
	const closures = [...packageGraph.closures.values()]
		.map((closure) => ({
			...closure,
			resourceIds: sortStrings(closure.resourceIds),
			filePaths: sortStrings(closure.filePaths),
			assetPaths: sortStrings(closure.assetPaths),
			diagnostics: sortDiagnostics(closure.diagnostics),
		}))
		.sort(compareBy((closure) => closure.resourceId));

	return {
		packageId: packageGraph.packageId,
		manifestIdentifier: packageGraph.manifest.identifier,
		entrypoints: [...packageGraph.entrypoints].sort(compareBy((entrypoint) => entrypoint.resourceId)),
		resources,
		references,
		closures,
		assets,
		relationshipHints: buildRelationshipHints(references, assets),
		qtiVersion: {
			...packageGraph.qtiVersion,
			signals: [...packageGraph.qtiVersion.signals].sort(compareVersionSignal),
			diagnostics: sortDiagnostics(packageGraph.qtiVersion.diagnostics),
		},
		diagnostics: sortDiagnostics(packageGraph.diagnostics),
		files: sortStrings(packageGraph.files),
	};
}

function toResourceNode(resource: ManifestResource, manifest: ParsedManifest): PackageResourceNode {
	const base = joinPackagePath(manifest.xmlBase, resource.xmlBase);
	return {
		identifier: resource.identifier,
		type: resource.type,
		kind: classifyResource(resource),
		href: resource.href,
		resolvedHref: resource.href ? resolvePackagePath(base, resource.href) : undefined,
		xmlBase: resource.xmlBase,
		files: resource.files,
		resolvedFiles: resource.files.map((file) => resolvePackagePath(base, file)),
		dependencies: resource.dependencies,
		metadata: resource.metadata,
	};
}

function toEntrypoint(resource: ManifestResource, kind: PackageEntrypoint['kind']): PackageEntrypoint {
	return {
		resourceId: resource.identifier,
		kind,
		href: resource.href,
	};
}

function classifyResource(resource: ManifestResource): PackageResourceKind {
	if (resource.type.includes('imsqti_item') || resource.type.includes('qti_item')) return 'item';
	if (resource.type.includes('test') || resource.type.includes('assessment')) return 'test';
	if (resource.type.includes('passage') || resource.type.includes('stimulus')) return 'passage';
	if (resource.type === 'webcontent') return 'webcontent';
	if (resource.files.some((file) => classifyAssetUsage(file) !== 'other')) return 'asset';
	return 'other';
}

function discoverReferences(xml: string, owner: PackageResourceNode): {
	references: PackageReference[];
	assets: PackageAssetRef[];
} {
	const references: PackageReference[] = [];
	const assets: PackageAssetRef[] = [];
	const basePath = owner.resolvedHref ? dirname(owner.resolvedHref) : '';

	for (const match of findAttributeReferences(xml)) {
		const resolvedPath = resolvePackagePath(basePath, match.rawHref);
		const reference: PackageReference = {
			kind: match.kind,
			rawHref: match.rawHref,
			resolvedPath,
			sourcePath: owner.resolvedHref,
			sourceElement: match.element,
			sourceAttribute: match.attribute,
		};
		references.push(reference);
		if (match.kind !== 'assessment-item-ref') {
			assets.push({
				rawHref: match.rawHref,
				resolvedPath,
				usage: usageFromReference(match.kind, resolvedPath),
				ownerResourceId: owner.identifier,
				sourcePath: owner.resolvedHref,
				sourceElement: match.element,
				sourceAttribute: match.attribute,
			});
		}
	}

	return { references, assets };
}

function findAttributeReferences(xml: string): Array<{
	kind: PackageReference['kind'];
	element: string;
	attribute: string;
	rawHref: string;
}> {
	const refs: Array<{
		kind: PackageReference['kind'];
		element: string;
		attribute: string;
		rawHref: string;
	}> = [];
	const pattern =
		/<(?<element>assessmentItemRef|img|object|audio|video|source|stylesheet|link|file)\b(?<attrs>[^>]*)>/gi;
	for (const match of xml.matchAll(pattern)) {
		const element = match.groups?.element ?? '';
		const attrs = match.groups?.attrs ?? '';
		const attribute = element === 'object' ? 'data' : element === 'img' ? 'src' : 'href';
		const rawHref = readAttribute(attrs, attribute) ?? readAttribute(attrs, 'src') ?? readAttribute(attrs, 'href');
		if (!rawHref || isExternalHref(rawHref)) continue;
		refs.push({
			kind: kindFromElement(element),
			element,
			attribute: rawHref === readAttribute(attrs, 'data') ? 'data' : rawHref === readAttribute(attrs, 'src') ? 'src' : 'href',
			rawHref,
		});
	}
	return refs;
}

function kindFromElement(element: string): PackageReference['kind'] {
	switch (element) {
		case 'assessmentItemRef':
			return 'assessment-item-ref';
		case 'stylesheet':
		case 'link':
			return 'stylesheet';
		case 'object':
			return 'object';
		default:
			return 'asset';
	}
}

function usageFromReference(kind: PackageReference['kind'], path: string): PackageAssetRef['usage'] {
	if (kind === 'stylesheet') return 'stylesheet';
	if (kind === 'catalog') return 'catalog';
	return classifyAssetUsage(path);
}

function buildClosure(
	resourceId: string,
	resources: Map<string, PackageResourceNode>,
	references: Map<string, PackageReference[]>,
	packageDiagnostics: PackageDiagnostic[]
): PackageResourceClosure {
	const visited = new Set<string>();
	const filePaths = new Set<string>();
	const assetPaths = new Set<string>();
	const diagnostics: PackageDiagnostic[] = [];

	function visit(id: string) {
		if (visited.has(id)) return;
		const node = resources.get(id);
		if (!node) {
			diagnostics.push({
				severity: 'warning',
				code: 'IMS_CP_MISSING_CLOSURE_RESOURCE',
				message: `Closure references missing resource ${id}.`,
				resourceId,
				reference: id,
			});
			return;
		}
		visited.add(id);
		if (node.resolvedHref) filePaths.add(node.resolvedHref);
		for (const file of node.resolvedFiles) {
			filePaths.add(file);
			if (classifyAssetUsage(file) !== 'source-qti') assetPaths.add(file);
		}
		for (const reference of references.get(id) ?? []) {
			if (reference.targetResourceId) visit(reference.targetResourceId);
			if (reference.resolvedPath && reference.kind !== 'assessment-item-ref') {
				assetPaths.add(reference.resolvedPath);
				filePaths.add(reference.resolvedPath);
			}
		}
	}

	visit(resourceId);
	return {
		resourceId,
		resourceIds: [...visited],
		filePaths: [...filePaths],
		assetPaths: [...assetPaths],
		diagnostics: [...diagnostics, ...packageDiagnostics.filter((diagnostic) => diagnostic.resourceId === resourceId)],
	};
}

function maybeRegisterAsset(
	assets: Map<string, PackageAssetRef>,
	path: string,
	context: Pick<PackageAssetRef, 'ownerResourceId' | 'sourcePath'>
) {
	const usage = classifyAssetUsage(path);
	if (usage === 'source-qti' || usage === 'other') return;
	registerAsset(assets, {
		rawHref: path,
		resolvedPath: path,
		usage,
		...context,
	});
}

function registerAsset(assets: Map<string, PackageAssetRef>, asset: PackageAssetRef): void {
	const existing = assets.get(asset.resolvedPath);
	if (!existing) {
		assets.set(asset.resolvedPath, {
			...asset,
			ownerResourceIds: asset.ownerResourceId ? [asset.ownerResourceId] : [],
			sourcePaths: asset.sourcePath ? [asset.sourcePath] : [],
		});
		return;
	}

	const ownerResourceIds = new Set([
		...(existing.ownerResourceIds ?? (existing.ownerResourceId ? [existing.ownerResourceId] : [])),
		...(asset.ownerResourceIds ?? (asset.ownerResourceId ? [asset.ownerResourceId] : [])),
	]);
	const sourcePaths = new Set([
		...(existing.sourcePaths ?? (existing.sourcePath ? [existing.sourcePath] : [])),
		...(asset.sourcePaths ?? (asset.sourcePath ? [asset.sourcePath] : [])),
	]);

	assets.set(asset.resolvedPath, {
		...existing,
		rawHref: existing.rawHref || asset.rawHref,
		usage: existing.usage === 'other' ? asset.usage : existing.usage,
		ownerResourceId: existing.ownerResourceId ?? asset.ownerResourceId,
		ownerResourceIds: [...ownerResourceIds],
		sourcePath: existing.sourcePath ?? asset.sourcePath,
		sourcePaths: [...sourcePaths],
		sourceElement: existing.sourceElement ?? asset.sourceElement,
		sourceAttribute: existing.sourceAttribute ?? asset.sourceAttribute,
	});
}

function findResourceByResolvedHref(
	resources: Map<string, PackageResourceNode>,
	resolvedHref: string
): PackageResourceNode | undefined {
	return [...resources.values()].find((resource) => resource.resolvedHref === resolvedHref);
}

function classifyAssetUsage(path: string): PackageAssetRef['usage'] {
	const lower = path.toLowerCase();
	const extension = Object.keys(ASSET_EXTENSIONS).find((candidate) => lower.endsWith(candidate));
	return extension ? ASSET_EXTENSIONS[extension] : 'other';
}

function isXmlLike(path: string): boolean {
	return path.toLowerCase().endsWith('.xml');
}

function readAttribute(attrs: string, name: string): string | undefined {
	const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
	return match?.[1];
}

function isExternalHref(href: string): boolean {
	return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href);
}

function joinPackagePath(...parts: Array<string | undefined>): string {
	return parts.filter(Boolean).join('/');
}

function resolvePackagePath(basePath: string | undefined, href: string): string {
	const raw = href.replaceAll('\\', '/');
	const combined = raw.startsWith('/') ? raw.slice(1) : joinPackagePath(basePath, raw);
	const normalized: string[] = [];
	for (const part of combined.split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') {
			normalized.pop();
			continue;
		}
		normalized.push(part);
	}
	return normalized.join('/');
}

function dirname(path: string): string {
	const normalized = path.replaceAll('\\', '/');
	const index = normalized.lastIndexOf('/');
	return index === -1 ? '' : normalized.slice(0, index);
}

async function packagePathExists(
	path: string,
	fileAccess: PackageFileAccess,
	listedFiles?: Set<string>
): Promise<boolean> {
	if (listedFiles) return listedFiles.has(path);
	if (fileAccess.exists) return Boolean(await fileAccess.exists(path));
	return true;
}

function hasMissingFileDiagnostic(
	diagnostics: PackageDiagnostic[],
	resourceId: string,
	path: string
): boolean {
	return diagnostics.some(
		(diagnostic) =>
			diagnostic.code === 'IMS_CP_MISSING_FILE' &&
			diagnostic.resourceId === resourceId &&
			diagnostic.reference === path
	);
}

function detectManifestVersionSignals(manifestXml: string): QtiVersionSignal[] {
	return [
		...detectVersionPatterns(manifestXml, {
			source: 'schema_location',
			confidence: 'medium',
			includeResourceTypes: false,
		}),
		...detectVersionPatterns(manifestXml, {
			source: 'package_metadata',
			confidence: 'low',
			includeResourceTypes: false,
		}),
	];
}

function detectResourceTypeVersionSignals(resources: Iterable<ManifestResource>): QtiVersionSignal[] {
	const signals: QtiVersionSignal[] = [];
	for (const resource of resources) {
		signals.push(
			...detectVersionPatterns(resource.type, {
				source: 'manifest',
				confidence: 'high',
				resourceId: resource.identifier,
			})
		);
	}
	return dedupeVersionSignals(signals);
}

function detectQtiXmlVersionSignals(xml: string, node: PackageResourceNode): QtiVersionSignal[] {
	return dedupeVersionSignals(
		detectVersionPatterns(xml, {
			source: 'qti_xml',
			confidence: 'high',
			resourceId: node.identifier,
			sourcePath: node.resolvedHref,
		})
	);
}

function detectVersionPatterns(
	value: string,
	context: {
		source: QtiVersionSignal['source'];
		confidence: QtiVersionSignal['confidence'];
		resourceId?: string;
		sourcePath?: string;
		includeResourceTypes?: boolean;
	}
): QtiVersionSignal[] {
	const includeResourceTypes = context.includeResourceTypes ?? true;
	const patterns: Array<{
		version: Exclude<QtiPackageVersion, 'unknown' | 'conflicting'>;
		patterns: RegExp[];
	}> = [
		{
			version: '3.0',
			patterns: [
				/imsqtiasi_v3p0/i,
				/imsqti_v3p0/i,
				/qti[_-]?v?3p0/i,
				/qti[_\s-]?3\.0/i,
			],
		},
		{
			version: '2.2',
			patterns: [
				/imsqti_v2p2/i,
				/qti[_-]?v?2p2/i,
				/qti[_\s-]?2\.2/i,
				...(includeResourceTypes ? [/xmlv2p2/i] : []),
			],
		},
		{
			version: '2.1',
			patterns: [
				/imsqti_v2p1/i,
				/qti[_-]?v?2p1/i,
				/qti[_\s-]?2\.1/i,
				...(includeResourceTypes ? [/xmlv2p1/i] : []),
			],
		},
	];
	const signals: QtiVersionSignal[] = [];
	for (const { version, patterns: versionPatterns } of patterns) {
		for (const pattern of versionPatterns) {
			const match = value.match(pattern);
			if (!match) continue;
			signals.push({
				source: context.source,
				version,
				confidence: context.confidence,
				evidence: match[0],
				resourceId: context.resourceId,
				sourcePath: context.sourcePath,
			});
			break;
		}
	}
	return dedupeVersionSignals(signals);
}

function summarizeQtiVersion(signals: QtiVersionSignal[]): QtiPackageVersionDiagnostic {
	const dedupedSignals = dedupeVersionSignals(signals);
	const versions = [...new Set(dedupedSignals.map((signal) => signal.version))].sort();
	if (versions.length === 0) {
		return {
			version: 'unknown',
			confidence: 'none',
			signals: [],
			diagnostics: [
				{
					severity: 'warning',
					code: 'QTI_VERSION_UNKNOWN',
					message: 'Could not determine the QTI package version from manifest, schema, metadata, or readable QTI XML.',
				},
			],
		};
	}
	if (versions.length > 1) {
		return {
			version: 'conflicting',
			confidence: 'conflicting',
			signals: dedupedSignals,
			diagnostics: [
				{
					severity: 'warning',
					code: 'QTI_VERSION_CONFLICT',
					message: `Conflicting QTI package version signals were found: ${versions.join(', ')}.`,
					reference: versions.join(','),
				},
			],
		};
	}
	return {
		version: versions[0],
		confidence: strongestConfidence(dedupedSignals),
		signals: dedupedSignals,
		diagnostics: [],
	};
}

function strongestConfidence(signals: QtiVersionSignal[]): QtiVersionConfidence {
	if (signals.some((signal) => signal.confidence === 'high')) return 'high';
	if (signals.some((signal) => signal.confidence === 'medium')) return 'medium';
	if (signals.some((signal) => signal.confidence === 'low')) return 'low';
	return 'none';
}

function dedupeVersionSignals(signals: QtiVersionSignal[]): QtiVersionSignal[] {
	const byKey = new Map<string, QtiVersionSignal>();
	for (const signal of signals) {
		const key = [
			signal.source,
			signal.version,
			signal.confidence,
			signal.resourceId ?? '',
			signal.sourcePath ?? '',
			signal.evidence,
		].join('|');
		byKey.set(key, signal);
	}
	return [...byKey.values()];
}

function buildRelationshipHints(
	references: Array<PackageReference & { resourceId: string }>,
	assets: PackageAssetRef[]
): PackageRelationshipHint[] {
	const hints: PackageRelationshipHint[] = [];
	for (const reference of references) {
		if (reference.kind !== 'manifest-dependency' && reference.kind !== 'assessment-item-ref') continue;
		hints.push({
			kind: reference.kind,
			sourceResourceId: reference.resourceId,
			targetResourceId: reference.targetResourceId,
			targetPath: reference.resolvedPath,
			rawHref: reference.rawHref,
			sourcePath: reference.sourcePath,
			sourceElement: reference.sourceElement,
			sourceAttribute: reference.sourceAttribute,
		});
	}
	for (const asset of assets) {
		const ownerResourceIds = asset.ownerResourceIds ?? (asset.ownerResourceId ? [asset.ownerResourceId] : []);
		if (ownerResourceIds.length < 2) continue;
		hints.push({
			kind: 'shared-asset',
			sourceResourceIds: sortStrings(ownerResourceIds),
			targetPath: asset.resolvedPath,
			rawHref: asset.rawHref,
			sourcePath: asset.sourcePath,
			sourceElement: asset.sourceElement,
			sourceAttribute: asset.sourceAttribute,
		});
	}
	return hints.sort(compareRelationshipHint);
}

function sortStrings(values: string[]): string[] {
	return [...values].sort((left, right) => left.localeCompare(right));
}

function sortDiagnostics(diagnostics: PackageDiagnostic[]): PackageDiagnostic[] {
	return [...diagnostics].sort(
		(left, right) =>
			left.severity.localeCompare(right.severity) ||
			left.code.localeCompare(right.code) ||
			(left.resourceId ?? '').localeCompare(right.resourceId ?? '') ||
			(left.sourcePath ?? '').localeCompare(right.sourcePath ?? '') ||
			(left.reference ?? '').localeCompare(right.reference ?? '') ||
			left.message.localeCompare(right.message)
	);
}

function compareBy<T>(select: (value: T) => string | undefined): (left: T, right: T) => number {
	return (left, right) => (select(left) ?? '').localeCompare(select(right) ?? '');
}

function compareReferenceEvidence(
	left: PackageReference & { resourceId: string },
	right: PackageReference & { resourceId: string }
): number {
	return (
		left.resourceId.localeCompare(right.resourceId) ||
		left.kind.localeCompare(right.kind) ||
		(left.targetResourceId ?? '').localeCompare(right.targetResourceId ?? '') ||
		(left.resolvedPath ?? '').localeCompare(right.resolvedPath ?? '') ||
		left.rawHref.localeCompare(right.rawHref)
	);
}

function compareVersionSignal(left: QtiVersionSignal, right: QtiVersionSignal): number {
	return (
		left.version.localeCompare(right.version) ||
		left.source.localeCompare(right.source) ||
		(left.resourceId ?? '').localeCompare(right.resourceId ?? '') ||
		(left.sourcePath ?? '').localeCompare(right.sourcePath ?? '') ||
		left.evidence.localeCompare(right.evidence)
	);
}

function compareRelationshipHint(left: PackageRelationshipHint, right: PackageRelationshipHint): number {
	return (
		left.kind.localeCompare(right.kind) ||
		(left.sourceResourceId ?? '').localeCompare(right.sourceResourceId ?? '') ||
		(left.sourceResourceIds?.join(',') ?? '').localeCompare(right.sourceResourceIds?.join(',') ?? '') ||
		(left.targetResourceId ?? '').localeCompare(right.targetResourceId ?? '') ||
		(left.targetPath ?? '').localeCompare(right.targetPath ?? '') ||
		(left.rawHref ?? '').localeCompare(right.rawHref ?? '')
	);
}
