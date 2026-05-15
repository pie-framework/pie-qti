import type {
	ConversionTrace,
	QtiSourceProfile,
	SidecarArtifact,
	SourceProfileDiagnostic,
	SourceProfileMatch,
	StandardCandidate,
	TransformContext,
	TransformOutput,
	TransformOutputItem,
	TransformWarning,
} from '@pie-qti/transform-types';
import {
	type AnalyzedContentPackage,
	type PackageFileAccess,
	analyzeContentPackage,
} from '@pie-qti/ims-cp-core';
import {
	QtiSourceProfileTransformError,
	QtiToPiePlugin,
	type QtiToPiePluginOptions,
} from './plugin.js';
import {
	addTraceEvent,
	createConversionTrace,
	detectPackageProfiles,
} from './source-profile-runtime.js';

export interface QtiPackageTransformInput {
	packageId?: string;
	manifestXml: string;
	fileAccess: PackageFileAccess;
	sourceProfiles?: QtiSourceProfile[];
	plugin?: QtiToPiePlugin;
	pluginOptions?: QtiToPiePluginOptions;
	context?: TransformContext;
}

export interface QtiPackageTransformResult {
	packageId: string;
	packageGraph: AnalyzedContentPackage;
	items: TransformOutputItem[];
	itemOutputs: TransformOutput[];
	sidecars: SidecarArtifact[];
	sourceProfiles: SourceProfileMatch[];
	sourceDiagnostics: SourceProfileDiagnostic[];
	standardCandidates: StandardCandidate[];
	warnings: TransformWarning[];
	conversionTrace: ConversionTrace;
}

