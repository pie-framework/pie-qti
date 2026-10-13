/**
 * Scorer rubric carriage
 *
 * An item's scorer rubricBlocks reach the instructor as `teacherInstructions` on one model of the
 * converted item, whatever its interactions. The rubric belongs to the item, so it is attached once
 * per item rather than by each transformer, which would repeat it across a composite item's
 * models. An item with no model that shows teacher instructions gets a
 * `QTI_SCORER_RUBRIC_NOT_CARRIED` warning.
 */

import type { PieItem, TransformOutput, TransformWarning } from '@pie-qti/transform-types';
import { parse } from 'node-html-parser';
import { extractScorerRubric } from './passage-extraction.js';
import { piePackageName } from './pie-markup.js';

export const SCORER_RUBRIC_NOT_CARRIED = 'QTI_SCORER_RUBRIC_NOT_CARRIED';

export interface ScorerRubricNotCarriedWarning extends TransformWarning {
  code: typeof SCORER_RUBRIC_NOT_CARRIED;
}

/** The elements whose controllers show `teacherInstructions` to an instructor. */
const TEACHER_INSTRUCTION_ELEMENTS = new Set([
  '@pie-element/categorize',
  '@pie-element/charting',
  '@pie-element/drag-in-the-blank',
  '@pie-element/drawing-response',
  '@pie-element/ebsr',
  '@pie-element/explicit-constructed-response',
  '@pie-element/extended-text-entry',
  '@pie-element/graphing',
  '@pie-element/hotspot',
  '@pie-element/image-cloze-association',
  '@pie-element/inline-dropdown',
  '@pie-element/match',
  '@pie-element/multiple-choice',
  '@pie-element/number-line',
  '@pie-element/placement-ordering',
  '@pie-element/select-text',
]);

/** Hand-scored elements, where a scorer reads the rubric, take it ahead of the item's other models. */
const HAND_SCORED_ELEMENTS = new Set([
  '@pie-element/drawing-response',
  '@pie-element/extended-text-entry',
]);

/** Attach the item's scorer rubric to one model of the output, or warn when no model can show it. */
export function withScorerRubric(
  output: TransformOutput,
  qtiXml: string,
  itemId: string
): TransformOutput {
  if (!output.items.some((item) => isPieItem(item.content))) {
    return output;
  }
  const rubric = extractScorerRubric(parse(qtiXml, { lowerCaseTagName: false, comment: false }));
  if (!rubric) return output;

  const target = output.items.findIndex(
    (item) => isPieItem(item.content) && rubricTarget(item.content) !== undefined
  );
  if (target < 0) {
    const warning: ScorerRubricNotCarriedWarning = {
      itemId,
      code: SCORER_RUBRIC_NOT_CARRIED,
      message:
        'Scorer rubricBlock content not carried into PIE: no element in the item shows teacher instructions.',
    };
    return { ...output, warnings: [...(output.warnings ?? []), warning] };
  }
  return {
    ...output,
    items: output.items.map((item, index) =>
      index === target ? { ...item, content: attachRubric(item.content as PieItem, rubric) } : item
    ),
  };
}

function rubricTarget(item: PieItem): number | undefined {
  const elements = (item.config?.elements ?? {}) as Record<string, string>;
  const packages = ((item.config?.models ?? []) as Array<Record<string, unknown>>).map((model) =>
    typeof model.element === 'string'
      ? piePackageName(elements[model.element] ?? model.element)
      : ''
  );
  const eligible = packages
    .map((packageName, index) => ({ packageName, index }))
    .filter(({ packageName }) => TEACHER_INSTRUCTION_ELEMENTS.has(packageName));
  return (eligible.find(({ packageName }) => HAND_SCORED_ELEMENTS.has(packageName)) ?? eligible[0])
    ?.index;
}

function attachRubric(item: PieItem, rubric: string): PieItem {
  const target = rubricTarget(item);
  return {
    ...item,
    config: {
      ...item.config,
      models: (item.config.models ?? []).map((model, index) => {
        if (index !== target) return model;
        const authored = (model as Record<string, unknown>).teacherInstructions;
        const existing = typeof authored === 'string' ? authored.trim() : '';
        return {
          ...model,
          teacherInstructions: existing ? `<div>${existing}</div><div>${rubric}</div>` : rubric,
          teacherInstructionsEnabled: true,
        };
      }),
    },
  };
}

function isPieItem(value: unknown): value is PieItem {
  return typeof value === 'object' && value !== null && 'config' in value;
}
