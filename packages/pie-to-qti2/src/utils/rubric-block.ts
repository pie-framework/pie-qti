/**
 * Rubric blocks
 *
 * PIE rubric models become a `<rubricBlock view="scorer">` at the end of the item body: a table of
 * score points for a simple rubric, one table per scale for a multi-trait rubric, and the maximum
 * points with any instruction for a rubricless one. Score labels and descriptors are indexed from
 * the lowest score, which is 1 when the rubric excludes zero; tables list the highest score first,
 * as PIE delivery does. Descriptor HTML is carried as authored.
 */

import type { PieModel } from '@pie-qti/transform-types';
import { escapeXml } from './qti-builder.js';

export const RUBRIC_ELEMENTS = [
  '@pie-element/rubric',
  '@pie-element/multi-trait-rubric',
  '@pie-element/complex-rubric',
] as const;

interface SimpleRubric {
  points?: string[];
  sampleAnswers?: (string | null)[];
  excludeZero?: boolean;
}

interface RubricScale {
  excludeZero?: boolean;
  maxPoints?: number;
  traitLabel?: string;
  scorePointsLabels?: string[];
  traits?: Array<{ name?: string; description?: string; scorePointsDescriptors?: string[] }>;
}

interface MultiTraitRubric {
  scales?: RubricScale[];
}

interface Rubricless {
  maxPoints?: number;
  rubriclessInstruction?: string;
}

interface RenderedRubric {
  html: string;
  maxScore: number;
}

export function isRubricModel(model: PieModel): boolean {
  return (RUBRIC_ELEMENTS as readonly string[]).includes(model.element ?? '');
}

/**
 * The `rubricBlock` for a rubric model, with the score it awards at most; undefined when the model
 * carries no rubric content.
 */
export function renderRubricBlock(model: PieModel): RenderedRubric | undefined {
  const rendered = renderRubric(model);
  return rendered && { ...rendered, html: `<rubricBlock view="scorer">\n${rendered.html}\n</rubricBlock>` };
}

/**
 * The highest score the item's rubrics award, or undefined without a scorable rubric.
 */
export function rubricMaxScore(rubrics: PieModel[] | undefined): number | undefined {
  const scores = (rubrics ?? []).map((model) => renderRubric(model)?.maxScore).filter((score) => score !== undefined);
  return scores.length > 0 ? Math.max(...scores) : undefined;
}

function renderRubric(model: PieModel): RenderedRubric | undefined {
  switch (model.element) {
    case '@pie-element/rubric':
      return simpleRubric(model as SimpleRubric);
    case '@pie-element/multi-trait-rubric':
      return multiTraitRubric(model as MultiTraitRubric);
    case '@pie-element/complex-rubric': {
      const { rubricType, rubrics = {} } = model as { rubricType?: string; rubrics?: Record<string, any> };
      if (rubricType === 'multiTraitRubric') return multiTraitRubric(rubrics.multiTraitRubric ?? {});
      if (rubricType === 'rubricless') return rubricless(rubrics.rubricless ?? {});
      return simpleRubric(rubrics.simpleRubric ?? {});
    }
    default:
      return undefined;
  }
}

function simpleRubric({ points = [], sampleAnswers = [], excludeZero = false }: SimpleRubric): RenderedRubric | undefined {
  if (points.length === 0) return undefined;
  const lowest = excludeZero ? 1 : 0;
  const withSamples = sampleAnswers.some((sample) => !!sample);
  const head = row('th', ['Points', 'Description', ...(withSamples ? ['Sample answer'] : [])]);
  const rows = points
    .map((description, index) =>
      row('td', [String(index + lowest), description ?? '', ...(withSamples ? [sampleAnswers[index] ?? ''] : [])])
    )
    .reverse();
  return { html: table(head, rows), maxScore: points.length - 1 + lowest };
}

function multiTraitRubric({ scales = [] }: MultiTraitRubric): RenderedRubric | undefined {
  const tables: string[] = [];
  let maxScore = 0;
  for (const { excludeZero = false, maxPoints = 0, traitLabel, scorePointsLabels = [], traits = [] } of scales) {
    if (traits.length === 0) continue;
    const lowest = excludeZero ? 1 : 0;
    const scores = Array.from({ length: Math.max(0, maxPoints - lowest + 1) }, (_, index) => maxPoints - index);
    const head = row('th', [
      escapeXml(traitLabel || 'Trait'),
      ...scores.map((score) => (scorePointsLabels[score - lowest] ? `${score}: ${escapeXml(scorePointsLabels[score - lowest])}` : String(score))),
    ]);
    const rows = traits.map(({ name, description, scorePointsDescriptors = [] }) =>
      row('td', [
        [name, description].filter(Boolean).join('<br/>'),
        ...scores.map((score) => scorePointsDescriptors[score - lowest] ?? ''),
      ])
    );
    tables.push(table(head, rows));
    maxScore += maxPoints * traits.length;
  }
  return tables.length > 0 ? { html: tables.join('\n'), maxScore } : undefined;
}

function rubricless({ maxPoints, rubriclessInstruction }: Rubricless): RenderedRubric | undefined {
  if (!maxPoints) return undefined;
  const instruction = rubriclessInstruction ? `\n<div>${rubriclessInstruction}</div>` : '';
  return { html: `<p>Maximum points: ${maxPoints}</p>${instruction}`, maxScore: maxPoints };
}

function row(cell: 'th' | 'td', contents: string[]): string {
  return `<tr>${contents.map((content) => `<${cell}>${content}</${cell}>`).join('')}</tr>`;
}

function table(head: string, rows: string[]): string {
  return `<table>\n<thead>${head}</thead>\n<tbody>\n${rows.join('\n')}\n</tbody>\n</table>`;
}
