import type { HTMLElement } from 'node-html-parser';
import { transformAssessmentTest } from '../transformers/assessment-test.js';
import { transformAssociateToCategorize } from '../transformers/associate-to-categorize.js';
import { transformDragInTheBlank } from '../transformers/drag-in-the-blank.js';
import { transformEbsr } from '../transformers/ebsr.js';
import { transformExplicitConstructedResponse } from '../transformers/explicit-constructed-response.js';
import { transformExtendedResponse } from '../transformers/extended-response.js';
import { transformHotspot } from '../transformers/hotspot.js';
import { transformImageClozeAssociation } from '../transformers/image-cloze-association.js';
import { transformInlineDropdown } from '../transformers/inline-dropdown.js';
import { transformMatch } from '../transformers/match.js';
import { transformMatchList } from '../transformers/match-list.js';
import { transformMultipleChoice } from '../transformers/multiple-choice.js';
import { transformPassage } from '../transformers/passage.js';
import { transformPlacementOrdering } from '../transformers/placement-ordering.js';
import { transformSelectText } from '../transformers/select-text.js';

export type BuiltInTransformKind = 'pie-item' | 'assessment';

export interface BuiltInTransformContext {
	interactionType: string;
	qtiXml: string;
	itemId: string;
	assessmentItem?: HTMLElement;
	baseId?: string;
	logger?: { warn?(message: string): void; info?(message: string): void };
}

export interface BuiltInTransformResult {
	kind: BuiltInTransformKind;
	content: any;
	itemCount?: number;
}

export interface QtiBuiltInTransformHandler {
	id: string;
	interactionTypes: readonly string[];
	transform(context: BuiltInTransformContext): Promise<BuiltInTransformResult> | BuiltInTransformResult;
}

export interface BuiltInTransformDelegate {
	transformWithBuiltIn(
		handlerId: string,
		overrides?: Partial<BuiltInTransformContext>
	): Promise<BuiltInTransformResult>;
}

export class QtiToPieRegistry {
	private readonly handlers = new Map<string, QtiBuiltInTransformHandler>();
	private readonly interactionIndex = new Map<string, QtiBuiltInTransformHandler>();

	register(handler: QtiBuiltInTransformHandler): void {
		this.handlers.set(handler.id, handler);
		for (const interactionType of handler.interactionTypes) {
			this.interactionIndex.set(interactionType, handler);
		}
	}

	getHandlerForInteraction(interactionType: string): QtiBuiltInTransformHandler | undefined {
		return this.interactionIndex.get(interactionType);
	}

	getHandler(handlerId: string): QtiBuiltInTransformHandler | undefined {
		return this.handlers.get(handlerId);
	}

	async transform(context: BuiltInTransformContext): Promise<BuiltInTransformResult> {
		const handler = this.getHandlerForInteraction(context.interactionType);
		if (!handler) {
			throw new Error(`Unsupported interaction type: ${context.interactionType}`);
		}
		return handler.transform(context);
	}

	createDelegate(context: BuiltInTransformContext): BuiltInTransformDelegate {
		return {
			transformWithBuiltIn: async (handlerId, overrides) => {
				const handler = this.getHandler(handlerId);
				if (!handler) {
					throw new Error(`Unknown built-in QTI transform handler: ${handlerId}`);
				}
				return handler.transform({ ...context, ...overrides });
			},
		};
	}
}

