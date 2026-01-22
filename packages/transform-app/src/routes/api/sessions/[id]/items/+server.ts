/**
 * Session Items List Endpoint
 * Returns a list of all QTI items in a session
 */

import { json, error as svelteError } from '@sveltejs/kit';
import { loadResolvedManifest, toAbsolutePath } from '@pie-qti/qti2-to-pie/ims-cp';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	try {
		const { storage, sessionStorage, appSessionStorage } = locals;
		const extractedPath = sessionStorage.getExtractedPath(id);
		const uploadsPath = sessionStorage.getUploadsPath(id);

		function normalizePossiblyAbsolutePath(p: string): string {
			if (p.startsWith('Users/') || p.startsWith('home/')) {
				return `/${p}`;
			}
			return p;
		}

		function isAbsolutePath(p: string): boolean {
			return p.startsWith('/');
		}

		async function readSessionXml(samplePath: string): Promise<string> {
			const normalized = normalizePossiblyAbsolutePath(samplePath);
			const candidates: string[] = [];

			if (isAbsolutePath(normalized)) {
				// Absolute path - convert to storage-relative path
				const storageRoot = (storage as any).rootDir || process.cwd() + '/uploads';
				if (normalized.startsWith(storageRoot + '/')) {
					candidates.push(normalized.substring(storageRoot.length + 1));
				} else if (normalized.includes('/uploads/sessions/')) {
					const match = normalized.match(/\/uploads\/(sessions\/.+)/);
					if (match) {
						candidates.push(match[1]);
					}
				}
				candidates.push(normalized.substring(1));
			} else {
				candidates.push(`${extractedPath}/${normalized}`);
				candidates.push(`${uploadsPath}/${normalized}`);
				const baseName = normalized.split('/').pop();
				if (baseName && baseName !== normalized) {
					candidates.push(`${uploadsPath}/${baseName}`);
					candidates.push(`${extractedPath}/${baseName}`);
				}
			}

			for (const candidate of candidates) {
				try {
					if (await storage.exists(candidate)) {
						return await storage.readText(candidate);
					}
				} catch {
					continue;
				}
			}

			throw new Error(`ENOENT: no such file or directory, open '${candidates[0] || samplePath}'`);
		}

		/**
		 * Extract interaction types from XML content
		 */
		function extractInteractionTypes(xmlContent: string): string[] {
			const interactions: string[] = [];
			const rawContent = xmlContent.toLowerCase();

			const interactionTypes = [
				'choiceInteraction',
				'extendedTextInteraction',
				'textEntryInteraction',
				'orderInteraction',
				'matchInteraction',
				'associateInteraction',
				'gapMatchInteraction',
				'inlineChoiceInteraction',
				'hotspotInteraction',
				'graphicGapMatchInteraction',
				'selectPointInteraction',
				'graphicOrderInteraction',
				'graphicAssociateInteraction',
				'sliderInteraction',
				'mediaInteraction',
				'positionObjectInteraction',
				'drawingInteraction',
				'uploadInteraction',
				'customInteraction',
			];

			for (const interactionType of interactionTypes) {
				const searchTerm = `<${interactionType.toLowerCase()}`;
				const regex = new RegExp(searchTerm, 'gi');
				const matches = rawContent.match(regex);
				if (matches && matches.length > 0) {
					interactions.push(interactionType);
				}
			}

			return interactions;
		}

		/**
		 * Recursively find all assessment item XML files in a directory
		 */
		async function findAllAssessmentItems(rootDir: string): Promise<string[]> {
			const found: string[] = [];
			const stack: string[] = [rootDir];

			while (stack.length > 0) {
				const dir = stack.pop()!;

				let entries: string[] = [];
				try {
					if (!(await storage.exists(dir))) continue;
					if (!storage.listFiles) continue;
					entries = await storage.listFiles(dir);
				} catch {
					continue;
				}

				for (const entryName of entries) {
					const fullPath = `${dir}/${entryName}`;

					// Check if it's a directory by trying to list it
					let isDirectory = false;
					try {
						if (storage.listFiles) {
							await storage.listFiles(fullPath);
							isDirectory = true;
						}
					} catch {
						isDirectory = false;
					}

					if (isDirectory) {
						stack.push(fullPath);
						continue;
					}

					if (!entryName.toLowerCase().endsWith('.xml')) continue;

					try {
						const xml = await storage.readText(fullPath);
						if (xml.toLowerCase().includes('<assessmentitem')) {
							found.push(fullPath);
						}
					} catch {
						// Ignore unreadable file
					}
				}
			}

			return found;
		}

		/**
		 * Convert absolute path to storage-relative path
		 */
		function absoluteToStoragePath(absolutePath: string, packageAbsolutePath: string): string {
			const storageRoot = (storage as any).rootDir || process.cwd() + '/uploads';
			
			// If it's already relative to storage root
			if (absolutePath.startsWith(storageRoot)) {
				return absolutePath.substring(storageRoot.length + 1);
			}
			
			// Extract relative path from package absolute path
			if (absolutePath.startsWith(packageAbsolutePath)) {
				const relative = absolutePath.substring(packageAbsolutePath.length + 1);
				// Convert package absolute path to storage-relative
				const packageStoragePath = packageAbsolutePath.startsWith(storageRoot)
					? packageAbsolutePath.substring(storageRoot.length + 1)
					: packageAbsolutePath.startsWith('/')
						? packageAbsolutePath.substring(1)
						: packageAbsolutePath;
				return `${packageStoragePath}/${relative}`;
			}
			
			// Fallback: return as-is (might already be storage-relative)
			return absolutePath.startsWith('/') ? absolutePath.substring(1) : absolutePath;
		}

		// Get session with analysis
		const session = await appSessionStorage.getSession(id);
		if (!session) {
			throw svelteError(404, 'Session not found');
		}

		// Check if analysis is available
		if (!session.analysis) {
			throw svelteError(400, 'Session has not been analyzed yet');
		}

		// Build list of items from ALL items (not just samples)
		const items: Array<{
			id: string;
			title: string;
			filePath: string;
			sourcePath: string;
			interactions: string[];
			url: string;
			xml?: string;
		}> = [];

		const seenFiles = new Set<string>();

		// Get absolute extracted path for manifest loading
		const storageRoot = (storage as any).rootDir || process.cwd() + '/uploads';
		const absoluteExtractedPath = (storage as any).resolvePath
			? (storage as any).resolvePath(extractedPath)
			: require('node:path').resolve(storageRoot, extractedPath);

		// Iterate through packages
		for (const pkg of session.analysis.packages) {
			// Try to load manifest to get ALL items
			let allItemPaths: Array<{ absolute: string; storageRelative: string }> = [];
			let packageAbsolutePath: string;
			
			try {
				// Resolve package path
				packageAbsolutePath = pkg.packagePath.startsWith('/')
					? pkg.packagePath
					: require('node:path').resolve(absoluteExtractedPath, pkg.packagePath);
				
				const resolvedManifest = await loadResolvedManifest(packageAbsolutePath);
				
				// Get all items from manifest
				for (const itemResource of resolvedManifest.items) {
					const rel = itemResource.hrefResolved || itemResource.href;
					if (rel) {
						const abs = toAbsolutePath(packageAbsolutePath, rel);
						const storageRel = absoluteToStoragePath(abs, packageAbsolutePath);
						allItemPaths.push({ absolute: abs, storageRelative: storageRel });
					}
				}
			} catch {
				// No manifest or failed to load - scan directory instead
				packageAbsolutePath = pkg.packagePath.startsWith('/')
					? pkg.packagePath
					: require('node:path').resolve(absoluteExtractedPath, pkg.packagePath);
				
				const packageStoragePath = pkg.packagePath.startsWith('/')
					? absoluteToStoragePath(pkg.packagePath, packageAbsolutePath)
					: `${extractedPath}/${pkg.packagePath}`;
				
				const scannedPaths = await findAllAssessmentItems(packageStoragePath);
				allItemPaths = scannedPaths.map(path => ({ absolute: path, storageRelative: path }));
			}

			// Process all items
			for (const { absolute: itemAbsolutePath, storageRelative: itemStoragePath } of allItemPaths) {
				if (seenFiles.has(itemStoragePath) || seenFiles.has(itemAbsolutePath)) {
					continue;
				}

				seenFiles.add(itemStoragePath);
				seenFiles.add(itemAbsolutePath);

				try {
					// Read the XML content - use the exact storage-relative path we calculated
					let xmlContent: string;
					
					// First, try the exact storage-relative path
					if (await storage.exists(itemStoragePath)) {
						xmlContent = await storage.readText(itemStoragePath);
					} else {
						// If that doesn't work, try converting absolute path to storage path
						const storageRoot = (storage as any).rootDir || process.cwd() + '/uploads';
						if (itemAbsolutePath.startsWith(storageRoot)) {
							const storagePath = itemAbsolutePath.substring(storageRoot.length + 1);
							if (await storage.exists(storagePath)) {
								xmlContent = await storage.readText(storagePath);
							} else {
								// Last resort: use readSessionXml with its fallback logic
								xmlContent = await readSessionXml(itemStoragePath);
							}
						} else {
							// Try readSessionXml as fallback
							xmlContent = await readSessionXml(itemStoragePath);
						}
					}
					
					// Extract interaction types
					const interactions = extractInteractionTypes(xmlContent);
					
					// Extract filename from path
					const fileName = itemStoragePath.split('/').pop() || itemAbsolutePath.split('/').pop() || 'unknown';
					const fileId = fileName.replace(/\.xml$/i, '');
					
					// Extract identifier from XML for better uniqueness
					let itemIdentifier = fileId;
					try {
						const identifierMatch = xmlContent.match(/<assessmentItem[^>]*identifier\s*=\s*["']([^"']+)["']/i);
						if (identifierMatch && identifierMatch[1]) {
							itemIdentifier = identifierMatch[1];
						}
					} catch {
						// Use filename-based ID if extraction fails
					}
					
					// Extract title from XML if available, otherwise use filename
					let title = fileId.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
					try {
						const titleMatch = xmlContent.match(/<assessmentItem[^>]*title\s*=\s*["']([^"']+)["']/i);
						if (titleMatch && titleMatch[1]) {
							title = titleMatch[1];
						} else if (itemIdentifier !== fileId) {
							title = itemIdentifier.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
						}
					} catch {
						// Use filename-based title if extraction fails
					}

					// Construct URL to serve this item
					const url = `/api/sessions/${id}/items/${fileName}`;

					items.push({
						id: itemIdentifier,
						title,
						filePath: fileName,
						sourcePath: itemStoragePath,
						interactions: interactions.length > 0 ? interactions : ['unknown'],
						url,
						xml: xmlContent
					});
				} catch (error) {
					console.warn(`Failed to process item at ${itemStoragePath}:`, error);
					// Continue with other items
				}
			}
		}

		return json({
			success: true,
			sessionId: id,
			items,
			totalItems: items.length
		});
	} catch (err) {
		console.error('List items error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw svelteError(500, err instanceof Error ? err.message : 'Failed to list items');
	}
};
