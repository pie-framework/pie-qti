/**
 * Session transformation endpoint.
 *
 * Converts analyzed IMS Content Packages through @pie-qti/to-pie's package
 * transformer so package evidence, sidecars, source profiles, diagnostics, and
 * conversion traces stay consistent with CLI transforms.
 */

import { json } from '@sveltejs/kit';
import type { PackageFileAccess } from '@pie-qti/ims-cp-core';
import { QtiToPiePlugin, transformQtiPackageToPie } from '@pie-qti/to-pie';
import type { StorageBackend } from '@pie-qti/storage';
import type { RequestHandler } from './$types';
import { convertAbsoluteToStorageRelative, isAbsolutePath } from '$lib/server/utils/path-utils';
import type { PackageTransformResult, TransformedItem } from '$lib/server/storage/app-types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const { id } = params;
	const { storage, sessionStorage, appSessionStorage, transformEngine } = locals;
	const session = await appSessionStorage.getSession(id);

	if (!session) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	if (!session.analysis) {
		return json({ error: 'Session not analyzed yet' }, { status: 400 });
	}

	const startedAt = new Date();
	const plugin = getQtiToPiePlugin(transformEngine.getPlugins());
	const outputsPath = sessionStorage.getOutputsPath(id);
	const flattenedItems: Array<{
		identifier: string;
		title: string;
		pieConfig: unknown;
		warnings: unknown[];
	}> = [];
	const flattenedAssessments: Array<{
		identifier: string;
		title: string;
		pieConfig: unknown;
		warnings: unknown[];
	}> = [];
	const errors: Array<{ identifier: string; error: string }> = [];
	const packageResults: PackageTransformResult[] = [];

	for (const analyzedPackage of session.analysis.packages) {
		const packageName = analyzedPackage.packageName;
		try {
			if (!analyzedPackage.hasManifest) {
				throw new Error(`Package ${packageName} has no imsmanifest.xml; package transforms require a manifest.`);
			}

			const packageRoot = toStoragePath(analyzedPackage.packagePath, storage);
			const manifestPath = await findStorageManifestPath(storage, packageRoot);
			if (!manifestPath) {
				throw new Error(`No imsmanifest.xml found for package ${packageName}.`);
			}

			const manifestXml = await storage.readText(manifestPath);
			const transformResult = await transformQtiPackageToPie({
				packageId: packageName,
				manifestXml,
				fileAccess: createStoragePackageFileAccess(storage, storageDirname(manifestPath)),
				plugin,
				context: {
					storage,
					sessionId: id,
				},
			});

			const packageOutputPath = `${outputsPath}/${safeSegment(packageName)}`;
			await storage.writeText(
				`${packageOutputPath}/package-transform.json`,
				JSON.stringify(toPackageTransformJson(transformResult), null, 2)
			);
			await storage.writeText(
				`${packageOutputPath}/package-evidence.json`,
				JSON.stringify(transformResult.packageEvidence, null, 2)
			);
			await storage.writeText(
				`${packageOutputPath}/conversion-trace.json`,
				JSON.stringify(transformResult.conversionTrace, null, 2)
			);

			const transformedItems = await writeItemOutputs(
				storage,
				packageOutputPath,
				transformResult,
				flattenedItems
			);
			const packageErrors = transformResult.itemResults
				.filter((item) => item.status === 'failed')
				.map((item) => ({
					file: item.sourcePath ?? item.resourceId,
					error: item.message ?? `Failed to transform ${item.resourceId}`,
					packagePath: analyzedPackage.packagePath,
				}));

			errors.push(
				...packageErrors.map((error) => ({
					identifier: error.file,
					error: error.error,
				}))
			);

			packageResults.push({
				packageName,
				packageId: transformResult.packageId,
				qtiVersion: transformResult.qtiVersion,
				packageEvidence: transformResult.packageEvidence,
				itemResults: transformResult.itemResults,
				sidecars: transformResult.sidecars,
				sourceProfiles: transformResult.sourceProfiles,
				sourceDiagnostics: transformResult.sourceDiagnostics,
				conversionTrace: transformResult.conversionTrace,
				items: transformedItems,
				errors: packageErrors,
			});
		} catch (error) {
			const message = errorMessage(error);
			errors.push({ identifier: packageName, error: message });
			packageResults.push({
				packageName,
				items: [],
				errors: [
					{
						file: packageName,
						error: message,
						packagePath: analyzedPackage.packagePath,
					},
				],
			});
		}
	}

	const endedAt = new Date();
	const totalItemResults = packageResults.reduce(
		(total, pkg) => total + (pkg.itemResults?.length ?? pkg.items.length),
		0
	);
	const totalAssessments = packageResults.reduce(
		(total, pkg) =>
			total + (pkg.packageEvidence?.entrypoints.filter((entrypoint) => entrypoint.kind === 'test').length ?? 0),
		0
	);
	const totalPassages = packageResults.reduce(
		(total, pkg) =>
			total + (pkg.packageEvidence?.entrypoints.filter((entrypoint) => entrypoint.kind === 'passage').length ?? 0),
		0
	);

	const transformationResult = {
		sessionId: id,
		status: statusFor(flattenedItems.length, errors.length),
		startTime: startedAt,
		endTime: endedAt,
		duration: endedAt.getTime() - startedAt.getTime(),
		packages: packageResults,
		summary: {
			totalItems: totalItemResults,
			successfulItems: flattenedItems.length,
			failedItems: errors.length,
			totalAssessments,
			successfulAssessments: totalAssessments,
			totalPassages,
			successfulPassages: totalPassages,
		},
		items: flattenedItems,
		assessments: flattenedAssessments,
		errors,
	};

	await appSessionStorage.saveTransformation(id, transformationResult);

	return json({
		packages: packageResults,
		items: flattenedItems,
		assessments: flattenedAssessments,
		errors,
		summary: transformationResult.summary,
	});
};

