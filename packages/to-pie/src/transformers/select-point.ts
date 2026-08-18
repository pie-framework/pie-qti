/**
 * QTI `selectPointInteraction` to PIE, for the Renaissance vendor classes carried on that
 * element (`numberLine`, `chart`, `graph`).
 *
 * See `utils/select-point-config.ts` for the shape these packages use and why the embedded
 * JSON maps onto PIE models directly. Each transformer below emits **authored intent** and
 * leaves normalization to the element's own controller — `number-line`'s `reloadTicksData`
 * re-derives `tickIntervalType` and clamps tick values against the domain and width, and
 * charting/graphing fill their remaining defaults — so only fields the source actually
 * declares are set.
 *
 * Field mappings are grounded in `pie-elements-ng` -
 * `packages/elements-react/<element>/src/controller/defaults.ts`, the matching
 * `src/author/defaults.ts`, and `docs/evals/elements-react/<element>/samples/default.json`.
 */

import type { PieItem, PieModel } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { extractPromptForInteraction } from '../utils/prompt-extraction.js';
import {
  parseTickInterval,
  readJsonCorrectResponses,
  readJsonParams,
  readSelectPointParams,
  type SelectPointParams,
} from '../utils/select-point-config.js';

export interface SelectPointTransformContext {
  assessmentItem: HTMLElement;
  itemBody: HTMLElement;
  interaction: HTMLElement;
  itemId: string;
  baseId?: string;
  promptBoundaryStart?: HTMLElement;
}

/**
 * `<param>` keys each class consumes. Anything a source declares outside its class's set has
 * no PIE home, and `unmappedSelectPointParams` reports it rather than letting it vanish —
 * `xAxisTitleTop` and `yAxisTitleRight` are real examples, since PIE's graphing `domain`/
 * `range` carry a single `axisLabel` each.
 */
const MAPPED_PARAMS: Record<string, readonly string[]> = {
  numberLine: ['minValue', 'maxValue', 'stepValue', 'labelStepValue', 'title', 'availableTools'],
  chart: [
    'chartType',
    'minValue',
    'maxValue',
    'stepValue',
    'labelStepValue',
    'chartTitle',
    'xAxisTitle',
    'yAxisTitle',
    'addCategoryEnabled',
    'category',
  ],
  graph: [
    'gridHeightInPixels',
    'gridWidthInPixels',
    'chartTitle',
    'availableTools',
    'xAxisTitleBottom',
    'xAxisMinValue',
    'xAxisMaxValue',
    'xAxisStepValue',
    'yAxisTitleLeft',
    'yAxisMinValue',
    'yAxisMaxValue',
    'yAxisStepValue',
  ],
};

/** Config keys the source declared with a non-empty value that this class does not map. */
export function unmappedSelectPointParams(className: string, interaction: HTMLElement): string[] {
  const mapped = new Set(MAPPED_PARAMS[className] ?? []);
  const params = readSelectPointParams(interaction);
  const declared = [
    ...new Set(
      interaction
        .getElementsByTagName('param')
        .map((param) => param.getAttribute('name'))
        .filter((name): name is string => Boolean(name))
    ),
  ];
  return declared.filter((name) => !mapped.has(name) && (params.text(name) ?? '') !== '');
}

/**
 * `selectPointInteraction class="numberLine"` to `@pie-element/number-line`.
 *
 * `availableTools` is a comma-separated list of PIE's own tool codes (`PF`, `LFF`, … `REP`),
 * which become `graph.availableTypes` and seed `graph.initialType`.
 */
