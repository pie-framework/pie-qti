/**
 * Standard QTI uploadInteraction extractor
 *
 * Extracts data from uploadInteraction elements (file upload)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Upload data extracted from uploadInteraction elements
 */
export interface UploadData {
	fileTypes: string[];
	rawAttributes: Record<string, string>;
	prompt: string | null;
}

/**
 * Standard QTI upload interaction extractor
 * Handles uploadInteraction elements (file upload)
 */
export const standardUploadExtractor: ElementExtractor<UploadData> = {
	id: 'qti:upload-interaction',
	name: 'QTI Standard Upload Interaction',
	priority: 10,
	elementTypes: ['uploadInteraction'],
	description: 'Extracts standard QTI uploadInteraction (file upload)',

	canHandle(element, _context) {
		// All uploadInteraction elements are standard
		return element.rawTagName === 'uploadInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract fileType child elements
		const fileTypeElements = utils.getChildrenByTag(element, 'fileType');
		const fileTypes = fileTypeElements.map((el) => utils.getTextContent(el));

		// Extract all attributes
		const rawAttributes: Record<string, string> = {};
		if (element.attributes) {
			for (const [key, value] of Object.entries(element.attributes)) {
				rawAttributes[key] = String(value);
			}
		}

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			fileTypes,
			rawAttributes,
			prompt,
		};
	},

	validate(data) {
		const warnings: string[] = [];

		// Warn if no file type restrictions
		if (!data.fileTypes || data.fileTypes.length === 0) {
			warnings.push('uploadInteraction has no fileTypes - any file type will be accepted');
		}

		return {
			valid: true,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
