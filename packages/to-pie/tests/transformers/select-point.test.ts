import { describe, expect, test } from 'bun:test';
import { parse } from 'node-html-parser';
import { createDefaultQtiToPieRegistry } from '../../src/registry/qti-to-pie-registry';
import {
  describeSelectPointInteraction,
  parseTickInterval,
  selectPointUnsupportedDetails,
} from '../../src/utils/select-point-config';

/**
 * Renaissance QTI carries its graphical item types on a standard `selectPointInteraction`
 * discriminated by `@class`. Shapes here are reduced from the `Vendor Sample Items Custom QTI
 * 2.2` package attached to CONTOOL-2113.
 */
function selectPointItem(options: {
  className?: string;
  params?: [string, string][];
  correctResponses?: string[];
  maxChoices?: string;
}): string {
  const params = (options.params ?? [])
    .map(([name, value]) => `<param name="${name}" valuetype="DATA" value='${value}' />`)
    .join('\n        ');
  const values = (options.correctResponses ?? [])
    .map((value) => `<value>${value}</value>`)
    .join('\n      ');
  return `<?xml version="1.0" encoding="utf-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" title="sample" identifier="sample">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple">
    <correctResponse>
      ${values}
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <selectPointInteraction responseIdentifier="RESPONSE" maxChoices="${
      options.maxChoices ?? '1'
    }"${options.className ? ` class="${options.className}"` : ''}>
      <prompt><div>Do the thing.</div></prompt>
      <object data="n/a" type="n/a">
        ${params}
      </object>
    </selectPointInteraction>
  </itemBody>
</assessmentItem>`;
}

async function convert(qtiXml: string, logger?: { warn(message: string): void }) {
  const result = await createDefaultQtiToPieRegistry().transform({
    interactionType: 'selectPointInteraction',
    qtiXml,
    itemId: 'sample',
    assessmentItem: parse(qtiXml).getElementsByTagName('assessmentItem')[0],
    ...(logger ? { logger } : {}),
  });
  return result.content.config.models[0];
}

describe('selectPointInteraction routing', () => {
  /**
   * The regression this file exists for. `selectPointInteraction` was registered to
   * `builtin.select-text`, whose transformer reads `hottextInteraction` and nothing else, so a
   * graphing item failed with advice to add `<hottext>` markup — and since a plain `Error` is
   * not caught per item, it aborted the whole package.
   */
  test('does not route to the select-text handler', () => {
    const registry = createDefaultQtiToPieRegistry();

    expect(registry.getHandlerForInteraction('selectPointInteraction')?.id).toBe(
      'builtin.select-point'
    );
    expect(registry.getHandlerForInteraction('hottextInteraction')?.id).toBe('builtin.select-text');
    expect(registry.getHandler('builtin.select-text')?.interactionTypes).toEqual([
      'hottextInteraction',
    ]);
  });

  test('declares the three PIE elements it can produce', () => {
    expect(createDefaultQtiToPieRegistry().getHandler('builtin.select-point')?.pieElements).toEqual(
      ['@pie-element/number-line', '@pie-element/charting', '@pie-element/graphing']
    );
  });
});

describe('numberLine to @pie-element/number-line', () => {
  const item = selectPointItem({
    className: 'numberLine',
    params: [
      ['minValue', '4'],
      ['maxValue', '6'],
      ['stepValue', '0.1'],
      ['labelStepValue', '1'],
      ['title', 'Tenths'],
      ['availableTools', 'PF,LFF'],
    ],
    correctResponses: ['{"type": "point", "domainPosition": 5.4}'],
  });

  test('maps config onto the graph and passes the answer key through', async () => {
    const model = await convert(item);

    expect(model.element).toContain('number-line');
    expect(model.graph.domain).toEqual({ min: 4, max: 6 });
    expect(model.graph.ticks).toEqual({ minor: 0.1, tickIntervalType: 'Decimal', major: 1 });
    expect(model.graph.title).toBe('Tenths');
    // availableTools carries PIE's own tool codes, so they become availableTypes directly.
    expect(model.graph.availableTypes).toEqual({ PF: true, LFF: true });
    expect(model.graph.initialType).toBe('PF');
    expect(model.graph.maxNumberOfPoints).toBe(1);
  });

  /**
   * The source omits `pointType`; `number-line`'s `toPointType` reads `pointType[0]` when
   * deriving tool codes, so passing the response through untouched would break that derivation.
   */
  test('defaults a point response with no pointType to full', async () => {
    expect((await convert(item)).correctResponse).toEqual([
      { type: 'point', domainPosition: 5.4, pointType: 'full' },
    ]);
  });

  test('leaves line and ray responses exactly as authored', async () => {
    const model = await convert(
      selectPointItem({
        className: 'numberLine',
        params: [['availableTools', 'LFF,REP']],
        correctResponses: [
          '{"type": "line", "domainPosition": 0.5, "size": 0.1, "leftPoint": "full", "rightPoint": "empty"}',
          '{"type": "ray", "domainPosition": 0.5, "pointType": "empty", "direction": "positive"}',
        ],
      })
    );

    expect(model.correctResponse).toEqual([
      {
        type: 'line',
        domainPosition: 0.5,
        size: 0.1,
        leftPoint: 'full',
        rightPoint: 'empty',
      },
      { type: 'ray', domainPosition: 0.5, pointType: 'empty', direction: 'positive' },
    ]);
  });

  /**
   * `maxChoices="0"` is QTI for unlimited. Emitting `0` would tell the element no points are
   * allowed, so the field is left off and the element's own default stands.
   */
  test('omits maxNumberOfPoints when maxChoices is unlimited', async () => {
    const model = await convert(
      selectPointItem({ className: 'numberLine', maxChoices: '0', correctResponses: [] })
    );

    expect(model.graph?.maxNumberOfPoints).toBeUndefined();
  });
});