export function transformNumberLineSelectPoint(context: SelectPointTransformContext): PieItem {
  const params = readSelectPointParams(context.interaction);
  const responseIdentifier = context.interaction.getAttribute('responseIdentifier') || 'RESPONSE';
  const graph: Record<string, unknown> = {};

  const min = params.number('minValue');
  const max = params.number('maxValue');
  if (min !== undefined || max !== undefined) {
    graph.domain = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
  }

  const minor = parseTickInterval(params.text('stepValue'));
  const major = parseTickInterval(params.text('labelStepValue'));
  if (minor || major) {
    graph.ticks = {
      ...(minor && { minor: minor.value, tickIntervalType: minor.tickIntervalType }),
      ...(major && { major: major.value }),
    };
  }

  const title = params.text('title');
  if (title) {
    graph.title = title;
  }

  const tools = params.list('availableTools');
  if (tools.length > 0) {
    graph.availableTypes = Object.fromEntries(tools.map((tool) => [tool, true]));
    graph.initialType = tools[0];
  }

  // QTI `maxChoices="0"` means unlimited, which is not a point count PIE can honour; leaving
  // `maxNumberOfPoints` unset keeps the element's own default rather than inventing a cap.
  const maxChoices = Number(context.interaction.getAttribute('maxChoices'));
  if (Number.isFinite(maxChoices) && maxChoices > 0) {
    graph.maxNumberOfPoints = maxChoices;
  }

  const { values } = readJsonCorrectResponses(context.assessmentItem, responseIdentifier);

  return buildItem(context, '@pie-element/number-line', 'number-line', {
    ...(Object.keys(graph).length > 0 && { graph }),
    correctResponse: values.map(withDefaultPointType),
    responseIdentifier,
  });
}

/**
 * A `point` response with no `pointType`.
 *
 * The source omits it (`{"type": "point", "domainPosition": 5.4}`) while PIE's own sample
 * carries `pointType: "full"`, and `number-line`'s authoring surface derives tool codes with
 * `toPointType`, which reads `response.pointType[0]` — so an absent `pointType` would break
 * that derivation rather than default gracefully. `full` is the grounded choice: `PF` is what
 * these items declare in `availableTools`, and the delivery element treats any type code not
 * suffixed `e` as full (`number-line/src/delivery/number-line/graph/elements/builder.ts`).
 */
function withDefaultPointType(response: unknown): unknown {
  if (
    typeof response === 'object' &&
    response !== null &&
    (response as { type?: unknown }).type === 'point' &&
    (response as { pointType?: unknown }).pointType === undefined
  ) {
    return { ...(response as object), pointType: 'full' };
  }
  return response;
}

/**
 * `selectPointInteraction class="chart"` to `@pie-element/charting`.
 *
 * `category` repeats once per starting category, each value being JSON already shaped like a
 * charting `data` entry (`{"label": "1 1/4", "initialValue": 0, "interactive": true}`), and the
 * `<correctResponse>` values are `{label, value}` pairs matching `correctAnswer.data`.
 */
export function transformChartingSelectPoint(context: SelectPointTransformContext): PieItem {
  const params = readSelectPointParams(context.interaction);
  const responseIdentifier = context.interaction.getAttribute('responseIdentifier') || 'RESPONSE';
  const model: Record<string, unknown> = { responseIdentifier };

  const chartType = params.text('chartType');
  if (chartType) {
    model.chartType = chartType;
  }
  const title = params.text('chartTitle');
  if (title) {
    model.title = title;
  }

  const xAxisTitle = params.text('xAxisTitle');
  if (xAxisTitle) {
    model.domain = { label: xAxisTitle };
  }

  const range: Record<string, unknown> = {};
  const yAxisTitle = params.text('yAxisTitle');
  if (yAxisTitle) {
    range.label = yAxisTitle;
  }
  const min = params.number('minValue');
  const max = params.number('maxValue');
  if (min !== undefined) range.min = min;
  if (max !== undefined) range.max = max;
  const step = parseTickInterval(params.text('stepValue'));
  if (step) range.step = step.value;
  const labelStep = parseTickInterval(params.text('labelStepValue'));
  if (labelStep) range.labelStep = labelStep.value;
  if (Object.keys(range).length > 0) {
    model.range = range;
  }

  const categories = readJsonParams(params, 'category').map(toChartingCategory);
  if (categories.length > 0) {
    model.data = categories;
  }

  const addCategoryEnabled = params.flag('addCategoryEnabled');
  if (addCategoryEnabled !== undefined) {
    model.addCategoryEnabled = addCategoryEnabled;
  }

  const { values } = readJsonCorrectResponses(context.assessmentItem, responseIdentifier);
  model.correctAnswer = { data: values };

  return buildItem(context, '@pie-element/charting', 'charting', model);
}

