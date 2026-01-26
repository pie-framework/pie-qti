/**
 * Parser factory for creating version-appropriate QTI parsers.
 *
 * This module provides a unified entry point for detecting QTI version
 * and creating appropriate element name mappers.
 */

import { detectQtiVersion, type QtiVersion } from './version-detection/detectQtiVersion.js';
import { Qti2xElementNameMapper } from './element-mapper/Qti2xElementNameMapper.js';
import { Qti3ElementNameMapper } from './element-mapper/Qti3ElementNameMapper.js';
import type { ElementNameMapper } from './element-mapper/ElementNameMapper.js';

/**
 * Result of creating a QTI parser.
 */
export interface QtiParserResult {
	/**
	 * Detected or specified QTI version
	 */
	version: QtiVersion;

	/**
	 * Element name mapper appropriate for the detected version
	 */
	mapper: ElementNameMapper;
}

/**
 * Options for creating a QTI parser.
 */
export interface CreateParserOptions {
	/**
	 * Override automatic version detection.
	 * If not provided, version will be detected from XML content.
	 */
	version?: QtiVersion;

	/**
	 * Custom element name mapper to use.
	 * If provided, overrides automatic mapper selection.
	 */
	mapper?: ElementNameMapper;
}

/**
 * Create a QTI parser with appropriate element name mapper for the given XML.
 *
 * This function automatically detects the QTI version and returns the appropriate
 * element name mapper. It can be used as the primary entry point for parsing
 * any QTI content.
 *
 * @param xml - QTI XML content as string
 * @param options - Optional configuration
 * @returns Parser result with version and mapper
 *
 * @example
 * ```typescript
 * // Auto-detect version and create appropriate parser
 * const { version, mapper } = createQtiParser(xml);
 * console.log(`Detected QTI ${version}`);
 *
 * // Use with qti-processing
 * const program = buildResponseProcessingAst(responseProcessing, { elementNameMapper: mapper });
 *
 * // Use with item-player
 * const player = new Player(xml, { elementNameMapper: mapper });
 * ```
 *
 * @example
 * ```typescript
 * // Force specific version
 * const { mapper } = createQtiParser(xml, { version: '3.0' });
 * ```
 */
export function createQtiParser(xml: string, options?: CreateParserOptions): QtiParserResult {
	// Use custom mapper if provided
	if (options?.mapper) {
		const version = options.version ?? detectQtiVersion(xml);
		return {
			version,
			mapper: options.mapper,
		};
	}

	// Detect or use specified version
	const version = options?.version ?? detectQtiVersion(xml);

	// Create appropriate mapper based on version
	const mapper = createMapperForVersion(version);

	return {
		version,
		mapper,
	};
}

/**
 * Create element name mapper for a specific QTI version.
 *
 * @param version - QTI version
 * @returns Element name mapper for the version
 *
 * @example
 * ```typescript
 * const qti2Mapper = createMapperForVersion('2.2');
 * const qti3Mapper = createMapperForVersion('3.0');
 * ```
 */
export function createMapperForVersion(version: QtiVersion): ElementNameMapper {
	switch (version) {
		case '2.0':
		case '2.1':
		case '2.2':
			return new Qti2xElementNameMapper();

		case '3.0':
			return new Qti3ElementNameMapper();

		case 'unknown':
		default:
			// Default to QTI 2.x mapper for unknown versions
			// (most existing content is QTI 2.x)
			return new Qti2xElementNameMapper();
	}
}

/**
 * Check if XML content is QTI 3.0.
 *
 * Convenience function for quickly checking if content uses QTI 3.0.
 *
 * @param xml - QTI XML content
 * @returns true if QTI 3.0, false otherwise
 *
 * @example
 * ```typescript
 * if (isQti3(xml)) {
 *   console.log('This is QTI 3.0 content');
 * }
 * ```
 */
export function isQti3(xml: string): boolean {
	return detectQtiVersion(xml) === '3.0';
}

/**
 * Check if XML content is QTI 2.x (2.0, 2.1, or 2.2).
 *
 * @param xml - QTI XML content
 * @returns true if QTI 2.x, false otherwise
 *
 * @example
 * ```typescript
 * if (isQti2(xml)) {
 *   console.log('This is QTI 2.x content');
 * }
 * ```
 */
export function isQti2(xml: string): boolean {
	const version = detectQtiVersion(xml);
	return version === '2.0' || version === '2.1' || version === '2.2';
}
