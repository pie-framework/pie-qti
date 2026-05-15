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
	sourcePath?: string;
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

export interface AnalyzedContentPackage {
	packageId: string;
	manifest: ParsedManifest;
	resources: Map<string, PackageResourceNode>;
	entrypoints: PackageEntrypoint[];
	references: Map<string, PackageReference[]>;
	closures: Map<string, PackageResourceClosure>;
	assets: Map<string, PackageAssetRef>;
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

	for (const resource of manifest.resources.values()) {
		const node = toResourceNode(resource, manifest);
		resources.set(node.identifier, node);
		for (const filePath of node.resolvedFiles) {
			maybeRegisterAsset(assets, filePath, {
				ownerResourceId: node.identifier,
				sourcePath: node.resolvedHref,
			});
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
				const discovered = discoverReferences(xml, node);
				resourceReferences.push(...discovered.references);
				for (const asset of discovered.assets) {
					assets.set(asset.resolvedPath, asset);
				}
			}
		}

		references.set(node.identifier, resourceReferences);
	}

	const closures = new Map<string, PackageResourceClosure>();
	for (const entrypoint of [...manifest.tests, ...manifest.items, ...manifest.passages]) {
		closures.set(entrypoint.identifier, buildClosure(entrypoint.identifier, resources, references, diagnostics));
	}

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
		diagnostics,
		files,
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
	assets.set(path, {
		rawHref: path,
		resolvedPath: path,
		usage,
		...context,
	});
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