export function createDefaultQtiToPieRegistry(): QtiToPieRegistry {
	const registry = new QtiToPieRegistry();

	registry.register({
		id: 'builtin.choice',
		interactionTypes: ['choiceInteraction'],
		async transform(context) {
			if (!context.assessmentItem) throw new Error('No assessmentItem found');
			return {
				kind: 'pie-item',
				content: await transformMultipleChoice(context.assessmentItem, context.itemId, {
					baseId: context.baseId,
				}),
			};
		},
	});

	registry.register({
		id: 'builtin.extended-text',
		interactionTypes: ['extendedTextInteraction'],
		async transform(context) {
			if (!context.assessmentItem) throw new Error('No assessmentItem found');
			return {
				kind: 'pie-item',
				content: await transformExtendedResponse(context.assessmentItem, context.itemId, {
					baseId: context.baseId,
				}),
			};
		},
	});

	registry.register(itemHandler('builtin.order', ['orderInteraction'], (context) =>
		transformPlacementOrdering(context.qtiXml, context.itemId)
	));
	registry.register({
		id: 'builtin.match',
		interactionTypes: ['matchInteraction'],
		transform(context) {
			return {
				kind: 'pie-item',
				content: isMatchList(context.qtiXml)
					? transformMatchList(context.qtiXml, context.itemId)
					: transformMatch(context.qtiXml, context.itemId),
			};
		},
	});
	registry.register(itemHandler('builtin.text-entry', ['textEntryInteraction'], (context) =>
		transformExplicitConstructedResponse(context.qtiXml, context.itemId)
	));
	registry.register(itemHandler('builtin.select-text', ['selectPointInteraction', 'hottextInteraction'], (context) =>
		transformSelectText(context.qtiXml, context.itemId)
	));
	registry.register(itemHandler('builtin.inline-dropdown', ['inlineChoiceInteraction'], (context) =>
		transformInlineDropdown(context.qtiXml, context.itemId)
	));
	registry.register(itemHandler('builtin.drag-in-the-blank', ['gapMatchInteraction'], (context) =>
		transformDragInTheBlank(context.qtiXml, context.itemId)
	));
	registry.register(itemHandler('builtin.ebsr', ['ebsr'], (context) =>
		transformEbsr(context.qtiXml, context.itemId)
	));
	registry.register(itemHandler('builtin.hotspot', ['hotspotInteraction'], (context) =>
		transformHotspot(context.qtiXml, context.itemId)
	));
	registry.register(itemHandler('builtin.image-cloze-association', ['graphicGapMatchInteraction'], (context) =>
		transformImageClozeAssociation(context.qtiXml, context.itemId)
	));
	registry.register(itemHandler('builtin.passage', ['passage'], (context) =>
		transformPassage(context.qtiXml, context.itemId)
	));
	registry.register({
		id: 'builtin.associate',
		interactionTypes: ['associateInteraction'],
		transform(context) {
			context.logger?.warn?.(
				`Transforming associateInteraction to categorize (experimental). ` +
					`Original any-to-any pairing semantics may not be fully preserved. ` +
					`Item: ${context.itemId}`
			);
			return {
				kind: 'pie-item',
				content: transformAssociateToCategorize(context.qtiXml, context.itemId),
			};
		},
	});
	registry.register({
		id: 'builtin.assessment-test',
		interactionTypes: ['assessmentTest'],
		transform(context) {
			context.logger?.info?.(`Transforming assessmentTest: ${context.itemId}`);
			const assessment = transformAssessmentTest(context.qtiXml, context.itemId, {
				includeTimeLimits: true,
				includeBranchRules: true,
				includeItemControls: true,
			});
			return {
				kind: 'assessment',
				content: assessment,
				itemCount: assessment.testParts.reduce(
					(total, testPart) =>
						total +
						testPart.sections.reduce(
							(sectionTotal, section) => sectionTotal + section.itemRefs.length,
							0
						),
					0
				),
			};
		},
	});

	return registry;
}

function itemHandler(
	id: string,
	interactionTypes: readonly string[],
	transform: (context: BuiltInTransformContext) => any
): QtiBuiltInTransformHandler {
	return {
		id,
		interactionTypes,
		transform(context) {
			return {
				kind: 'pie-item',
				content: transform(context),
			};
		},
	};
}

function isMatchList(qtiXml: string): boolean {
	const matches = qtiXml.match(/<simpleMatchSet/g);
	return matches ? matches.length >= 2 : false;
}
