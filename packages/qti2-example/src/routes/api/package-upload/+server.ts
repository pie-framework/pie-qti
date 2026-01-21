/**
 * Enhanced API endpoint for uploading full QTI packages
 * Extracts ZIP, parses imsmanifest.xml, and returns complete package structure
 * including all items, tests, and assets
 */

export const prerender = false;

import { error, json } from '@sveltejs/kit';
import unzipper from 'unzipper';
import { parseString } from 'xml2js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import * as os from 'os';
import type { RequestHandler } from './$types';

interface PackageItem {
	identifier: string;
	href: string;
	title?: string;
}

interface PackageTest {
	identifier: string;
	href: string;
	title?: string;
}

interface PackageStructure {
	packageId: string;
	items: PackageItem[];
	tests: PackageTest[];
	assets: {
		images: string[];
		styles: string[];
		audio: string[];
		video: string[];
		passages: string[];
	};
	manifest: any;
	packageDir?: string; // For development - stores extracted package path
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const contentType = request.headers.get('content-type') || '';
		const contentLength = request.headers.get('content-length');
		console.log('Request Content-Type:', contentType);
		console.log('Request Content-Length:', contentLength);
		
		// Clone the request to ensure we can read the body
		// This is important in case the body was already partially consumed
		const clonedRequest = request.clone();
		
		// Read the full request body as arrayBuffer
		// This ensures we get all the data, not just the first chunk
		const arrayBuffer = await clonedRequest.arrayBuffer();
		let buffer = Buffer.from(arrayBuffer);
		console.log(`Read raw request body: ${buffer.length} bytes (expected: ${contentLength || 'unknown'})`);
		
		// If we got less data than expected, something is wrong
		if (contentLength && parseInt(contentLength) > buffer.length) {
			console.warn(`Warning: Received ${buffer.length} bytes but Content-Length indicates ${contentLength} bytes`);
		}
		
		// Parse multipart/form-data manually
		// Extract boundary from Content-Type header
		const boundaryMatch = contentType.match(/boundary=([^;\s]+)/);
		if (!boundaryMatch) {
			throw error(400, 'Invalid multipart/form-data: no boundary found');
		}
		
		const rawBoundary = boundaryMatch[1].trim();
		const boundary = `--${rawBoundary}`;
		const boundaryBuffer = Buffer.from(boundary, 'utf-8');
		const endBoundary = Buffer.from(`${boundary}--`, 'utf-8');
		
		console.log(`Boundary: "${boundary}"`);
		console.log(`Total buffer size: ${buffer.length} bytes`);
		
		// Find all boundary positions
		const boundaryPositions: number[] = [];
		let searchPos = 0;
		while (true) {
			const pos = buffer.indexOf(boundaryBuffer, searchPos);
			if (pos === -1) break;
			boundaryPositions.push(pos);
			searchPos = pos + 1;
		}
		
		console.log(`Found ${boundaryPositions.length} boundary markers at positions:`, boundaryPositions);
		
		if (boundaryPositions.length < 2) {
			throw error(400, `Expected at least 2 boundaries, found ${boundaryPositions.length}`);
		}
		
		// The file part should be between the first and second boundary
		// First boundary marks the start of the form field
		// Second boundary marks the end of the form field
		const firstBoundary = boundaryPositions[0];
		const secondBoundary = boundaryPositions[1];
		
		// Find the end of headers (double CRLF) after first boundary
		let fileStart: number;
		const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n', 'utf-8'), firstBoundary);
		if (headerEnd === -1) {
			// Try single CRLF as fallback
			const headerEndAlt = buffer.indexOf(Buffer.from('\n\n', 'utf-8'), firstBoundary);
			if (headerEndAlt === -1) {
				throw error(400, 'Could not find end of headers in multipart data');
			}
			fileStart = headerEndAlt + 2;
		} else {
			fileStart = headerEnd + 4; // Skip \r\n\r\n
		}
		
		// Find the start of the second boundary (back up for \r\n before boundary)
		// Look backwards from second boundary for line break
		let fileEnd = secondBoundary;
		
		// Back up to find the actual end of file data (before \r\n--boundary)
		if (fileEnd >= 2 && buffer[fileEnd - 2] === 0x0D && buffer[fileEnd - 1] === 0x0A) {
			fileEnd -= 2; // Skip \r\n
		} else if (fileEnd >= 1 && buffer[fileEnd - 1] === 0x0A) {
			fileEnd -= 1; // Skip \n
		}
		
		if (fileStart >= fileEnd || fileEnd <= fileStart) {
			console.error('Invalid file range:', { fileStart, fileEnd, firstBoundary, secondBoundary });
			throw error(400, `Invalid file range: start=${fileStart}, end=${fileEnd}`);
		}
		
		// Extract the file buffer
		buffer = buffer.subarray(fileStart, fileEnd);
		console.log(`Extracted file data: ${buffer.length} bytes (from ${fileStart} to ${fileEnd})`);

		// Try to open as ZIP - this is the real validation
		// We don't check filename/MIME type first because they can be unreliable
		let directory;
		try {
			directory = await unzipper.Open.buffer(buffer);
		} catch (zipError) {
			const errorMsg = zipError instanceof Error ? zipError.message : 'Unknown error';
			console.error('Failed to open as ZIP:', errorMsg);
			throw error(400, `File is not a valid ZIP archive: ${errorMsg}`);
		}