export async function transformQtiPackageToPie({
	packageId,
	manifestXml,
	fileAccess,
	sourceProfiles,
	plugin,
	pluginOptions,
	context,
}: QtiPackageTransformInput): Promise<QtiPackageTransformResult> {
	const trace = createConversionTrace(`qti-package-${packageId ?? Date.now()}`);
	const packageGraph = await analyzeContentPackage({
		packageId,
		manifestXml,
		fileAccess,
	});
	addTraceEvent(trace, {
		kind: 'package-analyzed',
		scope: 'package',
		message: `Analyzed QTI package ${packageGraph.packageId}.`,
		data: {
			resources: packageGraph.resources.size,
			entrypoints: packageGraph.entrypoints.length,
			assets: packageGraph.assets.size,
			diagnostics: packageGraph.diagnostics.length,
		},
	});

	const profiles = sourceProfiles ?? pluginOptions?.sourceProfiles ?? [];
	if (plugin && profiles.length > 0) {
		throw new Error(
			'transformQtiPackageToPie cannot combine a preconfigured plugin instance with sourceProfiles/pluginOptions.sourceProfiles. Construct the plugin with profiles and omit sourceProfiles, or let the package transformer create the plugin.'
		);
	}
	const packageRuntime = detectPackageProfiles(
		profiles,
		{
			packageId: packageGraph.packageId,
			manifestXml,
			manifest: packageGraph.manifest,
			packageGraph,
			files: packageGraph.files,
		},
		trace
	);
	const transformer =
		plugin ??
		new QtiToPiePlugin({
			...(pluginOptions ?? {}),
			sourceProfiles: profiles,
		});

	const itemOutputs: TransformOutput[] = [];
	const failedItemDiagnostics: SourceProfileDiagnostic[] = [];
	for (const item of packageGraph.manifest.items) {
		const node = packageGraph.resources.get(item.identifier);
		if (!node?.resolvedHref) {
			continue;
		}
		const itemXml = await fileAccess.readText(node.resolvedHref);
		if (!itemXml) {
			continue;
		}
		addTraceEvent(trace, {
			kind: 'resource-analyzed',
			scope: 'resource',
			resourceId: node.identifier,
			sourcePath: node.resolvedHref,
			message: `Transforming package item resource ${node.identifier}.`,
		});
		try {
			const output = await transformer.transform(
				{
					content: itemXml,
					format: 'qti',
					metadata: {
						resourceId: node.identifier,
						sourcePath: node.resolvedHref,
						packageContext: {
							packageId: packageGraph.packageId,
							manifest: packageGraph.manifest,
							packageGraph,
							files: packageGraph.files,
						},
					},
				},
				context ?? {}
			);
			itemOutputs.push(output);
		} catch (error) {
			if (!(error instanceof QtiSourceProfileTransformError)) {
				throw error;
			}
			failedItemDiagnostics.push(...(error.sourceDiagnostics ?? []));
			addTraceEvent(trace, {
				kind: 'error',
				scope: 'item',
				resourceId: node.identifier,
				sourcePath: node.resolvedHref,
				message: error.message,
				data: {
					diagnostics: error.sourceDiagnostics,
					itemTraceId: error.conversionTrace.traceId,
				},
			});
		}
	}

	const sidecars = dedupeSidecars([
		...sourceQtiSidecars(packageGraph),
		...assetSidecars(packageGraph),
		...(packageRuntime.extraction.sidecars ?? []),
		...itemOutputs.flatMap(
			(output) => (((output.metadata as any).sidecars ?? []) as SidecarArtifact[])
		),
	]);
	for (const sidecar of sidecars) {
		addTraceEvent(trace, {
			kind: 'sidecar-emitted',
			scope: sidecar.kind === 'asset' || sidecar.kind === 'stylesheet' || sidecar.kind === 'catalog'
				? 'asset'
				: 'resource',
			resourceId: sidecar.sourceResourceId,
			sourcePath: sidecar.sourcePath,
			message: `Emitted ${sidecar.kind} sidecar ${sidecar.id}.`,
			data: {
				sidecarId: sidecar.id,
				kind: sidecar.kind,
				referencedBy: sidecar.referencedBy,
			},
		});
	}
	const warnings = [
		...packageGraph.diagnostics.map((diagnostic): TransformWarning => ({
			code: diagnostic.code,
			message: diagnostic.message,
			itemId: diagnostic.resourceId,
		})),
		...(packageRuntime.extraction.diagnostics ?? [])
			.filter((diagnostic) => diagnostic.severity !== 'info')
			.map(sourceDiagnosticToWarning),
		...(packageRuntime.extraction.warnings ?? []),
		...itemOutputs.flatMap((output) => output.warnings ?? []),
		...failedItemDiagnostics
			.filter((diagnostic) => diagnostic.severity !== 'info')
			.map(sourceDiagnosticToWarning),
	];
	const sourceDiagnostics = [
		...(packageRuntime.extraction.diagnostics ?? []),
		...itemOutputs.flatMap(
			(output) => (((output.metadata as any).sourceDiagnostics ?? []) as SourceProfileDiagnostic[])
		),
		...failedItemDiagnostics,
	];
	const standardCandidates = [
		...(packageRuntime.extraction.standardCandidates ?? []),
		...itemOutputs.flatMap(
			(output) => ((output.metadata as any).standardCandidates ?? []) as StandardCandidate[]
		),
	];

	return {
		packageId: packageGraph.packageId,
		packageGraph,
		items: itemOutputs.flatMap((output) => output.items),
		itemOutputs,
		sidecars,
		sourceProfiles: packageRuntime.matches,
		sourceDiagnostics,
		standardCandidates,
		warnings,
		conversionTrace: {
			...trace,
			profiles: packageRuntime.matches,
			diagnostics: [
				...(trace.diagnostics ?? []),
				...sourceDiagnostics,
			],
			standardCandidates,
			sidecars,
		},
	};
}

function assetSidecars(packageGraph: AnalyzedContentPackage): SidecarArtifact[] {
	return [...packageGraph.assets.values()].map((asset) => ({
		id: stableSidecarId(asset.usage, asset.resolvedPath),
		kind: sidecarKindForUsage(asset.usage),
		sourcePath: asset.resolvedPath,
		sourceResourceId: asset.ownerResourceId,
		mimeType: mimeTypeForPath(asset.resolvedPath),
		referencedBy: asset.ownerResourceIds?.length
			? asset.ownerResourceIds
			: asset.ownerResourceId
				? [asset.ownerResourceId]
				: [],
		metadata: {
			rawHref: asset.rawHref,
			usage: asset.usage,
			assetPath: asset.resolvedPath,
			sourcePaths: asset.sourcePaths,
			sourceElement: asset.sourceElement,
			sourceAttribute: asset.sourceAttribute,
		},
	}));
}

