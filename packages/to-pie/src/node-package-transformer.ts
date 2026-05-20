import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PackageFileAccess } from '@pie-qti/ims-cp-core';
import { findManifestPath, openContentPackage, type OpenContentPackageOptions } from '@pie-qti/ims-cp-node';
import { transformQtiPackageToPie, type QtiPackageTransformInput, type QtiPackageTransformResult } from './package-transformer.js';

export interface NodeQtiPackageTransformInput
	extends Omit<QtiPackageTransformInput, 'manifestXml' | 'fileAccess'> {
	packagePath: string;
	openOptions?: OpenContentPackageOptions;
}

export interface NodeQtiPackageTransformResult extends QtiPackageTransformResult {
	packageRoot: string;
	manifestPath: string;
}

export async function transformQtiPackagePathToPie({
	packagePath,
	openOptions,
	...input
}: NodeQtiPackageTransformInput): Promise<NodeQtiPackageTransformResult> {
	const opened = await openContentPackage(packagePath, openOptions);
	try {
		const manifestPath = await findManifestPath(opened.packageRoot);
		if (!manifestPath) {
			throw new Error(`No imsmanifest.xml found in ${packagePath}`);
		}

		const packageRoot = path.dirname(manifestPath);
		const manifestXml = await readFile(manifestPath, 'utf-8');
		const result = await transformQtiPackageToPie({
			...input,
			packageId: input.packageId ?? path.basename(packageRoot),
			manifestXml,
			fileAccess: createNodePackageFileAccess(packageRoot),
		});

		return {
			...result,
			packageRoot,
			manifestPath,
		};
	} finally {
		await opened.close();
	}
}

function createNodePackageFileAccess(packageRoot: string): PackageFileAccess {
	return {
		async readText(packagePath) {
			try {
				return await readFile(toPackageFsPath(packageRoot, packagePath), 'utf-8');
			} catch {
				return null;
			}
		},
		async readBuffer(packagePath) {
			try {
				return await readFile(toPackageFsPath(packageRoot, packagePath));
			} catch {
				return null;
			}
		},
		async exists(packagePath) {
			try {
				await readFile(toPackageFsPath(packageRoot, packagePath));
				return true;
			} catch {
				return false;
			}
		},
		async listFiles() {
			return listPackageFiles(packageRoot);
		},
	};
}

async function listPackageFiles(packageRoot: string): Promise<string[]> {
	const files: string[] = [];

	async function visit(relativeDir: string): Promise<void> {
		const absoluteDir = toPackageFsPath(packageRoot, relativeDir);
		const entries = await readdir(absoluteDir, { withFileTypes: true });
		for (const entry of entries) {
			const relativePath = toPackagePosixPath(path.posix.join(relativeDir, entry.name));
			if (entry.isDirectory()) {
				await visit(relativePath);
				continue;
			}
			files.push(relativePath);
		}
	}

	await visit('');
	return files;
}

function toPackageFsPath(packageRoot: string, packagePath: string): string {
	const normalized = toPackagePosixPath(packagePath);
	const absolutePath = path.resolve(packageRoot, normalized.split('/').join(path.sep));
	const root = path.resolve(packageRoot);
	const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
	if (absolutePath !== root && !absolutePath.startsWith(rootPrefix)) {
		throw new Error(`Package path escapes root: ${packagePath}`);
	}
	return absolutePath;
}

function toPackagePosixPath(packagePath: string): string {
	const normalized = path.posix.normalize(packagePath.replace(/\\/g, '/')).replace(/^\/+/, '');
	if (normalized === '.') return '';
	if (normalized.startsWith('..')) {
		throw new Error(`Package path escapes root: ${packagePath}`);
	}
	return normalized;
}
