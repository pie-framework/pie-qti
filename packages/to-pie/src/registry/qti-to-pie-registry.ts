import type { PieItem } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { transformAssessmentTest } from '../transformers/assessment-test.js';
import { transformAssociateToCategorize } from '../transformers/associate-to-categorize.js';
import { transformDragInTheBlank } from '../transformers/drag-in-the-blank.js';
import { transformEbsr, transformEbsrInteractions } from '../transformers/ebsr.js';
import {
  transformExplicitConstructedResponse,
  transformExplicitConstructedResponseInteractions,
} from '../transformers/explicit-constructed-response.js';
import { transformExtendedResponse } from '../transformers/extended-response.js';
import { transformHotspot } from '../transformers/hotspot.js';
import { transformImageClozeAssociation } from '../transformers/image-cloze-association.js';
import {
  transformInlineDropdown,
  transformInlineDropdownInteractions,
} from '../transformers/inline-dropdown.js';
import { transformMatch } from '../transformers/match.js';
import { transformMatchList } from '../transformers/match-list.js';
import {
  transformMultipleChoice,
  transformMultipleChoiceInteraction,
} from '../transformers/multiple-choice.js';
import {
  transformNumberLine,
  transformNumberLineInteraction,
} from '../transformers/number-line.js';
import { transformPassage } from '../transformers/passage.js';
import {
  transformPlacementOrdering,
  transformPlacementOrderingInteraction,
} from '../transformers/placement-ordering.js';
import {
  type SelectPointTransformContext,
  transformChartingSelectPoint,
  transformGraphingSelectPoint,
  transformNumberLineSelectPoint,
  unmappedSelectPointParams,
} from '../transformers/select-point.js';
import { transformSelectText } from '../transformers/select-text.js';
import { createUnsupportedInteractionError } from '../utils/qti-errors.js';
import type { PlannedQtiInteractionUnit, QtiItemBodyPlan } from '../utils/qti-item-planner.js';
import {
  describeSelectPointInteraction,
  SELECT_POINT_VENDOR_CLASSES,
  selectPointUnsupportedDetails,
} from '../utils/select-point-config.js';

/**
 * `selectPointInteraction` `@class` to transformer. Adding a class is an entry here plus one in
 * `SELECT_POINT_VENDOR_CLASSES`; anything unlisted falls through to the fail-closed path.
 */
const SELECT_POINT_CLASS_TRANSFORMS: Record<
  string,
  (context: SelectPointTransformContext) => PieItem
> = {
  numberLine: transformNumberLineSelectPoint,
  chart: transformChartingSelectPoint,
  graph: transformGraphingSelectPoint,
};

export type BuiltInTransformKind = 'pie-item' | 'assessment';

export interface BuiltInTransformContext {
  interactionType: string;
  qtiXml: string;
  itemId: string;
  assessmentItem?: HTMLElement;
  itemBodyPlan?: QtiItemBodyPlan;
  interactionUnit?: PlannedQtiInteractionUnit;
  sourcePath?: string;
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
  outputKind?: BuiltInTransformKind;
  pieElements?: readonly string[];
  notes?: readonly string[];
  transform(
    context: BuiltInTransformContext
  ): Promise<BuiltInTransformResult> | BuiltInTransformResult;
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