		// Create temporary directory for extracted package
		const packageId = `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const packageDir = join(os.tmpdir(), 'qti-packages', packageId);
		await mkdir(packageDir, { recursive: true });

		// Extract all files and store in memory
		const files: Record<string, Buffer> = {};
		for (const fileEntry of directory.files) {
			if (fileEntry.type === 'File') {
				const content = await fileEntry.buffer();
				files[fileEntry.path] = content;

				// Also write to disk for asset serving (Phase 2)
				const filePath = join(packageDir, fileEntry.path);
				// Handle both Windows and Unix paths
				const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
				if (lastSlash > 0) {
					const fileDir = filePath.substring(0, lastSlash);
					await mkdir(fileDir, { recursive: true });
				}
				await writeFile(filePath, content);
			}
		}

		// Parse imsmanifest.xml
		let manifest: any = null;
		let manifestPath = 'imsmanifest.xml';

		if (files[manifestPath]) {
			manifest = await parseXml(files[manifestPath].toString('utf-8'));
		} else {
			// Try to find manifest in subdirectories
			const manifestFile = Object.keys(files).find((path) => path.endsWith('imsmanifest.xml'));
			if (manifestFile) {
				manifestPath = manifestFile;
				manifest = await parseXml(files[manifestFile].toString('utf-8'));
			}
		}

		if (!manifest) {
			throw error(400, 'No imsmanifest.xml found in ZIP file');
		}

		// Extract all resources from manifest
		const resources = manifest.manifest?.resources?.[0]?.resource || [];

		// Extract items (QTI items)
		const items: PackageItem[] = resources
			.filter((r: any) => {
				if (!r.$) return false;
				const type = r.$?.type || '';
				return (
					type.includes('imsqti_item') ||
					type.includes('imsqti_assessmentitem') ||
					// Also check dependencies that reference items
					(r.dependency && r.dependency.some((d: any) => d.$?.identifierref?.startsWith('ITEM-')))
				);
			})
			.map((r: any) => ({
				identifier: r.$?.identifier || '',
				href: r.$?.href || '',
				title: r.$?.title || extractTitleFromMetadata(r),
			}))
			.filter((item) => item.identifier && item.href); // Filter out invalid items

		// Also scan items directory for actual item files
		const itemFiles = Object.keys(files).filter((path) => path.startsWith('items/') && path.endsWith('.xml'));
		for (const itemPath of itemFiles) {
			const itemContent = files[itemPath].toString('utf-8');
			const identifierMatch = itemContent.match(/identifier=["']([^"']+)["']/);
			const titleMatch = itemContent.match(/title=["']([^"']+)["']/);

			if (identifierMatch) {
				const identifier = identifierMatch[1];
				// Only add if not already in items list
				if (!items.find((i) => i.identifier === identifier)) {
					items.push({
						identifier,
						href: itemPath,
						title: titleMatch?.[1],
					});
				}
			}
		}

		// Extract tests (QTI assessments)
		const tests: PackageTest[] = resources
			.filter((r: any) => {
				if (!r.$) return false;
				const type = r.$?.type || '';
				return type.includes('imsqti_test') || type.includes('imsqti_assessmenttest');
			})
			.map((r: any) => ({
				identifier: r.$?.identifier || '',
				href: r.$?.href || '',
				title: r.$?.title || extractTitleFromMetadata(r),
			}))
			.filter((test) => test.identifier && test.href); // Filter out invalid tests

		// Also scan tests directory
		const testFiles = Object.keys(files).filter((path) => path.startsWith('tests/') && path.endsWith('.xml'));
		for (const testPath of testFiles) {
			const testContent = files[testPath].toString('utf-8');
			const identifierMatch = testContent.match(/identifier=["']([^"']+)["']/);
			const titleMatch = testContent.match(/title=["']([^"']+)["']/);

			if (identifierMatch) {
				const identifier = identifierMatch[1];
				if (!tests.find((t) => t.identifier === identifier)) {
					tests.push({
						identifier,
						href: testPath,
						title: titleMatch?.[1],
					});
				}
			}
		}

		// Find assets
		const images = Object.keys(files)
			.filter((p) => p.startsWith('images/') && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(p))
			.map((p) => p);

		const styles = Object.keys(files)
			.filter((p) => p.startsWith('styles/') && p.endsWith('.css'))
			.map((p) => p);

		const audio = Object.keys(files)
			.filter((p) => p.startsWith('audio/') && /\.(mp3|wav|ogg|m4a)$/i.test(p))
			.map((p) => p);

		const video = Object.keys(files)
			.filter((p) => p.startsWith('video/') && /\.(mp4|webm|ogg|mov)$/i.test(p))
			.map((p) => p);

		const passages = Object.keys(files)
			.filter((p) => p.startsWith('passages/') && p.endsWith('.xml'))
			.map((p) => p);

		const packageStructure: PackageStructure = {
			packageId,
			items,
			tests,
			assets: {
				images,
				styles,
				audio,
				video,
				passages,
			},
			manifest,
			packageDir, // For development - in production, use packageId only
		};

		return json({
			success: true,
			package: packageStructure,
		});
	} catch (err) {
		console.error('Error processing QTI package:', err);

		if (err instanceof Error) {
			throw error(500, err.message);
		}

		throw error(500, 'Failed to process QTI package');
	}
};

/**
 * Parse XML string to JavaScript object
 */
function parseXml(xmlString: string): Promise<any> {
	return new Promise((resolve, reject) => {
		parseString(xmlString, (err, result) => {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
}

/**
 * Extract title from resource metadata
 */
function extractTitleFromMetadata(resource: any): string | undefined {
	// Try to extract title from metadata
	const metadata = resource.metadata?.[0];
	if (metadata) {
		const lom = metadata.lom?.[0];
		if (lom) {
			const general = lom.general?.[0];
			if (general) {
				const title = general.title?.[0]?.string?.[0]?._ || general.title?.[0]?.string?.[0];
				if (title) return title;
			}
		}
	}
	return undefined;
}
