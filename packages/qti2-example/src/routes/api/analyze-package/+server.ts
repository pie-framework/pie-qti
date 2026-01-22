/**
 * API endpoint for analyzing all QTI items in a ZIP package
 * POST /api/analyze-package
 * Finds all assessment item files and organizes them by grade/form structure
 */

export const prerender = false;

import { error, json, type RequestEvent } from '@sveltejs/kit';
import { Readable } from 'stream';
import unzipper from 'unzipper';

interface ItemAnalysis {
	fileName: string;
	filePath: string;
	xmlContent: string;
	analysis: {
		type: 'item' | 'test' | 'passage' | 'unknown';
		identifier?: string;
		title?: string;
		interactionTypes: Record<string, number>;
		hasRubrics: boolean;
		hasStimulus: boolean;
		issues: string[];
	};
}

interface OrganizedItems {
	[grade: string]: {
		[form: string]: ItemAnalysis[];
	};
}

export async function POST({ request }: RequestEvent) {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return json({ success: false, error: 'No file provided' }, { status: 400 });
		}

		// Verify it's a ZIP file
		if (!file.name.endsWith('.zip')) {
			return json({ success: false, error: 'File must be a ZIP file' }, { status: 400 });
		}

		// Convert File to Buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Extract ZIP contents
		const files: Record<string, string> = {};
		const directory = await unzipper.Open.buffer(buffer);
		const allFiles = directory.files.filter((f) => f.type === 'File');

		// Extract all files
		for (const file of allFiles) {
			const content = await file.buffer();
			files[file.path] = content.toString('utf-8');
		}

		// Find all assessment item files
		// Pattern: files containing <assessmentItem> root element or matching Q#.xml pattern
		const itemFiles: Array<{ path: string; content: string }> = [];
		
		for (const [filePath, content] of Object.entries(files)) {
			// Skip manifest and non-XML files
			if (filePath.includes('imsmanifest.xml') || !filePath.endsWith('.xml')) {
				continue;
			}

			// Check if it's an assessment item by looking for <assessmentItem> root element
			const isAssessmentItem = /<\s*[\w]*:?assessmentItem[\s>]/i.test(content);
			
			// Also check filename pattern (Q followed by number)
			const matchesQPattern = /Q\d+\.xml$/i.test(filePath);
			
			if (isAssessmentItem || matchesQPattern) {
				itemFiles.push({ path: filePath, content });
			}
		}

		if (itemFiles.length === 0) {
			return json({
				success: true,
				items: [],
				organized: {},
				totalItems: 0,
				message: 'No assessment item files found in package',
			});
		}

		// Analyze each item file
		const analyzedItems: ItemAnalysis[] = [];
		
		for (const itemFile of itemFiles) {
			const analysis = await analyzeItemXml(itemFile.content);
			
			analyzedItems.push({
				fileName: itemFile.path.split('/').pop() || itemFile.path,
				filePath: itemFile.path,
				xmlContent: itemFile.content,
				analysis,
			});
		}

		// Organize items by grade and form
		const organized = organizeItemsByGradeAndForm(analyzedItems);

		return json({
			success: true,
			items: analyzedItems,
			organized,
			totalItems: analyzedItems.length,
			grades: Object.keys(organized),
		});
	} catch (err: any) {
		console.error('Package analysis error:', err);
		return json(
			{
				success: false,
				error: err.message || 'Failed to analyze package',
			},
			{ status: 500 }
		);
	}
}

/**
 * Organize items by grade and form based on file path structure
 * Examples:
 * - Grade 6/Amp_Grade_6_Form_dA/Q1.xml -> grade: "Grade 6", form: "Form dA"
 * - Items/qtiv2p2_G6_Form-dA_Q1.xml -> grade: "Grade 6", form: "Form dA"
 */
