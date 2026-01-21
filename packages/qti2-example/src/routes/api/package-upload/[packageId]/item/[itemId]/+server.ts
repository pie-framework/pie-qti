/**
 * API endpoint to fetch QTI item XML content by packageId and itemId
 * Reads from the extracted package directory
 */

export const prerender = false;

import { error, json } from '@sveltejs/kit';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import * as os from 'os';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { packageId, itemId } = params;

		if (!packageId || !itemId) {
			throw error(400, 'Missing packageId or itemId');
		}

		// Find the package directory
		const packageDir = join(os.tmpdir(), 'qti-packages', packageId);

		// Try to find the item file
		// First, try to get item info from a stored manifest or scan the items directory
		const itemsDir = join(packageDir, 'items');
		
		// Try common item file patterns
		const possiblePaths = [
			join(itemsDir, `${itemId}.xml`),
			join(itemsDir, `ITEM-${itemId}.xml`),
			join(packageDir, `items/${itemId}.xml`),
		];

		let itemContent: string | null = null;
		let itemPath: string | null = null;

		for (const path of possiblePaths) {
			try {
				const content = await readFile(path, 'utf-8');
				// Verify it's the right item by checking identifier in XML
				if (content.includes(`identifier="${itemId}"`) || content.includes(`identifier='${itemId}'`)) {
					itemContent = content;
					itemPath = path;
					break;
				}
			} catch {
				// File doesn't exist at this path, try next
				continue;
			}
		}

		// If not found in common paths, scan items directory
		if (!itemContent) {
			try {
				const files = await readdir(itemsDir);
				for (const file of files) {
					if (file.endsWith('.xml')) {
						const filePath = join(itemsDir, file);
						const content = await readFile(filePath, 'utf-8');
						if (content.includes(`identifier="${itemId}"`) || content.includes(`identifier='${itemId}'`)) {
							itemContent = content;
							itemPath = filePath;
							break;
						}
					}
				}
			} catch {
				// Items directory might not exist
			}
		}

		if (!itemContent) {
			throw error(404, `Item ${itemId} not found in package ${packageId}`);
		}

		return json({
			success: true,
			itemId,
			packageId,
			xml: itemContent,
			path: itemPath,
		});
	} catch (err) {
		console.error('Error fetching item:', err);

		if (err instanceof Error && err.message.includes('404')) {
			throw error(404, err.message);
		}

		throw error(500, 'Failed to fetch item');
	}
};
