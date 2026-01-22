/**
 * ExampleCorp Vendor Plugin
 *
 * This plugin demonstrates vendor-specific QTI transformation with:
 * - Custom metadata extraction
 * - Partial credit scoring
 * - Enhanced feedback (hints, explanations)
 * - Standards alignment
 */

import type {
	TransformPlugin,
	TransformContext,
	TransformInput,
	TransformOutput,
	TransformOutputItem,
	ValidationResult,
} from '@pie-qti/transform-types';
import { ErrorCategory } from '@pie-qti/transform-types';

interface ExampleCorpMetadata {
	contentId?: string;
	subject?: string;
	grade?: string;
	difficulty?: string;
	standards?: string[];
	author?: string;
	createdAt?: string;
}

interface PartialCreditChoice {
	identifier: string;
	credit: number;
	rationale?: string;
}

interface ExampleCorpFeedback {
	hints?: string[];
	explanation?: string;
}

export class ExampleCorpPlugin implements TransformPlugin {
	readonly id = 'vendor-examplecorp';
	readonly version = '0.1.0';
	readonly name = 'ExampleCorp QTI Plugin';
	readonly sourceFormat = 'qti22';
	readonly targetFormat = 'pie';
	readonly priority = 550;

	/**
	 * Check if this plugin can handle the input content
	 * Looks for ExampleCorp-specific markers in the XML
	 */
	async canHandle(input: TransformInput): Promise<boolean> {
		const content =
			typeof input.content === 'string'
				? input.content
				: JSON.stringify(input.content);

		const hasExampleCorpNamespace = content.includes('xmlns:examplecorp=');
		const hasExampleCorpMetadata = content.includes('<examplecorp:metadata');
		const hasExampleCorpGenerator = content.includes('ExampleCorp QTI Creator');

		return (
			hasExampleCorpNamespace ||
			hasExampleCorpMetadata ||
			hasExampleCorpGenerator
		);
	}

	/**
	 * Extract ExampleCorp metadata from QTI XML
	 */
	private extractMetadata(content: string): ExampleCorpMetadata {
		const metadata: ExampleCorpMetadata = {};

		// Extract contentId
		const contentIdMatch = content.match(
			/<examplecorp:contentId>([^<]+)<\/examplecorp:contentId>/
		);
		if (contentIdMatch) metadata.contentId = contentIdMatch[1];

		// Extract subject
		const subjectMatch = content.match(
			/<examplecorp:subject>([^<]+)<\/examplecorp:subject>/
		);
		if (subjectMatch) metadata.subject = subjectMatch[1];

		// Extract grade
		const gradeMatch = content.match(
			/<examplecorp:grade>([^<]+)<\/examplecorp:grade>/
		);
		if (gradeMatch) metadata.grade = gradeMatch[1];

		// Extract difficulty
		const difficultyMatch = content.match(
			/<examplecorp:difficulty>([^<]+)<\/examplecorp:difficulty>/
		);
		if (difficultyMatch) metadata.difficulty = difficultyMatch[1];

		// Extract standards
		const standardMatches = content.matchAll(
			/<examplecorp:standard>([^<]+)<\/examplecorp:standard>/g
		);
		metadata.standards = Array.from(standardMatches, (m) => m[1]);

		// Extract author
		const authorMatch = content.match(
			/<examplecorp:author>([^<]+)<\/examplecorp:author>/
		);
		if (authorMatch) metadata.author = authorMatch[1];

		// Extract createdAt
		const createdAtMatch = content.match(
			/<examplecorp:createdAt>([^<]+)<\/examplecorp:createdAt>/
		);
		if (createdAtMatch) metadata.createdAt = createdAtMatch[1];

		return metadata;
	}