function getQtiToPiePlugin(plugins: unknown[]): QtiToPiePlugin {
	const plugin = plugins.find((candidate): candidate is QtiToPiePlugin => candidate instanceof QtiToPiePlugin);
	return plugin ?? new QtiToPiePlugin();
}

function toStoragePath(packagePath: string, storage: StorageBackend): string {
	if (!isAbsolutePath(packagePath)) return packagePath;
	return convertAbsoluteToStorageRelative(packagePath, storage) ?? packagePath;
}

async function findStorageManifestPath(
	storage: StorageBackend,
	packageRoot: string
): Promise<string | null> {
	const rootManifest = `${packageRoot}/imsmanifest.xml`;
	if (await storage.exists(rootManifest)) return rootManifest;
	if (!storage.listFiles) return null;

	const queue = [packageRoot];
	const visited = new Set<string>();
	while (queue.length > 0) {
		const dir = queue.shift()!;
		if (visited.has(dir)) continue;
		visited.add(dir);

		let entries: string[] = [];
		try {
			entries = await storage.listFiles(dir);
		} catch {
			continue;
		}

		for (const entry of entries) {
			const entryPath = `${dir}/${entry}`;
			if (entry === 'imsmanifest.xml') return entryPath;
			if (entry.startsWith('.')) continue;
			if (await isStorageDirectory(storage, entryPath)) {
				queue.push(entryPath);
			}
		}
	}

	return null;
}

function createStoragePackageFileAccess(
	storage: StorageBackend,
	packageRoot: string
): PackageFileAccess {
	return {
		async readText(packagePath) {
			try {
				return await storage.readText(joinStoragePackagePath(packageRoot, packagePath));
			} catch {
				return null;
			}
		},
		async readBuffer(packagePath) {
			try {
				return await storage.readBuffer(joinStoragePackagePath(packageRoot, packagePath));
			} catch {
				return null;
			}
		},
		async exists(packagePath) {
			return storage.exists(joinStoragePackagePath(packageRoot, packagePath));
		},
		async listFiles() {
			return listStoragePackageFiles(storage, packageRoot);
		},
	};
}

