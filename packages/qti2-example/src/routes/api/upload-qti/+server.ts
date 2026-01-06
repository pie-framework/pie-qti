/**
 * API endpoint for uploading QTI ZIP files
 * Extracts ZIP, parses imsmanifest.xml, and returns assessment/item data
 */

export const prerender = false;

import { error, json } from '@sveltejs/kit';
import { Readable } from 'stream';
import unzipper from 'unzipper';
import { parseString } from 'xml2js';
import type { RequestHandler } from './$types';

interface ManifestResource {
	$: {
		identifier: string;
		type: string;
		href: string;
	};
}

interface ManifestItem {
	$: {
		identifier: string;
		title?: string;
	};
	metadata?: any[];
	file?: { $: { href: string } }[];
}

interface QtiPackageData {
	type: 'assessment' | 'item';
	identifier: string;
	title?: string;
	files: Record<string, string>; // filename -> content
	mainFile: string; // path to main XML file
	resources: ManifestResource[];
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			throw error(400, 'No file provided');
		}

		// Verify it's a ZIP file
		if (!file.name.endsWith('.zip')) {
			throw error(400, 'File must be a ZIP file');
		}

		// Convert File to Buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Extract ZIP contents
		const files: Record<string, string> = {};
		const stream = Readable.from(buffer);
		const directory = await unzipper.Open.buffer(buffer);

		// Extract all files
		for (const file of directory.files) {
			if (file.type === 'File') {
				const content = await file.buffer();
				files[file.path] = content.toString('utf-8');
			}
		}

		// Parse imsmanifest.xml
		let manifest: any = null;
		let manifestPath = 'imsmanifest.xml';

		if (files[manifestPath]) {
			manifest = await parseXml(files[manifestPath]);
		} else {
			// Try to find manifest in subdirectories
			const manifestFile = Object.keys(files).find((path) => path.endsWith('imsmanifest.xml'));
			if (manifestFile) {
				manifestPath = manifestFile;
				manifest = await parseXml(files[manifestFile]);
			}
		}

		if (!manifest) {
			throw error(400, 'No imsmanifest.xml found in ZIP file');
		}

		// Extract QTI resources from manifest
		const resources = manifest.manifest?.resources?.[0]?.resource || [];
		const qtiResources = resources.filter(
			(r: any) =>
				r.$?.type?.includes('imsqti_test_xmlv2p2') || r.$?.type?.includes('imsqti_item_xmlv2p2'),
		);

		if (qtiResources.length === 0) {
			throw error(400, 'No QTI resources found in manifest');
		}

		// For now, return the first QTI resource
		const mainResource = qtiResources[0];
		const isAssessment = mainResource.$?.type?.includes('test');
		const mainFilePath = mainResource.$.href;

		// Resolve file path (might be relative to manifest location)
		const basePath = manifestPath.substring(0, manifestPath.lastIndexOf('/') + 1);
		const resolvedPath = basePath + mainFilePath;

		if (!files[resolvedPath] && !files[mainFilePath]) {
			throw error(400, `Main QTI file not found: ${mainFilePath}`);
		}

		const mainFileContent = files[resolvedPath] || files[mainFilePath];

		const packageData: QtiPackageData = {
			type: isAssessment ? 'assessment' : 'item',
			identifier: mainResource.$.identifier,
			title: mainResource.$?.title,
			files,
			mainFile: resolvedPath || mainFilePath,
			resources: resources.map((r: any) => ({
				$: {
					identifier: r.$.identifier,
					type: r.$.type,
					href: r.$.href,
				},
			})),
		};

		return json({
			success: true,
			data: packageData,
			mainXml: mainFileContent,
		});
	} catch (err) {
		console.error('Error processing QTI ZIP:', err);

		if (err instanceof Error) {
			throw error(500, err.message);
		}

		throw error(500, 'Failed to process QTI ZIP file');
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