	/**
	 * Extract partial credit information
	 */
	private extractPartialCredit(content: string): PartialCreditChoice[] {
		const choices: PartialCreditChoice[] = [];

		// Find all choice elements with partial credit
		const choiceRegex =
			/<examplecorp:choice\s+identifier="([^"]+)"\s+credit="([^"]+)">([\s\S]*?)<\/examplecorp:choice>/g;
		const matches = content.matchAll(choiceRegex);

		for (const match of matches) {
			const identifier = match[1];
			const credit = Number.parseFloat(match[2]);
			const innerContent = match[3];

			// Extract rationale if present
			const rationaleMatch = innerContent.match(
				/<examplecorp:rationale>([^<]+)<\/examplecorp:rationale>/
			);

			choices.push({
				identifier,
				credit,
				rationale: rationaleMatch ? rationaleMatch[1] : undefined,
			});
		}

		return choices;
	}

	/**
	 * Extract feedback (hints and explanations)
	 */
	private extractFeedback(content: string): ExampleCorpFeedback {
		const feedback: ExampleCorpFeedback = {};

		// Extract hints
		const hintMatches = content.matchAll(
			/<examplecorp:hint[^>]*>([^<]+)<\/examplecorp:hint>/g
		);
		feedback.hints = Array.from(hintMatches, (m) => m[1]);

		// Extract explanation
		const explanationMatch = content.match(
			/<examplecorp:explanation>\s*([\s\S]*?)\s*<\/examplecorp:explanation>/
		);
		if (explanationMatch) {
			feedback.explanation = explanationMatch[1].trim().replace(/\s+/g, ' ');
		}

		return feedback;
	}

	/**
	 * Extract basic QTI elements
	 */
	private extractBasicElements(content: string): {
		identifier: string;
		title: string;
		prompt: string;
		choices: Array<{ label: string; value: string }>;
		correctResponse?: string;
	} {
		// Extract identifier
		const identifierMatch = content.match(/identifier="([^"]+)"/);
		const identifier = identifierMatch ? identifierMatch[1] : 'unknown';

		// Extract title
		const titleMatch = content.match(/title="([^"]+)"/);
		const title = titleMatch ? titleMatch[1] : 'Untitled';

		// Extract prompt from itemBody
		const promptMatch = content.match(
			/<div class="prompt">\s*<p[^>]*>([\s\S]*?)<\/p>/
		);
		let prompt = 'No prompt available';
		if (promptMatch) {
			prompt = promptMatch[1]
				.replace(/<strong>(.*?)<\/strong>/g, '$1')
				.trim();
		}

		// Extract choices
		const choices: Array<{ label: string; value: string }> = [];
		const choiceMatches = content.matchAll(
			/<simpleChoice identifier="([^"]+)">([^<]+)<\/simpleChoice>/g
		);
		for (const match of choiceMatches) {
			choices.push({
				value: match[1],
				label: match[2].trim(),
			});
		}

		// Extract correct response
		const correctMatch = content.match(
			/<correctResponse>\s*<value>([^<]+)<\/value>/
		);
		const correctResponse = correctMatch ? correctMatch[1] : undefined;

		return { identifier, title, prompt, choices, correctResponse };
	}

	/**
	 * Transform ExampleCorp QTI to PIE format
	 */
	async transform(
		input: TransformInput,
		context: TransformContext
	): Promise<TransformOutput> {
		const content =
			typeof input.content === 'string'
				? input.content
				: JSON.stringify(input.content);

		context?.logger?.info('Transforming ExampleCorp QTI content', undefined, {
			vendor: 'examplecorp',
			sessionId: context.sessionId,
		});

		const startTime = Date.now();

		try {
			// Extract all components
			const basicElements = this.extractBasicElements(content);
			const metadata = this.extractMetadata(content);
			const partialCredit = this.extractPartialCredit(content);
			const feedback = this.extractFeedback(content);

			// Build PIE model with ExampleCorp enhancements
			const pieModel = {
				id: basicElements.identifier,
				element: 'multiple-choice',
				prompt: basicElements.prompt,
				promptEnabled: true,
				choiceMode: 'radio',
				choices: basicElements.choices.map((choice) => {
					const creditInfo = partialCredit.find(
						(pc) => pc.identifier === choice.value
					);
					return {
						label: choice.label,
						value: choice.value,
						correct: choice.value === basicElements.correctResponse,
						// ExampleCorp enhancement: partial credit
						...(creditInfo && {
							partialCredit: creditInfo.credit,
							rationale: creditInfo.rationale,
						}),
					};
				}),
				// ExampleCorp enhancements
				feedback: {
					type: 'default',
					...(feedback.hints && feedback.hints.length > 0 && { hints: feedback.hints }),
					...(feedback.explanation && { explanation: feedback.explanation }),
				},
				// Preserve vendor metadata
				vendorMetadata: {
					vendor: 'examplecorp',
					originalFormat: 'qti22',
					title: basicElements.title,
					...metadata,
					hasPartialCredit: partialCredit.length > 0,
					hasHints: (feedback.hints?.length || 0) > 0,
					hasExplanation: !!feedback.explanation,
					processedAt: new Date().toISOString(),
				},
			};

			const processingTime = Date.now() - startTime;

			const outputItem: TransformOutputItem = {
				content: pieModel,
				format: this.targetFormat,
			};

			return {
				items: [outputItem],
				format: this.targetFormat,
				metadata: {
					sourceFormat: this.sourceFormat,
					targetFormat: this.targetFormat,
					pluginId: this.id,
					timestamp: new Date(),
					itemCount: 1,
					processingTime,
				},
			};
		} catch (error) {
			const processingTime = Date.now() - startTime;

			return {
				items: [],
				format: this.targetFormat,
				metadata: {
					sourceFormat: this.sourceFormat,
					targetFormat: this.targetFormat,
					pluginId: this.id,
					timestamp: new Date(),
					itemCount: 0,
					processingTime,
				},
				errors: [
					{
						message: error instanceof Error ? error.message : 'Unknown error',
						code: 'TRANSFORM_ERROR',
						category: ErrorCategory.INTERNAL,
						recoverable: false,
						fatal: true,
						cause: error instanceof Error ? error : undefined,
					},
				],
			};
		}
	}

	/**
	 * Validate PIE output
	 */
	async validate(output: TransformOutput): Promise<ValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!output.items || output.items.length === 0) {
			errors.push('No items in output');
			return { valid: false, errors };
		}

		for (const item of output.items) {
			const content = item.content as any;

			if (!content) {
				errors.push('Item has no content');
				continue;
			}

			// Validate required fields
			if (!content.id) errors.push('Item missing id');
			if (!content.element) errors.push('Item missing element type');
			if (!content.prompt) warnings.push('Item missing prompt');
			if (!content.choices || content.choices.length === 0) {
				errors.push('Item has no choices');
			}

			// Validate vendor metadata
			if (!content.vendorMetadata?.vendor) {
				warnings.push('Vendor metadata not preserved');
			}

			// Validate choices
			if (content.choices) {
				const hasCorrect = content.choices.some((c: any) => c.correct);
				if (!hasCorrect) {
					warnings.push('No correct answer marked');
				}

				// Check for partial credit consistency
				const hasPartialCredit = content.choices.some(
					(c: any) => c.partialCredit !== undefined
				);
				if (
					hasPartialCredit &&
					!content.choices.every((c: any) => c.partialCredit !== undefined)
				) {
					warnings.push('Partial credit not defined for all choices');
				}
			}
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	}
}

/**
 * Factory function for creating the plugin
 */
export default function createExampleCorpPlugin(
	_config?: Record<string, unknown>
): TransformPlugin {
	return new ExampleCorpPlugin();
}