describe('chart to @pie-element/charting', () => {
  const item = selectPointItem({
    className: 'chart',
    params: [
      ['chartType', 'linePlot'],
      ['minValue', '0'],
      ['maxValue', '5'],
      ['stepValue', '1'],
      ['labelStepValue', '1'],
      ['chartTitle', 'Miles Run'],
      ['xAxisTitle', 'Distance'],
      ['yAxisTitle', 'Days'],
      ['addCategoryEnabled', 'false'],
      ['category', '{"label": "1", "initialValue": 0, "interactive": true}'],
      ['category', '{"label": "1 1/4", "initialValue": 0, "interactive": true}'],
    ],
    correctResponses: ['{"label": "1", "value": 2}', '{"label": "1 1/4", "value": 1}'],
  });

  test('maps axes, chart type, and the add-category flag', async () => {
    const model = await convert(item);

    expect(model.element).toContain('charting');
    expect(model.chartType).toBe('linePlot');
    expect(model.title).toBe('Miles Run');
    expect(model.domain).toEqual({ label: 'Distance' });
    expect(model.range).toEqual({ label: 'Days', min: 0, max: 5, step: 1, labelStep: 1 });
    expect(model.addCategoryEnabled).toBe(false);
  });

  /** The source calls the starting height `initialValue`; charting's `data` calls it `value`. */
  test('renames category initialValue to value and keeps the rest', async () => {
    expect((await convert(item)).data).toEqual([
      { label: '1', interactive: true, value: 0 },
      { label: '1 1/4', interactive: true, value: 0 },
    ]);
  });

  test('puts the answer key under correctAnswer.data', async () => {
    expect((await convert(item)).correctAnswer).toEqual({
      data: [
        { label: '1', value: 2 },
        { label: '1 1/4', value: 1 },
      ],
    });
  });
});

