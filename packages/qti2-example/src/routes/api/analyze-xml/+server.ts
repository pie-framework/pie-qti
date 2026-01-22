/**
 * API endpoint for analyzing QTI XML files
 * POST /api/analyze-xml
 */

export const prerender = false;

import { error, json, type RequestEvent } from '@sveltejs/kit';

interface AnalysisResult {
	success: boolean;
	type: 'item' | 'passage' | 'test' | 'manifest' | 'unknown';
	interactionTypes: Record<string, number>;
	hasRubrics: boolean;
	hasStimulus: boolean;
	issues: string[];
	rootElement?: string;
	metadata?: {
		identifier?: string;
		title?: string;
	};
	testInfo?: {
		testPartCount?: number;
		sectionCount?: number;
		itemRefCount?: number;
	};
}

export async function POST({ request }: RequestEvent) {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return json({ success: false, error: 'No file provided' }, { status: 400 });
		}

		// Verify it's an XML file
		if (!file.name.endsWith('.xml') && file.type !== 'text/xml' && file.type !== 'application/xml') {
			return json({ success: false, error: 'File must be an XML file' }, { status: 400 });
		}

		// Read file content
		const xmlContent = await file.text();

		// Analyze the XML
		const result = await analyzeXmlContent(xmlContent);

		return json({
			success: true,
			...result,
		});
	} catch (err: any) {
		console.error('Analysis error:', err);
		return json(
			{
				success: false,
				error: err.message || 'Failed to analyze XML file',
			},
			{ status: 500 }
		);
	}
}

/**
 * Analyze XML content and return analysis results
 */
async function analyzeXmlContent(xmlContent: string): Promise<AnalysisResult> {
	const result: AnalysisResult = {
		success: true,
		type: 'unknown',
		interactionTypes: {},
		hasRubrics: false,
		hasStimulus: false,
		issues: [],
	};

	try {
		// Extract root element name - this is the key to proper detection
		const rootElementMatch = xmlContent.match(/<\s*([\w:]+)[\s>]/);
		if (rootElementMatch) {
			result.rootElement = rootElementMatch[1];
		}

		// Use case-insensitive matching for XML tags (XML is case-sensitive but we want to be flexible)
		const lowerContent = xmlContent.toLowerCase();
		const originalContent = xmlContent;

		// Check root element first to avoid false matches (e.g., assessmentItemRef matching assessmentItem)
		const rootElementLower = result.rootElement?.toLowerCase() || '';

		// Check for assessment test FIRST (most specific, as it can contain assessmentItemRef)
		if (rootElementLower === 'assessmenttest' || rootElementLower.endsWith(':assessmenttest')) {
			result.type = 'test';
			analyzeAssessmentTest(originalContent, result);
			return result;
		}

		// Check for assessment item (root element only, not refs)
		if (rootElementLower === 'assessmentitem' || rootElementLower.endsWith(':assessmentitem')) {
			result.type = 'item';
			analyzeAssessmentItem(originalContent, result);
			return result;
		}

		// Check for assessment stimulus/passage
		if (
			rootElementLower === 'assessmentstimulus' ||
			rootElementLower.endsWith(':assessmentstimulus') ||
			rootElementLower === 'assessmentpassage' ||
			rootElementLower.endsWith(':assessmentpassage')
		) {
			result.type = 'passage';
			return result;
		}

		// Fallback: search content if root element check didn't work (for edge cases)
		// But be more specific to avoid false matches
		const assessmentTestPattern = /<[\w]*:?assessmentTest[\s>][^>]*>/i;
		if (assessmentTestPattern.test(originalContent) && !originalContent.match(/<[\w]*:?assessmentItemRef/i)) {
			result.type = 'test';
			analyzeAssessmentTest(originalContent, result);
			return result;
		}

		const assessmentItemPattern = /<[\w]*:?assessmentItem[\s>][^>]*>/i;
		if (assessmentItemPattern.test(originalContent) && !originalContent.match(/<[\w]*:?assessmentItemRef/i)) {
			result.type = 'item';
			analyzeAssessmentItem(originalContent, result);
			return result;
		}

		// Check for IMS Content Package manifest
		const manifestPattern = /<[\w]*:?manifest[\s>]/i;
		const hasManifest = manifestPattern.test(originalContent) || lowerContent.includes('<manifest');
		
		if (hasManifest) {
			result.type = 'manifest';
			result.issues.push('This appears to be an IMS Content Package manifest file. Please drop the actual QTI item/test XML file (usually found in an Items folder).');
			return result;
		}

		// Provide helpful error message with what was found
		if (result.rootElement) {
			result.issues.push(
				`No recognized QTI element found. Root element is "${result.rootElement}". ` +
				`Expected one of: assessmentItem, assessmentStimulus, assessmentPassage, or assessmentTest. ` +
				`If this is a package manifest, please drop the actual QTI XML file from the Items folder.`
			);
		} else {
			result.issues.push(
				'No recognized QTI element found (assessmentItem, assessmentStimulus, assessmentPassage, or assessmentTest). ' +
				'If this is a package manifest, please drop the actual QTI XML file from the Items folder.'
			);
		}
	} catch (parseError: any) {
		result.issues.push(`Failed to parse XML: ${parseError.message}`);
	}

	return result;
}