function organizeItemsByGradeAndForm(items: ItemAnalysis[]): OrganizedItems {
	const organized: OrganizedItems = {};

	for (const item of items) {
		const pathParts = item.filePath.split('/');
		
		// Try to extract grade and form from path
		// Look for patterns like "Grade 6", "G6", "Grade6", etc.
		let grade = 'Unknown Grade';
		let form = 'Unknown Form';
		
		// Check path parts for grade indicators
		for (const part of pathParts) {
			// Match "Grade 6", "Grade6", "G6", etc.
			const gradeMatch = part.match(/(?:Grade\s*)?(\d+)/i);
			if (gradeMatch) {
				grade = `Grade ${gradeMatch[1]}`;
				break;
			}
		}
		
		// Check filename for form pattern (Form-dA, Form_dA, Form dA, etc.)
		const formMatch = item.fileName.match(/Form[_\s-]?([a-zA-Z]+)/i);
		if (formMatch) {
			form = `Form ${formMatch[1]}`;
		} else {
			// Check path parts for form
			for (const part of pathParts) {
				const formInPath = part.match(/Form[_\s-]?([a-zA-Z]+)/i);
				if (formInPath) {
					form = `Form ${formInPath[1]}`;
					break;
				}
			}
		}
		
		// Initialize grade if needed
		if (!organized[grade]) {
			organized[grade] = {};
		}
		
		// Initialize form if needed
		if (!organized[grade][form]) {
			organized[grade][form] = [];
		}
		
		// Add item to appropriate grade/form
		organized[grade][form].push(item);
	}

	return organized;
}

/**
 * Analyze a single item XML file
 */
async function analyzeItemXml(xmlContent: string): Promise<ItemAnalysis['analysis']> {
	const result: ItemAnalysis['analysis'] = {
		type: 'unknown',
		interactionTypes: {},
		hasRubrics: false,
		hasStimulus: false,
		issues: [],
	};

	try {
		// Check root element
		const rootElementMatch = xmlContent.match(/<\s*([\w:]+)[\s>]/);
		const rootElementLower = rootElementMatch?.[1]?.toLowerCase() || '';

		if (rootElementLower === 'assessmentitem' || rootElementLower.endsWith(':assessmentitem')) {
			result.type = 'item';
			
			// Extract metadata
			const identifierMatch = xmlContent.match(/<[\w]*:?assessmentItem[^>]*identifier=["']([^"']+)["']/i);
			const titleMatch = xmlContent.match(/<[\w]*:?title[^>]*>([^<]+)<\/[\w]*:?title>/i);

			result.identifier = identifierMatch ? identifierMatch[1] : undefined;
			result.title = titleMatch ? titleMatch[1].trim() : undefined;

			// Check for itemBody
			const itemBodyPattern = /<[\w]*:?itemBody[\s>]/i;
			const hasItemBody = itemBodyPattern.test(xmlContent);
			
			if (hasItemBody) {
				const itemBodyMatch = xmlContent.match(/<[\w]*:?itemBody[^>]*>([\s\S]*?)<\/[\w]*:?itemBody>/i);
				const itemBodyContent = itemBodyMatch ? itemBodyMatch[1] : xmlContent;

				// Detect interaction types
				const interactions = [
					'choiceInteraction', 'extendedTextInteraction', 'textEntryInteraction',
					'orderInteraction', 'matchInteraction', 'associateInteraction',
					'gapMatchInteraction', 'inlineChoiceInteraction', 'hotspotInteraction',
					'graphicGapMatchInteraction', 'selectPointInteraction', 'graphicOrderInteraction',
					'graphicAssociateInteraction', 'sliderInteraction', 'mediaInteraction',
					'positionObjectInteraction', 'drawingInteraction', 'uploadInteraction',
					'customInteraction',
				];

				for (const interactionType of interactions) {
					const regex = new RegExp(`<[\\w]*:?${interactionType}[\\s>][\\s\\S]*?<\\/[\\w]*:?${interactionType}>|<[\\w]*:?${interactionType}[\\s>][^>]*\\/>`, 'gi');
					const matches = itemBodyContent.match(regex);
					if (matches) {
						result.interactionTypes[interactionType] = matches.length;
					}
				}

				// Detect stimulus
				const stimulusPattern = /<[\w]*:?stimulus[\s>]/i;
				if (stimulusPattern.test(itemBodyContent)) {
					result.hasStimulus = true;
				}
			} else {
				result.issues.push('No itemBody found');
			}

			// Detect rubrics
			const rubricPattern = /<[\w]*:?rubricBlock[\s>]/i;
			if (rubricPattern.test(xmlContent)) {
				result.hasRubrics = true;
			}
		} else {
			result.issues.push(`Unexpected root element: ${rootElementMatch?.[1] || 'unknown'}`);
		}
	} catch (parseError: any) {
		result.issues.push(`Failed to parse: ${parseError.message}`);
	}

	return result;
}