describe('graph to @pie-element/graphing', () => {
  const item = selectPointItem({
    className: 'graph',
    maxChoices: '0',
    params: [
      ['gridWidthInPixels', '600'],
      ['gridHeightInPixels', '600'],
      ['chartTitle', 'Pizza Prices'],
      ['availableTools', 'line,ray,segment'],
      ['xAxisTitleBottom', 'Toppings'],
      ['xAxisMinValue', '0'],
      ['xAxisMaxValue', '10'],
      ['xAxisStepValue', '2'],
      ['yAxisTitleLeft', 'Price'],
      ['yAxisMinValue', '0'],
      ['yAxisMaxValue', '20'],
      ['yAxisStepValue', '2'],
    ],
    correctResponses: ['{"type": "ray", "from": {"x": 0, "y": 10}, "to": {"x": 10, "y": 16}}'],
  });

  test('maps grid size, axes, and tools', async () => {
    const model = await convert(item);

    expect(model.element).toContain('graphing');
    expect(model.title).toBe('Pizza Prices');
    expect(model.graph).toEqual({ width: 600, height: 600 });
    expect(model.domain).toEqual({ min: 0, max: 10, step: 2, labelStep: 2, axisLabel: 'Toppings' });
    expect(model.range).toEqual({ min: 0, max: 20, step: 2, labelStep: 2, axisLabel: 'Price' });
    expect(model.toolbarTools).toEqual(['line', 'ray', 'segment']);
  });

  test('carries marks into answers.correctAnswer unchanged', async () => {
    expect((await convert(item)).answers).toEqual({
      correctAnswer: {
        name: 'Correct Answer',
        marks: [{ type: 'ray', from: { x: 0, y: 10 }, to: { x: 10, y: 16 } }],
      },
    });
  });

  test.each([
    ['point', '{"type": "point", "x": -9, "y": 9}'],
    [
      'polygon',
      '{"type": "polygon", "points": [{"x": -7, "y": 1}, {"x": -2, "y": 6}], "closed": true}',
    ],
    ['circle', '{"type": "circle", "root": {"x": 6, "y": 7}, "edge": {"x": 8, "y": 5}}'],
    ['sine', '{"type": "sine", "root": {"x": -9, "y": -5}, "edge": {"x": -7, "y": -3}}'],
  ])('preserves a %s mark verbatim', async (_type, value) => {
    const model = await convert(selectPointItem({ className: 'graph', correctResponses: [value] }));

    expect(model.answers.correctAnswer.marks).toEqual([JSON.parse(value)]);
  });

  /**
   * PIE's graphing `domain`/`range` carry a single `axisLabel` each, so the source's second
   * labels have no home. They must be reported rather than vanish.
   */
  test('logs config that has no PIE target instead of dropping it silently', async () => {
    const warnings: string[] = [];
    await convert(
      selectPointItem({
        className: 'graph',
        params: [
          ['xAxisTitleBottom', 'Bottom Label'],
          ['xAxisTitleTop', 'Top Label'],
          ['yAxisTitleRight', 'Right Label'],
        ],
      }),
      { warn: (message) => warnings.push(message) }
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('xAxisTitleTop');
    expect(warnings[0]).toContain('yAxisTitleRight');
    expect(warnings[0]).not.toContain('xAxisTitleBottom');
  });

  test('stays quiet when every declared param is mapped', async () => {
    const warnings: string[] = [];
    await convert(item, { warn: (message) => warnings.push(message) });

    expect(warnings).toEqual([]);
  });
});

describe('unsupported select-point shapes', () => {
  test('a bare selectPointInteraction reports graphic point selection, not missing markup', async () => {
    const attempt = convert(selectPointItem({}));

    await expect(attempt).rejects.toThrow(/Unsupported QTI interaction: selectPointInteraction/);
    await expect(attempt).rejects.toThrow(/point on an image/);
    // The old failure sent reviewers looking for text-selection markup to add.
    await expect(attempt).rejects.not.toThrow(/hottext/i);
    await expect(attempt).rejects.not.toThrow(/Missing required/);
  });

  test('an unrecognized class fails closed and names what it saw', async () => {
    const attempt = convert(
      selectPointItem({ className: 'somethingNew', params: [['minValue', '0']] })
    );

    await expect(attempt).rejects.toThrow(/Unrecognized class "somethingNew"/);
    await expect(attempt).rejects.toThrow(/Configuration observed: minValue/);
  });
});

describe('select-point config reading', () => {
  test('reads the vendor class and its distinct config keys', () => {
    const description = describeSelectPointInteraction(
      selectPointItem({
        className: 'numberLine',
        params: [
          ['minValue', '4'],
          ['maxValue', '6'],
        ],
      })
    );

    expect(description.className).toBe('numberLine');
    expect(description.vendorClass?.pieElement).toBe('@pie-element/number-line');
    expect(description.configParams).toEqual(['minValue', 'maxValue']);
  });

  /**
   * These shapes express a list by repeating a key: a `chart` with nine categories declares nine
   * `category` params. Repeating the name nine times buries the other keys.
   */
  test('collapses a repeated config key', () => {
    const description = describeSelectPointInteraction(
      selectPointItem({
        className: 'chart',
        params: [
          ['chartType', 'bar'],
          ['category', '{}'],
          ['category', '{}'],
        ],
      })
    );

    expect(description.configParams).toEqual(['chartType', 'category']);
  });

  test('an unrecognized class is reported as declared, not treated as known', () => {
    const description = describeSelectPointInteraction(selectPointItem({ className: 'nope' }));

    expect(description.vendorClass).toBeUndefined();
    expect(selectPointUnsupportedDetails(description)).toContain('Unrecognized class');
  });

  test('reads the specific element when the planner supplies one', () => {
    const composite = `<assessmentItem><itemBody>
        <selectPointInteraction class="chart"><object><param name="chartType" value="bar"/></object></selectPointInteraction>
        <selectPointInteraction class="graph"><object><param name="availableTools" value="point"/></object></selectPointInteraction>
      </itemBody></assessmentItem>`;
    const second = parse(composite).getElementsByTagName('selectPointInteraction')[1];

    expect(describeSelectPointInteraction(composite, second).className).toBe('graph');
    expect(describeSelectPointInteraction(composite).className).toBe('chart');
  });

  /**
   * `1/10` and `0.1` are the same number written differently, and PIE keeps the distinction in
   * `tickIntervalType`, so it has to come from the literal rather than the value.
   */
  test.each([
    ['1', 1, 'Integer'],
    ['0.1', 0.1, 'Decimal'],
    ['1/10', 0.1, 'Fraction'],
    ['1/2', 0.5, 'Fraction'],
  ] as const)('reads tick interval %s as %p (%s)', (raw, value, tickIntervalType) => {
    expect(parseTickInterval(raw)).toEqual({ value, tickIntervalType });
  });

  test.each([[undefined], [''], ['  '], ['abc'], ['1/0']])(
    'reports no tick interval for %p',
    (raw) => {
      expect(parseTickInterval(raw)).toBeUndefined();
    }
  );
});
