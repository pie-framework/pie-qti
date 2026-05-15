import type {
	ConversionTrace,
	QtiSourceProfile,
	SidecarArtifact,
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
import { QtiToPiePlugin, type QtiToPiePluginOptions } from './plugin.js';
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
	}

	const sidecars = [
		...assetSidecars(packageGraph),
		...(packageRuntime.extraction.sidecars ?? []),
	];
	const warnings = [
		...packageGraph.diagnostics.map((diagnostic): TransformWarning => ({
			code: diagnostic.code,
			message: diagnostic.message,
			itemId: diagnostic.resourceId,
		})),
		...(packageRuntime.extraction.warnings ?? []),
		...itemOutputs.flatMap((output) => output.warnings ?? []),
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
		standardCandidates,
		warnings,
		conversionTrace: {
			...trace,
			profiles: packageRuntime.matches,
			standardCandidates,
			sidecars,
		},
	};
}

function assetSidecars(packageGraph: AnalyzedContentPackage): SidecarArtifact[] {
	return [...packageGraph.assets.values()].map((asset) => ({
		id: `asset:${asset.resolvedPath}`,
		kind: 'asset',
		sourcePath: asset.resolvedPath,
		sourceResourceId: asset.ownerResourceId,
		mimeType: asset.usage,
		referencedBy: asset.ownerResourceId ? [asset.ownerResourceId] : [],
		metadata: {
			rawHref: asset.rawHref,
			sourceElement: asset.sourceElement,
			sourceAttribute: asset.sourceAttribute,
		},
	}));
}
