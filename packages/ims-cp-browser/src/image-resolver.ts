/**
 * Image resolution utilities for QTI packages
 *
 * Handles resolving image references in QTI XML and converting them to data URLs
 * for display in browsers. This is a core package concern since all QTI content
 * displayed in browsers needs image resolution.
 */

import {
	buildPackageFileIndex,
	decodeXmlAttribute,
	parseSrcsetCandidates,
	resolvePackageReference,
	type QtiHeuristicsConfig,
} from '@pie-qti/ims-cp-core';
import type { VirtualPackage } from './virtual-package.js';

/**
 * Get MIME type from file path extension
 */
function getMimeType(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase() || '';
	const mimeTypes: Record<string, string> = {
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'png': 'image/png',
		'gif': 'image/gif',
		'svg': 'image/svg+xml',
		'webp': 'image/webp',
	};
	return mimeTypes[ext] ?? '';
}

function isSupportedImagePath(path: string): boolean {
	return Boolean(getMimeType(path));
}

/**
 * Convert Blob to data URL with correct MIME type
 */
async function blobToDataUrl(blob: Blob, filePath: string): Promise<string> {
	const correctMimeType = getMimeType(filePath);
	if (typeof FileReader === 'undefined') {
		const bytes = new Uint8Array(await blob.arrayBuffer());
		let binary = '';
		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}
		return `data:${correctMimeType};base64,${btoa(binary)}`;
	}
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			let dataUrl = reader.result as string;

			// Replace incorrect MIME types (e.g., application/octet-stream)
			if (dataUrl.startsWith('data:application/octet-stream') ||
			    !dataUrl.startsWith(`data:${correctMimeType}`)) {
				dataUrl = dataUrl.replace(/^data:[^;]+/, `data:${correctMimeType}`);
			}

			// Ensure no spaces in data URL format
			dataUrl = dataUrl.replace(/; /g, ';');
			resolve(dataUrl);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

/**
 * Try multiple strategies to resolve an image path
 * Returns an array of possible paths to try in order
 *
 * @param imagePath The image path from the XML (may be relative or absolute)
 * @param itemDir The directory containing the item file
 * @returns Array of resolved paths to try
 * @deprecated Use `buildPackageFileIndex` and `resolvePackageReference` from
 * `@pie-qti/ims-cp-core` so resolution follows the shared safety/provenance rules.
 */
export function tryResolveImagePath(imagePath: string, itemDir: string): string[] {
	// Remove query strings and fragments
	const cleanPath = imagePath.split('?')[0].split('#')[0];

	// If it's a data URL, return as-is (no resolution needed)
	if (cleanPath.startsWith('data:')) {
		return [cleanPath];
	}

	const pathsToTry: string[] = [];

	// Strategy 1: If it's already an absolute path (starts with /), use it as-is
	if (cleanPath.startsWith('/')) {
		pathsToTry.push(cleanPath.substring(1)); // Remove leading slash for package paths
		pathsToTry.push(cleanPath); // Also try with leading slash
	}

	// Strategy 2: Resolve relative to item directory
	const parts = cleanPath.split('/');
	const dirParts = itemDir.split('/').filter(p => p);

	for (const part of parts) {
		if (part === '..') {
			if (dirParts.length > 0) {
				dirParts.pop();
			}
		} else if (part !== '.' && part !== '') {
			dirParts.push(part);
		}
	}

	const relativePath = dirParts.join('/');
	pathsToTry.push(relativePath);

	// Strategy 3: Try with just the filename in the same directory as item
	const filename = cleanPath.substring(cleanPath.lastIndexOf('/') + 1);
	if (filename && filename !== cleanPath) {
		pathsToTry.push(itemDir + filename);
	}

	// Strategy 4: Try in an 'images' subdirectory relative to item
	if (filename && filename !== cleanPath) {
		pathsToTry.push(itemDir + 'images/' + filename);
	}

	// Strategy 5: Try root-level images directory
	if (filename && filename !== cleanPath) {
		pathsToTry.push('images/' + filename);
	}

	// Strategy 6: Try just the filename at root
	if (filename && filename !== cleanPath) {
		pathsToTry.push(filename);
	}

	// Remove duplicates and return
	return [...new Set(pathsToTry)];
}

/**
 * Logger interface compatible with @pie-qti/browser-utils Logger
 */
export interface LoggerLike {
	debug: (message: string, ...args: any[]) => void;
	warn: (message: string, ...args: any[]) => void;
}

/**
 * Options for image resolution
 */