/**
 * Analyze an assessment item using text-based parsing
 */
function analyzeAssessmentItem(xmlContent: string, result: AnalysisResult): void {
	// Extract metadata using regex (handle namespaced and non-namespaced)
	// Match: <assessmentItem identifier="...", <qti:assessmentItem identifier="...", etc.
	const identifierMatch = xmlContent.match(/<[\w]*:?assessmentItem[^>]*identifier=["']([^"']+)["']/i);
	const titleMatch = xmlContent.match(/<[\w]*:?title[^>]*>([^<]+)<\/[\w]*:?title>/i);

	result.metadata = {
		identifier: identifierMatch ? identifierMatch[1] : undefined,
		title: titleMatch ? titleMatch[1].trim() : undefined,
	};

	// Check for itemBody (handle namespaced)
	const itemBodyPattern = /<[\w]*:?itemBody[\s>]/i;
	const hasItemBody = itemBodyPattern.test(xmlContent);
	if (!hasItemBody) {
		result.issues.push('No itemBody found in assessmentItem');
		return;
	}

	// Extract itemBody content (between <itemBody> and </itemBody>, handle namespaced)
	const itemBodyMatch = xmlContent.match(/<[\w]*:?itemBody[^>]*>([\s\S]*?)<\/[\w]*:?itemBody>/i);
	const itemBodyContent = itemBodyMatch ? itemBodyMatch[1] : xmlContent;

	// Detect interaction types using regex
	const interactions = [
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

	for (const interactionType of interactions) {
		// Match both self-closing and full tags, handle namespaced (e.g., <qti:choiceInteraction>)
		// Match: <choiceInteraction>, <qti:choiceInteraction>, etc.
		const regex = new RegExp(`<[\\w]*:?${interactionType}[\\s>][\\s\\S]*?<\\/[\\w]*:?${interactionType}>|<[\\w]*:?${interactionType}[\\s>][^>]*\\/>`, 'gi');
		const matches = itemBodyContent.match(regex);
		if (matches) {
			result.interactionTypes[interactionType] = matches.length;
		}
	}

	// Detect stimulus (handle namespaced)
	const stimulusPattern = /<[\w]*:?stimulus[\s>]/i;
	const hasStimulus = stimulusPattern.test(itemBodyContent);
	if (hasStimulus) {
		result.hasStimulus = true;
	}

	// Detect rubrics (can be anywhere in the item, not just itemBody, handle namespaced)
	const rubricPattern = /<[\w]*:?rubricBlock[\s>]/i;
	const hasRubrics = rubricPattern.test(xmlContent);
	if (hasRubrics) {
		result.hasRubrics = true;
	}
}

/**
 * Analyze an assessment test using text-based parsing
 */
function analyzeAssessmentTest(xmlContent: string, result: AnalysisResult): void {
	// Extract test metadata (from root assessmentTest element)
	const identifierMatch = xmlContent.match(/<[\w]*:?assessmentTest[^>]*identifier=["']([^"']+)["']/i);
	const titleMatch = xmlContent.match(/<[\w]*:?assessmentTest[^>]*title=["']([^"']+)["']/i);

	result.metadata = {
		identifier: identifierMatch ? identifierMatch[1] : undefined,
		title: titleMatch ? titleMatch[1].trim() : undefined,
	};

	// Count test parts
	const testPartMatches = xmlContent.match(/<[\w]*:?testPart[\s>]/gi);
	const testPartCount = testPartMatches ? testPartMatches.length : 0;

	// Count assessment sections
	const sectionMatches = xmlContent.match(/<[\w]*:?assessmentSection[\s>]/gi);
	const sectionCount = sectionMatches ? sectionMatches.length : 0;

	// Count item references
	const itemRefMatches = xmlContent.match(/<[\w]*:?assessmentItemRef[\s>]/gi);
	const itemRefCount = itemRefMatches ? itemRefMatches.length : 0;

	result.testInfo = {
		testPartCount,
		sectionCount,
		itemRefCount,
	};

	// Detect rubrics in test sections
	const rubricPattern = /<[\w]*:?rubricBlock[\s>]/i;
	const hasRubrics = rubricPattern.test(xmlContent);
	if (hasRubrics) {
		result.hasRubrics = true;
	}

	// Tests don't have interactions directly - they reference items
	if (itemRefCount === 0) {
		result.issues.push('No assessmentItemRef elements found in test');
	}
}