  listHandlers(): QtiBuiltInTransformHandler[] {
    return [...this.handlers.values()];
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
    outputKind: 'pie-item',
    pieElements: ['@pie-element/multiple-choice'],
    async transform(context) {
      if (!context.assessmentItem) throw new Error('No assessmentItem found');
      const itemBody = context.itemBodyPlan
        ? (context.assessmentItem.getElementsByTagName('itemBody')[0] as HTMLElement | undefined)
        : undefined;
      const choiceInteraction = context.interactionUnit?.interactions[0];
      if (itemBody && choiceInteraction) {
        return {
          kind: 'pie-item',
          content: await transformMultipleChoiceInteraction(
            context.assessmentItem,
            itemBody,
            choiceInteraction,
            context.itemId,
            {
              baseId: context.baseId,
              promptBoundaryStart: previousPlannedInteraction(context, choiceInteraction),
            }
          ),
        };
      }
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
    outputKind: 'pie-item',
    pieElements: ['@pie-element/extended-text-entry'],
    notes: ['May also emit passage or rubric elements when the source item carries them.'],
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

  registry.register(
    itemHandler(
      'builtin.order',
      ['orderInteraction'],
      ['@pie-element/placement-ordering'],
      (context) => {
        const orderInteraction = context.interactionUnit?.interactions[0];
        const assessmentItem = context.assessmentItem;
        const itemBody = assessmentItem?.getElementsByTagName('itemBody')[0];
        if (assessmentItem && itemBody && orderInteraction) {
          return transformPlacementOrderingInteraction(
            assessmentItem,
            itemBody,
            orderInteraction,
            context.itemId,
            {
              promptBoundaryStart: previousPlannedInteraction(context, orderInteraction),
            }
          );
        }
        return transformPlacementOrdering(context.qtiXml, context.itemId);
      }
    )
  );
  registry.register({
    id: 'builtin.match',
    interactionTypes: ['matchInteraction'],
    outputKind: 'pie-item',
    pieElements: ['@pie-element/match', '@pie-element/match-list'],
    notes: ['Uses match-list when the source has two simpleMatchSet groups; otherwise match.'],
    transform(context) {
      const matchInteraction = context.interactionUnit?.interactions[0];
      return {
        kind: 'pie-item',
        content: (
          matchInteraction
            ? isMatchListInteraction(matchInteraction)
            : isMatchList(context.qtiXml)
        )
          ? transformMatchList(context.qtiXml, context.itemId)
          : transformMatch(context.qtiXml, context.itemId),
      };
    },
  });
  registry.register(
    itemHandler(
      'builtin.text-entry',
      ['textEntryInteraction'],
      ['@pie-element/explicit-constructed-response'],
      (context) => {
        const assessmentItem = context.assessmentItem;
        const itemBody = assessmentItem?.getElementsByTagName('itemBody')[0];
        if (assessmentItem && itemBody && context.interactionUnit?.interactions.length) {
          return transformExplicitConstructedResponseInteractions(
            assessmentItem,
            itemBody,
            context.interactionUnit.interactions,
            context.itemId
          );
        }
        return transformExplicitConstructedResponse(context.qtiXml, context.itemId);
      }
    )
  );
  registry.register(
    itemHandler(
      'builtin.select-text',
      ['hottextInteraction'],
      ['@pie-element/select-text'],
      (context) => transformSelectText(context.qtiXml, context.itemId)
    )
  );
  registry.register({
    id: 'builtin.select-point',
    interactionTypes: ['selectPointInteraction'],
    outputKind: 'pie-item',
    pieElements: SELECT_POINT_VENDOR_CLASSES.map((vendorClass) => vendorClass.pieElement),
    notes: [
      'Dispatches on the Renaissance @class discriminator: numberLine, chart, and graph each ' +
        'convert to their own PIE element. A bare selectPointInteraction is plain QTI graphic ' +
        'point selection, which has no PIE element, and fails closed.',
    ],
    transform(context) {
      const interaction =
        context.interactionUnit?.interactions[0] ??
        context.assessmentItem?.getElementsByTagName('selectPointInteraction')[0];
      const description = describeSelectPointInteraction(context.qtiXml, interaction);
      const className = description.className;
      const transform = className ? SELECT_POINT_CLASS_TRANSFORMS[className] : undefined;
      const itemBody = context.assessmentItem?.getElementsByTagName('itemBody')[0];

      // A bare or unrecognized class has no PIE target, and so does a class-bearing item whose
      // itemBody the planner could not resolve — both fail closed rather than convert partially.
      if (!className || !transform || !context.assessmentItem || !itemBody || !interaction) {
        throw createUnsupportedInteractionError('selectPointInteraction', {
          itemId: context.itemId,
          details: selectPointUnsupportedDetails(description),
        });
      }

      const unmapped = unmappedSelectPointParams(className, interaction);
      if (unmapped.length > 0) {
        context.logger?.warn?.(
          `selectPointInteraction class "${className}" in item ${context.itemId} declares config ` +
            `with no PIE target, which is not carried into the model: ${unmapped.join(', ')}.`
        );
      }

      return {
        kind: 'pie-item',
        content: transform({
          assessmentItem: context.assessmentItem,
          itemBody,
          interaction,
          itemId: context.itemId,
          ...(context.baseId && { baseId: context.baseId }),
          promptBoundaryStart: previousPlannedInteraction(context, interaction),
        }),
      };
    },
  });
  registry.register(
    itemHandler(
      'builtin.number-line',
      ['sliderInteraction'],
      ['@pie-element/number-line'],
      (context) => {
        const slider = context.interactionUnit?.interactions[0];
        const assessmentItem = context.assessmentItem;
        const itemBody = assessmentItem?.getElementsByTagName('itemBody')[0];
        if (assessmentItem && itemBody && slider) {
          return transformNumberLineInteraction(
            assessmentItem,
            itemBody,
            slider,
            context.itemId,
            previousPlannedInteraction(context, slider)
          );
        }
        return transformNumberLine(context.qtiXml, context.itemId);
      }
    )
  );
  registry.register(
    itemHandler(
      'builtin.inline-dropdown',
      ['inlineChoiceInteraction'],
      ['@pie-element/inline-dropdown'],
      (context) => {
        const assessmentItem = context.assessmentItem;
        const itemBody = assessmentItem?.getElementsByTagName('itemBody')[0];
        if (assessmentItem && itemBody && context.interactionUnit?.interactions.length) {
          return transformInlineDropdownInteractions(
            assessmentItem,
            itemBody,
            context.interactionUnit.interactions,
            context.itemId
          );
        }
        return transformInlineDropdown(context.qtiXml, context.itemId);
      }
    )
  );
  registry.register(
    itemHandler(
      'builtin.drag-in-the-blank',
      ['gapMatchInteraction'],
      ['@pie-element/drag-in-the-blank'],
      (context) => transformDragInTheBlank(context.qtiXml, context.itemId)
    )
  );
  registry.register(
    itemHandler('builtin.ebsr', ['ebsr'], ['@pie-element/ebsr'], (context) => {
      const assessmentItem = context.assessmentItem;
      const itemBody = assessmentItem?.getElementsByTagName('itemBody')[0];
      const [first, second] = context.interactionUnit?.interactions ?? [];
      if (assessmentItem && itemBody && first && second) {
        return transformEbsrInteractions(assessmentItem, itemBody, [first, second], context.itemId);
      }
      return transformEbsr(context.qtiXml, context.itemId);
    })
  );
  registry.register(
    itemHandler('builtin.hotspot', ['hotspotInteraction'], ['@pie-element/hotspot'], (context) =>
      transformHotspot(context.qtiXml, context.itemId)
    )
  );
  registry.register(
    itemHandler(
      'builtin.image-cloze-association',
      ['graphicGapMatchInteraction'],
      ['@pie-element/image-cloze-association'],
      (context) => transformImageClozeAssociation(context.qtiXml, context.itemId)
    )
  );
  registry.register(
    itemHandler('builtin.passage', ['passage'], ['@pie-element/passage'], (context) =>
      transformPassage(context.qtiXml, context.itemId)
    )
  );
  registry.register({
    id: 'builtin.associate',
    interactionTypes: ['associateInteraction'],
    outputKind: 'pie-item',
    pieElements: ['@pie-element/categorize'],
    notes: [
      'Experimental: maps QTI any-to-any associateInteraction semantics to PIE grouping semantics.',
    ],
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
    outputKind: 'assessment',
    pieElements: [],
    notes: ['Produces a PIE assessment structure rather than an item element model.'],
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
  pieElements: readonly string[],
  transform: (context: BuiltInTransformContext) => any
): QtiBuiltInTransformHandler {
  return {
    id,
    interactionTypes,
    outputKind: 'pie-item',
    pieElements,
    transform(context) {
      return {
        kind: 'pie-item',
        content: transform(context),
      };
    },
  };
}

function previousPlannedInteraction(
  context: BuiltInTransformContext,
  interaction: HTMLElement
): HTMLElement | undefined {
  const interactions = context.itemBodyPlan?.interactions;
  if (!interactions) {
    return undefined;
  }
  const index = interactions.indexOf(interaction);
  return index > 0 ? interactions[index - 1] : undefined;
}

function isMatchList(qtiXml: string): boolean {
  const matches = qtiXml.match(/<simpleMatchSet/g);
  return matches ? matches.length >= 2 : false;
}

function isMatchListInteraction(matchInteraction: HTMLElement): boolean {
  return matchInteraction.getElementsByTagName('simpleMatchSet').length >= 2;
}
