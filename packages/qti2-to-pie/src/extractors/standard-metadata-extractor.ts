/**
 * Standard Metadata Extractor
 *
 * Extracts standard QTI metadata using environment-agnostic utilities from @pie-qti/ims-cp-core.
 * This serves as the default metadata extractor and can be overridden by vendor-specific extractors.
 */

import type { MetadataExtractor, VendorInfo } from '../types/vendor-extensions.js';
import type { HTMLElement } from 'node-html-parser';
import {
	extractTitleFromQtiXml,
	extractIdentifierFromQtiXml,
	extractSearchMetadataFromQtiXml,
	extractInteractionTypesFromQtiXml,
} from '@pie-qti/ims-cp-core';

/**
 * Standard QTI metadata extractor
 *
 * Uses shared utilities from @pie-qti/ims-cp-core to extract:
 * - title
 * - identifier
 * - searchMetadata (from PIE extension or qti-metadata section)
 * - interactionTypes (detected interaction elements)
 *
 * This extractor has vendor: 'standard' and should run with low priority
 * so vendor-specific extractors can override it.
 */
export class StandardMetadataExtractor implements MetadataExtractor {
	readonly vendor = 'standard';

	/**
	 * Extract standard QTI metadata
	 *
	 * @param qtiXml Raw QTI XML string
	 * @param _parsedDoc Parsed HTML document (not used, we use qtiXml directly)
	 * @param _vendorInfo Detected vendor information (not used for standard extraction)
	 * @returns Standard metadata object
	 */
	extract(qtiXml: string, _parsedDoc: HTMLElement, _vendorInfo: VendorInfo): Record<string, any> {
		return {
			title: extractTitleFromQtiXml(qtiXml),
			identifier: extractIdentifierFromQtiXml(qtiXml),
			searchMetadata: extractSearchMetadataFromQtiXml(qtiXml),
			interactionTypes: extractInteractionTypesFromQtiXml(qtiXml),
		};
	}
}

/**
 * Create standard metadata extractor instance
 *
 * @returns StandardMetadataExtractor instance
 */
export function createStandardMetadataExtractor(): StandardMetadataExtractor {
	return new StandardMetadataExtractor();
}