async function listStoragePackageFiles(
	storage: StorageBackend,
	packageRoot: string
): Promise<string[]> {
	if (!storage.listFiles) return [];

	const files: string[] = [];
	const queue = [''];
	while (queue.length > 0) {
		const relativeDir = queue.shift()!;
		const storageDir = relativeDir ? `${packageRoot}/${relativeDir}` : packageRoot;
		let entries: string[] = [];
		try {
			entries = await storage.listFiles(storageDir);
		} catch {
			continue;
		}

		for (const entry of entries) {
			const relativePath = relativeDir ? `${relativeDir}/${entry}` : entry;
			const storagePath = `${packageRoot}/${relativePath}`;
			if (await isStorageDirectory(storage, storagePath)) {
				queue.push(relativePath);
			} else {
				files.push(relativePath);
			}
		}
	}

	return files;
}

async function isStorageDirectory(storage: StorageBackend, storagePath: string): Promise<boolean> {
	if (!storage.listFiles) return false;
	try {
		await storage.listFiles(storagePath);
		return true;
	} catch {
		return false;
	}
}

async function writeItemOutputs(
	storage: StorageBackend,
	packageOutputPath: string,
	transformResult: Awaited<ReturnType<typeof transformQtiPackageToPie>>,
	flattenedItems: Array<{
		identifier: string;
		title: string;
		pieConfig: unknown;
		warnings: unknown[];
	}>
): Promise<TransformedItem[]> {
	const transformedItems: TransformedItem[] = [];

	for (let index = 0; index < transformResult.itemOutputs.length; index += 1) {
		const output = transformResult.itemOutputs[index];
		const itemResult = transformResult.itemResults[index];
		const identifier = itemResult?.resourceId ?? `item-${index + 1}`;
		const pieConfig =
			output.items.length === 1 ? output.items[0]?.content : output.items.map((item) => item.content);
		const outputPath = `${packageOutputPath}/items/${safeSegment(identifier)}.json`;

		await storage.writeText(outputPath, JSON.stringify(pieConfig, null, 2));

		const flattened = {
			identifier,
			title: titleFromId(identifier),
			pieConfig,
			warnings: [...(itemResult?.warnings ?? []), ...(output.warnings ?? [])],
		};
		flattenedItems.push(flattened);
		transformedItems.push({
			sourceId: identifier,
			sourcePath: itemResult?.sourcePath ?? identifier,
			outputPath,
			type: 'item',
			success: true,
			warnings: flattened.warnings.map((warning) => ({ message: warningMessage(warning) })),
			metadata: {
				interactions: [],
				pieElements: [],
			},
		});
	}

	return transformedItems;
}

function toPackageTransformJson(transformResult: Awaited<ReturnType<typeof transformQtiPackageToPie>>) {
	return {
		packageId: transformResult.packageId,
		qtiVersion: transformResult.qtiVersion,
		itemResults: transformResult.itemResults,
		sidecars: transformResult.sidecars.map((sidecar) => ({
			...sidecar,
			content:
				typeof sidecar.content === 'string'
					? { type: 'text', length: sidecar.content.length }
					: sidecar.content instanceof Uint8Array
						? { type: 'binary', length: sidecar.content.byteLength }
						: undefined,
		})),
		sourceProfiles: transformResult.sourceProfiles,
		sourceDiagnostics: transformResult.sourceDiagnostics,
		standardCandidates: transformResult.standardCandidates,
		rubricCandidates: transformResult.rubricCandidates,
		warnings: transformResult.warnings,
	};
}

function joinStoragePackagePath(packageRoot: string, packagePath: string): string {
	const normalized = packagePath.replace(/\\/g, '/').replace(/^\/+/, '');
	if (normalized.split('/').includes('..')) {
		throw new Error(`Package path escapes root: ${packagePath}`);
	}
	return normalized ? `${packageRoot}/${normalized}` : packageRoot;
}

function storageDirname(storagePath: string): string {
	const index = storagePath.lastIndexOf('/');
	return index === -1 ? '' : storagePath.slice(0, index);
}

function safeSegment(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'unnamed';
}

function titleFromId(fileId: string): string {
	return fileId.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function warningMessage(warning: unknown): string {
	if (typeof warning === 'string') return warning;
	if (warning && typeof warning === 'object' && 'message' in warning) {
		return String((warning as { message: unknown }).message);
	}
	return String(warning);
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

function statusFor(successCount: number, errorCount: number): 'success' | 'partial' | 'failed' {
	if (errorCount === 0) return 'success';
	if (successCount > 0) return 'partial';
	return 'failed';
}