/**
 * A `category` param to a charting `data` entry.
 *
 * The source names the starting height `initialValue`; charting's `data` entries call it
 * `value` (`docs/evals/elements-react/charting/samples/default.json`). Everything else passes
 * through, so `interactive` and any future key survive.
 */
function toChartingCategory(category: unknown): unknown {
  if (typeof category !== 'object' || category === null) {
    return category;
  }
  const { initialValue, ...rest } = category as Record<string, unknown>;
  return initialValue === undefined ? category : { ...rest, value: initialValue };
}

/**
 * `selectPointInteraction class="graph"` to `@pie-element/graphing`.
 *
 * `availableTools` is graphing's own tool vocabulary (`point`, `segment`, `polygon`, `sine`, …)
 * and becomes `toolbarTools`; the `<correctResponse>` values are marks in graphing's own shapes
 * and become `answers.correctAnswer.marks` unchanged.
 */
export function transformGraphingSelectPoint(context: SelectPointTransformContext): PieItem {
  const params = readSelectPointParams(context.interaction);
  const responseIdentifier = context.interaction.getAttribute('responseIdentifier') || 'RESPONSE';
  const model: Record<string, unknown> = { responseIdentifier };

  const title = params.text('chartTitle');
  if (title) {
    model.title = title;
  }

  const width = params.number('gridWidthInPixels');
  const height = params.number('gridHeightInPixels');
  if (width !== undefined || height !== undefined) {
    model.graph = {
      ...(width !== undefined && { width }),
      ...(height !== undefined && { height }),
    };
  }

  const domain = axis(
    params,
    'xAxisMinValue',
    'xAxisMaxValue',
    'xAxisStepValue',
    'xAxisTitleBottom'
  );
  if (domain) model.domain = domain;
  const range = axis(params, 'yAxisMinValue', 'yAxisMaxValue', 'yAxisStepValue', 'yAxisTitleLeft');
  if (range) model.range = range;

  const tools = params.list('availableTools');
  if (tools.length > 0) {
    model.toolbarTools = tools;
  }

  const { values } = readJsonCorrectResponses(context.assessmentItem, responseIdentifier);
  model.answers = { correctAnswer: { name: 'Correct Answer', marks: values } };

  return buildItem(context, '@pie-element/graphing', 'graphing', model);
}

/**
 * One graphing axis.
 *
 * `labelStep` is seeded from the step because these packages declare a single
 * `*AxisStepValue`; graphing keeps `step` (grid spacing) and `labelStep` (labelled spacing)
 * separate, and defaulting them equal reproduces what the source draws.
 */
function axis(
  params: SelectPointParams,
  minKey: string,
  maxKey: string,
  stepKey: string,
  labelKey: string
): Record<string, unknown> | undefined {
  const min = params.number(minKey);
  const max = params.number(maxKey);
  const step = params.number(stepKey);
  const axisLabel = params.text(labelKey);
  const built = {
    ...(min !== undefined && { min }),
    ...(max !== undefined && { max }),
    ...(step !== undefined && { step, labelStep: step }),
    ...(axisLabel && { axisLabel }),
  };
  return Object.keys(built).length > 0 ? built : undefined;
}

function buildItem(
  context: SelectPointTransformContext,
  element: string,
  elementKey: string,
  model: Record<string, unknown>
): PieItem {
  const modelId = uuid();
  const pieModel: PieModel & Record<string, unknown> = {
    id: modelId,
    element,
    prompt: extractPromptForInteraction(context.itemBody, context.interaction, {
      after: context.promptBoundaryStart,
    }),
    ...model,
  };

  return {
    id: context.itemId,
    ...(context.baseId && { baseId: context.baseId }),
    uuid: modelId,
    config: {
      id: modelId,
      models: [pieModel],
      elements: { [elementKey]: `${element}@latest` },
    },
    metadata: {
      searchMetaData: {
        title: context.assessmentItem.getAttribute('title') || context.itemId,
        itemType: elementKey,
        source: 'qti22',
      },
    },
  };
}