function sourceQtiSidecars(packageGraph: AnalyzedContentPackage): SidecarArtifact[] {
	const missingResourcePaths = new Set(
		packageGraph.diagnostics
			.filter((diagnostic) => diagnostic.code === 'IMS_CP_MISSING_FILE' && diagnostic.reference)
			.map((diagnostic) => diagnostic.reference)
	);
	return [...packageGraph.resources.values()]
		.filter(
			(resource) =>
				resource.resolvedHref &&
				!missingResourcePaths.has(resource.resolvedHref) &&
				['item', 'test', 'passage'].includes(resource.kind)
		)
		.map((resource) => ({
			id: stableSidecarId('source-qti', resource.resolvedHref!),
			kind: 'source-qti',
			sourcePath: resource.resolvedHref,
			sourceResourceId: resource.identifier,
			mimeType: 'application/qti+xml',
			referencedBy: [resource.identifier],
			metadata: {
				resourceId: resource.identifier,
				resourceType: resource.type,
				resourceKind: resource.kind,
				href: resource.href,
			},
		}));
}

function sourceDiagnosticToWarning(diagnostic: SourceProfileDiagnostic): TransformWarning {
	return {
		itemId: diagnostic.itemId ?? diagnostic.resourceId,
		code: diagnostic.code,
		message: diagnostic.message,
	};
}

function dedupeSidecars(sidecars: SidecarArtifact[]): SidecarArtifact[] {
	const byId = new Map<string, SidecarArtifact>();
	for (const sidecar of sidecars) {
		const existing = byId.get(sidecar.id);
		if (!existing) {
			byId.set(sidecar.id, sidecar);
			continue;
		}
		byId.set(sidecar.id, {
			...existing,
			referencedBy: [...new Set([...existing.referencedBy, ...sidecar.referencedBy])],
			metadata: {
				...(existing.metadata ?? {}),
				...(sidecar.metadata ?? {}),
			},
		});
	}
	return [...byId.values()];
}

function sidecarKindForUsage(usage: string): SidecarArtifact['kind'] {
	switch (usage) {
		case 'stylesheet':
			return 'stylesheet';
		case 'catalog':
			return 'catalog';
		default:
			return 'asset';
	}
}

function mimeTypeForPath(path: string): string | undefined {
	const lower = path.toLowerCase();
	if (lower.endsWith('.css')) return 'text/css';
	if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
	if (lower.endsWith('.svg')) return 'image/svg+xml';
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	if (lower.endsWith('.gif')) return 'image/gif';
	if (lower.endsWith('.webp')) return 'image/webp';
	if (lower.endsWith('.avif')) return 'image/avif';
	if (lower.endsWith('.mp3')) return 'audio/mpeg';
	if (lower.endsWith('.m4a')) return 'audio/mp4';
	if (lower.endsWith('.ogg')) return 'audio/ogg';
	if (lower.endsWith('.wav')) return 'audio/wav';
	if (lower.endsWith('.mp4')) return 'video/mp4';
	if (lower.endsWith('.mov')) return 'video/quicktime';
	if (lower.endsWith('.webm')) return 'video/webm';
	return undefined;
}

function stableSidecarId(kind: string, path: string): string {
	return `${kind}:${slugPath(path)}:${shortHash(path)}`;
}

function slugPath(path: string): string {
	return path
		.replaceAll('\\', '/')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80) || 'artifact';
}

function shortHash(value: string): string {
	let hash = 5381;
	for (let index = 0; index < value.length; index += 1) {
		hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
	}
	return (hash >>> 0).toString(36);
}