export interface ResolveImagesOptions {
	/**
	 * Optional logger for debug/warning messages
	 * Compatible with @pie-qti/browser-utils Logger
	 */
	logger?: LoggerLike;

	/**
	 * Optional heuristics configuration
	 * Controls whether to use lenient image path resolution for non-standard QTI content
	 */
	heuristicsConfig?: QtiHeuristicsConfig;
}

/**
 * Resolve image references in QTI XML and replace with data URLs from package
 *
 * Finds all <object data="..."> and <img src="..."> tags in the XML and replaces
 * their image paths with data URLs from the package.
 *
 * @param itemXml The QTI item XML string
 * @param pkg VirtualPackage instance containing the images
 * @param itemHref The href path of the item file (used for resolving relative paths)
 * @param options Optional configuration
 * @returns Modified XML string with image references replaced with data URLs
 */
export async function resolveImagesInXml(
	itemXml: string,
	pkg: VirtualPackage,
	itemHref: string,
	options: ResolveImagesOptions = {}
): Promise<string> {
	const { logger } = options;
	const heuristicsConfig = normalizeImageHeuristicsConfig(options.heuristicsConfig);

	// Check if lenient image path resolution is enabled
	const useLenientPaths = heuristicsConfig.enabled !== false && heuristicsConfig.lenientImagePaths !== false;

	if (useLenientPaths) {
		logger?.debug(
			'[QTI Heuristic] Using lenient image path resolution. ' +
			'Will try multiple path strategies for images that do not follow strict relative path conventions.'
		);
	}

	const fileIndex = buildPackageFileIndex([...pkg.files.keys()]);
	logger?.debug(`[Image Resolution] Available package files (${pkg.files.size})`, [...pkg.files.keys()]);

	/**
	 * Resolve a single image reference
	 */
	const resolveImageReference = async (
		imagePath: string,
		tag: string,
		attr: string
	): Promise<ImageRewriteDecision> => {
		const resolution = resolvePackageReference({
			fileIndex,
			sourcePath: itemHref,
			rawHref: imagePath,
			referenceKind: 'media-asset',
			heuristicsConfig,
		});

		if (resolution.status !== 'resolved') {
			logger?.warn(
				`[QTI Heuristic] Could not resolve image reference: ${imagePath}`,
				{ status: resolution.status, diagnostics: resolution.diagnostics }
			);
			return { action: resolution.status === 'skipped' && isAllowedRawUrl(imagePath, tag, attr) ? 'preserve' : 'remove' };
		}

		const file = pkg.getFile(resolution.resolvedPath);
		if (!file) {
			logger?.warn(`Resolved image path is not readable: ${resolution.resolvedPath}`);
			return { action: 'remove' };
		}
		if (!isSupportedImagePath(resolution.resolvedPath)) {
			if (tag === 'object' && attr === 'data') {
				return { action: 'preserve' };
			}
			logger?.warn(`Resolved image file is not a supported image type: ${resolution.resolvedPath}`);
			return { action: 'remove' };
		}
		if (file.type === 'binary') {
			const blob = file.content as Blob;
			try {
				const dataUrl = await blobToDataUrl(blob, resolution.resolvedPath);
				logger?.debug(`✓ Resolved image: ${imagePath} -> ${resolution.resolvedPath}`);
				return { action: 'replace', value: dataUrl };
			} catch (err) {
				logger?.warn(`Failed to convert blob to data URL for: ${resolution.resolvedPath}`, err);
			}
		}
		if (file.type === 'text' && resolution.resolvedPath.toLowerCase().endsWith('.svg')) {
			const resolvedUrl = svgTextToBrowserUrl(file.content as string);
			logger?.debug(`✓ Resolved SVG (text): ${imagePath} -> ${resolution.resolvedPath}`);
			return { action: 'replace', value: resolvedUrl };
		}

		logger?.warn(`Resolved image file is not a supported image type: ${resolution.resolvedPath}`);
		return { action: 'remove' };
	};

	return rewriteImageReferences(itemXml, resolveImageReference);
}

