import type {
	ConversionTrace,
	QtiSourceProfile,
	RubricCandidate,
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
	type PackageResourceNode,
	type PackageFileAccess,
	type QtiPackageVersionDiagnostic,
	type SerializedContentPackageEvidence,
	analyzeContentPackage,
	serializeContentPackageEvidence,
} from '@pie-qti/ims-cp-core';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
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

export type QtiPackageItemTransformStatus = 'transformed' | 'skipped' | 'failed';

export interface QtiPackageItemTransformResult {
	resourceId: string;
	sourcePath?: string;
	status: QtiPackageItemTransformStatus;
	itemCount: number;
	warnings: TransformWarning[];
	diagnostics: SourceProfileDiagnostic[];
	profiles: SourceProfileMatch[];
	traceId?: string;
	message?: string;
}

export interface QtiPackageTransformResult {
	packageId: string;
	packageGraph: AnalyzedContentPackage;
	packageEvidence: SerializedContentPackageEvidence;
	qtiVersion: QtiPackageVersionDiagnostic;
	items: TransformOutputItem[];
	itemOutputs: TransformOutput[];
	itemResults: QtiPackageItemTransformResult[];
	sidecars: SidecarArtifact[];
	sourceProfiles: SourceProfileMatch[];
	sourceDiagnostics: SourceProfileDiagnostic[];
	standardCandidates: StandardCandidate[];
	rubricCandidates: RubricCandidate[];
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
	const packageGraph = await analyzeContentPackage({
		packageId,
		manifestXml,
		fileAccess,
	});
	const packageEvidence = serializeContentPackageEvidence(packageGraph);
	const trace = createConversionTrace(`qti-package-${packageGraph.packageId}`);
	addTraceEvent(trace, {
		kind: 'package-analyzed',
		scope: 'package',
		message: `Analyzed QTI package ${packageGraph.packageId}.`,
		data: {
			resources: packageGraph.resources.size,
			entrypoints: packageGraph.entrypoints.length,
			assets: packageGraph.assets.size,
			qtiVersion: packageGraph.qtiVersion.version,
			qtiVersionConfidence: packageGraph.qtiVersion.confidence,
			relationshipHints: packageEvidence.relationshipHints.length,
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
			metadata: {
				qtiVersion: packageGraph.qtiVersion.version,
				qtiVersionDiagnostic: packageGraph.qtiVersion,
			},
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
	const itemResults: QtiPackageItemTransformResult[] = [];
	const failedItemDiagnostics: SourceProfileDiagnostic[] = [];
	const genericRubricCandidates: RubricCandidate[] = [];
	for (const item of packageGraph.manifest.items) {
		const node = packageGraph.resources.get(item.identifier);
		if (!node?.resolvedHref) {
			itemResults.push({
				resourceId: item.identifier,
				status: 'skipped',
				itemCount: 0,
				warnings: [],
				diagnostics: [],
				profiles: [],
				message: `Package item resource ${item.identifier} has no resolved source path.`,
			});
			continue;
		}
		const itemXml = await fileAccess.readText(node.resolvedHref);
		if (!itemXml) {
			itemResults.push({
				resourceId: node.identifier,
				sourcePath: node.resolvedHref,
				status: 'skipped',
				itemCount: 0,
				warnings: [],
				diagnostics: [],
				profiles: [],
				message: `Package item resource ${node.identifier} could not be read.`,
			});
			continue;
		}
		addTraceEvent(trace, {
			kind: 'resource-analyzed',
			scope: 'resource',
			resourceId: node.identifier,
			sourcePath: node.resolvedHref,
			message: `Transforming package item resource ${node.identifier}.`,
		});
		const itemRubricCandidates = extractGenericRubricCandidates(itemXml, node);
		genericRubricCandidates.push(...itemRubricCandidates);
		for (const rubricCandidate of itemRubricCandidates) {
			addRubricTraceEvent(trace, rubricCandidate, node);
		}
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
							metadata: {
								qtiVersion: packageGraph.qtiVersion.version,
								qtiVersionDiagnostic: packageGraph.qtiVersion,
							},
						},
					},
				},
				context ?? {}
			);
			itemOutputs.push(output);
			itemResults.push(createItemTransformResult(node, output));
		} catch (error) {
			if (!(error instanceof QtiSourceProfileTransformError)) {
				throw error;
			}
			failedItemDiagnostics.push(...(error.sourceDiagnostics ?? []));
			itemResults.push({
				resourceId: node.identifier,
				sourcePath: node.resolvedHref,
				status: 'failed',
				itemCount: 0,
				warnings: error.sourceDiagnostics?.filter((diagnostic) => diagnostic.severity !== 'info').map(sourceDiagnosticToWarning) ?? [],
				diagnostics: error.sourceDiagnostics ?? [],
				profiles: error.conversionTrace.profiles ?? [],
				traceId: error.conversionTrace.traceId,
				message: error.message,
			});
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

	for (const node of packageGraph.resources.values()) {
		if (node.kind === 'item' || !node.resolvedHref || !isXmlLike(node.resolvedHref)) continue;
		const resourceXml = await fileAccess.readText(node.resolvedHref);
		if (!resourceXml) continue;
		const resourceRubricCandidates = extractGenericRubricCandidates(resourceXml, node);
		genericRubricCandidates.push(...resourceRubricCandidates);
		for (const rubricCandidate of resourceRubricCandidates) {
			addRubricTraceEvent(trace, rubricCandidate, node);
		}
	}

	const sidecars = dedupeSidecars([
		packageManifestSidecar(packageGraph, manifestXml),
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
	const rubricCandidates = [
		...genericRubricCandidates,
		...(packageRuntime.extraction.rubricCandidates ?? []),
		...itemOutputs.flatMap(
			(output) => ((output.metadata as any).rubricCandidates ?? []) as RubricCandidate[]
		),
	];
	const detectedSourceProfiles = dedupeSourceProfileMatches([
		...packageRuntime.matches,
		...itemOutputs.flatMap(
			(output) => (((output.metadata as any).sourceProfiles ?? []) as SourceProfileMatch[])
		),
	]);

	return {
		packageId: packageGraph.packageId,
		packageGraph,
		packageEvidence,
		qtiVersion: packageGraph.qtiVersion,
		items: itemOutputs.flatMap((output) => output.items),
		itemOutputs,
		itemResults,
		sidecars,
		sourceProfiles: detectedSourceProfiles,
		sourceDiagnostics,
		standardCandidates,
		rubricCandidates,
		warnings,
		conversionTrace: {
			...trace,
			profiles: detectedSourceProfiles,
			diagnostics: [
				...(trace.diagnostics ?? []),
				...sourceDiagnostics,
			],
			standardCandidates,
			rubricCandidates,
			sidecars,
		},
	};
}

function createItemTransformResult(
	node: PackageResourceNode,
	output: TransformOutput
): QtiPackageItemTransformResult {
	const metadata = output.metadata as any;
	return {
		resourceId: node.identifier,
		sourcePath: node.resolvedHref,
		status: 'transformed',
		itemCount: output.items.length,
		warnings: output.warnings ?? [],
		diagnostics: (metadata.sourceDiagnostics ?? []) as SourceProfileDiagnostic[],
		profiles: (metadata.sourceProfiles ?? []) as SourceProfileMatch[],
		traceId: (metadata.conversionTrace as ConversionTrace | undefined)?.traceId,
	};
}

function packageManifestSidecar(
	packageGraph: AnalyzedContentPackage,
	manifestXml: string
): SidecarArtifact {
	return {
		id: stableSidecarId('manifest', `${packageGraph.packageId}/imsmanifest.xml`),
		kind: 'manifest',
		sourcePath: 'imsmanifest.xml',
		mimeType: 'application/xml',
		content: manifestXml,
		referencedBy: [packageGraph.packageId],
		metadata: {
			packageId: packageGraph.packageId,
			manifestIdentifier: packageGraph.manifest.identifier,
			resourceCount: packageGraph.resources.size,
		},
	};
}

function addRubricTraceEvent(
	trace: ConversionTrace,
	rubricCandidate: RubricCandidate,
	node: PackageResourceNode
): void {
	addTraceEvent(trace, {
		kind: 'rubric-extracted',
		scope: rubricCandidate.itemId ? 'item' : 'resource',
		resourceId: node.identifier,
		itemId: rubricCandidate.itemId,
		sourcePath: node.resolvedHref,
		message: `Preserved QTI rubric evidence ${rubricCandidate.id}.`,
		data: {
			rubricCandidateId: rubricCandidate.id,
			kind: rubricCandidate.kind,
			view: rubricCandidate.metadata?.view,
		},
	});
}

function extractGenericRubricCandidates(xml: string, node: PackageResourceNode): RubricCandidate[] {
	try {
		const document = parse(xml, {
			lowerCaseTagName: false,
			comment: false,
		});
		const itemElement =
			document.getElementsByTagName('assessmentItem')[0] ??
			document.getElementsByTagName('qti-assessment-item')[0];
		const itemId = itemElement?.getAttribute('identifier');
		const rubricBlocks = [
			...Array.from(document.getElementsByTagName('rubricBlock')),
			...Array.from(document.getElementsByTagName('qti-rubric-block')),
		];
		return rubricBlocks.map((rubricBlock, index) =>
			toRubricCandidate(rubricBlock, {
				index,
				itemId,
				resourceId: node.identifier,
				sourcePath: node.resolvedHref,
			})
		);
	} catch {
		return [];
	}
}

function toRubricCandidate(
	rubricBlock: HTMLElement,
	context: {
		index: number;
		itemId?: string;
		resourceId: string;
		sourcePath?: string;
	}
): RubricCandidate {
	const content = rubricBlock.toString();
	const view = rubricBlock.getAttribute('view');
	const identifier = rubricBlock.getAttribute('identifier');
	const sourceElement = rubricBlock.tagName;
	return {
		id: `qti-rubric:${context.resourceId}:${context.index + 1}:${shortHash(content)}`,
		kind: 'unknown',
		content,
		itemId: context.itemId,
		resourceId: context.resourceId,
		sourcePath: context.sourcePath,
		evidence: [
			{
				type: 'qti-rubric-block',
				message: 'Preserved QTI rubric block for host interpretation.',
				scope: context.itemId ? 'item' : 'resource',
				sourcePath: context.sourcePath,
				resourceId: context.resourceId,
				itemId: context.itemId,
				value: identifier ?? view ?? sourceElement,
			},
		],
		metadata: {
			source: 'qti-rubric-block',
			sourceElement,
			index: context.index,
			identifier,
			view,
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

function dedupeSourceProfileMatches(matches: SourceProfileMatch[]): SourceProfileMatch[] {
	const byKey = new Map<string, SourceProfileMatch>();
	for (const match of matches) {
		const key = [
			match.profileId,
			match.profileVersion ?? '',
			match.scope,
			match.resourceId ?? '',
			match.itemId ?? '',
		].join('|');
		const existing = byKey.get(key);
		if (!existing || match.confidence > existing.confidence) {
			byKey.set(key, match);
		}
	}
	return [...byKey.values()].sort(
		(left, right) =>
			left.scope.localeCompare(right.scope) ||
			left.profileId.localeCompare(right.profileId) ||
			(left.profileVersion ?? '').localeCompare(right.profileVersion ?? '') ||
			(left.resourceId ?? '').localeCompare(right.resourceId ?? '') ||
			(left.itemId ?? '').localeCompare(right.itemId ?? '')
	);
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

function isXmlLike(path: string): boolean {
	return path.toLowerCase().endsWith('.xml');
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
