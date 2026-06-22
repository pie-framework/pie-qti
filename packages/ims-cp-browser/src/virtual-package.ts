/**
 * Virtual package - in-memory representation of an IMS Content Package
 */

import type { VirtualFile } from './types.js';
import type { ResolvedManifest } from './package-loader.js';
import type { StorageBackend } from './storage.js';

export interface VirtualPackage {
	/** Unique package identifier */
	packageId: string;
	/** All files in the package */
	files: Map<string, VirtualFile>;
	/** Parsed and resolved manifest */
	manifest: ResolvedManifest;

	// File access methods
	getFile(path: string): VirtualFile | null;
	readText(path: string): string | null;
	readBinary(path: string): Blob | null;
	getDataUrl(path: string): string | null;
	listFiles(directory?: string): VirtualFile[];

	// Persistence
	save(): Promise<void>;
	close(): Promise<void>;
}

/**
 * Create a virtual package instance
 */
export function createVirtualPackage(
	packageId: string,
	files: Map<string, VirtualFile>,
	manifest: ResolvedManifest,
	storage?: StorageBackend
): VirtualPackage {
	return {
		packageId,
		files,
		manifest,

		getFile(path: string): VirtualFile | null {
			return this.files.get(path) ?? null;
		},

		readText(path: string): string | null {
			const file = this.files.get(path);
			if (!file) return null;
			if (file.type !== 'text') {
				console.warn(`File ${path} is binary, not text`);
				return null;
			}
			return file.content as string;
		},

		readBinary(path: string): Blob | null {
			const file = this.files.get(path);
			if (!file) return null;
			if (file.type !== 'binary') {
				// Convert text to Blob if needed
				return new Blob([file.content as string], { type: 'text/plain' });
			}
			return file.content as Blob;
		},

		getDataUrl(path: string): string | null {
			const file = this.files.get(path);
			if (!file) return null;

			if (file.type === 'text') {
				// Create data URL from text
				const encoded = encodeURIComponent(file.content as string);
				return `data:${getTextMimeType(path)};charset=utf-8,${encoded}`;
			} else {
				// Create blob URL for binary files
				const blob = file.content as Blob;
				return URL.createObjectURL(blob);
			}
		},

		listFiles(directory?: string): VirtualFile[] {
			if (!directory) {
				return Array.from(this.files.values());
			}

			// Normalize directory path
			const dir = directory.endsWith('/') ? directory : `${directory}/`;

			return Array.from(this.files.values()).filter((file) => file.path.startsWith(dir));
		},

		async save(): Promise<void> {
			if (!storage) {
				throw new Error('No storage backend configured');
			}

			// Convert files Map to serializable format
			const filesArray = Array.from(this.files.entries()).map(([path, file]) => ({
				path,
				content: file.type === 'text' ? file.content : null, // Don't serialize binary files
				type: file.type,
				size: file.size,
			}));

			const data = {
				packageId: this.packageId,
				files: filesArray,
				manifest: {
					identifier: this.manifest.identifier,
					manifestPath: this.manifest.manifestPath,
					xmlBase: this.manifest.xmlBase,
					// Convert Maps to objects for serialization
					resources: Object.fromEntries(this.manifest.resources),
					items: this.manifest.items,
					passages: this.manifest.passages,
					tests: this.manifest.tests,
				},
			};

			await storage.store(`qti-package-${this.packageId}`, data);
		},

		async close(): Promise<void> {
			// Revoke any blob URLs we created
			for (const file of this.files.values()) {
				if (file.type === 'binary' && file.content instanceof Blob) {
					// Note: We can't track which blob URLs were created, so this is a no-op
					// In practice, blob URLs will be garbage collected when the page unloads
				}
			}
		},
	};
}

function getTextMimeType(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		css: 'text/css',
		html: 'text/html',
		htm: 'text/html',
		svg: 'image/svg+xml',
		xml: 'application/xml',
	};
	return mimeTypes[ext ?? ''] ?? 'text/plain';
}

/**
 * Load a virtual package from storage
 */
export async function loadPackageFromStorage(
	packageId: string,
	storage: StorageBackend
): Promise<VirtualPackage | null> {
	const data = await storage.retrieve(`qti-package-${packageId}`);
	if (!data) return null;

	// Reconstruct files Map
	const files = new Map<string, VirtualFile>();
	for (const fileData of data.files) {
		if (fileData.type === 'text' && fileData.content) {
			files.set(fileData.path, {
				path: fileData.path,
				content: fileData.content,
				type: 'text',
				size: fileData.size,
			});
		}
		// Binary files are not persisted in storage
	}

	// Reconstruct manifest
	const manifest: ResolvedManifest = {
		identifier: data.manifest.identifier,
		manifestPath: data.manifest.manifestPath,
		xmlBase: data.manifest.xmlBase,
		resources: new Map(Object.entries(data.manifest.resources)),
		items: data.manifest.items,
		passages: data.manifest.passages,
		tests: data.manifest.tests,
	};

	return createVirtualPackage(packageId, files, manifest, storage);
}