function svgTextToBrowserUrl(svg: string): string {
	if (
		typeof window !== 'undefined' &&
		typeof URL !== 'undefined' &&
		typeof URL.createObjectURL === 'function' &&
		typeof Blob !== 'undefined'
	) {
		return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	}
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function normalizeImageHeuristicsConfig(config: QtiHeuristicsConfig | undefined): QtiHeuristicsConfig {
	if (config?.lenientImagePaths === false) {
		return {
			...config,
			lenientPackageResourcePaths: false,
			lenientAssetBasenames: false,
		};
	}
	return config ?? { enabled: true, lenientImagePaths: true };
}

const IMAGE_TAG_PATTERN = /<(?<tag>object|img|video)\b(?<attrs>(?:[^>"']+|"[^"]*"|'[^']*')*)>/gis;
const IMAGE_ATTRIBUTE_PATTERN = /\s(?<attr>data|srcset|src|poster)\s*=\s*(?<quote>["'])(?<value>.*?)\k<quote>/gis;

type ImageRewriteDecision =
	| { action: 'replace'; value: string }
	| { action: 'remove' }
	| { action: 'preserve' };

async function rewriteImageReferences(
	xml: string,
	resolveImageReference: (imagePath: string, tag: string, attr: string) => Promise<ImageRewriteDecision>
): Promise<string> {
	let output = '';
	let lastIndex = 0;
	for (const match of xml.matchAll(IMAGE_TAG_PATTERN)) {
		const rawTag = match.groups?.tag ?? '';
		const tag = rawTag.toLowerCase();
		const attrs = match.groups?.attrs ?? '';
		const start = match.index ?? 0;
		output += xml.slice(lastIndex, start);
		lastIndex = start + match[0].length;

		output += `<${rawTag}${await rewriteTagAttributes(tag, attrs, resolveImageReference)}>`;
	}
	output += xml.slice(lastIndex);
	return output;
}

async function rewriteTagAttributes(
	tag: string,
	attrs: string,
	resolveImageReference: (imagePath: string, tag: string, attr: string) => Promise<ImageRewriteDecision>
): Promise<string> {
	let output = '';
	let lastIndex = 0;
	for (const match of attrs.matchAll(IMAGE_ATTRIBUTE_PATTERN)) {
		const attr = match.groups?.attr.toLowerCase() ?? '';
		const value = decodeXmlAttribute(match.groups?.value ?? '');
		const start = match.index ?? 0;
		output += attrs.slice(lastIndex, start);
		lastIndex = start + match[0].length;

		if (!isImageRewriteAttribute(tag, attr)) {
			output += match[0];
			continue;
		}
		if (attr === 'srcset') {
			const rewritten = await rewriteSrcsetAttribute(value, resolveImageReference);
			if (rewritten) {
				output += ` ${attr}="${escapeAttribute(rewritten)}"`;
			}
			continue;
		}
		if (isSchemeUrl(value)) {
			if (isAllowedRawUrl(value, tag, attr)) {
				output += match[0];
			}
			continue;
		}

		const decision = await resolveImageReference(value, tag, attr);
		if (decision.action === 'preserve') {
			output += match[0];
		} else if (decision.action === 'replace') {
			output += ` ${attr}="${escapeAttribute(decision.value)}"`;
		}
	}
	output += attrs.slice(lastIndex);
	return output;
}

function isImageRewriteAttribute(tag: string, attr: string): boolean {
	return (
		(tag === 'img' && (attr === 'src' || attr === 'srcset')) ||
		(tag === 'object' && attr === 'data') ||
		(tag === 'video' && attr === 'poster')
	);
}

async function rewriteSrcsetAttribute(
	value: string,
	resolveImageReference: (imagePath: string, tag: string, attr: string) => Promise<ImageRewriteDecision>
): Promise<string | null> {
	const rewritten: string[] = [];
	for (const candidate of parseSrcsetCandidates(value)) {
		const decodedUrl = decodeXmlAttribute(candidate.url);
		if (isSchemeUrl(decodedUrl)) {
			if (isAllowedRawUrl(decodedUrl, 'img', 'src')) {
				rewritten.push(candidate.raw);
			}
			continue;
		}
		const decision = await resolveImageReference(decodedUrl, 'img', 'src');
		if (decision.action === 'replace') {
			rewritten.push([decision.value, candidate.descriptors].filter(Boolean).join(' '));
		} else if (decision.action === 'preserve') {
			rewritten.push(candidate.raw);
		}
	}
	return rewritten.length > 0 ? rewritten.join(', ') : null;
}

function isSchemeUrl(value: string): boolean {
	return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value.trim());
}

function isAllowedRawUrl(value: string, tag: string, attr: string): boolean {
	const trimmed = value.trim();
	if ((tag === 'img' || tag === 'video') && (attr === 'src' || attr === 'poster') && /^data:image\/(?:png|jpe?g|gif|webp)(?:[;,]|$)/i.test(trimmed)) {
		return true;
	}
	if ((tag === 'img' && attr === 'src') || (tag === 'video' && attr === 'poster') || (tag === 'object' && attr === 'data')) {
		return /^(?:https?:|blob:)/i.test(trimmed);
	}
	return false;
}

function escapeAttribute(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

