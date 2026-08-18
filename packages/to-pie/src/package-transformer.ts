import {
  type AnalyzedContentPackage,
  analyzeContentPackage,
  type PackageFileAccess,
  type PackageResourceNode,
  type QtiPackageVersionDiagnostic,
  type SerializedContentPackageEvidence,
  serializeContentPackageEvidence,
} from '@pie-qti/ims-cp-core';
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
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import {
  QtiItemTransformError,
  QtiToPiePlugin,
  type QtiToPiePluginOptions,
} from './plugin.js';
import {
  addTraceEvent,
  createConversionTrace,
  detectPackageProfiles,
} from './source-profile-runtime.js';
import { isAssessmentTestDocument } from './utils/qti-validator.js';

export interface QtiPackageTransformInput {
  packageId?: string;
  manifestXml: string;
  fileAccess: PackageFileAccess;
  sourceProfiles?: QtiSourceProfile[];
  plugin?: QtiToPiePlugin;
  pluginOptions?: QtiToPiePluginOptions;
  itemConcurrency?: number;
  context?: TransformContext;
}

export interface QtiAnalyzedPackageTransformInput {
  packageGraph: AnalyzedContentPackage;
  manifestXml: string;
  fileAccess: PackageFileAccess;
  sourceProfiles?: QtiSourceProfile[];
  plugin?: QtiToPiePlugin;
  pluginOptions?: QtiToPiePluginOptions;
  itemConcurrency?: number;
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

/**
 * Analyze `manifestXml` and transform it. Callers that need to run their own stage over each
 * item's raw XML before conversion (see `explodeAnalyzedQtiPackageItems`) should analyze the
 * package themselves and call `transformAnalyzedQtiPackageToPie` directly instead, so the
 * package is analyzed exactly once.
 */
export async function transformQtiPackageToPie({
  packageId,
  manifestXml,
  fileAccess,
  sourceProfiles,
  plugin,
  pluginOptions,
  itemConcurrency,
  context,
}: QtiPackageTransformInput): Promise<QtiPackageTransformResult> {
  const packageGraph = await analyzeContentPackage({
    packageId,
    manifestXml,
    fileAccess,
  });
  return transformAnalyzedQtiPackageToPie({
    packageGraph,
    manifestXml,
    fileAccess,
    sourceProfiles,
    plugin,
    pluginOptions,
    itemConcurrency,
    context,
  });
}

export async function transformAnalyzedQtiPackageToPie({
  packageGraph,
  manifestXml,
  fileAccess,
  sourceProfiles,
  plugin,
  pluginOptions,
  itemConcurrency,
  context,
}: QtiAnalyzedPackageTransformInput): Promise<QtiPackageTransformResult> {
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
  const itemRuns = await mapWithConcurrency(
    packageGraph.manifest.items,
    Math.max(1, Math.floor(itemConcurrency ?? 1)),
    async (item) => {
      const node = packageGraph.resources.get(item.identifier);
      if (!node?.resolvedHref) {
        return {
          genericRubricCandidates: [],
          itemOutputs: [],
          itemResults: [
            {
              resourceId: item.identifier,
              status: 'skipped' as const,
              itemCount: 0,
              warnings: [],
              diagnostics: [],
              profiles: [],
              message: `Package item resource ${item.identifier} has no resolved source path.`,
            },
          ],
          traceEvents: [],
        };
      }
      const itemXml = await fileAccess.readText(node.resolvedHref);
      if (!itemXml) {
        return {
          genericRubricCandidates: [],
          itemOutputs: [],
          itemResults: [
            {
              resourceId: node.identifier,
              sourcePath: node.resolvedHref,
              status: 'skipped' as const,
              itemCount: 0,
              warnings: [],
              diagnostics: [],
              profiles: [],
              message: `Package item resource ${node.identifier} could not be read.`,
            },
          ],
          traceEvents: [],
        };
      }
      if (isAssessmentTestDocument(itemXml)) {
        // The manifest declared this resource as an item, but the document is a test.
        // Converting it yields a `PieAssessment` reported as a transformed item with no
        // warning, so test structure would be stored as an item. Refuse it here instead;
        // a resource declared as a test still converts through the test lane below.
        // `failed` rather than `skipped` because the resource read fine — it was rejected,
        // and the two statuses carry different meanings for stage coverage.
        const diagnostic: SourceProfileDiagnostic = {
          code: 'QTI_ASSESSMENT_TEST_DECLARED_AS_ITEM',
          severity: 'error',
          scope: 'item',
          message:
            `Resource ${node.identifier} is declared as an item resource but the document is a ` +
            'QTI test definition. Test structure is not imported as an item.',
          resourceId: node.identifier,
          sourcePath: node.resolvedHref,
        };
        return {
          // No rubric harvest from a rejected resource, matching the other early returns.
          genericRubricCandidates: [],
          itemOutputs: [],
          itemResults: [
            {
              resourceId: node.identifier,
              sourcePath: node.resolvedHref,
              status: 'failed' as const,
              itemCount: 0,
              warnings: [sourceDiagnosticToWarning(diagnostic)],
              diagnostics: [diagnostic],
              profiles: [],
              message: diagnostic.message,
            },
          ],
          failedItemDiagnostics: [diagnostic],
          traceEvents: [
            {
              kind: 'error',
              scope: 'item',
              resourceId: node.identifier,
              sourcePath: node.resolvedHref,
              message: diagnostic.message,
              data: { diagnostics: [diagnostic] },
            },
          ] satisfies Parameters<typeof addTraceEvent>[1][],
        };
      }
      const traceEvents: Parameters<typeof addTraceEvent>[1][] = [
        {
          kind: 'resource-analyzed',
          scope: 'resource',
          resourceId: node.identifier,
          sourcePath: node.resolvedHref,
          message: `Transforming package item resource ${node.identifier}.`,
        },
      ];
      const itemRubricCandidates = extractGenericRubricCandidates(itemXml, node);
      for (const rubricCandidate of itemRubricCandidates) {
        traceEvents.push(rubricTraceEvent(rubricCandidate, node));
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
        return {
          genericRubricCandidates: itemRubricCandidates,
          itemOutputs: [output],
          itemResults: [createItemTransformResult(node, output)],
          traceEvents,
        };
      } catch (error) {
        // Item-scoped failures are recorded against the item; anything else is a package-level
        // fault and must not be swallowed.
        if (!(error instanceof QtiItemTransformError)) {
          throw error;
        }
        const itemResult = {
          resourceId: node.identifier,
          sourcePath: node.resolvedHref,
          status: 'failed' as const,
          itemCount: 0,
          warnings:
            error.sourceDiagnostics
              ?.filter((diagnostic) => diagnostic.severity !== 'info')
              .map(sourceDiagnosticToWarning) ?? [],
          diagnostics: error.sourceDiagnostics ?? [],
          profiles: error.conversionTrace.profiles ?? [],
          traceId: error.conversionTrace.traceId,
          message: error.message,
        };
        traceEvents.push({
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
        return {
          genericRubricCandidates: itemRubricCandidates,
          itemOutputs: [],
          itemResults: [itemResult],
          failedItemDiagnostics: error.sourceDiagnostics ?? [],
          traceEvents,
        };
      }
    }
  );

  for (const run of itemRuns) {
    genericRubricCandidates.push(...run.genericRubricCandidates);
    itemOutputs.push(...run.itemOutputs);
    itemResults.push(...run.itemResults);
    failedItemDiagnostics.push(...(run.failedItemDiagnostics ?? []));
    for (const event of run.traceEvents) {
      addTraceEvent(trace, event);
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
      (output) => ((output.metadata as any).sidecars ?? []) as SidecarArtifact[]
    ),
  ]);
  for (const sidecar of sidecars) {
    addTraceEvent(trace, {
      kind: 'sidecar-emitted',
      scope:
        sidecar.kind === 'asset' || sidecar.kind === 'stylesheet' || sidecar.kind === 'catalog'
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
    ...packageGraph.diagnostics.map(
      (diagnostic): TransformWarning => ({
        code: diagnostic.code,
        message: diagnostic.message,
        itemId: diagnostic.resourceId,
      })
    ),
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
      (output) => ((output.metadata as any).sourceDiagnostics ?? []) as SourceProfileDiagnostic[]
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
      (output) => ((output.metadata as any).sourceProfiles ?? []) as SourceProfileMatch[]
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
      diagnostics: [...(trace.diagnostics ?? []), ...sourceDiagnostics],
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
  addTraceEvent(trace, rubricTraceEvent(rubricCandidate, node));
}

function rubricTraceEvent(rubricCandidate: RubricCandidate, node: PackageResourceNode) {
  return {
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
  } satisfies Parameters<typeof addTraceEvent>[1];
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

/**
 * Runs `mapper` over `values` with at most `concurrency` in flight at once, preserving output
 * order. The first error wins and is re-thrown after every in-flight worker settles, rather
 * than rejecting immediately, so a mid-batch failure does not leave other workers' state
 * dangling.
 */
async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  let firstError: unknown;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await mapper(values[index] as T, index);
      } catch (error) {
        firstError ??= error;
      }
    }
  });
  await Promise.all(workers);
  if (firstError) {
    throw firstError;
  }
  return results;
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
  return (
    path
      .replaceAll('\\', '/')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'artifact'
  );
}

function shortHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
